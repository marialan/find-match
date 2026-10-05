import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  emitContainerEvent,
  isTrialCompleted,
  loadLanguagePack,
  loadTrial,
  loadTrialIndex,
  makeBoardObjects,
  nearestCandidate,
  nextTrialNumber,
  pageCount,
  playPronunciation,
  playTone,
  preloadAudio,
  readSolvedIds,
  trialIndexPath,
  trialNumberFromSearch,
  trialPath,
  trialsForPage,
  writeSolvedIds,
  writeTrialTotal,
  wordFontSize,
  worldLayout,
} from "./game";
import type { Trial, BoardObject, LanguagePack } from "./game";
import crateImage from "./assets/crate.png";
import "./App.css";

const AUDIO_ICON = "🔊";
const TAP_MOVE_TOLERANCE_PX = 10;

function labelFor(item: BoardObject): string {
  return item.type === "audio" ? "Play sound" : item.target;
}

type DragState = {
  id: string;
  offsetX: number;
  offsetY: number;
  origin: [number, number];
};

type ReturnState = {
  id: string;
  origin: [number, number];
};

type TrialBoardProps = {
  trialNum: number;
  languagePack: LanguagePack;
  onBack: () => void;
  onNext: (() => void) | null;
};

function TrialBoard({ trialNum, languagePack, onBack, onNext }: TrialBoardProps) {
  const [trial, setTrial] = useState<Trial | null>(null);
  const [objects, setObjects] = useState<BoardObject[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [returning, setReturning] = useState<ReturnState | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [celebratingId, setCelebratingId] = useState<string | null>(null);
  const [missingImages, setMissingImages] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [sizes, setSizes] = useState({ targetSize: 120, wordHeight: 60, cardWidth: 160 });
  const [listeningId, setListeningId] = useState<string | null>(null);
  const playAreaRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);
  const completesTrialAfterMatchRef = useRef(false);
  // Touch input jitters during a tap, so only movement past this radius counts as a drag.
  const downPointRef = useRef<{ x: number; y: number } | null>(null);
  const userId = new URLSearchParams(window.location.search).get("cr_user_id");

  useEffect(() => {
    const playArea = playAreaRef.current;
    if (!playArea) return undefined;
    const updateScale = (width: number, height: number) => {
      if (!trial || width <= 0 || height <= 0) return;
      const layout = worldLayout(makeBoardObjects(trial, readSolvedIds(trial.trial_num, languagePack.code)), width, height);
      setSizes({ targetSize: layout.targetSize, wordHeight: layout.wordHeight, cardWidth: layout.cardWidth });
      setObjects(layout.objects);
      setDrag(null);
      setReturning(null);
      setCandidateId(null);
    };
    updateScale(playArea.clientWidth, playArea.clientHeight);
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      updateScale(width, height);
    });
    observer.observe(playArea);
    return () => observer.disconnect();
    // playAreaRef only attaches once the board has a trial to render, so this must
    // re-run after that first render instead of just once on mount.
  }, [trial, languagePack.code]);

  useEffect(() => {
    loadTrial(trialPath(languagePack.code, trialNum), languagePack.code)
      .then(async (loaded) => {
        await preloadAudio(loaded);
        setTrial(loaded);
        writeTrialTotal(loaded.trial_num, loaded.left.length + loaded.right.length, languagePack.code);
        setObjects(makeBoardObjects(loaded, readSolvedIds(loaded.trial_num, languagePack.code)));
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load this trial",
        ),
      );
  }, [trialNum, languagePack]);

  function pointFromEvent(
    event: React.PointerEvent,
  ): { x: number; y: number } | null {
    const board = boardRef.current?.getBoundingClientRect();
    return board
      ? { x: event.clientX - board.left, y: event.clientY - board.top }
      : null;
  }

  function startDrag(event: React.PointerEvent, item: BoardObject): void {
    movedRef.current = false;
    downPointRef.current = null;
    if (item.solved || item.fixed || drag || returning) return;
    const point = pointFromEvent(event);
    if (!point) return;
    downPointRef.current = point;
    event.currentTarget.setPointerCapture(event.pointerId);
    const board = boardRef.current;
    const designPoint = board
      ? {
          x: (point.x / board.clientWidth) * BOARD_WIDTH,
          y: (point.y / board.clientHeight) * BOARD_HEIGHT,
        }
      : point;
    setDrag({
      id: item.object_id,
      offsetX: designPoint.x - item.x,
      offsetY: designPoint.y - item.y,
      origin: [item.x, item.y],
    });
    setCandidateId(null);
  }

  function moveDrag(event: React.PointerEvent): void {
    if (!drag) return;
    const point = pointFromEvent(event);
    if (!point) return;
    const start = downPointRef.current;
    if (!start || Math.hypot(point.x - start.x, point.y - start.y) <= TAP_MOVE_TOLERANCE_PX) return;
    movedRef.current = true;
    const width = boardRef.current?.clientWidth ?? BOARD_WIDTH;
    const height = boardRef.current?.clientHeight ?? BOARD_HEIGHT;
    const moved = objects.find((item) => item.object_id === drag.id);
    if (!moved) return;
    const halfWidth = (sizes.cardWidth / 2) * (BOARD_WIDTH / width);
    const halfHeight = (sizes.wordHeight / 2) * (BOARD_HEIGHT / height);
    const x = Math.max(
      halfWidth,
      Math.min(
        (point.x / width) * BOARD_WIDTH - drag.offsetX,
        BOARD_WIDTH - halfWidth,
      ),
    );
    const y = Math.max(
      halfHeight,
      Math.min(
        (point.y / height) * BOARD_HEIGHT - drag.offsetY,
        BOARD_HEIGHT - halfHeight,
      ),
    );
    const next = { ...moved, x, y };
    setObjects((current) =>
      current.map((item) => (item.object_id === drag.id ? next : item)),
    );
    setCandidateId(nearestCandidate(next, objects)?.object_id ?? null);
  }

  function endDrag(event: React.PointerEvent): void {
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const endPoint = pointFromEvent(event);
    const startPoint = downPointRef.current;
    if (
      startPoint &&
      endPoint &&
      Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y) > TAP_MOVE_TOLERANCE_PX
    ) {
      movedRef.current = true;
    }
    if (!movedRef.current) {
      setDrag(null);
      setCandidateId(null);
      return;
    }
    const dragged = objects.find((item) => item.object_id === drag.id);
    const candidate = dragged ? nearestCandidate(dragged, objects) : null;
    if (!dragged || !candidate) {
      setReturning({ id: drag.id, origin: drag.origin });
      setDrag(null);
      setCandidateId(null);
      return;
    }
    if (dragged.pair_id.includes(candidate.object_id)) {
      const solvedIds = new Set(
        objects.filter((item) => item.solved).map((item) => item.object_id),
      );
      solvedIds.add(dragged.object_id);
      solvedIds.add(candidate.object_id);
      setObjects((current) =>
          current.map((item) =>
            item.object_id === dragged.object_id
              ? {
                  ...item,
                  solved: true,
                  mergedInto: candidate.object_id,
                  x: candidate.x,
                  y: candidate.y,
                }
              : item.object_id === candidate.object_id
                ? { ...item, solved: true }
                : item,
          ),
      );
      writeSolvedIds(trial?.trial_num ?? 0, solvedIds, languagePack.code);
      playTone("match");
      playPronunciation(candidate, languagePack.speechLocale);
      setCelebration(null);
      setCelebratingId(candidate.object_id);
      completesTrialAfterMatchRef.current = solvedIds.size === objects.length;
      if (completesTrialAfterMatchRef.current) {
        emitContainerEvent(userId, "trial_completed", {
          type: "trial_completed",
          trial_num: trial?.trial_num,
          lang: languagePack.code,
          pairs_completed: objects.length / 2,
        });
        emitContainerEvent(userId, "summary_data", {
          type: "summary_data",
          operation: "add",
          trials_completed: 1,
        });
      }
    } else {
      playTone("miss");
      setReturning({ id: drag.id, origin: drag.origin });
    }
    setDrag(null);
    setCandidateId(null);
  }

  function finishReturn(): void {
    if (!returning) return;
    setObjects((current) =>
      current.map((item) =>
        item.object_id === returning.id
          ? { ...item, x: returning.origin[0], y: returning.origin[1] }
          : item,
      ),
    );
    setReturning(null);
  }

  function finishCelebration(): void {
    setCelebratingId(null);
    if (completesTrialAfterMatchRef.current) {
      completesTrialAfterMatchRef.current = false;
      setCelebration("Trial complete!");
    }
  }

  function resetTrial(): void {
    if (!trial) return;
    writeSolvedIds(trial.trial_num, new Set(), languagePack.code);
    const board = boardRef.current;
    setObjects(worldLayout(makeBoardObjects(trial, new Set()), board?.clientWidth ?? BOARD_WIDTH, board?.clientHeight ?? BOARD_HEIGHT).objects);
    setDrag(null);
    setReturning(null);
    setCandidateId(null);
    setCelebration(null);
    setCelebratingId(null);
    setListeningId(null);
    completesTrialAfterMatchRef.current = false;
  }

  function contentFor(item: BoardObject): ReactNode {
    if (item.type === "audio") return (
      <>
        <img className="object-image crate-image" src={crateImage} alt="" draggable={false} />
        <span className="listen-icon" aria-hidden="true">{AUDIO_ICON}</span>
      </>
    );
    if (!item.image) return <span className="word-target">{item.target}</span>;
    if (missingImages.has(item.object_id))
      return <span className="image-placeholder" aria-hidden="true" />;
    return (
      <img
        className="object-image"
        src={item.image}
        alt=""
        draggable={false}
        onError={() =>
          setMissingImages((current) => new Set(current).add(item.object_id))
        }
      />
    );
  }

  if (error)
    return (
      <main className="status-screen">
        <div className="error-mark">!</div>
        <p>Something went wrong loading this board.</p>
        <small>{error}</small>
      </main>
    );
  if (!trial)
    return (
      <main className="status-screen" role="status" aria-label="Loading">
        <div className="loader-orbit" />
      </main>
    );

  const solvedCount = objects.filter((item) => item.solved).length / 2;
  return (
    <main className="game-shell world-shell">
      <header className="game-header">
        <div
          className="progress-pill"
          aria-label={`${solvedCount} pairs found`}
        >
          {Array.from({ length: objects.length / 2 }, (_, index) => (
            <span key={index} className={`pair-progress ${index < solvedCount ? "is-found" : ""}`} aria-hidden="true">★</span>
          ))}
        </div>
      </header>
      <section className="play-area" ref={playAreaRef}>
        <div
          className="board"
          ref={boardRef}
          onPointerDown={celebration ? () => setCelebration(null) : undefined}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
        >
          {objects.filter((item) => !item.mergedInto).map((item) => {
            const active = drag?.id === item.object_id;
            const isReturning = returning?.id === item.object_id;
            const highlighted =
              candidateId === item.object_id ||
              (active && candidateId !== null);
            const merged = objects.find(
              (other) => other.mergedInto === item.object_id,
            );
            const itemWidth = item.fixed ? sizes.targetSize : sizes.cardWidth;
            const itemHeight = item.fixed ? sizes.targetSize : sizes.wordHeight;
            const isCelebrating = celebratingId === item.object_id;
            return (
              <button
                key={item.object_id}
                className={`match-object ${item.side} ${item.fixed ? "world-target" : "world-word"} ${item.image ? "has-image" : ""} ${item.type === "audio" ? "has-audio" : ""} ${active ? "is-dragging" : ""} ${isReturning ? "is-returning" : ""} ${highlighted ? "is-highlighted" : ""} ${item.solved ? "is-solved" : ""} ${merged ? "world-combined" : ""} ${isCelebrating ? "is-celebrating" : ""} ${listeningId === item.object_id ? "is-listening" : ""}`}
                style={{
                  left: `${(item.x / BOARD_WIDTH) * 100}%`,
                  top: `${(item.y / BOARD_HEIGHT) * 100}%`,
                  ...({
                    "--object-width": `${itemWidth}px`,
                    "--object-size": `${itemHeight}px`,
                    "--label-width": `${sizes.cardWidth}px`,
                    "--label-height": `${sizes.wordHeight}px`,
                    "--word-font-size": `${wordFontSize(itemWidth, item.target.length, itemHeight)}px`,
                  } as React.CSSProperties),
                }}
                onPointerDown={(event) => startDrag(event, item)}
                onAnimationEnd={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (isReturning) finishReturn();
                  else if (isCelebrating) finishCelebration();
                  else setListeningId(null);
                }}
                onClick={() => {
                  if (returning) return;
                  if (movedRef.current) {
                    movedRef.current = false;
                    return;
                  }
                  playPronunciation(item, languagePack.speechLocale);
                  setListeningId(item.object_id);
                }}
                aria-label={
                  merged
                    ? `${merged.target} matched`
                    : labelFor(item)
                }
                data-object-id={item.object_id}
                data-fixed={item.fixed}
              >
                <span className="object-shadow" />
                <span className="object-glyph">
                  {contentFor(item)}
                </span>
                {item.fixed && (
                  <span className={`word-landing ${merged ? "is-filled" : ""}`} aria-hidden={!merged}
                    style={{ "--word-font-size": `${wordFontSize(sizes.cardWidth, merged?.target.length ?? 1, sizes.wordHeight)}px` } as React.CSSProperties}>
                    {merged && <span className="word-target">{merged.target}</span>}
                  </span>
                )}
                {isCelebrating && (
                  <span className="match-sparkles" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                )}
                {item.solved && <span className="solved-check">✓</span>}
              </button>
            );
          })}
          {celebration && (
            <div className="celebration" aria-live="polite" aria-label="Trial complete">
              <span className="sparkle" aria-hidden="true">🎉</span>
            </div>
          )}
        </div>
      </section>
      <footer className="game-footer">
        <button
          className="icon-button"
          type="button"
          onClick={onBack}
          aria-label="Back to trial selector"
          title="Back to trial selector"
        >
          ↩
        </button>
        <span className="footer-spark">✦</span>
        <button
          className="icon-button"
          type="button"
          onClick={resetTrial}
          aria-label="Reset trial"
          title="Reset trial"
        >
          ↻
        </button>
        <span className="footer-spark">✦</span>
        {onNext && objects.length > 0 && objects.every((item) => item.solved) ? (
          <button
            className="icon-button is-next"
            type="button"
            onClick={onNext}
            aria-label="Next trial"
            title="Next trial"
          >
            →
          </button>
        ) : (
          <span className="icon-button-placeholder" aria-hidden="true" />
        )}
      </footer>
    </main>
  );
}

