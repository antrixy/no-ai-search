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
- [ ] Confirm the popup also shows a **"Show 'AI Mode' tab"** toggle,
      **OFF** by default
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
- [ ] Confirm the page is **not** immediately redirected back to filtered
      results
- [ ] Confirm Google's AI Overview actually appears **and stays visible** —
      it must not flash in and then vanish. (That flash-then-hide was the
      pre-1.1 bug: the backstop was re-hiding the panel the user just
      asked to see.) _If Google shows no AI Overview for this query at
      all, retry with a more AI-prone query like "how does photosynthesis
      work" — do not treat "URL is just different" as a pass._
- [ ] Open the popup and confirm it does **not** show a "Backup filter
      caught something…" note. On a bypass page the backstop must stay
      completely hands-off, so a note here means the bypass exemption has
      regressed.
- [ ] Run a **new search** from that page
- [ ] Confirm the new search URL contains `udm=14` again (redirect is
      back in effect)

---

## 5. "Show AI Overview" banner is Web-results-only

- [ ] From a filtered results page, click the **Images** tab
      (URL becomes `udm=2`)
- [ ] Confirm the **"Show AI Overview for this search"** banner does
      **not** appear on the Images results
- [ ] Click the **Videos** tab and confirm the banner does not appear
      there either
- [ ] Return to **All / Web** results (`udm=14`) and confirm the banner
      is present again

---

## 6. Dismiss banner

- [ ] On a filtered results page, click the **×** button on the banner
- [ ] Confirm the banner disappears immediately
- [ ] Confirm the rest of the results page is unaffected

---

## 7. Toggle off

- [ ] Click the toolbar icon → flip the toggle to **OFF**
- [ ] Confirm popup shows "Off — Google's normal AI results will show."
- [ ] Run a search on `www.google.com`
- [ ] Confirm the URL does **not** contain `udm=14`
- [ ] Confirm the "Show AI Overview" banner does **not** appear
- [ ] Confirm AI Overviews can now appear normally (try "what is
      machine learning" again)
- [ ] _(Conditional — only reproducible if the backstop fired earlier.)_
      If at any point during testing the popup showed "Backup filter
      caught something…" **and** an AI panel was hidden on a page, then
      while still on that page flip the extension **OFF** and confirm the
      hidden panel reappears **without** reloading. In normal operation
      the redirect stops the backstop from ever needing to hide anything,
      so this may not be reproducible — **do not fail on it.**

---

## 8. Toggle back on

- [ ] Click the toolbar icon → flip toggle back to **ON**
- [ ] Run a search
- [ ] Confirm `udm=14` is back in the URL
- [ ] Confirm the "Show AI Overview" banner reappears

---

## 9. "AI Mode" tab hidden by default (and the show toggle)

- [ ] With the extension ON, run a search on `www.google.com`
- [ ] Confirm there is **no** "AI Mode" tab in the results tab row
      (All, Images, Videos, News…) — it's hidden by default
- [ ] Open the popup and turn **"Show 'AI Mode' tab"** ON
- [ ] Without reloading, confirm the "AI Mode" tab now appears in the tab
      row on the current page (the setting takes effect immediately)
- [ ] Turn **"Show 'AI Mode' tab"** back OFF and confirm the tab
      disappears again on the current page
- [ ] _(If Google shows no "AI Mode" tab for your account/region even with
      the setting ON, skip — availability depends on account/region)_

---

## 10. Session token rotation

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

## 11. Error surfacing (optional but recommended)

- [ ] Open `chrome://extensions` → click **Service worker** link for
      No AI Search to open the background DevTools console
- [ ] Toggle the extension off and on
- [ ] Confirm no errors appear in the console
- [ ] Confirm `chrome.storage.local` does not contain a `ruleError` key
      (check via console: `chrome.storage.local.get(null, console.log)`)

---

## 12. Selector check (most likely thing to need a fix)

- [ ] Run a search that shows an AI Overview with the extension **OFF**
- [ ] Right-click the AI Overview container → **Inspect**
- [ ] Look for a `data-attrid`, `jsname`, or `aria-label` attribute on
      the outermost AI container div
- [ ] Cross-check against the `SELECTORS` array at the top of
      `content.js` — confirm at least one selector matches what you see
- [ ] If none match, add the new selector to `SELECTORS` and re-test
      with the extension ON to confirm the backstop hides it

---

## 13. No unintended side effects

- [ ] Open **Gmail** (`mail.google.com`) and use its search bar
- [ ] Confirm Gmail search works normally and URL does **not** contain
      `udm=14`
- [ ] Open **Google Drive** (`drive.google.com`) and search for a file
- [ ] Confirm Drive search works normally
- [ ] Open any non-Google website
- [ ] Confirm the extension has no visible effect

### Over-hiding check (added in 1.1.2)

- [ ] Search a query that shows **"People also ask"** with the extension
      **ON** — e.g. `how does photosynthesis work`
- [ ] Confirm the People-also-ask questions are **visible**, and that the
      AI Overview above them is gone
- [ ] Repeat the same query **3×** — page composition varies materially
      between renders, so one pass does not clear this box
- [ ] Confirm the other classic features on the page survived: organic
      results, related searches, and any widget (translate, calculator,
      unit conversion) the query would normally produce

---

## Known acceptable gaps (do not fail on these)

- If you navigate **directly** to a `udm=50` (AI Mode) URL — typing it,
  an old bookmark, an external link — that page loads and the extension
  cannot detect or correct it. Hiding the in-page tab prevents the click
  path, not every possible route to that URL.
- Turning **"Show 'AI Mode' tab"** off *while already on the AI Mode page
  itself* does nothing on that specific page; it applies again on the
  next normal results page. The content script never runs on the AI Mode
  page — see the README's "What this can't do."
- The omnibox Gemini/AI Mode button is native Chrome UI; the extension
  cannot remove it and is not expected to.
- In a region where Google's ccTLD→`google.com` redirect hasn't fully
  rolled out, a search made directly on e.g. `google.co.uk` may not be
  filtered.

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
