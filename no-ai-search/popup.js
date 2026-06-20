const toggle = document.getElementById("toggle");
const status = document.getElementById("status");
const note = document.getElementById("note");
const showAiModeTabToggle = document.getElementById("showAiModeTab");
const substatus = document.getElementById("substatus");

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

chrome.storage.local.get(
  ["enabled", "ruleError", "lastFallbackTrigger", "showAiModeTab"],
  (result) => {
    render(result.enabled !== false);
    renderNote(result);
    renderShowAiModeTab(result.showAiModeTab);
  }
);

toggle.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: toggle.checked });
  render(toggle.checked);
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
