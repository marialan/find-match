import { useState } from "react";
import {
  isTrialCompleted,
  pageCount,
  trialsForPage,
} from "../game.ts";

type TrialSelectorProps = {
  trials: number[];
  langCode: string;
  onSelect: (trialNum: number) => void;
};

export function TrialSelector({
  trials,
  langCode,
  onSelect,
}: TrialSelectorProps) {
  const [page, setPage] = useState(0);
  const pages = pageCount(trials.length);
  const visible = trialsForPage(trials, page);
  const completedCount = trials.filter((trialNum) =>
    isTrialCompleted(trialNum, langCode),
  ).length;

  return (
    <main className="game-shell">
      <header className="game-header">
        <div className="brand-lockup">
          <strong>FIND THE MATCH</strong>
        </div>
        <div
          className="progress-pill"
          aria-label={`${completedCount} of ${trials.length} trials completed`}
        >
          <span className="progress-dot" />
          {completedCount} / {trials.length}
        </div>
      </header>
      <section className="selector-area">
        <ul className="trial-grid">
          {visible.map((trialNum) => {
            const completed = isTrialCompleted(trialNum, langCode);
            return (
              <li key={trialNum}>
                <button
                  className={`trial-tile ${completed ? "is-complete" : ""}`}
                  type="button"
                  onClick={() => onSelect(trialNum)}
                  aria-label={`Trial ${trialNum}${completed ? ", completed" : ""}`}
                >
                  <span className="trial-number">{trialNum}</span>
                  {completed && (
                    <span className="trial-check" aria-hidden="true">
                        ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      {pages > 1 && (
        <footer className="game-footer">
          <button
            className="icon-button"
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0}
            aria-label="Previous page"
            title="Previous page"
          >
            ‹
          </button>
          <span className="page-status" aria-live="polite">
            {page + 1} / {pages}
          </span>
          <button
            className="icon-button"
            type="button"
            onClick={() =>
              setPage((current) => Math.min(pages - 1, current + 1))
            }
            disabled={page === pages - 1}
            aria-label="Next page"
            title="Next page"
          >
            ›
          </button>
        </footer>
      )}
    </main>
  );
}
