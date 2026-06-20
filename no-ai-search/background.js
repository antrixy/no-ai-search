// Forces every Google Search navigation to include "udm=14" (Google's
// "Web" filter), which bypasses AI Overviews and AI Mode at the source —
// no DOM-guessing required. This only touches top-level page loads
// (typing in the address bar, clicking a link), not the page's internal
// AJAX requests, so it won't break the page itself.
//
// Domain coverage: www.google.com and the bare google.com apex, not a
// list of country domains. Google retired country-code search domains
// (google.co.uk, google.de, etc.) in 2025 and now redirects all of them
// to google.com — so this covers the actual traffic without needing an
// enumerated, ever-changing ccTLD list. The one gap this doesn't close:
// if that redirect hasn't rolled out yet in some region, or is reversed
// in the future, this extension won't catch a ccTLD search directly.
//
// The bare apex needs its own condition shape rather than just adding
// "google.com" to requestDomains: requestDomains cascades to every
// subdomain of whatever's listed (mail.google.com, drive.google.com,
// support.google.com, ...), some of which have their own "/search?"
// paths for entirely unrelated, in-product search. The "|" in the bare
// rule's urlFilter anchors to the exact start of the URL instead, so it
// only ever matches "https://google.com/search?...", nothing wider.
//
// This isn't assumed to be bulletproof: content.js is a lightweight
// backstop for cases this redirect can't cover (Google changing
// behavior), and reports back here if it ever has to step in, so
// failures surface in the popup instead of silently degrading. The
// in-page "AI Mode" tab is handled differently — content.js hides that
// tab preventatively rather than reacting to it, since (after testing)
// nothing reachable from this extension can observe that transition
// happening at all. See content.js's header comment for the full story.
//
// content.js also adds a "Show AI Overview for this search" link on
// every results page, for people who want to see it for one specific
// query without turning the extension off. That link points at the
// same query with udm removed and a marker param attached. The bypass
// rules below exist only to let that one request through unmodified —
// each has higher priority than its matching redirect rule, so Chrome
// picks it over the redirect for any request carrying the marker, and
// ignores it (so the redirect applies as normal) for everything else.
//
// The marker's value is a random token regenerated each session (on
// install and on browser startup), not a fixed string — so a bypass
// link only works for the session it was created in, not indefinitely.
//
// Safe-vertical allowlist: the redirect rules above match every
// "/search?" request and force udm=14 onto it, which is correct for the
// default search experience (where AI Overview shows) and for AI Mode
// (udm=50), but is too broad as written — it also overwrites the udm
// value when someone explicitly clicks a different tab like Images
// (udm=2) or Videos (udm=7), incorrectly bouncing them back to Web
// results. SAFE_VERTICAL_UDM_VALUES below is an allowlist of known
// non-AI tab codes; a higher-priority "allow" rule lets those requests
// through untouched, while anything not on the list (missing udm, or
// udm=50) still gets redirected. These codes are not officially
// documented by Google — this list is reverse-engineered and could be
// incomplete or go stale if Google adds a new tab. Deliberately an
// allowlist rather than a blocklist of just "50": an unrecognized future
// vertical defaults to being redirected to Web (a UX annoyance, fixed by
// adding its code here) rather than defaulting to being left alone (a
// gap that could let a future AI feature through unblocked) — the safer
// failure direction for what this extension is for.

const SAFE_VERTICAL_UDM_VALUES = [2, 6, 7, 12, 15, 18, 28, 36, 37, 44, 48];

const RULE_ID = 1;
const RULE_ID_BARE = 3;
const BYPASS_RULE_ID = 2;
const BYPASS_RULE_ID_BARE = 4;
const SAFE_VERTICAL_RULE_ID = 5;
const SAFE_VERTICAL_RULE_ID_BARE = 6;
const ALL_RULE_IDS = [
  RULE_ID, RULE_ID_BARE,
  BYPASS_RULE_ID, BYPASS_RULE_ID_BARE,
  SAFE_VERTICAL_RULE_ID, SAFE_VERTICAL_RULE_ID_BARE
];
// Must match BYPASS_PARAM in content.js. The value paired with this key
// is the current session's token, read from storage.local.bypassToken.
const BYPASS_PARAM = "show_ai_overview";

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildRule() {
  return {
    id: RULE_ID,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        transform: {
          queryTransform: {
            addOrReplaceParams: [{ key: "udm", value: "14" }]
          }
        }
      }
    },
    condition: {
      // requestDomains is hash-matched natively; pairing it with a short
      // path-only urlFilter means Chrome never runs the pattern matcher
      // against anything outside www.google.com in the first place.
      requestDomains: ["www.google.com"],
      urlFilter: "/search?",
      requestMethods: ["get"],
      resourceTypes: ["main_frame"]
    }
  };
}

