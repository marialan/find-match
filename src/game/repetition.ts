import type { Trial, TrialObject } from "./types.ts";

export const DEFAULT_REPETITIONS = 3;
export type RepetitionCounts = Record<string, number>;

type CollisionRect = { x: number; y: number; width: number; height: number };

export function repetitionCandidate<T extends CollisionRect>(
  dragged: CollisionRect,
  targets: T[],
  pointer: { x: number; y: number },
): T | null {
  return targets
    .filter((target) =>
      Math.abs(target.x - dragged.x) <= (target.width + dragged.width) / 2 + 10 &&
      Math.abs(target.y - dragged.y) <= (target.height + dragged.height) / 2 + 10)
    .sort((a, b) => Math.hypot(a.x - pointer.x, a.y - pointer.y) -
      Math.hypot(b.x - pointer.x, b.y - pointer.y))[0] ?? null;
}

export function repetitionLayout(width: number, height: number, landscape: boolean) {
  const margin = 12;
  const gap = 16;
  const innerWidth = width - margin * 2;
  const innerHeight = height - margin * 2;
  const target = {
    x: margin, y: margin,
    width: landscape ? (innerWidth - gap) * 0.6 : innerWidth,
    height: landscape ? innerHeight : (innerHeight - gap) * 0.6,
  };
  const tray = landscape
    ? { x: margin, y: margin,
        width: innerWidth - target.width - gap, height: innerHeight }
    : { x: margin, y: margin + target.height + gap,
        width: innerWidth, height: innerHeight - target.height - gap };
  if (landscape) target.x = tray.x + tray.width + gap;
  return { target, tray };
}

export function requiredRepetitions(trial: Trial, target: TrialObject): number {
  return target.repetitions ?? trial.repetitions ?? DEFAULT_REPETITIONS;
}

export function repetitionSignature(trial: Trial): string {
  return JSON.stringify(trial.right.map((target) => [
    target.object_id, target.pair_id[0], requiredRepetitions(trial, target),
  ]));
}

export function repetitionTotal(trial: Trial): number {
  return trial.right.reduce((total, target) =>
    total + requiredRepetitions(trial, target), 0);
}

export function repetitionCount(counts: RepetitionCounts, id: string): number {
  return Object.hasOwn(counts, id) ? counts[id] : 0;
}

export function nextRepetitionPrompt(
  trial: Trial,
  counts: RepetitionCounts,
): TrialObject | null {
  const pending = trial.left.filter((prompt) => {
    const target = trial.right.find((item) => item.object_id === prompt.pair_id[0]);
    return target && repetitionCount(counts, target.object_id) < requiredRepetitions(trial, target);
  });
  return pending.reduce<TrialObject | null>((next, prompt) =>
    !next || repetitionCount(counts, prompt.pair_id[0]) <
      repetitionCount(counts, next.pair_id[0]) ? prompt : next, null);
}

export function recordRepetition(
  trial: Trial,
  counts: RepetitionCounts,
  prompt: TrialObject,
  target: TrialObject,
): RepetitionCounts {
  if (prompt.pair_id[0] !== target.object_id ||
      target.pair_id[0] !== prompt.object_id) return counts;
  return {
    ...counts,
    [target.object_id]: Math.min(
      requiredRepetitions(trial, target),
      repetitionCount(counts, target.object_id) + 1,
    ),
  };
}

export function repetitionKey(trialNum: number, langCode: string): string {
  return `ftm:repetition:lang:${langCode}:trial:${trialNum}`;
}

type StoredProgress = {
  signature: string;
  counts: RepetitionCounts;
  complete: boolean;
};

function readProgress(trialNum: number, langCode: string): StoredProgress | null {
  try {
    const raw = localStorage.getItem(repetitionKey(trialNum, langCode));
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null ||
        !("signature" in value) || typeof value.signature !== "string" ||
        !("complete" in value) || typeof value.complete !== "boolean" ||
        !("counts" in value) || typeof value.counts !== "object" ||
        value.counts === null || Array.isArray(value.counts) ||
        !Object.values(value.counts).every((count) =>
          typeof count === "number" && Number.isSafeInteger(count) && count >= 0)) {
      throw new Error("Invalid repeated-matching progress");
    }
    return value as StoredProgress;
  } catch (error) {
    console.warn("Unable to restore repeated-matching progress", error);
    return null;
  }
}

export function readRepetitionCounts(trial: Trial, langCode: string): RepetitionCounts {
  const saved = readProgress(trial.trial_num, langCode);
  if (!saved || saved.signature !== repetitionSignature(trial)) return {};
  return Object.fromEntries(trial.right.map((target) => [
    target.object_id,
    Math.min(requiredRepetitions(trial, target),
      repetitionCount(saved.counts, target.object_id)),
  ]));
}

export function writeRepetitionCounts(
  trial: Trial, langCode: string, counts: RepetitionCounts,
): void {
  try {
    localStorage.setItem(repetitionKey(trial.trial_num, langCode), JSON.stringify({
      signature: repetitionSignature(trial),
      counts,
      complete: trial.right.length > 0 && nextRepetitionPrompt(trial, counts) === null,
    }));
  } catch (error) {
    console.warn("Unable to save repeated-matching progress", error);
  }
}

export function isRepetitionCompleted(trialNum: number, langCode: string): boolean {
  return readProgress(trialNum, langCode)?.complete ?? false;
}
