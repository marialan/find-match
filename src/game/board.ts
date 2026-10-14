import type { BoardObject, Side, Trial } from "./types.ts";

export const PROXIMITY_TOLERANCE = 64;
export const BOARD_OBJECT_SIZE = 84;
export const BOARD_IMAGE_OBJECT_SIZE = 176;
export const BOARD_OBJECT_MIN_SIZE = 56;
export const BOARD_WIDTH = 1120;
export const BOARD_HEIGHT = 650;
export const MIN_WORD_FONT_SIZE = 16;

const WORD_CHAR_WIDTH = 0.62;
const WORD_INSET = 22;
const BOARD_CENTER = BOARD_WIDTH / 2;
const DIVIDER_CLEARANCE = 12;
const TILE_GAP = 8;
const SEARCH_STEP = 10;

type Rect = { x: number; y: number; w: number; h: number };

export interface LayoutMetrics {
  scale: number;
  maxSize: number;
  unitsPerPx: [number, number];
}

export function boardObjectSize(
  scale: number,
  maxSize = BOARD_OBJECT_SIZE,
): number {
  return Math.min(maxSize, Math.max(BOARD_OBJECT_MIN_SIZE, maxSize * scale));
}

export function wordFontSize(
  width: number,
  targetLength: number,
  height: number,
): number {
  const fit =
    (width - WORD_INSET) / (Math.max(1, targetLength) * WORD_CHAR_WIDTH);
  return Math.max(MIN_WORD_FONT_SIZE, Math.min(54, height * 0.5, fit));
}

export function boardObjectWidth(
  item: BoardObject,
  objects: BoardObject[],
  scale: number,
  maxSize = BOARD_OBJECT_SIZE,
  pxPerUnit?: number,
): number {
  const size = boardObjectSize(scale, maxSize);
  if (item.type === "audio" || item.image) return size;

  const scaleFactor = pxPerUnit ?? size / maxSize;
  const desiredWidth =
    size + Math.max(0, item.target.length - 3) * size * 0.3;
  const sideWidth = (x: number) =>
    Math.max(
      0,
      2 *
        Math.min(
          x,
          BOARD_WIDTH - x,
          Math.abs(x - BOARD_CENTER) - DIVIDER_CLEARANCE,
        ) *
        scaleFactor,
    );
  const ownLimit = sideWidth(item.pos[0]);
  const partnerLimit = item.pair_id
    .map((id) => objects.find((candidate) => candidate.object_id === id))
    .filter((candidate): candidate is BoardObject => candidate !== undefined)
    .map((candidate) => {
      const candidateDesiredWidth =
        candidate.type === "audio" || candidate.image
          ? size
          : size + Math.max(0, candidate.target.length - 3) * size * 0.3;
      const candidateWidth = Math.min(
        candidateDesiredWidth,
        sideWidth(candidate.pos[0]),
      );
      return sideWidth(candidate.pos[0]) - candidateWidth;
    })
    .reduce((widest, limit) => Math.max(widest, limit), 0);
  const maxWidth = Math.min(ownLimit, partnerLimit || ownLimit);
  return Math.max(size, Math.min(desiredWidth, maxWidth));
}

export function boardScale(
  width: number,
  height: number,
  hasImages: boolean,
): number {
  const scale = Math.min(width / BOARD_WIDTH, height / BOARD_HEIGHT, 1);
  if (!hasImages || height <= width) return scale;
  const pairFit =
    (width / 2 - DIVIDER_CLEARANCE) / 2 / BOARD_IMAGE_OBJECT_SIZE;
  return Math.min(height / BOARD_HEIGHT, 1, Math.max(scale, pairFit));
}

