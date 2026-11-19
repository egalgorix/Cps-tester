export const DURATIONS = Object.freeze([1, 5, 10, 15, 30, 60]);
export const HISTORY_SIZE = 6;

export class Round {
  constructor(duration, startedAt) {
    this.duration = duration;
    this.startedAt = startedAt;
    this.deadline = startedAt + duration * 1000;
    this.clicks = 0;
    this.intervals = Array(duration).fill(0);
  }

  record(now) {
    if (now < this.startedAt || now >= this.deadline) return false;
    this.clicks += 1;
    this.intervals[Math.floor((now - this.startedAt) / 1000)] += 1;
    return true;
  }

  metrics(now) {
    const elapsed = Math.max(0, Math.min(now - this.startedAt, this.duration * 1000));
    return {
      remaining: this.duration * 1000 - elapsed,
      clicks: this.clicks,
      cps: elapsed >= 1000 ? this.clicks / (elapsed / 1000) : null
    };
  }

  result() {
    return { duration: this.duration, clicks: this.clicks, intervals: [...this.intervals] };
  }
}

export function clicksPerSecond({ duration, clicks }) {
  return clicks / duration;
}

export function paceGroups({ duration, intervals }) {
  const seconds = duration > 15 ? 5 : 1;
  const groups = [];
  for (let index = 0; index < intervals.length; index += seconds) {
    const clicks = intervals.slice(index, index + seconds).reduce((sum, count) => sum + count, 0);
    groups.push({ from: index, to: Math.min(index + seconds, duration), clicks });
  }
  return groups;
}

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isResult(result, duration) {
  return result?.duration === duration && isCount(result.clicks) &&
    Array.isArray(result.intervals) && result.intervals.length === duration &&
    result.intervals.every(isCount) &&
    result.intervals.reduce((sum, count) => sum + count, 0) === result.clicks;
}

export function loadRecords(json) {
  let saved;
  try {
    saved = JSON.parse(json);
  } catch {
    saved = null;
  }
  return Object.fromEntries(DURATIONS.map(duration => {
    const record = saved?.[duration];
    const recent = Array.isArray(record?.recent)
      ? record.recent.filter(result => isResult(result, duration)).slice(0, HISTORY_SIZE)
      : [];
    const best = Math.max(isCount(record?.best) ? record.best : 0, ...recent.map(result => result.clicks));
    return [duration, { best, recent }];
  }));
}

export function saveResult(records, result) {
  const record = records[result.duration];
  record.best = Math.max(record.best, result.clicks);
  record.recent.unshift(result);
  record.recent.length = Math.min(record.recent.length, HISTORY_SIZE);
}
