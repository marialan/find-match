import { loadBinary } from "./assets.ts";
import type { Trial, TrialObject } from "./types.ts";

let audioContext: AudioContext | null = null;
const audioBuffers = new Map<string, AudioBuffer>();

function getAudioContext(): AudioContext | null {
  try {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === "suspended") void audioContext.resume();
    return audioContext;
  } catch {
    return null;
  }
}

export async function preloadAudio(trial: Trial): Promise<void> {
  try {
    window.speechSynthesis?.getVoices();
  } catch {
    // Speech synthesis is optional.
  }
  const context = getAudioContext();
  if (!context) return;
  const paths = new Set(
    [...trial.left, ...trial.right].flatMap((item) =>
      item.audio ? [item.audio] : [],
    ),
  );
  await Promise.allSettled(
    [...paths].map(async (path) => {
      audioBuffers.set(
        path,
        await context.decodeAudioData(await loadBinary(path)),
      );
    }),
  );
}

function speak(text: string, speechLocale: string): boolean {
  try {
    if (!("speechSynthesis" in window)) return false;
    const locale = speechLocale === "english" ? "en-GB" : speechLocale;
    const requested = locale.toLowerCase();
    const voices = window.speechSynthesis
      .getVoices()
      .filter((candidate) => candidate.localService);
    const voice =
      voices.find((candidate) => candidate.lang.toLowerCase() === requested) ??
      voices.find((candidate) =>
        candidate.lang.toLowerCase().startsWith(`${requested.split("-")[0]}-`),
      );
    if (!voice) return false;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function playPronunciation(
  item: Pick<TrialObject, "audio" | "target">,
  speechLocale: string,
): void {
  const buffer = item.audio ? audioBuffers.get(item.audio) : undefined;
  const context = getAudioContext();
  if (buffer && context) {
    try {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start();
      return;
    } catch {
      // Fall back to generated speech.
    }
  }
  if (!speak(item.target, speechLocale)) playTone("target");
}

export function playTone(kind: "match" | "miss" | "target"): void {
  try {
    const context = getAudioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const notes =
      kind === "match" ? [523, 659, 784] : kind === "miss" ? [180, 130] : [440];
    const now = context.currentTime;
    oscillator.type = kind === "miss" ? "sawtooth" : "sine";
    oscillator.frequency.setValueAtTime(notes[0], now);
    notes.slice(1).forEach((note, index) =>
      oscillator.frequency.setValueAtTime(note, now + (index + 1) * 0.12),
    );
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      now + (kind === "match" ? 0.48 : 0.28),
    );
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + (kind === "match" ? 0.5 : 0.3));
  } catch {
    // Audio feedback is optional.
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