export function makeBoardObjects(
  trial: Trial,
  solvedIds: Set<string>,
): BoardObject[] {
  const trialIds = new Set(
    [...trial.left, ...trial.right].map((item) => item.object_id),
  );
  const eligibleSolvedIds = new Set(
    [...solvedIds].filter((id) => trialIds.has(id)),
  );
  const partnerByLeftId = new Map(
    trial.left
      .filter(
        (item) =>
          eligibleSolvedIds.has(item.object_id) &&
          eligibleSolvedIds.has(item.pair_id[0]),
      )
      .map((item) => [item.object_id, item.pair_id[0]]),
  );
  const leftByRightId = new Map(
    [...partnerByLeftId].map(([leftId, rightId]) => [rightId, leftId]),
  );
  const all: BoardObject[] = [
    ...trial.left.map((item) => ({
      ...item,
      side: "left" as const,
      x: item.pos[0],
      y: item.pos[1],
      solved: partnerByLeftId.has(item.object_id),
    })),
    ...trial.right.map((item) => ({
      ...item,
      side: "right" as const,
      x: item.pos[0],
      y: item.pos[1],
      solved: leftByRightId.has(item.object_id),
    })),
  ];
  return all.map((item) => {
    if (!item.solved) return item;
    const partnerId =
      item.side === "left"
        ? partnerByLeftId.get(item.object_id)
        : leftByRightId.get(item.object_id);
    return item.side === "left" && partnerId
      ? { ...item, mergedInto: partnerId }
      : item;
  });
}

export function nearestCandidate(
  dragged: BoardObject,
  objects: BoardObject[],
): BoardObject | null {
  return (
    objects
      .filter((item) => item.side !== dragged.side && !item.solved)
      .map((item) => ({
        item,
        distance: Math.hypot(item.x - dragged.x, item.y - dragged.y),
      }))
      .filter(({ distance }) => distance <= PROXIMITY_TOLERANCE)
      .sort((a, b) => a.distance - b.distance)[0]?.item ?? null
  );
}

function tileSize(
  item: BoardObject,
  objects: BoardObject[],
  metrics: LayoutMetrics,
): { w: number; h: number; combined: boolean } {
  const { scale, maxSize, unitsPerPx: [ux, uy] } = metrics;
  const merged = objects.find((other) => other.mergedInto === item.object_id);
  const width =
    boardObjectWidth(item, objects, scale, maxSize, 1 / ux) +
    (merged ? boardObjectWidth(merged, objects, scale, maxSize, 1 / ux) : 0);
  return {
    w: width * ux,
    h: boardObjectSize(scale, maxSize) * uy,
    combined: merged !== undefined,
  };
}

export function fitsHalf(widthUnits: number): boolean {
  return widthUnits <= BOARD_CENTER - DIVIDER_CLEARANCE;
}

function tileCenterX(item: BoardObject, width: number, combined: boolean): number {
  if (!combined) return item.x;
  const [min, max] = !fitsHalf(width)
    ? [width / 2, BOARD_WIDTH - width / 2]
    : item.x < BOARD_CENTER
      ? [width / 2, BOARD_CENTER - width / 2]
      : [BOARD_CENTER + width / 2, BOARD_WIDTH - width / 2];
  return Math.max(min, Math.min(item.x, max));
}

function overlaps(a: Rect, b: Rect, gap = 0): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap &&
    Math.abs(a.y - b.y) < (a.h + b.h) / 2 + gap
  );
}

function fitsBoard(rect: Rect): boolean {
  const [left, right] = [rect.x - rect.w / 2, rect.x + rect.w / 2];
  const epsilon = 0.5;
  return (
    left >= -epsilon &&
    right <= BOARD_WIDTH + epsilon &&
    rect.y - rect.h / 2 >= -epsilon &&
    rect.y + rect.h / 2 <= BOARD_HEIGHT + epsilon &&
    (!fitsHalf(rect.w) ||
      right <= BOARD_CENTER + epsilon ||
      left >= BOARD_CENTER - epsilon)
  );
}

function axisCandidates(min: number, max: number, edges: number[]): number[] {
  const values = [min, max, ...edges.filter((value) => value >= min && value <= max)];
  for (let value = min + SEARCH_STEP; value < max; value += SEARCH_STEP)
    values.push(value);
  return values;
}

