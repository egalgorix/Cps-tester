import { Round, clicksPerSecond, loadRecords, paceGroups, saveResult } from "./engine.js";

const storageKey = "cps-tester:rounds:v1";
const target = document.querySelector("#target");
const targetLabel = document.querySelector("#target-label");
const targetNote = document.querySelector("#target-note");
const reset = document.querySelector("#reset");
const durationInputs = [...document.querySelectorAll("[name=duration]")];
const progress = document.querySelector("#progress");
const time = document.querySelector("#time");
const clicks = document.querySelector("#clicks");
const cps = document.querySelector("#cps");
const best = document.querySelector("#best");
const bestDuration = document.querySelector("#best-duration");
const announcement = document.querySelector("#announcement");
const pace = document.querySelector("#pace");
const paceNote = document.querySelector("#pace-note");
const history = document.querySelector("#history");
const historyDuration = document.querySelector("#history-duration");
const historyEmpty = document.querySelector("#history-empty");

let records = loadRecords(readSavedResults());
let duration = Number(durationInputs.find(input => input.checked).value);
let round;
let frame;
let state = "ready";

function readSavedResults() {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function storeResults() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(records));
  } catch {
    return;
  }
}

function updateText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function renderMetrics({ remaining, clicks: count, cps: speed }) {
  updateText(time, (Math.ceil(remaining / 100) / 10).toFixed(1));
  updateText(clicks, String(count));
  updateText(cps, speed === null ? "—" : speed.toFixed(2));
  progress.value = 1 - remaining / (duration * 1000);
}

function renderPace(result) {
  pace.replaceChildren();
  pace.hidden = !result;
  if (!result) {
    paceNote.textContent = "Finish a round to see where you picked up speed.";
    return;
  }

  const groups = paceGroups(result);
  const maximum = Math.max(1, ...groups.map(group => group.clicks));
  const seconds = groups[0].to - groups[0].from;
  paceNote.textContent = seconds === 1 ? "Clicks per second in the latest round" : "Clicks per 5 seconds in the latest round";
  for (const { from, to, clicks: count } of groups) {
    const item = document.createElement("li");
    item.className = "pace-column";
    const bar = document.createElement("span");
    bar.className = "pace-bar";
    bar.style.setProperty("--bar-height", (count / maximum * 100) + "%");
    bar.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "sr-only";
    label.textContent = from + " to " + to + " seconds: " + count + " clicks";
    item.title = label.textContent;
    item.append(bar, label);
    pace.append(item);
  }
}

function renderResults() {
  const { best: bestCount, recent } = records[duration];
  best.textContent = bestCount ? (bestCount / duration).toFixed(2) + " CPS" : "—";
  bestDuration.textContent = "(" + duration + "s)";
  historyDuration.textContent = duration + "s";
  historyEmpty.hidden = recent.length > 0;
  history.hidden = recent.length === 0;
  history.replaceChildren();
  for (const result of recent) {
    const item = document.createElement("li");
    const total = document.createElement("span");
    total.textContent = result.clicks + (result.clicks === 1 ? " click" : " clicks");
    const score = document.createElement("strong");
    score.textContent = clicksPerSecond(result).toFixed(2) + " CPS";
    item.append(total, score);
    history.append(item);
  }
  renderPace(recent[0]);
}

function setState(next) {
  state = next;
  target.dataset.state = next;
  target.setAttribute("aria-disabled", String(next === "finished"));
  for (const input of durationInputs) input.disabled = next === "running";
  reset.disabled = next === "ready";
  reset.textContent = next === "finished" ? "Try again" : "Reset";
}

function resetRound(message = "") {
  cancelAnimationFrame(frame);
  round = undefined;
  setState("ready");
  targetLabel.textContent = "Start clicking";
  targetNote.textContent = message || "Your first click starts the timer";
  announcement.textContent = message;
  renderMetrics({ remaining: duration * 1000, clicks: 0, cps: 0 });
}

function finishRound() {
  cancelAnimationFrame(frame);
  const result = round.result();
  const speed = clicksPerSecond(result);
  const isBest = result.clicks > records[duration].best;
  saveResult(records, result);
  storeResults();
  setState("finished");
  targetLabel.textContent = "Round complete";
  targetNote.textContent = isBest ? "New personal best" : speed.toFixed(2) + " clicks per second";
  announcement.textContent = targetLabel.textContent + ". " + result.clicks + " clicks, " +
    speed.toFixed(2) + " clicks per second." + (isBest ? " New personal best." : "");
  renderMetrics({ remaining: 0, clicks: result.clicks, cps: speed });
  renderResults();
}

function tick(now) {
  if (state !== "running") return;
  if (now >= round.deadline) {
    finishRound();
    return;
  }
  renderMetrics(round.metrics(now));
  frame = requestAnimationFrame(tick);
}

target.addEventListener("click", () => {
  if (state === "finished") return;
  const now = performance.now();
  if (state === "ready") {
    round = new Round(duration, now);
    setState("running");
    targetLabel.textContent = "Keep clicking";
    targetNote.textContent = duration + "-second round";
    announcement.textContent = "Round started.";
    frame = requestAnimationFrame(tick);
  }
  if (round.record(now)) renderMetrics(round.metrics(now));
  else if (now >= round.deadline) finishRound();
});

target.addEventListener("keydown", event => {
  if (event.repeat && (event.key === " " || event.key === "Enter")) event.preventDefault();
});

reset.addEventListener("click", () => {
  resetRound();
  target.focus({ preventScroll: true });
});

for (const input of durationInputs) {
  input.addEventListener("change", () => {
    duration = Number(input.value);
    resetRound();
    renderResults();
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "running") {
    resetRound("Round canceled because the tab was hidden.");
  }
});

window.addEventListener("storage", event => {
  if (event.key !== storageKey && event.key !== null) return;
  records = loadRecords(readSavedResults());
  renderResults();
});

resetRound();
renderResults();
