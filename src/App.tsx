import { useEffect, useRef, useState } from "react";
import {
  BOARD_HEIGHT,
  BOARD_OBJECT_SIZE,
  BOARD_WIDTH,
  emitContainerEvent,
  loadTrial,
  makeBoardObjects,
  nearestCandidate,
  playTone,
  readSolvedIds,
  writeSolvedIds,
} from "./game";
import type { Trial, BoardObject } from "./game";
import "./App.css";

const TRIAL_PATH = "lang/english/trials/trial-1.json";
type DragState = {
  id: string;
  offsetX: number;
  offsetY: number;
  origin: [number, number];
};

function App() {
  const [trial, setTrial] = useState<Trial | null>(null);
  const [objects, setObjects] = useState<BoardObject[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const userId = new URLSearchParams(window.location.search).get("cr_user_id");

  useEffect(() => {
    loadTrial(TRIAL_PATH)
      .then((loaded) => {
        setTrial(loaded);
        setObjects(makeBoardObjects(loaded, readSolvedIds(loaded.trial_num)));
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load this trial",
        ),
      );
  }, []);

  useEffect(() => {
    if (!celebration) return undefined;
    const timer = window.setTimeout(() => setCelebration(null), 1000);
    return () => window.clearTimeout(timer);
  }, [celebration]);

  function pointFromEvent(
    event: React.PointerEvent,
  ): { x: number; y: number } | null {
    const board = boardRef.current?.getBoundingClientRect();
    return board
      ? { x: event.clientX - board.left, y: event.clientY - board.top }
      : null;
  }

  function startDrag(event: React.PointerEvent, item: BoardObject): void {
    if (item.solved || drag) return;
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
    const point = pointFromEvent(event);
    if (!point) return;
    const width = boardRef.current?.clientWidth ?? BOARD_WIDTH;
    const height = boardRef.current?.clientHeight ?? BOARD_HEIGHT;
    // Object size is fixed in real pixels, so the design-space half-size must scale with
    // the actual rendered board size to keep the object's edges inside the play area.
    const halfWidth = (BOARD_OBJECT_SIZE / 2) * (BOARD_WIDTH / width);
    const halfHeight = (BOARD_OBJECT_SIZE / 2) * (BOARD_HEIGHT / height);
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
    const moved = objects.find((item) => item.object_id === drag.id);
    if (!moved) return;
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
          solvedIds.has(item.object_id)
            ? { ...item, solved: true, x: item.pos[0], y: item.pos[1] }
            : item,
        ),
      );
      writeSolvedIds(trial?.trial_num ?? 0, solvedIds);
      setCelebration(`${dragged.target} + ${candidate.target}`);
      playTone("match");
      playTone("target");
      if (solvedIds.size === objects.length) {
        emitContainerEvent(userId, "trial_completed", {
          type: "trial_completed",
          trial_num: trial?.trial_num,
          lang: "english",
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
      setObjects((current) =>
        current.map((item) =>
          item.object_id === drag.id
            ? { ...item, x: drag.origin[0], y: drag.origin[1] }
            : item,
        ),
      );
    }
    setDrag(null);
    setCandidateId(null);
  }

  function resetTrial(): void {
    if (!trial) return;
    writeSolvedIds(trial.trial_num, new Set());
    setObjects(makeBoardObjects(trial, new Set()));
    setDrag(null);
    setCandidateId(null);
    setCelebration(null);
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
      <section
        className="play-area"
        ref={boardRef}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
      >
        <div className="board-divider" />
        {objects.map((item) => {
          const active = drag?.id === item.object_id;
          const highlighted =
            candidateId === item.object_id || (active && candidateId !== null);
          return (
            <button
              key={item.object_id}
              className={`match-object ${item.side} ${active ? "is-dragging" : ""} ${highlighted ? "is-highlighted" : ""} ${item.solved ? "is-solved" : ""}`}
              style={{
                left: `${(item.x / BOARD_WIDTH) * 100}%`,
                top: `${(item.y / BOARD_HEIGHT) * 100}%`,
              }}
              onPointerDown={(event) => startDrag(event, item)}
              onClick={() => {
                if (!drag && !item.solved) playTone("target");
              }}
              aria-label={item.target}
              disabled={item.solved}
            >
              <span className="object-shadow" />
              <span className="object-glyph">{item.target}</span>
              {item.solved && <span className="solved-check">✓</span>}
            </button>
          );
        })}
        {celebration && (
          <div className="celebration" aria-live="polite">
            <span className="sparkle">✦</span>
            <strong>Yes!</strong>
            <span className="celebration-pair">{celebration}</span>
          </div>
        )}
      </section>
      <footer className="game-footer">
        <span className="footer-spark">✦</span>
        <button
          className="reset-button"
          type="button"
          onClick={resetTrial}
          aria-label="Reset trial"
          title="Reset trial"
        >
          ↻
        </button>
        <span className="footer-spark">✦</span>
      </footer>
    </main>
  );
}

export default App;
