import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import {
  BOARD_HEIGHT, BOARD_WIDTH, emitContainerEvent, loadTrial, playPronunciation,
  playTone, preloadAudio, trialPath,
} from "../game.ts";
import type { BoardObject, LanguagePack, Trial, TrialObject } from "../game.ts";
import {
  nextRepetitionPrompt, readRepetitionCounts, recordRepetition, repetitionCount,
  repetitionCandidate, repetitionLayout, repetitionTotal, requiredRepetitions, writeRepetitionCounts,
} from "../game/repetition.ts";
import type { RepetitionCounts } from "../game/repetition.ts";
import { MatchObject } from "./MatchObject.tsx";

type Props = {
  trialNum: number;
  languagePack: LanguagePack;
  onBack: () => void;
  onNext: (() => void) | null;
};
type Point = { x: number; y: number };
type Gesture = { pointerId: number; start: Point; offset: Point; moved: boolean };
type Feedback = { id: string; correct: boolean; complete: boolean };

export function RepetitionBoard({ trialNum, languagePack, onBack, onNext }: Props) {
  const [loaded, setLoaded] = useState<{ trial: Trial; counts: RepetitionCounts } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({
    width: 1120, height: 650,
    landscape: window.innerWidth > window.innerHeight,
  });
  const [entering, setEntering] = useState(true);
  const [position, setPosition] = useState<Point | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [celebration, setCelebration] = useState(false);
  const [missingImages, setMissingImages] = useState<Set<string>>(() => new Set());
  const boardRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadTrial(trialPath(languagePack.code, trialNum), languagePack.code)
      .then(async (trial) => {
        if (!trial.left.length) throw new Error("Repeated matching requires at least one pair");
        await preloadAudio(trial);
        if (cancelled) return;
        const counts = readRepetitionCounts(trial, languagePack.code);
        writeRepetitionCounts(trial, languagePack.code, counts);
        setLoaded({ trial, counts });
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        console.error("Unable to load repeated-matching trial", reason);
        setError(reason instanceof Error ? reason.message : "Unable to load trial");
      });
    return () => { cancelled = true; };
  }, [trialNum, languagePack]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const update = () => {
      setDimensions({
        width: board.clientWidth, height: board.clientHeight,
        landscape: window.innerWidth > window.innerHeight,
      });
      gesture.current = null;
      setPosition(null);
      setDragging(false);
      setCandidateId(null);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(board);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [loaded?.trial]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => {
      setFeedback(null);
      if (feedback.correct) setEntering(true);
      if (feedback.complete) setCelebration(true);
    }, 480);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  if (error) return (
    <main className="status-screen">
      <div className="error-mark">!</div>
      <p>Something went wrong loading this board.</p>
      <small>{error}</small>
      <button className="icon-button" onClick={onBack} aria-label="Back to trial selector">↩</button>
    </main>
  );
  if (!loaded) return (
    <main className="status-screen" role="status" aria-label="Loading">
      <div className="loader-orbit" />
    </main>
  );

  const { trial, counts } = loaded;
  const prompt = nextRepetitionPrompt(trial, counts);
  const complete = prompt === null;
  const completed = trial.right.reduce((sum, target) =>
    sum + repetitionCount(counts, target.object_id), 0);
  const { width, height, landscape } = dimensions;
  const { target: targetArea, tray } = repetitionLayout(width, height, landscape);
  const columns = Math.min(trial.right.length, Math.max(1,
    Math.min(Math.floor(targetArea.width / 88),
      Math.ceil(Math.sqrt(trial.right.length * targetArea.width / targetArea.height)))));
  const rows = Math.ceil(trial.right.length / columns);
  const cellWidth = targetArea.width / columns;
  const cellHeight = targetArea.height / rows;
  const size = Math.max(1, Math.min(
    136, cellWidth - 24, cellHeight - 40, tray.width - 40, tray.height - 40,
  ));
  const origin = { x: tray.x + tray.width / 2, y: tray.y + tray.height / 2 };
  const targets = trial.right.map((item, index) => ({
    item,
    x: targetArea.x + (index % columns + 0.5) * cellWidth,
    y: targetArea.y + (Math.floor(index / columns) + 0.5) * cellHeight - 10,
  }));
  const cardWidth = (item: TrialObject) => item.image || item.type === "audio" ? size :
    Math.min((item === prompt ? tray.width : cellWidth) - 24,
      Math.max(size, size * (0.5 + item.target.length * 0.24)));
  const point = (event: PointerEvent<HTMLElement>): Point => {
    const rect = boardRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const dragPoint = (event: PointerEvent<HTMLElement>, active: Gesture): Point => {
    const current = point(event);
    const halfWidth = prompt ? cardWidth(prompt) / 2 : size / 2;
    return {
      x: Math.max(halfWidth + 8, Math.min(width - halfWidth - 8, current.x - active.offset.x)),
      y: Math.max(size / 2 + 8, Math.min(height - size / 2 - 8, current.y - active.offset.y)),
    };
  };
  const candidateAt = (current: Point, pointer: Point) => repetitionCandidate(
    { ...current, width: prompt ? cardWidth(prompt) : size, height: size },
    targets.map((target) => ({
      ...target, width: cardWidth(target.item), height: size,
    })),
    pointer,
  );

  function cancelDrag() {
    if (gesture.current?.moved) suppressClick.current = true;
    gesture.current = null;
    setDragging(false);
    setPosition(null);
    setCandidateId(null);
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    suppressClick.current = false;
    if (feedback || !prompt || gesture.current || event.button !== 0) return;
    setEntering(false);
    const start = point(event);
    gesture.current = {
      pointerId: event.pointerId, start,
      offset: { x: start.x - origin.x, y: start.y - origin.y }, moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setCelebration(false);
  }

  function cancelPointer(event: PointerEvent<HTMLElement>) {
    if (gesture.current?.pointerId === event.pointerId) cancelDrag();
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const current = point(event);
    active.moved ||= Math.hypot(current.x - active.start.x, current.y - active.start.y) > 10;
    if (!active.moved) return;
    suppressClick.current = true;
    const next = dragPoint(event, active);
    setPosition(next);
    setDragging(true);
    setCandidateId(candidateAt(next, current)?.item.object_id ?? null);
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId || !prompt) return;
    const end = point(event);
    const moved = active.moved || Math.hypot(end.x - active.start.x, end.y - active.start.y) > 10;
    const target = moved ? candidateAt(dragPoint(event, active), end)?.item : undefined;
    cancelDrag();
    suppressClick.current = moved;
    if (!moved) return;
    if (!target || target.object_id !== prompt.pair_id[0] ||
        target.pair_id[0] !== prompt.object_id) {
      playTone("miss");
      setFeedback({ id: prompt.object_id, correct: false, complete: false });
      return;
    }
    const next = recordRepetition(trial, counts, prompt, target);
    const finished = nextRepetitionPrompt(trial, next) === null;
    writeRepetitionCounts(trial, languagePack.code, next);
    setLoaded({ trial, counts: next });
    playTone("match");
    playPronunciation(target, languagePack.speechLocale);
    setFeedback({ id: target.object_id, correct: true, complete: finished });
    if (finished) {
      const userId = new URLSearchParams(window.location.search).get("cr_user_id");
      emitContainerEvent(userId, "trial_completed", {
        type: "trial_completed", trial_num: trial.trial_num, lang: languagePack.code,
        layout: "repetition", pairs_completed: trial.right.length,
        repetitions_completed: repetitionTotal(trial),
      });
      emitContainerEvent(userId, "summary_data", {
        type: "summary_data", operation: "add", trials_completed: 1, layout: "repetition",
      });
    }
  }

  function renderObject(item: TrialObject, location: Point, target: boolean) {
    const boardItem: BoardObject = {
      ...item, side: target ? "right" : "left", solved: false,
      x: location.x / width * BOARD_WIDTH, y: location.y / height * BOARD_HEIGHT,
    };
    return (
      <MatchObject
        key={`${target ? "target" : "prompt"}-${item.object_id}`}
        item={boardItem} objects={[]} scale={1} maxObjectSize={size}
        pxPerUnit={width / BOARD_WIDTH} widthOverride={cardWidth(item)}
        active={!target && dragging}
        entering={!target && entering}
        isReturning={!target && feedback?.correct === false}
        highlighted={candidateId === item.object_id || (!target && candidateId !== null)}
        isCelebrating={target && feedback?.id === item.object_id && feedback.correct}
        missingImages={missingImages}
        onImageError={(id) => setMissingImages((current) => new Set(current).add(id))}
        onPointerDown={target ? () => { suppressClick.current = false; } : startDrag}
        onPointerCancel={cancelPointer}
        onLostPointerCapture={cancelPointer}
        onAnimationEnd={(event) => {
          if (!target && event.target === event.currentTarget &&
              event.animationName === "prompt-float-in") setEntering(false);
        }}
        onClick={(event) => {
          if ((event.detail === 0 || !suppressClick.current) && !dragging && !feedback)
            playPronunciation(item, languagePack.speechLocale);
        }}
      />
    );
  }

  return (
    <main className="game-shell repetition-shell">
      <header className="game-header">
        <div className="brand-lockup"><strong>FIND THE MATCH</strong></div>
        <div className="progress-pill" aria-label={`${completed} of ${repetitionTotal(trial)} matches completed`}>
          <span className="progress-dot" />{completed} / {repetitionTotal(trial)}
        </div>
      </header>
      <section className="play-area">
        <div className={`board repetition-board ${landscape ? "is-landscape" : ""}`} ref={boardRef}
          onPointerMove={moveDrag} onPointerUp={endDrag}
          onPointerCancel={cancelPointer}
          style={{ "--board-object-max": `${size}px`, "--board-object-min": `${size}px` } as CSSProperties}>
          <div className="repetition-top" aria-hidden="true"
            style={{ left: targetArea.x, top: targetArea.y, width: targetArea.width, height: targetArea.height }} />
          <div className="repetition-tray" aria-hidden="true"
            style={{ left: tray.x, top: tray.y, width: tray.width, height: tray.height }} />
          {targets.map(({ item, x, y }) => (
            <div key={item.object_id} className="repetition-target">
              {renderObject(item, { x, y }, true)}
              <span className="repetition-meter"
                aria-label={`${repetitionCount(counts, item.object_id)} of ${requiredRepetitions(trial, item)} repetitions completed`}
                style={{ left: x, top: y + size / 2 + 12 }}>
                <span style={{ width: `${100 * repetitionCount(counts, item.object_id) / requiredRepetitions(trial, item)}%` }} />
              </span>
            </div>
          ))}
          {prompt && !feedback?.correct && renderObject(prompt, position ?? origin, false)}
          {celebration && (
            <div className="celebration" aria-live="polite" aria-label="Trial complete"
              onPointerDown={() => setCelebration(false)}>
              <span className="sparkle" aria-hidden="true">🎉</span>
            </div>
          )}
        </div>
      </section>
      <footer className="game-footer">
        <button className="icon-button" onClick={onBack} aria-label="Back to trial selector" title="Back to trial selector">↩</button>
        <span className="footer-spark">✦</span>
        <button className="icon-button" aria-label="Reset trial" title="Reset trial" onClick={() => {
          cancelDrag();
          writeRepetitionCounts(trial, languagePack.code, {});
          setLoaded({ trial, counts: {} });
          setFeedback(null);
          setEntering(true);
          setCelebration(false);
        }}>↻</button>
        <span className="footer-spark">✦</span>
        {complete && !feedback && onNext ?
          <button className="icon-button is-next" onClick={onNext} aria-label="Next trial" title="Next trial">→</button> :
          <span className="icon-button-placeholder" aria-hidden="true" />}
      </footer>
    </main>
  );
}
