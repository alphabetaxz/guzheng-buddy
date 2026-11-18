import { useMemo } from 'preact/hooks';
import {
  FINGERING_META,
  GUZHENG_21_STRINGS,
  type FingeringType,
  type GuzhengString,
} from '../core/guzhengTuning';
import type { BoardZoom } from '../core/gameLevels';

export interface GuzhengBoardProps {
  zoom: BoardZoom;
  stringRange?: [number, number];
  targetStringNum: number | null;
  targetFinger?: FingeringType;
  pluckedStringNum: number | null;
  pluckNonce: number;
  onPluckString: (str: GuzhengString) => void;
}

/**
 * Interactive top-down landscape Guzheng soundboard with:
 * - Authentic paulownia woodgrain, rosewood brocade, and front bridge bar
 * - Green 5/Sol strings (3, 8, 13, 18) with emerald glow
 * - Slanted 3D jade/rosewood bridges (雁柱)
 * - Pluck vibration + expanding ripple ring animation
 */
export function GuzhengBoard({
  zoom,
  stringRange,
  targetStringNum,
  targetFinger = 'tuo',
  pluckedStringNum,
  pluckNonce,
  onPluckString,
}: GuzhengBoardProps) {
  const strings = useMemo(() => {
    const ordered = [...GUZHENG_21_STRINGS].reverse(); // 21 (top/far) -> 1 (bottom/near)
    if (stringRange) {
      const [minNum, maxNum] = stringRange;
      return ordered.filter((s) => s.num >= minNum && s.num <= maxNum);
    }
    if (zoom === 'focus') {
      return ordered.filter((s) => s.num >= 6 && s.num <= 13);
    }
    return ordered;
  }, [zoom, stringRange]);

  const fingerEmoji = FINGERING_META[targetFinger].emoji;

  return (
    <div class="flex-1 rounded-[22px] guzheng-wood border-4 border-[#3A1C0E] relative overflow-hidden flex flex-col justify-between py-2 px-3">
      {/* Left Decorative Brocade End (尾岳山) */}
      <div class="absolute top-0 bottom-0 left-0 w-9 rosewood-frame border-r-2 border-amber-500/40 pointer-events-none flex flex-col items-center justify-between py-3">
        <div class="w-3 h-3 rounded-full border border-amber-400/40" />
        <div class="w-3 h-3 rounded-full border border-amber-400/40" />
      </div>

      {/* Right-side Front Bridge Bar (前岳山) */}
      <div class="absolute top-0 bottom-0 right-11 sm:right-14 w-3.5 rosewood-frame border-x border-amber-400/60 shadow-[0_0_12px_rgba(0,0,0,0.7)] pointer-events-none" />

      {/* Strings Container */}
      <div class="flex-1 flex flex-col justify-between relative z-10">
        {strings.map((s) => {
          const isTarget = s.num === targetStringNum;
          const isPlucked = s.num === pluckedStringNum;
          const bridgeLeftPct = 20 + ((21 - s.num) / 20) * 48;
          const thickness =
            s.num >= 14 ? 'h-[3.5px]' : s.num >= 7 ? 'h-[2.5px]' : 'h-[1.5px]';

          return (
            <button
              key={isPlucked ? `${s.num}-${pluckNonce}` : s.num}
              type="button"
              onClick={() => onPluckString(s)}
              aria-label={`第${s.num}弦 ${s.animalName}`}
              class={[
                'relative flex items-center w-full cursor-pointer rounded-full transition-all text-left',
                zoom === 'focus' ? 'flex-1 min-h-[26px] px-1' : 'flex-1 min-h-[11px] px-1',
                isTarget ? 'bg-amber-300/30 ring-2 ring-amber-300/90' : 'hover:bg-white/10',
                isPlucked ? 'pluck-anim' : '',
              ].join(' ')}
            >
              {/* Golden Engraved Number on Left Brocade */}
              <div
                class={[
                  'w-7 shrink-0 text-center font-black',
                  zoom === 'focus' ? 'text-xs sm:text-sm' : 'text-[9px] leading-none',
                  s.isGreen
                    ? 'text-emerald-300'
                    : isTarget
                      ? 'text-amber-300'
                      : 'text-amber-200/80',
                ].join(' ')}
              >
                {s.num}
              </div>

              {/* String + 3D Bridge + Animal Badge */}
              <div class="flex-1 relative flex items-center h-full">
                {/* Silk String */}
                <div
                  class={[
                    'w-full rounded-full',
                    thickness,
                    s.isGreen
                      ? 'bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-300 shadow-[0_0_8px_#34d399]'
                      : isTarget
                        ? 'bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 shadow-[0_0_12px_#fcd34d]'
                        : 'bg-gradient-to-r from-stone-200 via-amber-50 to-stone-200 shadow-[0_1px_2px_rgba(0,0,0,0.6)]',
                  ].join(' ')}
                />

                {/* Expanding Pluck Ripple Ring */}
                {isPlucked && (
                  <span
                    class={[
                      'ripple-ring pointer-events-none absolute right-24 w-7 h-7 rounded-full border-2',
                      s.isGreen ? 'border-emerald-300' : 'border-amber-300',
                    ].join(' ')}
                  />
                )}

                {/* 3D Jade or Rosewood Bridge (雁柱) */}
                <div
                  style={{ left: `${bridgeLeftPct}%` }}
                  class={[
                    'absolute -translate-x-1/2 rounded-[4px] flex items-center justify-center shadow-[0_3px_6px_rgba(0,0,0,0.65)] pointer-events-none',
                    zoom === 'focus' ? 'w-4 h-5' : 'w-2.5 h-3',
                    s.isGreen
                      ? 'bg-gradient-to-b from-emerald-300 via-emerald-500 to-emerald-800 border border-emerald-200'
                      : 'bg-gradient-to-b from-[#E6B17E] via-[#B87333] to-[#5C3317] border border-amber-200/70',
                  ].join(' ')}
                >
                  <div class="w-1 h-full bg-white/80 rounded-full" />
                </div>

                {/* Animal + Fingering Badge */}
                {(zoom === 'focus' || isTarget || s.isGreen) && (
                  <div
                    class={[
                      'absolute right-12 sm:right-14 flex items-center gap-1 px-2.5 rounded-full shadow-md border pointer-events-none',
                      zoom === 'focus' ? 'text-base py-0.5' : 'text-xs py-0',
                      isTarget
                        ? 'bg-gradient-to-b from-amber-200 to-amber-400 border-white scale-110 glow-target text-stone-900'
                        : s.isGreen
                          ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 border-emerald-300 text-white'
                          : 'bg-stone-900/75 border-amber-200/30 text-white',
                    ].join(' ')}
                  >
                    <span>{isTarget ? `${s.animalEmoji}${fingerEmoji}` : s.animalEmoji}</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
