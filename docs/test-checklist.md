# Manual test checklist — No AI Search
Run these in order before submitting to the Chrome Web Store.
Check each box as you go. All items must pass.

---

## 1. Installation

- [ ] Open `chrome://extensions`
- [ ] Enable **Developer mode** (top-right toggle)
- [ ] Click **Load unpacked** → select the `no-ai-search` folder
- [ ] Extension appears in the list with no errors shown
- [ ] Toolbar icon (crossed-out AI circle) appears in the Chrome toolbar
- [ ] Click the toolbar icon → popup opens showing toggle **ON** and status
      text "Google searches will skip AI Overviews and AI Mode."
- [ ] No yellow warning banners or error messages in `chrome://extensions`

---

## 2. Core redirect — www domain

- [ ] Go to `https://www.google.com` and search for anything likely to
      trigger an AI Overview, e.g. **"what is machine learning"**
- [ ] Confirm the URL contains `udm=14` after the redirect
- [ ] Confirm no AI Overview or AI Mode panel appears above the results
- [ ] Confirm regular blue-link web results are showing
- [ ] Confirm the **"Show AI Overview for this search"** banner appears
      top-right of the results page

---

## 3. Core redirect — bare apex domain

- [ ] Go to `https://google.com` (no www) and search for the same query
- [ ] Confirm the URL contains `udm=14`
- [ ] Confirm no AI Overview appears
- [ ] Confirm the "Show AI Overview" banner appears

---

## 4. Show AI Overview on demand

- [ ] From a filtered results page (either domain), click
      **"Show AI Overview for this search"**
- [ ] Confirm the new page loads **without** `udm=14` in the URL
- [ ] Confirm the page does **not** immediately get redirected back to
      filtered results
- [ ] Confirm an AI Overview or AI Mode result appears (or at minimum
      that the URL is different and Google's default tab is shown)
- [ ] Run a **new search** from that page
- [ ] Confirm the new search URL contains `udm=14` again (redirect is
      back in effect)

---

## 5. Dismiss banner

- [ ] On a filtered results page, click the **×** button on the banner
- [ ] Confirm the banner disappears immediately
- [ ] Confirm the rest of the results page is unaffected

---

## 6. Toggle off

- [ ] Click the toolbar icon → flip the toggle to **OFF**
- [ ] Confirm popup shows "Off — Google's normal AI results will show."
- [ ] Run a search on `www.google.com`
- [ ] Confirm the URL does **not** contain `udm=14`
- [ ] Confirm the "Show AI Overview" banner does **not** appear
- [ ] Confirm AI Overviews can now appear normally (try "what is
      machine learning" again)

---

## 7. Toggle back on

- [ ] Click the toolbar icon → flip toggle back to **ON**
- [ ] Run a search
- [ ] Confirm `udm=14` is back in the URL
- [ ] Confirm the "Show AI Overview" banner reappears

---

## 8. In-page AI Mode tab (backstop test)

- [ ] With the extension ON, run a search on `www.google.com`
- [ ] If a **"AI Mode"** tab is visible in the search tab bar, click it
- [ ] Confirm the backstop hides any AI content that loads via that tab
- [ ] Check the popup — if the backstop fired, it should show a note:
      "Backup filter caught something…"
- [ ] _(If the AI Mode tab doesn't appear for your query, skip — this
      depends on what Google shows for your account/region)_

---

## 9. Session token rotation

- [ ] With the extension ON, open a filtered results page and note the
      full URL of the "Show AI Overview" link (hover or inspect `href`)
- [ ] Close Chrome completely and reopen it
- [ ] Load the extension, open a results page, and inspect the new
      "Show AI Overview" link's URL
- [ ] Confirm the token value (`show_ai_overview=...`) is **different**
      from the one noted before closing Chrome
- [ ] Paste the **old** bypass URL into a new tab
- [ ] Confirm it gets redirected back to filtered results (old token
      no longer works)

---

## 10. Error surfacing (optional but recommended)

- [ ] Open `chrome://extensions` → click **Service worker** link for
      No AI Search to open the background DevTools console
- [ ] Toggle the extension off and on
- [ ] Confirm no errors appear in the console
- [ ] Confirm `chrome.storage.local` does not contain a `ruleError` key
      (check via console: `chrome.storage.local.get(null, console.log)`)

---

## 11. Selector check (most likely thing to need a fix)

- [ ] Run a search that shows an AI Overview with the extension **OFF**
- [ ] Right-click the AI Overview container → **Inspect**
- [ ] Look for a `data-attrid`, `jsname`, or `aria-label` attribute on
      the outermost AI container div
- [ ] Cross-check against the `SELECTORS` array at the top of
      `content.js` — confirm at least one selector matches what you see
- [ ] If none match, add the new selector to `SELECTORS` and re-test
      with the extension ON to confirm the backstop hides it

---

## 12. No unintended side effects

- [ ] Open **Gmail** (`mail.google.com`) and use its search bar
- [ ] Confirm Gmail search works normally and URL does **not** contain
      `udm=14`
- [ ] Open **Google Drive** (`drive.google.com`) and search for a file
- [ ] Confirm Drive search works normally
- [ ] Open any non-Google website
- [ ] Confirm the extension has no visible effect

---

## Known acceptable gaps (do not fail on these)

- The "AI Mode" tab inside a results page may still be visible as a UI
  element even when AI content is being filtered — hiding the tab
  itself is a separate feature not in v1.
- The omnibox Gemini/AI Mode button is native Chrome UI; the extension
  cannot remove it and is not expected to.
- On a country where Google's ccTLD redirect hasn't fully rolled out,
  a search made directly on e.g. `google.co.uk` may not be filtered.

---

## After all boxes are checked

1. Take screenshots for the store listing:
   - The popup (toggle ON state, including the "Show 'AI Mode' tab" toggle)
   - A filtered results page showing the "Show AI Overview" banner
   - A before/after side-by-side if possible (extension OFF vs ON)
   - Required size: **1280×800** or **640×400** (Chrome enforces this)

2. Take the promo tile screenshot: **440×280**, used as the store card image

3. `docs/PRIVACY.md` is fully filled in — no remaining placeholders.

4. Commit `docs/PRIVACY.md` to a public repo and copy the public URL

5. Open the Chrome Web Store Developer Dashboard → paste content from
   `docs/store-listing.md` into the matching fields → paste the
   `PRIVACY.md` URL into the Privacy policy field
