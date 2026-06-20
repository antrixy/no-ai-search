// Backstop for the redirect rule in background.js. The redirect does the
// real work; this exists for two things: (1) Google quietly weakening or
// changing how udm=14 behaves, and (2) a "Show AI Overview for this
// search" link, so AI Overview isn't an all-or-nothing setting — you can
// ask for it on a single query without turning the extension off.
//
// The in-page "AI Mode" tab's destination page is handled separately, in
// background.js via chrome.tabs.onUpdated — except that approach turned
// out not to work either. Across three different architectural layers —
// MutationObserver here, declarativeNetRequest, and chrome.tabs.onUpdated
// — none of them ever observe this transition happening, even though the
// address bar visibly changes to udm=50. That's strong evidence this
// isn't reachable through any extension API available here, possibly a
// deeper Chrome/Google integration rather than a normal page navigation.
//
// So instead of catching the destination, AI_MODE_TAB_PATTERNS below hides
// the clickable tab itself, preventing the click rather than reacting to
// it. This is a real but bounded mitigation: it stops the obvious path
// (clicking the visible tab), not every path — someone who manually
// navigates to a udm=50 URL would still reach it, since (as established
// above) nothing here can detect or correct that.
//
// Detection strategy: SELECTORS below are internal Google attributes
// (data-attrid, jsname, etc.) that may or may not match what Google
// currently ships — these get renamed often, so treat them as a cheap
// first check, not the primary mechanism. The more durable approach is
// HEADING_TEXT_PATTERNS: Google's AI Overview/AI Mode panels carry a
// visible role="heading" label ("AI Overview", "Mode IA", etc.), and
// that's matched directly, then climbed up to the nearest ancestor
// carrying a data-hveid attribute — a marker Google uses broadly across
// the results page to demarcate individual result blocks, not something
// AI-specific, which makes it a more stable anchor than guessing at
// AI-specific internals. If no such ancestor exists, a fixed number of
// parent levels is climbed instead, as a safety net.
//
// HEADING_TEXT_PATTERNS confidence by language: English, French, German,
// and Portuguese strings were confirmed directly against Google's own
// Search Help pages at the time this was written. The Spanish patterns
// are intentionally looser — Google's own help pages used inconsistent
// phrasing for "AI Overview" across different versions/dates, so there
// wasn't one confirmed literal string to match exactly. Any language not
// listed falls back to the attribute-based SELECTORS only.

const SELECTORS = [
  'div[data-attrid="AIOverview"]',
  'div[jsname="N760b"]',
  '[aria-label="AI Overview"]',
  '[aria-label*="AI Mode" i]'
  // A previous "bard" substring selector was removed here: it did a
  // loose case-insensitive substring match on an obfuscated Google
  // attribute, which risked false-matching unrelated elements whose
  // values happened to contain that substring coincidentally. The
  // heading-text detection below is the real detection mechanism now;
  // these are just a cheap first check against a couple of exact,
  // specific attribute values.
];

const HEADING_TEXT_PATTERNS = [
  /^AI (Overview|Mode)\b/i, // English
  /Aperçus? .*IA/i, /\bMode IA\b/i, // French
  /KI-Übersicht/i, /Übersicht mit KI/i, /KI-Modus/i, // German
  /Visão Geral.*IA/i, /\bModo IA\b/i, // Portuguese
  /Visión general.*IA/i, /\bVista.*IA\b/i // Spanish — lower confidence, see note above
];

function isAiHeadingText(text) {
  return HEADING_TEXT_PATTERNS.some((re) => re.test(text));
}

// Exact-match patterns for the tab label itself, not the panel heading —
// deliberately anchored with ^...$ rather than the looser partial-match
// patterns above, so this only ever matches a short standalone tab label
// ("AI Mode") and never a longer sentence that happens to contain those
// words. Same per-language confidence notes as HEADING_TEXT_PATTERNS.
const AI_MODE_TAB_PATTERNS = [
  /^AI Mode$/i, // English
  /^Mode IA$/i, // French
  /^KI-Modus$/i, // German
  /^Modo IA$/i // Portuguese & Spanish (same string in both)
];