function TrialSelector({
  trials,
  langCode,
  onSelect,
}: {
  trials: number[];
  langCode: string;
  onSelect: (trialNum: number) => void;
}) {
  const [page, setPage] = useState(0);
  const pages = pageCount(trials.length);
  const visible = trialsForPage(trials, page);
  const completedCount = trials.filter((trialNum) => isTrialCompleted(trialNum, langCode)).length;

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
            onClick={() => setPage((current) => Math.min(pages - 1, current + 1))}
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

// Keeps a reload on the same trial and makes the selector the URL's resting state.
function syncTrialParam(trialNum: number | null): void {
  try {
    const url = new URL(window.location.href);
    if (trialNum === null) url.searchParams.delete("trial");
    else url.searchParams.set("trial", String(trialNum));
    window.history.replaceState(null, "", url.toString());
  } catch {
    /* file:// origins may reject history updates */
  }
}

function App() {
  const [trials, setTrials] = useState<number[] | null>(null);
  const [languagePack, setLanguagePack] = useState<LanguagePack | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const langCode = new URLSearchParams(window.location.search).get("cr_lang") ?? "english";
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
            reason instanceof Error ? reason.message : "Unable to load this language pack",
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
    return <TrialSelector trials={trials} langCode={languagePack.code} onSelect={select} />;

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
