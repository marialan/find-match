import { BOARD_OBJECT_MIN_SIZE } from "../game.ts";
import type { BoardObject, LanguagePack } from "../game.ts";
import { useMatchBoard } from "../hooks/useMatchBoard.ts";
import { MatchObject } from "./MatchObject.tsx";

type TrialBoardProps = {
  trialNum: number;
  languagePack: LanguagePack;
  onBack: () => void;
  onNext: (() => void) | null;
};

export function TrialBoard({
  trialNum,
  languagePack,
  onBack,
  onNext,
}: TrialBoardProps) {
  const {
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
    markImageMissing,
    maxObjectSize,
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
  } = useMatchBoard({ trialNum, languagePack });

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
          onPointerDown={celebration ? dismissCelebration : undefined}
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
          {objects
            .filter((item) => !item.mergedInto)
            .map((item: BoardObject) => {
              const active = drag?.id === item.object_id;
              const isReturning = returning?.id === item.object_id;
              const highlighted =
                candidateId === item.object_id ||
                (active && candidateId !== null);
              const isCelebrating = celebratingId === item.object_id;
              return (
                <MatchObject
                  key={item.object_id}
                  item={item}
                  objects={objects}
                  scale={scale}
                  maxObjectSize={maxObjectSize}
                  pxPerUnit={pxPerUnit}
                  active={active}
                  isReturning={isReturning}
                  highlighted={highlighted}
                  isCelebrating={isCelebrating}
                  missingImages={missingImages}
                  onImageError={markImageMissing}
                  onPointerDown={(event) => startDrag(event, item)}
                  onAnimationEnd={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (isReturning) finishReturn();
                    else if (isCelebrating) finishCelebration();
                  }}
                  onClick={() => playObject(item)}
                />
              );
            })}
          {celebration && (
            <div
              className="celebration"
              aria-live="polite"
              aria-label="Trial complete"
            >
              <span className="sparkle" aria-hidden="true">
                🎉
              </span>
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
        {onNext &&
        objects.length > 0 &&
        objects.every((item) => item.solved) ? (
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
