// Glue-layer scenario tests, driving the real extension/panel.js.
//
// SCOPE, read this before trusting a pass:
//
// The Web Lock manager and chrome.storage here are MODELS written for this
// harness, not Chrome's implementations. A pass is evidence that panel.js
// behaves correctly *given a spec-conforming lock and storage*. It is not
// evidence about Chrome. The browser run in SMOKE.md remains the thing that
// tests the real platform; this tests the logic against a boundary the hand run
// cannot reach -- deterministic contention, and unload at an exact point.

import { makeStorage, makeLockManager, loadPanel } from "./glueharness.js";

const STORE = "notes:v1";
const LOCK = "margin-spike:notes";

const PAGE = "https://en.wikipedia.org/wiki/Carbohydrate";
const tabA = { id: 1, windowId: 10, url: PAGE, title: "Carbohydrate" };
const tabB = { id: 2, windowId: 20, url: PAGE, title: "Carbohydrate - reader" };

let pass = 0;
const failures = [];

function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name} ${detail}`); }
}

function bodies(storage) {
  return (storage._dump()[STORE] || []).map((n) => n.body);
}

const tick = () => new Promise((r) => setTimeout(r, 0));

// ---------------------------------------------------------------- C1, C2

console.log("\nC1 -- double save, same text");
{
  const storage = makeStorage();
  const locks = makeLockManager();
  const p = await loadPanel({ storage, locks, tab: tabA });

  const a = p.save("double save test");
  const b = p.save("double save test"); // second click, first still in flight
  await Promise.all([a, b]);

  check("exactly one note", bodies(storage).length === 1, `got ${bodies(storage).length}`);
}

console.log("\nC2 -- different second note mid-write");
{
  const storage = makeStorage();
  const locks = makeLockManager();
  const p = await loadPanel({ storage, locks, tab: tabA });

  const a = p.save("first note");
  const b = p.save("second note"); // genuinely different, first still writing
  await Promise.all([a, b]);

  const got = bodies(storage);
  check("both notes survive", got.length === 2, `got ${JSON.stringify(got)}`);
  check("first note present", got.includes("first note"));
  check("second note present", got.includes("second note"));
}

// ---------------------------------------------------------------- C4, C6

console.log("\nC4 -- two windows writing simultaneously");
{
  const storage = makeStorage();
  const locks = makeLockManager();
  const pA = await loadPanel({ storage, locks, tab: tabA });
  const pB = await loadPanel({ storage, locks, tab: tabB });

  const a = pA.save("from window A");
  const b = pB.save("from window B");
  await Promise.all([a, b]);

  const got = bodies(storage);
  check("both notes survive", got.length === 2, `got ${JSON.stringify(got)}`);
  check("A's note present", got.includes("from window A"));
  check("B's note present", got.includes("from window B"));
  check("lock granted twice", locks._grants() === 2, `granted ${locks._grants()}`);
}

console.log("\nC4b -- ten interleaved writes across two windows");
{
  const storage = makeStorage();
  const locks = makeLockManager();
  const pA = await loadPanel({ storage, locks, tab: tabA });
  const pB = await loadPanel({ storage, locks, tab: tabB });

  const jobs = [];
  for (let i = 0; i < 5; i++) {
    jobs.push(pA.save(`A${i}`));
    jobs.push(pB.save(`B${i}`));
  }
  await Promise.all(jobs);

  const got = bodies(storage);
  check("no writes lost (10 expected)", got.length === 10, `got ${got.length}: ${JSON.stringify(got)}`);
}

console.log("\nC6 -- cross-window view sync");
{
  const storage = makeStorage();
  const locks = makeLockManager();
  const pA = await loadPanel({ storage, locks, tab: tabA });
  const pB = await loadPanel({ storage, locks, tab: tabB });

  check("B starts empty", pB.list() === 0);
  await pA.save("written in A");
  await tick();
  check("B's list updated without interaction", pB.list() === 1, `B rows=${pB.list()}`);
}

console.log("\nM1 -- key removal does not update an idle panel");
{
  const storage = makeStorage();
  const locks = makeLockManager();
  const pA = await loadPanel({ storage, locks, tab: tabA });
  await pA.save("note one");
  check("panel shows the note", pA.list() === 1);

  await storage.api.local.remove(STORE);
  await tick();
  check("view stays stale after removal (M1)", pA.list() === 1, `rows=${pA.list()}`);

  // and the next commit repairs it
  await pA.save("note two");
  const got = bodies(storage);
  check("next commit repairs to one note", got.length === 1 && got[0] === "note two", JSON.stringify(got));
  check("view corrected", pA.list() === 1, `rows=${pA.list()}`);
}

// ---------------------------------------------------------------- C3b

console.log("\nC3b -- save queued behind another window's lock, then unload");
{
  const storage = makeStorage();
  const locks = makeLockManager();
  const pA = await loadPanel({ storage, locks, tab: tabA });

  // Window B holds the lock and does not let go.
  let releaseB;
  const bHeld = new Promise((r) => { releaseB = r; });
  locks.api.request(LOCK, () => bHeld);
  await tick();

  // Window A saves: its mutation queues behind B's lock.
  const saving = pA.save("lost to the lock");
  await tick();
  check("A's write is pending, not granted", locks._pending(LOCK) === 1, `pending=${locks._pending(LOCK)}`);
  check("nothing written yet", bodies(storage).length === 0);

  // A's document unloads: Web Locks abort pending requests.
  const aborted = locks._abortPending(LOCK);
  check("one pending request aborted", aborted === 1);
  await saving;

  check("note was NOT written", bodies(storage).length === 0, JSON.stringify(bodies(storage)));
  check(
    "failure is handled, not an unhandled rejection",
    true, // reaching here at all means commit() resolved
  );
  check(
    "status set to LOCK_FAILED",
    pA.hint() === "Not saved - could not update storage. Try again.",
    `hint=${JSON.stringify(pA.hint())}`
  );

  releaseB();
}

// ---------------------------------------------------------------- D2, D3

console.log("\nD2 -- storage write failure");
{
  const storage = makeStorage();
  const locks = makeLockManager();
  const p = await loadPanel({ storage, locks, tab: tabA });

  storage._failNextSet(new Error("QUOTA_BYTES quota exceeded"));
  await p.save("should not land");

  check("nothing written", bodies(storage).length === 0, JSON.stringify(bodies(storage)));
  check("note does not appear in the list", p.list() === 0, `rows=${p.list()}`);
  check(
    "status shows the full-storage message",
    p.hint() === "Not saved - storage is full. Delete a few notes and try again.",
    `hint=${JSON.stringify(p.hint())}`
  );
}

console.log("\nD3 -- corrupt store");
{
  const storage = makeStorage({ [STORE]: "not an array" });
  const locks = makeLockManager();
  const p = await loadPanel({ storage, locks, tab: tabA });

  check("draft disabled", p.el.get("draft").disabled === true);
  check("save disabled", p.el.get("save").disabled === true);
  check("search disabled", p.el.get("search").disabled === true);

  await p.save("must not be written");
  check(
    "corrupt store not overwritten",
    storage._dump()[STORE] === "not an array",
    JSON.stringify(storage._dump()[STORE])
  );
}

// ---------------------------------------------------------------- no-locks

console.log("\nFail-closed -- Web Locks unavailable");
{
  const storage = makeStorage();
  const locks = makeLockManager();
  const p = await loadPanel({ storage, locks, tab: tabA });

  Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true, writable: true });
  await p.save("must refuse");

  check("refused to write without locks", bodies(storage).length === 0, JSON.stringify(bodies(storage)));
  check(
    "status explains the refusal",
    p.hint() === "Not saved - this browser is missing a feature Margin needs.",
    `hint=${JSON.stringify(p.hint())}`
  );
}

// ---------------------------------------------------------------- summary

console.log(`\n${pass}/${pass + failures.length} glue checks passed`);
if (failures.length) {
  console.log("failed:", failures.join(", "));
  process.exitCode = 1;
}
