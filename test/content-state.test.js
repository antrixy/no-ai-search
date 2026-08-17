// Deterministic tests for content.js control state.
//
// Each test names the defect it guards against. All three were shipped in
// v1.1.2 and found by external review, not by these tests — which is the
// argument for having them.
//
//   run:  npm ci && node --test test/
//
// These tests were validated by running them against the shipped v1.1.2
// content.js, where tests 3, 4, 6 and 7 fail and the other five pass. A test
// that has only ever been green is not known to be able to fail:
//
//   CONTENT_JS=/path/to/v1.1.2/content.js node --test test/

const test = require('node:test');
const assert = require('node:assert');
const { load, aiPanel, paaBlock, aiModeTab, isHidden, reported, flush } = require('./rig');

test('baseline: filtering on hides the AI panel and the AI Mode tab', async () => {
  const { document, chrome } = load();
  await flush();
  assert.ok(isHidden(aiPanel(document)), 'AI Overview panel should be hidden');
  assert.ok(isHidden(aiModeTab(document)), 'AI Mode tab should be hidden');
  assert.ok(reported(chrome), 'a hide at page load is evidence the redirect failed');
});

test('baseline: People also ask is never touched (v1.1.1 regression)', async () => {
  const { document } = load();
  await flush();
  const paa = paaBlock(document);
  assert.ok(!isHidden(paa), 'PAA block must stay visible');
  assert.equal(paa.getAttribute('data-noaisearch-hidden-panel'), null,
    'PAA must not carry the hidden marker');
});

test('DEFECT 1: turning the extension off restores the AI Mode tab, not just panels', async () => {
  const { document, chrome } = load();
  await flush();
  const tab = aiModeTab(document);
  const originalHref = '/search?q=x&udm=50';
  assert.ok(isHidden(tab), 'precondition: tab hidden while on');
  assert.equal(tab.getAttribute('href'), null, 'precondition: href stripped while on');

  chrome.__fire({ enabled: { newValue: false } });
  await flush();

  assert.ok(!isHidden(aiPanel(document)), 'panel restored');
  assert.ok(!isHidden(tab), 'AI Mode tab restored — this is the defect');
  assert.equal(tab.getAttribute('href'), originalHref, 'href restored');
  assert.equal(tab.getAttribute('data-noaisearch-hidden-tab'), null, 'marker cleared');
});

test('DEFECT 2: the AI Mode preference is inert while the master switch is off', async () => {
  const { document, chrome } = load({ store: { showAiModeTab: true } });
  await flush();
  const tab = aiModeTab(document);
  assert.ok(!isHidden(tab), 'precondition: tab visible, preference says show');

  chrome.__fire({ enabled: { newValue: false } });
  await flush();
  // The user turns the secondary preference off while the extension is off.
  // Nothing on the page may change.
  chrome.__fire({ showAiModeTab: { newValue: false } });
  await flush();

  assert.ok(!isHidden(tab), 'tab must stay visible — master switch is off');
  assert.equal(tab.getAttribute('data-noaisearch-hidden-tab'), null,
    'secondary preference must not hide anything while disabled');
});

test('DEFECT 2b: with the master switch on, the preference still works', async () => {
  const { document, chrome } = load({ store: { showAiModeTab: true } });
  await flush();
  const tab = aiModeTab(document);
  assert.ok(!isHidden(tab), 'precondition: visible');

  chrome.__fire({ showAiModeTab: { newValue: false } });
  await flush();
  assert.ok(isHidden(tab), 'preference should hide the tab while enabled');

  chrome.__fire({ showAiModeTab: { newValue: true } });
  await flush();
  assert.ok(!isHidden(tab), 'and reveal it again');
});

test('DEFECT 3: no drift report when nothing was actually hidden', async () => {
  // Google already served the panel as display:none. The backstop has nothing
  // to do, so the popup must not claim it caught something.
  const { chrome } = load({ dom: { aiPanelPreHidden: true } });
  await flush();
  assert.ok(!reported(chrome),
    'reporting a catch when no hide occurred makes lastFallbackTrigger noise');
});

test('DEFECT 3b: no drift report when the user toggles on over a loaded SERP', async () => {
  const { document, chrome } = load({ store: { enabled: false } });
  await flush();
  assert.ok(!isHidden(aiPanel(document)), 'precondition: nothing filtered while off');

  chrome.__fire({ enabled: { newValue: true } });
  await flush();

  assert.ok(isHidden(aiPanel(document)), 'panel hidden after enabling');
  assert.ok(!reported(chrome),
    'hiding here is what the user asked for, not evidence the redirect failed');
});

test('bypass page: nothing is touched at all', async () => {
  const { document, chrome } = load({
    url: 'https://www.google.com/search?q=learn+guitar&show_ai_overview=tok123',
  });
  await flush();
  assert.ok(!isHidden(aiPanel(document)), 'AI panel left as Google served it');
  assert.ok(!isHidden(aiModeTab(document)), 'AI Mode tab left alone');
  assert.ok(!reported(chrome), 'no misleading fallback report on a requested-AI page');
});

test('stale bypass token does not exempt the page', async () => {
  const { document } = load({
    url: 'https://www.google.com/search?q=x&show_ai_overview=oldtoken',
    store: { bypassToken: 'tok123' },
  });
  await flush();
  assert.ok(isHidden(aiPanel(document)), 'a token from a previous session must not authorize');
});
