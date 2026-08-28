const toggle = document.getElementById("toggle");
const status = document.getElementById("status");
const note = document.getElementById("note");
const showAiModeTabToggle = document.getElementById("showAiModeTab");
const substatus = document.getElementById("substatus");
const bypassSection = document.getElementById("bypassSection");
const bypassButton = document.getElementById("bypass");
const bypassStatus = document.getElementById("bypassStatus");

// Must match BYPASS_PARAM in background.js and content.js.
const BYPASS_PARAM = "show_ai_overview";

function render(enabled) {
  toggle.checked = enabled;
  status.textContent = enabled
    ? "Google searches will skip AI Overviews and AI Mode."
    : "Off — Google's normal AI results will show.";
}

function renderNote({ ruleError, lastFallbackTrigger } = {}) {
  if (ruleError) {
    note.textContent = "Couldn't apply the filter rule — try reloading the extension.";
    return;
  }
  const dayMs = 24 * 60 * 60 * 1000;
  if (lastFallbackTrigger && Date.now() - lastFallbackTrigger < dayMs) {
    const mins = Math.round((Date.now() - lastFallbackTrigger) / 60000);
    const when = mins < 1 ? "just now" : `${mins} min ago`;
    note.textContent = `Backup filter caught something ${when} — Google may have changed something.`;
    return;
  }
  note.textContent = "";
}

function renderShowAiModeTab(showAiModeTab) {
  showAiModeTabToggle.checked = showAiModeTab === true;
  substatus.textContent = showAiModeTab === true
    ? "Google's \"AI Mode\" tab will appear on results pages."
    : "Hidden by default, so there's nothing to click into.";
}

// --- per-search bypass --------------------------------------------------
//
// This used to be an injected banner on every results page. It lives here
// now: the same one-search escape hatch, but only visible when the user
// deliberately opens the popup, rather than sitting over the SERP whether
// or not it was wanted. See content.js's header comment.
//
// Reading tab.url needs either the "tabs" permission or a host permission
// matching that tab. The manifest's host_permissions cover Google search
// pages, so no permission increase is required — but that is exactly the
// kind of thing that has to be confirmed in a real browser, not assumed.
// If tab.url comes back undefined the control degrades to a disabled
// state with an explanation instead of failing silently.

function isGoogleSearchUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch (e) {
    return false;
  }
  const host = url.hostname;
  return (host === "www.google.com" || host === "google.com")
    && url.pathname === "/search";
}

// Same query, minus udm (so Google serves the default tab, which can
// include AI Overview), plus this session's bypass token, matching the
// allow rule in background.js. Keeps the tab's own origin (www. or bare
// apex) rather than assuming one.
function buildShowAiUrl(rawUrl, token) {
  const url = new URL(rawUrl);
  url.searchParams.delete("udm");
  url.searchParams.set(BYPASS_PARAM, token);
  return `${url.origin}/search?${url.searchParams.toString()}`;
}

function isAlreadyBypassed(rawUrl, token) {
  try {
    return new URL(rawUrl).searchParams.get(BYPASS_PARAM) === token;
  } catch (e) {
    return false;
  }
}

function setBypass({ visible, enabled = false, message = "", href = null }) {
  bypassSection.hidden = !visible;
  bypassButton.disabled = !enabled;
  bypassButton.dataset.href = href || "";
  bypassStatus.textContent = message;
}

async function renderBypass(extensionEnabled) {
  // With the filter off, Google's AI results already show — there is
  // nothing to bypass, so the control isn't shown at all.
  if (!extensionEnabled) {
    setBypass({ visible: false });
    return;
  }

  const { bypassToken } = await chrome.storage.local.get("bypassToken");
  if (!bypassToken) {
    setBypass({
      visible: true,
      message: "Not ready yet — try reloading the extension."
    });
    return;
  }

  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (e) {
    tab = null;
  }

  if (!tab || !tab.url || !isGoogleSearchUrl(tab.url)) {
    setBypass({
      visible: true,
      message: "Open a Google search to use this."
    });
    return;
  }

  if (isAlreadyBypassed(tab.url, bypassToken)) {
    setBypass({
      visible: true,
      message: "Already showing AI results for this search."
    });
    return;
  }

  setBypass({
    visible: true,
    enabled: true,
    href: buildShowAiUrl(tab.url, bypassToken),
    message: "Reloads this one search with AI results. Your next search stays filtered."
  });
}

bypassButton.addEventListener("click", async () => {
  const href = bypassButton.dataset.href;
  if (!href) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  await chrome.tabs.update(tab.id, { url: href });
  window.close();
});

// --- init ---------------------------------------------------------------

chrome.storage.local.get(
  ["enabled", "ruleError", "lastFallbackTrigger", "showAiModeTab"],
  (result) => {
    const enabled = result.enabled !== false;
    render(enabled);
    renderNote(result);
    renderShowAiModeTab(result.showAiModeTab);
    renderBypass(enabled);
  }
);

toggle.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: toggle.checked });
  render(toggle.checked);
  renderBypass(toggle.checked);
});

showAiModeTabToggle.addEventListener("change", () => {
  chrome.storage.local.set({ showAiModeTab: showAiModeTabToggle.checked });
  renderShowAiModeTab(showAiModeTabToggle.checked);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if ("ruleError" in changes || "lastFallbackTrigger" in changes) {
    chrome.storage.local.get(["ruleError", "lastFallbackTrigger"], renderNote);
  }
});