function isAiModeTabText(text) {
  return AI_MODE_TAB_PATTERNS.some((re) => re.test(text));
}

// Must match BYPASS_PARAM in background.js.
const BYPASS_PARAM = "show_ai_overview";
const BANNER_ID = "no-ai-search-banner";

let observer = null;
let reported = false;

function hide(node) {
  if (node.style.display !== "none") {
    node.style.setProperty("display", "none", "important");
  }
  // Tell background.js the redirect didn't fully do its job here, so the
  // popup can surface that instead of silently degrading. Only once per
  // page — this is a signal, not a counter.
  if (!reported) {
    reported = true;
    chrome.runtime.sendMessage({ type: "ai_content_detected" }).catch(() => {});
  }
}

// Fallback when no data-hveid ancestor exists: climb a fixed number of
// parent levels so the whole module gets hidden, not just the heading
// text itself (which would leave an empty box behind).
function climbFixed(node, levels) {
  let el = node;
  for (let i = 0; i < levels && el.parentElement; i++) {
    el = el.parentElement;
  }
  return el;
}

// Finds AI Overview/AI Mode panels by their visible heading text rather
// than internal attributes — see header comment for why. Checks root
// itself plus all descendants, so it works whether called with a whole
// page or a single newly-added node.
function scanForHeadings(root) {
  const containers = [];
  const check = (el) => {
    if (!el.getAttribute || el.getAttribute("role") !== "heading") return;
    const text = (el.textContent || "").trim();
    if (!isAiHeadingText(text)) return;
    const container = el.closest("[data-hveid]") || climbFixed(el, 6);
    if (container) containers.push(container);
  };
  check(root);
  try {
    root.querySelectorAll('[role="heading"]').forEach(check);
  } catch (e) {
    // root isn't a queryable element (e.g. a text node slipped through) — skip
  }
  return containers;
}

// Whether to hide the "AI Mode" tab — true by default (matches the rest
// of the extension's filtering), but the user can opt to show it instead
// from the popup. Read once at init and kept in sync via the storage
// listener at the bottom of this file, rather than re-reading storage on
// every call, since hideAiModeTab/revealAiModeTab run synchronously
// inside the MutationObserver callback.
let showAiModeTabSetting = false;
const HIDDEN_TAB_MARKER = "data-noaisearch-hidden-tab";

// Finds and hides the clickable "AI Mode" tab itself — see header
// comment for why this preventative approach exists instead of reacting
// to the tab after it's clicked. Checks anchors and tab/link-role
// elements for an exact text match (not scanForHeadings's reported
// hide(), since this isn't "AI content slipped through," it's normal,
// expected operation — no need to alarm the user via the popup note).
// The original href is stashed in a data attribute before being removed,
// so revealAiModeTab() can fully restore the element later if the user
// opts to show the tab — this needs to be reversible, not just hidden.
function hideAiModeTab(root) {
  if (showAiModeTabSetting) return;
  const candidates = [];
  const check = (el) => {
    if (el.hasAttribute(HIDDEN_TAB_MARKER)) return; // already handled
    const text = (el.textContent || "").trim();
    if (!isAiModeTabText(text)) return;
    candidates.push(el);
  };
  if (root.matches && root.matches('a, [role="link"], [role="tab"]')) check(root);
  try {
    root.querySelectorAll('a, [role="link"], [role="tab"]').forEach(check);
  } catch (e) {
    return;
  }
  candidates.forEach((el) => {
    el.setAttribute(HIDDEN_TAB_MARKER, "1");
    if (el.hasAttribute("href")) {
      el.dataset.noaisearchHref = el.getAttribute("href");
      el.removeAttribute("href");
    }
    el.style.setProperty("display", "none", "important");
    el.style.pointerEvents = "none";
  });
}

// Undoes hideAiModeTab() for every tab currently hidden on this page —
// used when the user flips the "show AI Mode tab" setting on, so it
// takes effect immediately instead of only on the next page load.
function revealAiModeTab() {
  document.querySelectorAll(`[${HIDDEN_TAB_MARKER}]`).forEach((el) => {
    if (el.dataset.noaisearchHref) {
      el.setAttribute("href", el.dataset.noaisearchHref);
      delete el.dataset.noaisearchHref;
    }
    el.style.removeProperty("display");
    el.style.removeProperty("pointer-events");
    el.removeAttribute(HIDDEN_TAB_MARKER);
  });
}