function freeSpot(
  rect: Rect,
  side: Side,
  blockers: Rect[],
  preferred: Rect[],
): [number, number] | null {
  const halfW = rect.w / 2;
  const halfH = rect.h / 2;
  const gap = TILE_GAP + 0.01;
  const all = [...blockers, ...preferred];
  const ys = axisCandidates(
    halfH,
    BOARD_HEIGHT - halfH,
    all.flatMap((b) => [
      b.y - (b.h + rect.h) / 2 - gap,
      b.y + (b.h + rect.h) / 2 + gap,
    ]),
  );
  const sides: Side[] = side === "left" ? ["left", "right"] : ["right", "left"];
  for (const region of sides) {
    let [minX, maxX] = !fitsHalf(rect.w)
      ? [halfW, BOARD_WIDTH - halfW]
      : region === "left"
        ? [halfW, BOARD_CENTER - DIVIDER_CLEARANCE - halfW]
        : [BOARD_CENTER + DIVIDER_CLEARANCE + halfW, BOARD_WIDTH - halfW];
    if (minX > maxX) minX = maxX = (minX + maxX) / 2;
    const xs = axisCandidates(
      minX,
      maxX,
      all.flatMap((b) => [
        b.x - (b.w + rect.w) / 2 - gap,
        b.x + (b.w + rect.w) / 2 + gap,
      ]),
    );
    const candidates = xs.flatMap((x) =>
      ys.map((y): [number, number] => [x, y]),
    );
    candidates.sort(
      (a, b) =>
        Math.hypot(a[0] - rect.x, a[1] - rect.y) -
        Math.hypot(b[0] - rect.x, b[1] - rect.y),
    );
    for (const group of [all, blockers]) {
      const spot = candidates.find(([x, y]) =>
        group.every((other) => !overlaps({ ...rect, x, y }, other, TILE_GAP)),
      );
      if (spot) return spot;
    }
  }
  return null;
}

export function resolveOverlaps(
  objects: BoardObject[],
  anchorId: string | null,
  metrics: LayoutMetrics,
): BoardObject[] {
  const tiles = objects
    .filter((item) => !item.mergedInto)
    .map((item) => {
      const { w, h, combined } = tileSize(item, objects, metrics);
      const x = tileCenterX(item, w, combined);
      const side: Side = x < BOARD_CENTER ? "left" : "right";
      return {
        id: item.object_id,
        solved: item.solved,
        side,
        rect: { x, y: item.y, w, h },
      };
    });
  type Tile = (typeof tiles)[number];
  const anchor = tiles.find((tile) => tile.id === anchorId);
  let queue = tiles
    .filter((tile) => tile !== anchor)
    .sort((a, b) =>
      anchor
        ? Math.hypot(a.rect.x - anchor.rect.x, a.rect.y - anchor.rect.y) -
          Math.hypot(b.rect.x - anchor.rect.x, b.rect.y - anchor.rect.y)
        : Number(b.solved) - Number(a.solved),
    );

  const attempt = (order: Tile[]) => {
    const settled: Rect[] = anchor ? [anchor.rect] : [];
    const moves = new Map<string, [number, number]>();
    const stuck: Tile[] = [];
    order.forEach((tile, index) => {
      let rect = tile.rect;
      if (!fitsBoard(rect) || settled.some((other) => overlaps(rect, other))) {
        const spot = freeSpot(
          rect,
          tile.side,
          settled,
          order.slice(index + 1).map((other) => other.rect),
        );
        if (spot) {
          rect = { ...rect, x: spot[0], y: spot[1] };
          moves.set(tile.id, spot);
        } else stuck.push(tile);
      }
      settled.push(rect);
    });
    return { moves, stuck };
  };

  let best = attempt(queue);
  let latest = best;
  for (
    let tries = 0;
    latest.stuck.length > 0 && best.stuck.length > 0 && tries < queue.length;
    tries += 1
  ) {
    const [stuck] = latest.stuck;
    queue = [stuck, ...queue.filter((tile) => tile !== stuck)];
    latest = attempt(queue);
    if (latest.stuck.length < best.stuck.length) best = latest;
  }
  const { moves } = best;
  if (moves.size === 0) return objects;
  return objects.map((item) => {
    const spot = moves.get(item.object_id);
    return spot ? { ...item, x: spot[0], y: spot[1] } : item;
  });
}
