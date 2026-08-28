// The content script must not add any UI of its own to the results page.
//
// Guards the v1.2.0 defect: an un-dismissible "Show AI Overview for this
// search" banner was injected as a fixed-position overlay on every search,
// with no setting to suppress it and no persisted dismissal. Reported
// externally as a 1-star review, not caught by the suite below it.
//
// Why the existing suite missed it: test/rig.js's default fixture URL
// carries no `udm` parameter, so isWebResultsView() returned false and the
// banner was never injected under test. Every real user is on udm=14 —
// background.js's redirect rule puts them there — so the one state that
// mattered was the one state never exercised. The first test here pins that
// gap deliberately: it passes on the buggy build too, and is only meaningful
// next to the second.
//
// These assertions are written against the page, not against the banner's
// id. Asserting `getElementById('no-ai-search-banner') === null` would go
// green if someone reintroduced the same overlay under a different id. The
// invariant worth defending is "content.js adds nothing to the page," so
// that is what is measured.
//
//   run:  npm ci && node --test
//   mutation check, expect 2 of 3 to fail:
//     CONTENT_JS=/path/to/v1.1.2/content.js node --test

const test = require('node:test');
const assert = require('node:assert');
const { load, flush } = require('./rig');

const WEB_VIEW_URL = 'https://www.google.com/search?q=learn+guitar&udm=14';

// Everything the fixture itself puts in <body>. Anything else is ours.
function strayBodyChildren(document) {
  return [...document.body.children].filter((el) => el.id !== 'cnt');
}

test('baseline: no UI injected on a URL without udm (the gap the old suite had)', async () => {
  const { document } = load();
  await flush();
  assert.deepEqual(strayBodyChildren(document).map((el) => el.outerHTML), [],
    'nothing should be added to the page');
});

test('DEFECT 4: no UI injected on the filtered Web results view (udm=14)', async () => {
  const { document } = load({ url: WEB_VIEW_URL });
  await flush();
  assert.deepEqual(strayBodyChildren(document).map((el) => el.outerHTML), [],
    'content.js must not inject a banner or any other element');
});

test('DEFECT 4b: no UI injected after toggling the extension off and on again', async () => {
  const { document, chrome } = load({ url: WEB_VIEW_URL });
  await flush();
  chrome.__fire({ enabled: { newValue: false } });
  await flush();
  chrome.__fire({ enabled: { newValue: true } });
  await flush();
  assert.deepEqual(strayBodyChildren(document).map((el) => el.outerHTML), [],
    'the storage-change path must not inject anything either');
});