function buildBareRule() {
  return {
    id: RULE_ID_BARE,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        transform: {
          queryTransform: {
            addOrReplaceParams: [{ key: "udm", value: "14" }]
          }
        }
      }
    },
    condition: {
      // Deliberately not requestDomains: ["google.com"] — see header
      // comment. The single "|" anchors to the exact start of the URL.
      urlFilter: "|https://google.com/search?",
      requestMethods: ["get"],
      resourceTypes: ["main_frame"]
    }
  };
}

function buildBypassRule(token) {
  return {
    id: BYPASS_RULE_ID,
    priority: 2, // higher than RULE_ID, so this wins whenever both match
    action: { type: "allow" },
    condition: {
      requestDomains: ["www.google.com"],
      urlFilter: `/search?*${BYPASS_PARAM}=${token}`,
      requestMethods: ["get"],
      resourceTypes: ["main_frame"]
    }
  };
}

function buildBareBypassRule(token) {
  return {
    id: BYPASS_RULE_ID_BARE,
    priority: 2,
    action: { type: "allow" },
    condition: {
      urlFilter: `|https://google.com/search?*${BYPASS_PARAM}=${token}`,
      requestMethods: ["get"],
      resourceTypes: ["main_frame"]
    }
  };
}

// "(?:.*&)?udm=(2|6|...)(?:&|$)" — matches udm=<value> only at an actual
// parameter boundary, whether udm is the first param (right after "?")
// or a later one (after "&"), and not as a substring inside a longer
// value or a different parameter name (e.g. won't match "udm=28" when
// looking for "2", or "xudm=2"). RE2 (used by declarativeNetRequest)
// doesn't support lookahead, so this is a plain alternation + optional
// prefix rather than a negative check.
function buildSafeVerticalRegex() {
  return `(?:.*&)?udm=(${SAFE_VERTICAL_UDM_VALUES.join("|")})(?:&|$)`;
}

function buildSafeVerticalAllowRule() {
  return {
    id: SAFE_VERTICAL_RULE_ID,
    priority: 2, // higher than RULE_ID, so this wins whenever both match
    action: { type: "allow" },
    condition: {
      requestDomains: ["www.google.com"],
      regexFilter: `^https://www\\.google\\.com/search\\?${buildSafeVerticalRegex()}`,
      requestMethods: ["get"],
      resourceTypes: ["main_frame"]
    }
  };
}

function buildBareSafeVerticalAllowRule() {
  return {
    id: SAFE_VERTICAL_RULE_ID_BARE,
    priority: 2,
    action: { type: "allow" },
    condition: {
      regexFilter: `^https://google\\.com/search\\?${buildSafeVerticalRegex()}`,
      requestMethods: ["get"],
      resourceTypes: ["main_frame"]
    }
  };
}

async function applyState(enabled, token) {
  try {
    if (enabled) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ALL_RULE_IDS,
        addRules: [
          buildRule(), buildBareRule(),
          buildBypassRule(token), buildBareBypassRule(token),
          buildSafeVerticalAllowRule(), buildBareSafeVerticalAllowRule()
        ]
      });
    } else {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ALL_RULE_IDS
      });
    }
    await chrome.storage.local.remove("ruleError");
  } catch (err) {
    console.error("No AI Search: failed to update redirect rule", err);
    await chrome.storage.local.set({
      ruleError: { message: String(err), at: Date.now() }
    });
  }
}

async function init() {
  const { enabled = true } = await chrome.storage.local.get("enabled");
  // A fresh token each time the session starts (install/browser startup)
  // — any bypass link from a previous session stops working here.
  const token = generateToken();
  await chrome.storage.local.set({ bypassToken: token });
  await applyState(enabled, token);
}

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === "local" && "enabled" in changes) {
    // Reuse this session's existing token — toggling on/off shouldn't
    // invalidate a bypass link someone already has open.
    const { bypassToken } = await chrome.storage.local.get("bypassToken");
    applyState(changes.enabled.newValue, bypassToken);
  }
});

// content.js reports here if it ever has to hide AI content itself —
// meaning the redirect rule didn't fully do the job for that page.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "ai_content_detected") {
    chrome.storage.local.set({ lastFallbackTrigger: Date.now() });
  }
});
