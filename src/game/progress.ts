import { validLanguageCode } from "./trials.ts";

function progressLanguage(langCode: string): string {
  return validLanguageCode(langCode) ? langCode : "english";
}

export function progressKey(trialNum: number, langCode = "english"): string {
  return `ftm:lang:${progressLanguage(langCode)}:trial:${trialNum}:solved`;
}

export function totalKey(trialNum: number, langCode = "english"): string {
  return `ftm:lang:${progressLanguage(langCode)}:trial:${trialNum}:total`;
}

function readProgressValue(
  trialNum: number,
  langCode: string,
  kind: "solved" | "total",
): string | null {
  const code = progressLanguage(langCode);
  const scopedKey =
    kind === "solved" ? progressKey(trialNum, code) : totalKey(trialNum, code);
  try {
    const scopedValue = localStorage.getItem(scopedKey);
    if (scopedValue !== null || code !== "english") return scopedValue;
    const legacyKey = `ftm:trial:${trialNum}:${kind}`;
    const legacyValue = localStorage.getItem(legacyKey);
    if (legacyValue !== null) {
      localStorage.setItem(scopedKey, legacyValue);
      localStorage.removeItem(legacyKey);
    }
    return legacyValue;
  } catch {
    return null;
  }
}

export function readSolvedIds(
  trialNum: number,
  langCode = "english",
): Set<string> {
  try {
    const value = readProgressValue(trialNum, langCode, "solved");
    const ids: unknown = value ? JSON.parse(value) : [];
    return new Set(
      Array.isArray(ids) && ids.every((id) => typeof id === "string") ? ids : [],
    );
  } catch {
    return new Set();
  }
}

export function writeSolvedIds(
  trialNum: number,
  ids: Set<string>,
  langCode = "english",
): void {
  try {
    readProgressValue(trialNum, langCode, "solved");
    localStorage.setItem(progressKey(trialNum, langCode), JSON.stringify([...ids]));
  } catch {
    // Progress storage can be unavailable in restricted WebViews.
  }
}

export function readTrialTotal(
  trialNum: number,
  langCode = "english",
): number {
  try {
    const total = Number(readProgressValue(trialNum, langCode, "total"));
    return Number.isInteger(total) && total > 0 ? total : 0;
  } catch {
    return 0;
  }
}

export function writeTrialTotal(
  trialNum: number,
  total: number,
  langCode = "english",
): void {
  try {
    readProgressValue(trialNum, langCode, "total");
    localStorage.setItem(totalKey(trialNum, langCode), String(total));
  } catch {
    // Progress storage can be unavailable in restricted WebViews.
  }
}

export function isTrialCompleted(
  trialNum: number,
  langCode = "english",
): boolean {
  const total = readTrialTotal(trialNum, langCode);
  return total > 0 && readSolvedIds(trialNum, langCode).size === total;
}
