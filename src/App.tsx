import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BOARD_HEIGHT,
  BOARD_IMAGE_OBJECT_SIZE,
  BOARD_OBJECT_MIN_SIZE,
  BOARD_OBJECT_SIZE,
  BOARD_WIDTH,
  boardObjectSize,
  boardObjectWidth,
  boardScale,
  emitContainerEvent,
  fitsHalf,
  isTrialCompleted,
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
  resolveOverlaps,
  trialIndexPath,
  trialNumberFromSearch,
  trialPath,
  trialsForPage,
  writeSolvedIds,
  writeTrialTotal,
  wordFontSize,
} from "./game";
import type { Trial, BoardObject, LayoutMetrics } from "./game";
import "./App.css";

const LEARNING_LANG = "english";
const AUDIO_ICON = "🔊";

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
  onBack: () => void;
  onNext: (() => void) | null;
};

function TrialBoard({ trialNum, onBack, onNext }: TrialBoardProps) {
  const [trial, setTrial] = useState<Trial | null>(null);
  const [objects, setObjects] = useState<BoardObject[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [returning, setReturning] = useState<ReturnState | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [celebratingId, setCelebratingId] = useState<string | null>(null);
  const [missingImages, setMissingImages] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pxPerUnit, setPxPerUnit] = useState(1);
  const playAreaRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);
  const userId = new URLSearchParams(window.location.search).get("cr_user_id");

  useEffect(() => {
    const playArea = playAreaRef.current;
    if (!playArea) return undefined;
    // scale is the object-only sizing factor: the more constrained of the board's
    // width or height ratios, so square objects fit within whichever axis is
    // tightest even though the board itself may stretch to a different aspect ratio
    // (image trials on portrait boards may grow further, see boardScale).
    const updateScale = (width: number, height: number) => {
      const hasImages = [...(trial?.left ?? []), ...(trial?.right ?? [])].some((item) => item.image);
      const nextScale = boardScale(width, height, hasImages);
      setScale(nextScale);
      if (width > 0) setPxPerUnit(width / BOARD_WIDTH);
      // Restored combined tiles and resized cards can collide with neighbours.
      if (width > 0 && height > 0)
        setObjects((current) =>
          resolveOverlaps(current, null, {
            scale: nextScale,
            maxSize: current.some((item) => item.image)
              ? BOARD_IMAGE_OBJECT_SIZE
              : BOARD_OBJECT_SIZE,
            unitsPerPx: [BOARD_WIDTH / width, BOARD_HEIGHT / height],
          }),
        );
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
  }, [trial]);

  useEffect(() => {
    loadTrial(trialPath(LEARNING_LANG, trialNum))
      .then(async (loaded) => {
        await preloadAudio(loaded);
        setTrial(loaded);
        writeTrialTotal(loaded.trial_num, loaded.left.length + loaded.right.length);
        setObjects(makeBoardObjects(loaded, readSolvedIds(loaded.trial_num)));
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load this trial",
        ),
      );
  }, [trialNum]);

  function layoutMetrics(): LayoutMetrics {
    const board = boardRef.current;
    return {
      scale,
      maxSize: objects.some((item) => item.image)
        ? BOARD_IMAGE_OBJECT_SIZE
        : BOARD_OBJECT_SIZE,
      unitsPerPx: [
        BOARD_WIDTH / (board?.clientWidth || BOARD_WIDTH),
        BOARD_HEIGHT / (board?.clientHeight || BOARD_HEIGHT),
      ],
    };
  }

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
    if (item.solved || drag || returning) return;
    const point = pointFromEvent(event);
    if (!point) return;
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
    movedRef.current = true;
    const point = pointFromEvent(event);
    if (!point) return;
    const width = boardRef.current?.clientWidth ?? BOARD_WIDTH;
    const height = boardRef.current?.clientHeight ?? BOARD_HEIGHT;
    const maxSize = objects.some((item) => item.image)
      ? BOARD_IMAGE_OBJECT_SIZE
      : BOARD_OBJECT_SIZE;
    const moved = objects.find((item) => item.object_id === drag.id);
    if (!moved) return;
    const halfWidth = (boardObjectWidth(moved, objects, scale, maxSize, pxPerUnit) / 2) * (BOARD_WIDTH / width);
    const halfHeight = (boardObjectSize(scale, maxSize) / 2) * (BOARD_HEIGHT / height);
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
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const dragged = objects.find((item) => item.object_id === drag.id);
    const candidate = dragged ? nearestCandidate(dragged, objects) : null;
    if (!dragged || !candidate) {
      const metrics = layoutMetrics();
      setObjects((current) => resolveOverlaps(current, drag.id, metrics));
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
      const metrics = layoutMetrics();
      setObjects((current) =>
        resolveOverlaps(
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
          candidate.object_id,
          metrics,
        ),
      );
      writeSolvedIds(trial?.trial_num ?? 0, solvedIds);
      playTone("match");
      playPronunciation(candidate, LEARNING_LANG);
      setCelebration(null);
      setCelebratingId(candidate.object_id);
      if (solvedIds.size === objects.length) {
        emitContainerEvent(userId, "trial_completed", {
          type: "trial_completed",
          trial_num: trial?.trial_num,
          lang: LEARNING_LANG,
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
    if (objects.every((item) => item.solved)) setCelebration("Trial complete!");
  }

  function resetTrial(): void {
    if (!trial) return;
    writeSolvedIds(trial.trial_num, new Set());
    const metrics = layoutMetrics();
    setObjects(resolveOverlaps(makeBoardObjects(trial, new Set()), null, metrics));
    setDrag(null);
    setReturning(null);
    setCandidateId(null);
    setCelebration(null);
    setCelebratingId(null);
  }

  function contentFor(item: BoardObject): ReactNode {
    if (item.type === "audio") return AUDIO_ICON;
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
      <main className="status-screen">
        <div className="loader-orbit" />
        <p>Getting your matching game ready</p>
      </main>
    );

  const solvedCount = objects.filter((item) => item.solved).length / 2;
  const maxObjectSize = objects.some((item) => item.image)
    ? BOARD_IMAGE_OBJECT_SIZE
    : BOARD_OBJECT_SIZE;

  return (
    <main className="game-shell">
      <header className="game-header">
        <div className="brand-lockup">
          <strong>FIND THE MATCH</strong>
        </div>
        <div
          className="progress-pill"
          aria-label={`${solvedCount} pairs found`}
        >
          <span className="progress-dot" />
          {solvedCount} / {objects.length / 2}
        </div>
      </header>
      <section className="play-area" ref={playAreaRef}>
        <div
          className="board"
          ref={boardRef}
          onPointerDown={celebration ? () => setCelebration(null) : undefined}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          style={{
            ...({
              "--board-scale": scale,
              "--board-object-max": `${maxObjectSize}px`,
              "--board-object-min": `${BOARD_OBJECT_MIN_SIZE}px`,
            } as React.CSSProperties),
          }}
        >
          <div className="board-divider" />
          {objects.filter((item) => !item.mergedInto).map((item) => {
            const active = drag?.id === item.object_id;
            const isReturning = returning?.id === item.object_id;
            const highlighted =
              candidateId === item.object_id ||
              (active && candidateId !== null);
            const merged = objects.find(
              (other) => other.mergedInto === item.object_id,
            );
            const pair = merged
              ? item.side === "left"
                ? [item, merged]
                : [merged, item]
              : null;
            const itemWidth = boardObjectWidth(item, objects, scale, maxObjectSize, pxPerUnit);
            const itemHeight = boardObjectSize(scale, maxObjectSize);
            const pairWidths = pair?.map((part) => boardObjectWidth(part, objects, scale, maxObjectSize, pxPerUnit));
            const combinedWidth = pairWidths?.reduce((total, width) => total + width, 0) ?? 0;
            const isCelebrating = celebratingId === item.object_id;
            return (
              <button
                key={item.object_id}
                className={`match-object ${item.side} ${item.image ? "has-image" : ""} ${active ? "is-dragging" : ""} ${isReturning ? "is-returning" : ""} ${highlighted ? "is-highlighted" : ""} ${item.solved ? "is-solved" : ""} ${pair ? "is-combined" : ""} ${isCelebrating ? "is-celebrating" : ""}`}
                style={{
                  left: pair
                    ? !fitsHalf(combinedWidth / pxPerUnit)
                      ? `clamp(var(--combined-half-width), ${(item.x / BOARD_WIDTH) * 100}%, calc(100% - var(--combined-half-width)))`
                      : item.x < BOARD_WIDTH / 2
                      ? `clamp(var(--combined-half-width), ${(item.x / BOARD_WIDTH) * 100}%, calc(50% - var(--combined-half-width)))`
                      : `clamp(calc(50% + var(--combined-half-width)), ${(item.x / BOARD_WIDTH) * 100}%, calc(100% - var(--combined-half-width)))`
                    : `${(item.x / BOARD_WIDTH) * 100}%`,
                  top: `${(item.y / BOARD_HEIGHT) * 100}%`,
                  ...({
                    "--object-width": `${itemWidth}px`,
                    "--word-font-size": `${wordFontSize(itemWidth, item.target.length, itemHeight)}px`,
                    ...(pair && pairWidths
                      ? {
                          "--combined-width": `${combinedWidth}px`,
                          "--combined-half-width": `${combinedWidth / 2}px`,
                          "--combined-first-width": `${pairWidths[0]}px`,
                          "--combined-second-width": `${pairWidths[1]}px`,
                          "--celebration-origin-x": item.side === "left" ? "left" : "right",
                          "--celebration-origin-y": item.y < BOARD_HEIGHT / 2 ? "top" : "bottom",
                        }
                      : {}),
                  } as React.CSSProperties),
                }}
                onPointerDown={(event) => startDrag(event, item)}
                onAnimationEnd={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (isReturning) finishReturn();
                  else if (isCelebrating) finishCelebration();
                }}
                onClick={() => {
                  if (!drag && !returning && !movedRef.current)
                    playPronunciation(item, LEARNING_LANG);
                }}
                aria-label={
                  pair
                    ? `${pair.map((part) => (part.type === "audio" ? "sound" : part.target)).join(" ")} matched`
                    : labelFor(item)
                }
              >
                <span className="object-shadow" />
                <span className="object-glyph">
                  {pair
                    ? pair.map((part) => (
                        <span key={part.object_id} className={`glyph-part ${part.side} ${part.image ? "has-image" : ""}`}>
                          <span
                            className="glyph-content"
                            style={{
                              "--word-font-size": `${wordFontSize(
                                pairWidths?.[pair.indexOf(part)] ?? itemHeight,
                                part.target.length,
                                itemHeight,
                              )}px`,
                            } as React.CSSProperties}
                          >
                            {contentFor(part)}
                          </span>
                        </span>
                      ))
                    : contentFor(item)}
                </span>
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
  onSelect,
}: {
  trials: number[];
  onSelect: (trialNum: number) => void;
}) {
  const [page, setPage] = useState(0);
  const pages = pageCount(trials.length);
  const visible = trialsForPage(trials, page);
  const completedCount = trials.filter((trialNum) => isTrialCompleted(trialNum)).length;

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
            const completed = isTrialCompleted(trialNum);
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
            Page {page + 1} of {pages}
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
  const [selected, setSelected] = useState<number | null>(() =>
    trialNumberFromSearch(window.location.search),
  );

  useEffect(() => {
    void loadTrialIndex(trialIndexPath(LEARNING_LANG)).then(setTrials);
  }, []);

  function select(trialNum: number | null): void {
    syncTrialParam(trialNum);
    setSelected(trialNum);
  }

  if (!trials)
    return (
      <main className="status-screen">
        <div className="loader-orbit" />
        <p>Getting your matching game ready</p>
      </main>
    );

  if (selected === null)
    return <TrialSelector trials={trials} onSelect={select} />;

  const next = nextTrialNumber(trials, selected);
  return (
    <TrialBoard
      key={selected}
      trialNum={selected}
      onBack={() => select(null)}
      onNext={next === null ? null : () => select(next)}
    />
  );
}

export default App;
