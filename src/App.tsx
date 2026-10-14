import { useEffect, useState } from "react";
import {
  loadLanguagePack,
  loadTrialIndex,
  nextTrialNumber,
  trialIndexPath,
  trialNumberFromSearch,
} from "./game.ts";
import type { LanguagePack } from "./game.ts";
import { TrialBoard } from "./components/TrialBoard.tsx";
import { TrialSelector } from "./components/TrialSelector.tsx";
import "./App.css";

function syncTrialParam(trialNum: number | null): void {
  try {
    const url = new URL(window.location.href);
    if (trialNum === null) url.searchParams.delete("trial");
    else url.searchParams.set("trial", String(trialNum));
    window.history.replaceState(null, "", url.toString());
  } catch {
    // file:// origins may reject history updates.
  }
}

function App() {
  const [trials, setTrials] = useState<number[] | null>(null);
  const [languagePack, setLanguagePack] = useState<LanguagePack | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const langCode =
    new URLSearchParams(window.location.search).get("cr_lang") ?? "english";
  const [selected, setSelected] = useState<number | null>(() =>
    trialNumberFromSearch(window.location.search),
  );

  useEffect(() => {
    let cancelled = false;
    void loadLanguagePack(langCode)
      .then(async (pack) => {
        const loadedTrials = await loadTrialIndex(trialIndexPath(pack.code));
        if (!cancelled) {
          setLanguagePack(pack);
          setTrials(loadedTrials);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setLoadError(
            reason instanceof Error
              ? reason.message
              : "Unable to load this language pack",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [langCode]);

  function select(trialNum: number | null): void {
    syncTrialParam(trialNum);
    setSelected(trialNum);
  }

  if (loadError)
    return (
      <main className="status-screen">
        <div className="error-mark">!</div>
        <p>Something went wrong loading this board.</p>
        <small>{loadError}</small>
      </main>
    );

  if (!trials || !languagePack)
    return (
      <main className="status-screen" role="status" aria-label="Loading">
        <div className="loader-orbit" />
      </main>
    );

  if (selected === null)
    return (
      <TrialSelector
        trials={trials}
        langCode={languagePack.code}
        onSelect={select}
      />
    );

  const next = nextTrialNumber(trials, selected);
  return (
    <TrialBoard
      key={selected}
      trialNum={selected}
      languagePack={languagePack}
      onBack={() => select(null)}
      onNext={next === null ? null : () => select(next)}
    />
  );
}

export default App;
