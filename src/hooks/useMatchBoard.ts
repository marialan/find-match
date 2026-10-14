import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import {
  BOARD_HEIGHT,
  BOARD_IMAGE_OBJECT_SIZE,
  BOARD_OBJECT_SIZE,
  BOARD_WIDTH,
  boardObjectSize,
  boardObjectWidth,
  boardScale,
  emitContainerEvent,
  loadTrial,
  makeBoardObjects,
  nearestCandidate,
  playPronunciation,
  playTone,
  preloadAudio,
  readSolvedIds,
  resolveOverlaps,
  trialPath,
  writeSolvedIds,
  writeTrialTotal,
} from "../game.ts";
import type { BoardObject, LanguagePack, LayoutMetrics, Trial } from "../game.ts";

const TAP_MOVE_TOLERANCE_PX = 10;

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

type UseMatchBoardOptions = {
  trialNum: number;
  languagePack: LanguagePack;
};

export function useMatchBoard({ trialNum, languagePack }: UseMatchBoardOptions) {
  const [trial, setTrial] = useState<Trial | null>(null);
  const [objects, setObjects] = useState<BoardObject[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [returning, setReturning] = useState<ReturnState | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [celebratingId, setCelebratingId] = useState<string | null>(null);
  const [missingImages, setMissingImages] = useState<Set<string>>(
    () => new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pxPerUnit, setPxPerUnit] = useState(1);
  const playAreaRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);
  const completesTrialAfterMatchRef = useRef(false);
  const downPointRef = useRef<{ x: number; y: number } | null>(null);
  const userId = new URLSearchParams(window.location.search).get("cr_user_id");
  const maxObjectSize = objects.some((item) => item.image)
    ? BOARD_IMAGE_OBJECT_SIZE
    : BOARD_OBJECT_SIZE;

  useEffect(() => {
    const playArea = playAreaRef.current;
    if (!playArea) return undefined;
    const updateScale = (width: number, height: number) => {
      const hasImages = [...(trial?.left ?? []), ...(trial?.right ?? [])].some(
        (item) => item.image,
      );
      const nextScale = boardScale(width, height, hasImages);
      setScale(nextScale);
      if (width > 0) setPxPerUnit(width / BOARD_WIDTH);
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
  }, [trial]);

  useEffect(() => {
    loadTrial(trialPath(languagePack.code, trialNum), languagePack.code)
      .then(async (loaded) => {
        await preloadAudio(loaded);
        setTrial(loaded);
        writeTrialTotal(
          loaded.trial_num,
          loaded.left.length + loaded.right.length,
          languagePack.code,
        );
        setObjects(
          makeBoardObjects(
            loaded,
            readSolvedIds(loaded.trial_num, languagePack.code),
          ),
        );
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load this trial",
        ),
      );
  }, [trialNum, languagePack]);

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
    event: PointerEvent<HTMLElement>,
  ): { x: number; y: number } | null {
    const board = boardRef.current?.getBoundingClientRect();
    return board
      ? { x: event.clientX - board.left, y: event.clientY - board.top }
      : null;
  }

  function startDrag(
    event: PointerEvent<HTMLButtonElement>,
    item: BoardObject,
  ): void {
    movedRef.current = false;
    downPointRef.current = null;
    if (item.solved || drag || returning) return;
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

  function moveDrag(event: PointerEvent<HTMLDivElement>): void {
    if (!drag) return;
    const point = pointFromEvent(event);
    if (!point) return;
    const start = downPointRef.current;
    if (
      !start ||
      Math.hypot(point.x - start.x, point.y - start.y) <= TAP_MOVE_TOLERANCE_PX
    )
      return;
    movedRef.current = true;
    const width = boardRef.current?.clientWidth ?? BOARD_WIDTH;
    const height = boardRef.current?.clientHeight ?? BOARD_HEIGHT;
    const moved = objects.find((item) => item.object_id === drag.id);
    if (!moved) return;
    const halfWidth =
      (boardObjectWidth(moved, objects, scale, maxObjectSize, pxPerUnit) / 2) *
      (BOARD_WIDTH / width);
    const halfHeight =
      (boardObjectSize(scale, maxObjectSize) / 2) * (BOARD_HEIGHT / height);
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

  function endDrag(event: PointerEvent<HTMLDivElement>): void {
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const endPoint = pointFromEvent(event);
    const startPoint = downPointRef.current;
    if (
      startPoint &&
      endPoint &&
      Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y) >
        TAP_MOVE_TOLERANCE_PX
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
      const metrics = layoutMetrics();
      setObjects((current) =>
        resolveOverlaps(current, drag.id, metrics),
      );
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

  function dismissCelebration(): void {
    setCelebration(null);
  }

  function resetTrial(): void {
    if (!trial) return;
    writeSolvedIds(trial.trial_num, new Set(), languagePack.code);
    const metrics = layoutMetrics();
    setObjects(
      resolveOverlaps(makeBoardObjects(trial, new Set()), null, metrics),
    );
    setDrag(null);
    setReturning(null);
    setCandidateId(null);
    setCelebration(null);
    setCelebratingId(null);
    completesTrialAfterMatchRef.current = false;
  }

  function playObject(item: BoardObject): void {
    if (returning) return;
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    playPronunciation(item, languagePack.speechLocale);
  }

  function markImageMissing(objectId: string): void {
    setMissingImages((current) => new Set(current).add(objectId));
  }

  return {
    boardRef,
    candidateId,
    celebration,
    celebratingId,
    dismissCelebration,
    drag,
    endDrag,
    error,
    finishCelebration,
    finishReturn,
    languagePack,
    maxObjectSize,
    markImageMissing,
    missingImages,
    moveDrag,
    objects,
    playAreaRef,
    playObject,
    pxPerUnit,
    resetTrial,
    returning,
    scale,
    startDrag,
    trial,
  };
}
