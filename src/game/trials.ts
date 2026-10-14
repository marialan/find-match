import { loadBinary } from "./assets.ts";
import type { LanguagePack, Trial, TrialObject } from "./types.ts";

export const TRIALS_PER_PAGE = 12;
const LANGUAGE_CODE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SPEECH_LOCALE_PATTERN =
  /^(?:[A-Za-z]{2,3}|[A-Za-z]{4}|[A-Za-z]{5,8})(?:-[A-Za-z0-9]{1,8})*$/;
const OBJECT_TYPES: readonly string[] = ["letter", "audio"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validLanguageCode(code: string): boolean {
  return code.length <= 32 && LANGUAGE_CODE_PATTERN.test(code);
}

export function validateLanguagePack(
  value: unknown,
  expectedCode: string,
): LanguagePack {
  if (
    !isObject(value) ||
    Object.keys(value).length !== 2 ||
    value.code !== expectedCode ||
    typeof value.speechLocale !== "string" ||
    !SPEECH_LOCALE_PATTERN.test(value.speechLocale)
  ) {
    throw new Error(`Invalid language pack metadata for ${expectedCode}`);
  }
  return { code: expectedCode, speechLocale: value.speechLocale };
}

export async function loadLanguagePack(
  langCode: string,
): Promise<LanguagePack> {
  const code = validLanguageCode(langCode) ? langCode : "english";
  let buffer: ArrayBuffer;
  try {
    buffer = await loadBinary(`lang/${code}/pack.json`);
  } catch (error) {
    if (code !== "english") return loadLanguagePack("english");
    throw error;
  }
  const content = new TextDecoder().decode(buffer);
  if (/^\s*<(?:!doctype\s+html|html\b)/i.test(content)) {
    if (code !== "english") return loadLanguagePack("english");
    throw new Error("Missing English language pack metadata");
  }
  return validateLanguagePack(JSON.parse(content) as unknown, code);
}

export function resolveMediaPath(langCode: string, mediaPath: string): string {
  if (!validLanguageCode(langCode)) throw new Error("Invalid language code");
  if (
    typeof mediaPath !== "string" ||
    mediaPath.length === 0 ||
    mediaPath.startsWith("/") ||
    mediaPath.includes("\\") ||
    mediaPath.includes("?") ||
    mediaPath.includes("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(mediaPath) ||
    /%(?:2f|5c)/i.test(mediaPath)
  ) {
    throw new Error(`Invalid media path: ${mediaPath}`);
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(mediaPath);
  } catch {
    throw new Error(`Invalid media path: ${mediaPath}`);
  }
  const segments = decodedPath.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Invalid media path: ${mediaPath}`);
  }
  if (segments[0] === "lang") {
    if (segments[1] !== langCode || segments.length < 3) {
      throw new Error(`Invalid media path: ${mediaPath}`);
    }
    return mediaPath;
  }
  return `lang/${langCode}/${mediaPath}`;
}

export function loadTrial(url: string, langCode?: string): Promise<Trial> {
  return loadBinary(url).then((buffer) => {
    const trial = validateTrial(
      JSON.parse(new TextDecoder().decode(buffer)) as unknown,
    );
    if (!langCode) return trial;
    const resolveObjects = (items: TrialObject[]) =>
      items.map((item) => ({
        ...item,
        ...(item.image
          ? { image: resolveMediaPath(langCode, item.image) }
          : {}),
        ...(item.audio
          ? { audio: resolveMediaPath(langCode, item.audio) }
          : {}),
      }));
    return {
      ...trial,
      left: resolveObjects(trial.left),
      right: resolveObjects(trial.right),
    };
  });
}

export function trialNumberFromSearch(search: string): number | null {
  const value = new URLSearchParams(search).get("trial") ?? "";
  return /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

export function trialPath(langCode: string, trialNum: number): string {
  if (
    !validLanguageCode(langCode) ||
    !Number.isInteger(trialNum) ||
    trialNum < 1
  ) {
    throw new Error("Invalid trial path");
  }
  return `lang/${langCode}/trials/trial-${trialNum}.json`;
}

export function trialIndexPath(langCode: string): string {
  if (!validLanguageCode(langCode)) throw new Error("Invalid language code");
  return `lang/${langCode}/trials/index.json`;
}

export function validateTrialIndex(value: unknown): number[] {
  const trials = isObject(value) ? value.trials : undefined;
  if (
    !Array.isArray(trials) ||
    trials.length === 0 ||
    !trials.every(
      (num) => typeof num === "number" && Number.isInteger(num) && num > 0,
    )
  ) {
    throw new Error("Trial index must list positive trial numbers");
  }
  return [...new Set(trials as number[])].sort((a, b) => a - b);
}

export async function loadTrialIndex(url: string): Promise<number[]> {
  const buffer = await loadBinary(url);
  return validateTrialIndex(JSON.parse(new TextDecoder().decode(buffer)) as unknown);
}

export function pageCount(trialCount: number): number {
  return Math.max(1, Math.ceil(trialCount / TRIALS_PER_PAGE));
}

export function trialsForPage(trials: number[], page: number): number[] {
  return trials.slice(page * TRIALS_PER_PAGE, (page + 1) * TRIALS_PER_PAGE);
}

export function nextTrialNumber(
  trials: number[],
  trialNum: number,
): number | null {
  return trials[trials.indexOf(trialNum) + 1] ?? null;
}

function validateObject(value: unknown, ids: Set<string>): TrialObject {
  if (
    !isObject(value) ||
    typeof value.object_id !== "string" ||
    typeof value.target !== "string"
  ) {
    throw new Error("Each trial object needs object_id and target");
  }
  if (
    !Array.isArray(value.pos) ||
    value.pos.length !== 2 ||
    !value.pos.every((part) => typeof part === "number")
  ) {
    throw new Error(`Invalid position for ${value.object_id}`);
  }
  if (
    !Array.isArray(value.pair_id) ||
    value.pair_id.length !== 1 ||
    typeof value.pair_id[0] !== "string"
  ) {
    throw new Error(`Each object must have exactly one pair_id for ${value.object_id}`);
  }
  if (ids.has(value.object_id)) throw new Error(`Duplicate object_id ${value.object_id}`);
  if (
    value.type !== undefined &&
    (typeof value.type !== "string" || !OBJECT_TYPES.includes(value.type))
  ) {
    throw new Error(`Invalid type for ${value.object_id}`);
  }
  ids.add(value.object_id);
  return {
    object_id: value.object_id,
    pos: [value.pos[0] as number, value.pos[1] as number],
    target: value.target,
    type: (value.type as TrialObject["type"] | undefined) ?? "letter",
    pair_id: value.pair_id as string[],
    ...(typeof value.image === "string" ? { image: value.image } : {}),
    ...(typeof value.audio === "string" ? { audio: value.audio } : {}),
  };
}

export function validateTrial(value: unknown): Trial {
  if (
    !isObject(value) ||
    typeof value.trial_num !== "number" ||
    !Array.isArray(value.left) ||
    !Array.isArray(value.right)
  ) {
    throw new Error("Trial must contain trial_num, left, and right");
  }
  const ids = new Set<string>();
  const left = value.left.map((item) => validateObject(item, ids));
  const right = value.right.map((item) => validateObject(item, ids));
  if (left.length !== right.length)
    throw new Error("Trial sides must contain the same number of objects");
  const allIds = new Set([...left, ...right].map((item) => item.object_id));
  const rightById = new Map(right.map((item) => [item.object_id, item]));
  const leftById = new Map(left.map((item) => [item.object_id, item]));
  for (const item of [...left, ...right]) {
    if (item.pair_id.some((id) => !allIds.has(id)))
      throw new Error(`Unknown pair_id in ${item.object_id}`);
  }
  for (const item of left) {
    for (const partnerId of item.pair_id) {
      const partner = rightById.get(partnerId);
      if (!partner || !partner.pair_id.includes(item.object_id)) {
        throw new Error(
          `Pair relationship must be reciprocal and cross-side for ${item.object_id}`,
        );
      }
    }
  }
  for (const item of right) {
    for (const partnerId of item.pair_id) {
      const partner = leftById.get(partnerId);
      if (!partner || !partner.pair_id.includes(item.object_id)) {
        throw new Error(
          `Pair relationship must be reciprocal and cross-side for ${item.object_id}`,
        );
      }
    }
  }
  return { trial_num: value.trial_num, left, right };
}
