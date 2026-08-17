// Test rig for content.js — jsdom SERP fixture + chrome API stub.
//
// content.js is a plain script, not a module. It is evaluated inside a fresh
// jsdom window per test so top-level consts don't collide and no state leaks
// between cases.

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Defaults to the shipping file; override with CONTENT_JS=... to run these
// against an older build (see the note in content-state.test.js).
const CONTENT_JS = process.env.CONTENT_JS
  || path.resolve(__dirname, '../no-ai-search/content.js');

// A minimal SERP: an AI Overview panel with a role="heading" label inside a
// data-hveid wrapper (the shape issue-paa-overhide.md confirmed on live
// markup), a neighbouring People-also-ask block that must never be touched,
// and an AI Mode tab in the vertical nav.
function serpHtml({ aiPanel = true, aiPanelPreHidden = false } = {}) {
  const panel = aiPanel ? `
    <div jsname="ZLxsqf" data-hveid="CA8QAA"${aiPanelPreHidden ? ' style="display:none"' : ''}>
      <div role="heading" aria-level="2">AI Overview</div>
      <p>Generated summary text.</p>
    </div>` : '';
  return `<!doctype html><html><body>
    <div id="cnt">
      <nav>
        <a href="/search?q=x&udm=14" role="tab">Web</a>
        <a href="/search?q=x&udm=50" role="tab">AI Mode</a>
        <a href="/search?q=x&udm=2" role="tab">Images</a>
      </nav>
      <div id="search"><div id="rso">
        ${panel}
        <div jsname="N760b" data-hveid="CBAQAA">
          <div role="heading" aria-level="2">People also ask</div>
          <div>What is the most effective way to learn guitar?</div>
        </div>
        <div data-hveid="CBEQAA"><a href="https://example.com">A normal result</a></div>
      </div></div>
    </div>
  </body></html>`;
}

// Records every message content.js sends, so "did it claim the backup filter
// caught something" is directly assertable.
function makeChrome(store) {
  const listeners = [];
  const messages = [];
  const chrome = {
    storage: {
      local: {
        get(keys, cb) {
          const out = {};
          const list = Array.isArray(keys) ? keys : [keys];
          for (const k of list) if (k in store) out[k] = store[k];
          if (cb) cb(out);
          return Promise.resolve(out);
        },
      },
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
    runtime: {
      sendMessage(msg) { messages.push(msg); return Promise.resolve(); },
    },
    // Drives the listeners the way Chrome would.
    __fire(changes) {
      for (const k of Object.keys(changes)) store[k] = changes[k].newValue;
      for (const fn of listeners) fn(changes, 'local');
    },
    __messages: messages,
  };
  return chrome;
}

function load({ url = 'https://www.google.com/search?q=learn+guitar', store = {}, dom = {} } = {}) {
  const jsdom = new JSDOM(serpHtml(dom), { url, runScripts: 'outside-only' });
  const { window } = jsdom;
  const chrome = makeChrome({ enabled: true, showAiModeTab: false, bypassToken: 'tok123', ...store });
  window.chrome = chrome;
  window.eval(fs.readFileSync(CONTENT_JS, 'utf8'));
  return { window, document: window.document, chrome };
}

// --- assertions helpers -------------------------------------------------
const q = (d, sel) => d.querySelector(sel);
const aiPanel = (d) => q(d, 'div[jsname="ZLxsqf"]');
const paaBlock = (d) => q(d, 'div[jsname="N760b"]');
const aiModeTab = (d) => [...d.querySelectorAll('a[role="tab"], a[data-noaisearch-hidden-tab]')]
  .find((a) => (a.textContent || '').trim() === 'AI Mode');

const isHidden = (el) => !!el && el.style.display === 'none';
const reported = (chrome) => chrome.__messages.some((m) => m.type === 'ai_content_detected');
const flush = () => new Promise((r) => setImmediate(r));

module.exports = { load, aiPanel, paaBlock, aiModeTab, isHidden, reported, flush, CONTENT_JS };
