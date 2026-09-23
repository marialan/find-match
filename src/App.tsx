import { useEffect, useRef, useState } from "react";
import {
  BOARD_HEIGHT,
  BOARD_OBJECT_MIN_SIZE,
  BOARD_OBJECT_SIZE,
  BOARD_WIDTH,
  boardObjectSize,
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

type ReturnState = {
  id: string;
  origin: [number, number];
};

type Connection = {
  id: string;
  leftId: string;
  rightId: string;
  animate: boolean;
  color: string;
};

const MATCH_PALETTE = [
  "hsl(0 62% 58%)",
  "hsl(24 68% 58%)",
  "hsl(48 70% 58%)",
  "hsl(122 38% 48%)",
  "hsl(176 48% 46%)",
  "hsl(214 54% 56%)",
  "hsl(282 42% 56%)",
  "hsl(18 62% 54%)",
] as const;

function pairStrokeColor(leftId: string, rightId: string): string {
  const ids = [leftId, rightId].sort();
  let hash = 0;
  for (const char of ids.join("-")) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return MATCH_PALETTE[hash % MATCH_PALETTE.length];
}

function connectionStrokeColor(connection: Connection): string {
  return connection.color;
}

function solvedObjectColor(item: BoardObject, connections: Connection[]): string {
  const partnerId = item.pair_id.find((id) => id !== item.object_id) ?? item.object_id;
  const matchingConnection = connections.find((connection) => {
    const ids = [connection.leftId, connection.rightId];
    return ids.includes(item.object_id) && ids.includes(partnerId);
  });
  return matchingConnection?.color ?? pairStrokeColor(item.object_id, partnerId);
}

// Groups already-solved objects into left/right pairs via pair_id, with no
// animation flag — used on load so restored progress renders statically.
function buildConnections(objects: BoardObject[]): Connection[] {
  const usedRight = new Set<string>();
  const connections: Connection[] = [];
  for (const left of objects.filter((item) => item.side === "left" && item.solved)) {
    const right = objects.find(
      (item) =>
        item.side === "right" &&
        item.solved &&
        !usedRight.has(item.object_id) &&
        left.pair_id.includes(item.object_id),
    );
    if (right) {
      usedRight.add(right.object_id);
      connections.push({
        id: `${left.object_id}-${right.object_id}`,
        leftId: left.object_id,
        rightId: right.object_id,
        animate: false,
        color: MATCH_PALETTE[connections.length % MATCH_PALETTE.length],
      });
    }
  }
  return connections;
}

function App() {
  const [trial, setTrial] = useState<Trial | null>(null);
  const [objects, setObjects] = useState<BoardObject[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [returning, setReturning] = useState<ReturnState | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [boardSize, setBoardSize] = useState({ width: BOARD_WIDTH, height: BOARD_HEIGHT });
  const playAreaRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const userId = new URLSearchParams(window.location.search).get("cr_user_id");

  useEffect(() => {
    const playArea = playAreaRef.current;
    if (!playArea) return undefined;
    // scale is the object-only sizing factor: the more constrained of the board's
    // width or height ratios, so square objects fit within whichever axis is
    // tightest even though the board itself may stretch to a different aspect ratio.
    const updateScale = (width: number, height: number) => {
      setScale(Math.min(width / BOARD_WIDTH, height / BOARD_HEIGHT, 1));
      // The board fills the play area's content box exactly, so its rendered
      // pixel size tracks the play area's size 1:1 — kept for connection math.
      setBoardSize({ width, height });
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
    loadTrial(TRIAL_PATH)
      .then((loaded) => {
        setTrial(loaded);
        const loadedObjects = makeBoardObjects(loaded, readSolvedIds(loaded.trial_num));
        setObjects(loadedObjects);
        setConnections(buildConnections(loadedObjects));
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load this trial",
        ),
      );
  }, []);

  function pointFromEvent(
    event: React.PointerEvent,
  ): { x: number; y: number } | null {
    const board = boardRef.current?.getBoundingClientRect();
    return board
      ? { x: event.clientX - board.left, y: event.clientY - board.top }
      : null;
  }

  function startDrag(event: React.PointerEvent, item: BoardObject): void {
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
    const point = pointFromEvent(event);
    if (!point) return;
    const width = boardRef.current?.clientWidth ?? BOARD_WIDTH;
    const height = boardRef.current?.clientHeight ?? BOARD_HEIGHT;
    // Object size follows the same clamp() the CSS uses, so the design-space half-size
    // matches the object's actual rendered footprint at any board scale.
    const halfWidth = (boardObjectSize(scale) / 2) * (BOARD_WIDTH / width);
    const halfHeight = (boardObjectSize(scale) / 2) * (BOARD_HEIGHT / height);
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
      const leftObject = dragged.side === "left" ? dragged : candidate;
      const rightObject = dragged.side === "left" ? candidate : dragged;
      setConnections((current) => [
        ...current,
        {
          id: `${leftObject.object_id}-${rightObject.object_id}`,
          leftId: leftObject.object_id,
          rightId: rightObject.object_id,
          animate: true,
          color: MATCH_PALETTE[current.length % MATCH_PALETTE.length],
        },
      ]);
      playTone("match");
      playTone("target");
      if (solvedIds.size === objects.length) {
        setCelebration("Trial complete!");
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
      } else {
        setCelebration(null);
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

  function resetTrial(): void {
    if (!trial) return;
    writeSolvedIds(trial.trial_num, new Set());
    setObjects(makeBoardObjects(trial, new Set()));
    setDrag(null);
    setReturning(null);
    setCandidateId(null);
    setCelebration(null);
    setConnections([]);
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
  const halfObjectSize = boardObjectSize(scale) / 2;
  const connectionStrokeWidth = Math.max(5, 8 * scale);

  // Anchor point a little inside the object's inner edge (not right at the
  // boundary) so the line visually emerges from underneath the object, which
  // sits above the connection layer in stacking order.
  function connectionEdgePoint(item: BoardObject): { x: number; y: number } {
    const cx = (item.x / BOARD_WIDTH) * boardSize.width;
    const cy = (item.y / BOARD_HEIGHT) * boardSize.height;
    const inset = halfObjectSize * 0.6;
    return { x: cx + (item.side === "left" ? inset : -inset), y: cy };
  }

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
              "--board-object-max": `${BOARD_OBJECT_SIZE}px`,
              "--board-object-min": `${BOARD_OBJECT_MIN_SIZE}px`,
            } as React.CSSProperties),
          }}
        >
          <div className="board-divider" />
          <svg
            className="match-connections"
            viewBox={`0 0 ${boardSize.width} ${boardSize.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {connections.map((connection) => {
              const left = objects.find((item) => item.object_id === connection.leftId);
              const right = objects.find((item) => item.object_id === connection.rightId);
              if (!left || !right) return null;
              const p1 = connectionEdgePoint(left);
              const p2 = connectionEdgePoint(right);
              const curve = Math.max(24, (p2.x - p1.x) * 0.3);
              // Bow the first control point up and the second down, so the
              // path reads as a soft S-curve even when the two items are level.
              const bend = Math.min(90, Math.max(50, 65 * scale));
              const d = `M ${p1.x} ${p1.y} C ${p1.x + curve} ${p1.y - bend}, ${p2.x - curve} ${p2.y + bend}, ${p2.x} ${p2.y}`;
              const strokeColor = connectionStrokeColor(connection);
              return (
                <g
                  key={connection.id}
                  className={`connection-line ${connection.animate ? "is-animating" : ""}`}
                  onAnimationEnd={
                    connection.animate
                      ? () =>
                          setConnections((current) =>
                            current.map((item) =>
                              item.id === connection.id ? { ...item, animate: false } : item,
                            ),
                          )
                      : undefined
                  }
                >
                  <path
                    d={d}
                    pathLength={1}
                    strokeWidth={connectionStrokeWidth}
                    stroke={strokeColor}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </svg>
          {objects.map((item) => {
            const active = drag?.id === item.object_id;
            const isReturning = returning?.id === item.object_id;
            const highlighted =
              candidateId === item.object_id ||
              (active && candidateId !== null);
            const solvedStyle = item.solved
              ? ({ ["--match-color" as any]: solvedObjectColor(item, connections) } as React.CSSProperties)
              : undefined;
            return (
              <button
                key={item.object_id}
                className={`match-object ${item.side} ${active ? "is-dragging" : ""} ${isReturning ? "is-returning" : ""} ${highlighted ? "is-highlighted" : ""} ${item.solved ? "is-solved" : ""}`}
                style={{
                  left: `${(item.x / BOARD_WIDTH) * 100}%`,
                  top: `${(item.y / BOARD_HEIGHT) * 100}%`,
                  ...solvedStyle,
                }}
                onPointerDown={(event) => startDrag(event, item)}
                onAnimationEnd={isReturning ? finishReturn : undefined}
                onClick={() => {
                  if (!drag && !returning && !item.solved) playTone("target");
                }}
                aria-label={item.target}
                disabled={item.solved}
              >
                <span className="object-shadow" />
                <span className="object-glyph">{item.target}</span>
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