// One full pass at load, in case AI content was already in the initial
// HTML (e.g. the redirect rule didn't fire for this particular request).
function initialScan() {
  for (const sel of SELECTORS) {
    let nodes;
    try {
      nodes = document.querySelectorAll(sel);
    } catch (e) {
      continue; // selector syntax unsupported in this browser, skip it
    }
    nodes.forEach(hide);
  }
  scanForHeadings(document).forEach(hide);
  hideAiModeTab(document);
}

// After the initial pass, only inspect nodes that are actually added by
// a mutation — no re-scanning the whole document on every DOM change.
function handleMutations(records) {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      for (const sel of SELECTORS) {
        try {
          if (node.matches(sel)) {
            hide(node);
          } else {
            node.querySelectorAll(sel).forEach(hide);
          }
        } catch (e) {
          continue;
        }
      }
      scanForHeadings(node).forEach(hide);
      hideAiModeTab(node);
    }
  }
}

function startObserving() {
  if (observer) return;
  observer = new MutationObserver(handleMutations);
  observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserving() {
  if (!observer) return;
  observer.disconnect();
  observer = null;
}

// Same query, minus udm (so Google serves the default tab, which can
// include AI Overview), plus this session's bypass token, matching the
// rule in background.js. Uses the current origin (www. or bare apex)
// rather than assuming one, so the link stays on whichever domain the
// page is actually on. Returns null if the token isn't ready yet (e.g.
// content.js loaded in the brief window before background.js's startup
// init() finishes) — caller skips showing the banner then.
async function buildShowAiUrl() {
  const { bypassToken } = await chrome.storage.local.get("bypassToken");
  if (!bypassToken) return null;
  const params = new URLSearchParams(window.location.search);
  params.delete("udm");
  params.set(BYPASS_PARAM, bypassToken);
  return `${window.location.origin}/search?${params.toString()}`;
}

async function injectShowAiBanner() {
  if (document.getElementById(BANNER_ID)) return;
  const href = await buildShowAiUrl();
  if (!href) return;

  const banner = document.createElement("div");
  banner.id = BANNER_ID;
  banner.style.cssText =
    "position:fixed;top:12px;right:12px;z-index:2147483647;" +
    "background:#fff;color:#3c4043;border:1px solid #dadce0;" +
    "border-radius:8px;padding:8px 12px;font:13px/1.4 arial,sans-serif;" +
    "box-shadow:0 1px 3px rgba(0,0,0,.15);display:flex;" +
    "align-items:center;gap:10px;";

  const link = document.createElement("a");
  link.textContent = "Show AI Overview for this search";
  link.href = href;
  link.style.cssText = "color:#1a73e8;text-decoration:none;";

  const close = document.createElement("button");
  close.textContent = "\u00d7";
  close.setAttribute("aria-label", "Dismiss");
  close.style.cssText =
    "background:none;border:none;color:#5f6368;cursor:pointer;" +
    "font-size:16px;line-height:1;padding:0;";
  close.addEventListener("click", () => banner.remove());

  banner.append(link, close);
  document.body.appendChild(banner);
}

function removeShowAiBanner() {
  document.getElementById(BANNER_ID)?.remove();
}

chrome.storage.local.get(["enabled", "showAiModeTab"], (result) => {
  showAiModeTabSetting = result.showAiModeTab === true;
  if (result.enabled !== false) {
    initialScan();
    startObserving();
    injectShowAiBanner();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if ("showAiModeTab" in changes) {
    showAiModeTabSetting = changes.showAiModeTab.newValue === true;
    if (showAiModeTabSetting) {
      revealAiModeTab();
    } else {
      hideAiModeTab(document);
    }
  }

  if ("enabled" in changes) {
    if (changes.enabled.newValue !== false) {
      initialScan();
      startObserving();
      injectShowAiBanner();
    } else {
      stopObserving();
      removeShowAiBanner();
    }
  }
});
