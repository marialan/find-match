import type { AnimationEvent, CSSProperties, MouseEvent, PointerEvent } from "react";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  boardObjectSize,
  boardObjectWidth,
  fitsHalf,
  wordFontSize,
} from "../game.ts";
import type { BoardObject } from "../game.ts";

const AUDIO_ICON = "🔊";

type MatchObjectProps = {
  item: BoardObject;
  objects: BoardObject[];
  scale: number;
  maxObjectSize: number;
  pxPerUnit: number;
  active: boolean;
  isReturning: boolean;
  highlighted: boolean;
  isCelebrating: boolean;
  missingImages: Set<string>;
  onImageError: (objectId: string) => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onAnimationEnd: (event: AnimationEvent<HTMLButtonElement>) => void;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  widthOverride?: number;
  onPointerCancel?: (event: PointerEvent<HTMLButtonElement>) => void;
  onLostPointerCapture?: (event: PointerEvent<HTMLButtonElement>) => void;
  entering?: boolean;
};

export function MatchObject({
  item,
  objects,
  scale,
  maxObjectSize,
  pxPerUnit,
  active,
  isReturning,
  highlighted,
  isCelebrating,
  missingImages,
  onImageError,
  onPointerDown,
  onAnimationEnd,
  onClick,
  widthOverride,
  onPointerCancel,
  onLostPointerCapture,
  entering = false,
}: MatchObjectProps) {
  const merged = objects.find((other) => other.mergedInto === item.object_id);
  const pair = merged
    ? item.side === "left"
      ? [item, merged]
      : [merged, item]
    : null;
  const itemWidth = widthOverride ?? boardObjectWidth(
    item,
    objects,
    scale,
    maxObjectSize,
    pxPerUnit,
  );
  const itemHeight = boardObjectSize(scale, maxObjectSize);
  const pairWidths = pair?.map((part) =>
    boardObjectWidth(part, objects, scale, maxObjectSize, pxPerUnit),
  );
  const combinedWidth = pairWidths?.reduce((total, width) => total + width, 0) ?? 0;

  function contentFor(part: BoardObject) {
    if (part.type === "audio") return AUDIO_ICON;
    if (!part.image) return <span className="word-target">{part.target}</span>;
    if (missingImages.has(part.object_id))
      return <span className="image-placeholder" aria-hidden="true" />;
    return (
      <img
        className="object-image"
        src={part.image}
        alt=""
        draggable={false}
        onError={() => onImageError(part.object_id)}
      />
    );
  }

  return (
    <button
      className={`match-object ${item.side} ${item.image ? "has-image" : ""} ${active ? "is-dragging" : ""} ${isReturning ? "is-returning" : ""} ${highlighted ? "is-highlighted" : ""} ${item.solved ? "is-solved" : ""} ${pair ? "is-combined" : ""} ${isCelebrating ? "is-celebrating" : ""} ${entering ? "is-entering" : ""}`}
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
        } as CSSProperties),
      }}
      onPointerDown={onPointerDown}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onLostPointerCapture}
      onAnimationEnd={onAnimationEnd}
      onClick={onClick}
      aria-label={
        pair
          ? `${pair.map((part) => (part.type === "audio" ? "sound" : part.target)).join(" ")} matched`
          : item.type === "audio"
            ? "Play sound"
            : item.target
      }
    >
      <span className="object-shadow" />
      <span className="object-glyph">
        {pair
          ? pair.map((part, index) => (
              <span
                key={part.object_id}
                className={`glyph-part ${part.side} ${part.image ? "has-image" : ""}`}
              >
                <span
                  className="glyph-content"
                  style={
                    {
                      "--word-font-size": `${wordFontSize(
                        pairWidths?.[index] ?? itemHeight,
                        part.target.length,
                        itemHeight,
                      )}px`,
                    } as CSSProperties
                  }
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
}
