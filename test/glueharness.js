// Harness for driving the real, unmodified extension/panel.js from Node.
//
// panel.js has no exports and touches document/chrome/navigator at module top
// level, so it cannot be imported directly. This installs stubs on globalThis
// before import, then drives the panel through the same event listeners the
// real UI uses.
//
// Two panels = two module instances. ES modules are cached per URL, so each
// instance is loaded with a distinct `?doc=` query string. Storage and the lock
// manager are deliberately SHARED between instances -- that is what makes the
// cross-window scenarios real rather than simulated.

import { pathToFileURL } from "node:url";
import * as path from "node:path";

// ------------------------------------------------------------------ fake DOM

function makeEl(id) {
  const handlers = new Map();
  const el = {
    id,
    textContent: "",
    value: "",
    className: "",
    disabled: false,
    hidden: false,
    children: [],
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, on) { on === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (on ? this._s.add(c) : this._s.delete(c)); },
      contains(c) { return this._s.has(c); },
    },
    addEventListener(type, fn) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(fn);
    },
    append(...kids) { el.children.push(...kids); },
    replaceChildren(...kids) { el.children = kids; },
    // test-only
    dispatch(type, ev = {}) {
      const fns = handlers.get(type) || [];
      return Promise.all(fns.map((f) => f(ev)));
    },
  };
  return el;
}

function makeDocument() {
  const ids = ["scope", "page", "draft", "hint", "save", "search", "list", "empty"];
  const map = new Map(ids.map((i) => [i, makeEl(i)]));
  return {
    getElementById: (id) => map.get(id) ?? makeEl(id),
    createElement: (tag) => makeEl(tag),
    createTextNode: (t) => ({ text: t }),
    _el: map,
  };
}

// -------------------------------------------------- shared fake chrome.storage

export function makeStorage(initial = {}) {
  let data = { ...initial };
  const listeners = [];
  let failNextSet = null; // set to an Error to make one write fail

  return {
    _dump: () => ({ ...data }),
    _set: (k, v) => { data[k] = v; },
    _failNextSet: (err) => { failNextSet = err; },
    _listenerCount: () => listeners.length,
    api: {
      local: {
        async get(k) {
          if (k === null) return { ...data };
          return k in data ? { [k]: data[k] } : {};
        },
        async set(obj) {
          if (failNextSet) { const e = failNextSet; failNextSet = null; throw e; }
          const changes = {};
          for (const [k, v] of Object.entries(obj)) {
            changes[k] = { oldValue: data[k], newValue: v };
            data[k] = v;
          }
          for (const fn of listeners) fn(changes, "local");
        },
        async remove(k) {
          const changes = { [k]: { oldValue: data[k] } };
          delete data[k];
          for (const fn of listeners) fn(changes, "local");
        },
      },
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
  };
}

// ------------------------------------------------------ shared fake Web Locks
//
// Models the parts that matter: exclusive by name, FIFO, and -- critically --
// pending requests can be aborted, which is what a document unload does.

export function makeLockManager() {
  const held = new Set();
  const waiting = new Map(); // name -> [{resolve, reject, fn}]
  let grants = 0;

  function drain(name) {
    if (held.has(name)) return;
    const q = waiting.get(name);
    if (!q || q.length === 0) return;
    const job = q.shift();
    held.add(name);
    grants++;
    Promise.resolve()
      .then(() => job.fn())
      .then(job.resolve, job.reject)
      .finally(() => { held.delete(name); drain(name); });
  }

  return {
    _grants: () => grants,
    _pending: (name) => (waiting.get(name) || []).length,
    // Abort every queued (not yet granted) request -- what unload does.
    _abortPending(name, err = new DOMException("aborted", "AbortError")) {
      const q = waiting.get(name) || [];
      const n = q.length;
      while (q.length) q.shift().reject(err);
      return n;
    },
    api: {
      request(name, fn) {
        return new Promise((resolve, reject) => {
          if (!waiting.has(name)) waiting.set(name, []);
          waiting.get(name).push({ resolve, reject, fn });
          drain(name);
        });
      },
    },
  };
}

// ------------------------------------------------------------- panel instance

let seq = 0;

/**
 * Load one instance of the real panel.js with the given shared services.
 * `tab` is what chrome.tabs.query resolves to for this panel.
 */
export async function loadPanel({ storage, locks, tab }) {
  const doc = makeDocument();
  const tabListeners = { activated: [], updated: [] };

  const chrome = {
    storage: storage.api,
    tabs: {
      query: async () => [tab],
      onActivated: { addListener: (fn) => tabListeners.activated.push(fn) },
      onUpdated: { addListener: (fn) => tabListeners.updated.push(fn) },
    },
  };

  globalThis.document = doc;
  globalThis.chrome = chrome;
  // Node >=21 ships a real read-only `navigator`, so plain assignment fails.
  Object.defineProperty(globalThis, "navigator", {
    value: { locks: locks.api },
    configurable: true,
    writable: true,
  });

  const file = path.resolve("extension/panel.js");
  const url = `${pathToFileURL(file).href}?doc=${++seq}`;
  await import(url);

  return {
    el: doc._el,
    doc,
    tabListeners,
    // Type text into the composer and press Save. Returns the commit promise.
    save(text) {
      doc._el.get("draft").value = text;
      return doc._el.get("save").dispatch("click");
    },
    // Type without saving.
    type(text) {
      doc._el.get("draft").value = text;
      return doc._el.get("draft").dispatch("input");
    },
    list: () => doc._el.get("list").children.length,
    hint: () => doc._el.get("hint").textContent,
    pageLabel: () => doc._el.get("page").textContent,
  };
}
