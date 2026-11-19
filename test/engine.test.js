import assert from "node:assert/strict";
import test from "node:test";
import { Round, clicksPerSecond, loadRecords, paceGroups, saveResult } from "../engine.js";

test("includes the click that starts a round and excludes its exact deadline", () => {
  const round = new Round(5, 100);
  assert.equal(round.record(99), false);
  assert.equal(round.record(100), true);
  assert.equal(round.record(5_099.9), true);
  assert.equal(round.record(5_100), false);
  assert.equal(round.record(5_200), false);
  assert.deepEqual(round.result(), { duration: 5, clicks: 2, intervals: [1, 0, 0, 0, 1] });
  assert.equal(clicksPerSecond(round.result()), 0.4);
});

test("uses the scheduled duration when the clock update arrives late", () => {
  const round = new Round(1, 100);
  round.record(100);
  round.record(599);
  assert.deepEqual(round.metrics(100), { remaining: 1000, clicks: 2, cps: null });
  assert.deepEqual(round.metrics(5_000), { remaining: 0, clicks: 2, cps: 2 });
});

test("assigns clicks at an interval boundary to the next interval", () => {
  const round = new Round(5, 25);
  round.record(1_024.9);
  round.record(1_025);
  assert.deepEqual(round.result().intervals, [1, 1, 0, 0, 0]);
});

test("aggregates longer pace graphs without losing clicks", () => {
  const round = new Round(30, 10);
  for (const time of [10, 5_010, 9_999, 29_999]) round.record(time);
  const groups = paceGroups(round.result());
  assert.equal(groups.length, 6);
  assert.deepEqual(groups[1], { from: 5, to: 10, clicks: 2 });
  assert.deepEqual(groups[5], { from: 25, to: 30, clicks: 1 });
  assert.equal(groups.reduce((sum, group) => sum + group.clicks, 0), 4);
});

test("saves personal records by duration after older rounds leave history", () => {
  const records = loadRecords(null);
  const first = new Round(1, 0);
  for (let i = 0; i < 20; i += 1) first.record(i);
  saveResult(records, first.result());
  for (let i = 0; i < 7; i += 1) {
    const subsequent = new Round(1, 0);
    subsequent.record(0);
    saveResult(records, subsequent.result());
  }
  const restored = loadRecords(JSON.stringify(records));
  assert.equal(restored[1].best, 20);
  assert.equal(restored[1].recent.length, 6);
  assert.equal(restored[1].recent[5].clicks, 1);
  assert.deepEqual(restored[5], { best: 0, recent: [] });
});

test("ignores unusable stored scores and restores valid rounds", () => {
  assert.deepEqual(loadRecords("{invalid")[5], { best: 0, recent: [] });
  const saved = { 1: { best: -3, recent: [
    { duration: 1, clicks: 3, intervals: [0] },
    { duration: 1, clicks: 2, intervals: [2] },
    { duration: 5, clicks: 4, intervals: [4] }
  ] } };
  assert.deepEqual(loadRecords(JSON.stringify(saved))[1], {
    best: 2, recent: [{ duration: 1, clicks: 2, intervals: [2] }]
  });
});
