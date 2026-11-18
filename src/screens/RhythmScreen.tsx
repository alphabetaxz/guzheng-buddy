import { useEffect, useRef, useState } from 'preact/hooks';
import type { GuzhengSynth } from '../audio/guzhengSynth';
import { RHYTHM_PATTERNS } from '../core/theoryRhythm';

export interface RhythmScreenProps {
  synth: GuzhengSynth;
  onBack: () => void;
  onEarnStar: () => void;
}

export function RhythmScreen({ synth, onBack, onEarnStar }: RhythmScreenProps) {
  const [patternIdx, setPatternIdx] = useState(0);
  const [activeBeat, setActiveBeat] = useState(0);
  const [hits, setHits] = useState<boolean[]>([false, false, false, false]);
  const [metroRunning, setMetroRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const beatRef = useRef(0);

  const pattern = RHYTHM_PATTERNS[patternIdx] ?? RHYTHM_PATTERNS[0]!;

  const stopMetronome = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setMetroRunning(false);
  };

  useEffect(() => {
    return () => {
      stopMetronome();
    };
  }, []);

  const selectPattern = (idx: number) => {
    setPatternIdx(idx);
    setHits([false, false, false, false]);
    setActiveBeat(0);
    beatRef.current = 0;
  };

  const toggleMetronome = () => {
    void synth.unlock();
    if (metroRunning) {
      stopMetronome();
      return;
    }

    beatRef.current = 0;
    setActiveBeat(0);
    setHits([false, false, false, false]);
    setMetroRunning(true);
    synth.playWoodblock(true);

    timerRef.current = window.setInterval(() => {
      const next = (beatRef.current + 1) % 4;
      beatRef.current = next;
      setActiveBeat(next);
      if (next === 0) {
        setHits([false, false, false, false]);
      }
      synth.playWoodblock(next === 0);
    }, 750);
  };

  const handleTapDrum = () => {
    void synth.unlock();
    const beat = pattern.beats[activeBeat] ?? pattern.beats[0]!;
    const nextHits = [...hits];
    nextHits[activeBeat] = true;
    setHits(nextHits);

    synth.playTone(beat.freq, beat.type === 'hold' ? 1.6 : 0.9);

    if (!metroRunning) {
      const next = (activeBeat + 1) % 4;
      if (next === 0) {
        synth.playWinChord();
        onEarnStar();
        setTimeout(() => {
          setHits([false, false, false, false]);
          setActiveBeat(0);
        }, 480);
      } else {
        setActiveBeat(next);
      }
    } else if (nextHits.every(Boolean)) {
      synth.playStarChime();
      onEarnStar();
    }
  };

  return (
    <div
      class="w-full h-full flex flex-col justify-between p-3.5 relative overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 20%, #FFF1F2 0%, #FFE4E6 55%, #FECDD3 100%)',
      }}
    >
      {/* Top Bar */}
      <div class="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            stopMetronome();
            onBack();
          }}
          aria-label="返回首页"
          class="clay-card w-12 h-12 rounded-full bg-white border-2 border-rose-200 flex items-center justify-center text-2xl active:scale-90 transition"
        >
          🏠
        </button>

        <div class="flex items-center gap-1.5 sm:gap-2 bg-white/90 p-1 rounded-full shadow-md border-2 border-rose-200">
          {RHYTHM_PATTERNS.map((pat, idx) => (
            <button
              key={pat.id}
              type="button"
              onClick={() => selectPattern(idx)}
              class={[
                'px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-black transition',
                idx === patternIdx
                  ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow'
                  : 'text-stone-600',
              ].join(' ')}
            >
              {pat.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={toggleMetronome}
          aria-label={metroRunning ? '暂停节拍器' : '开启节拍器'}
          class="clay-card px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-sm border-2 border-white shadow-md flex items-center gap-1.5 active:scale-90"
        >
          <span>{metroRunning ? '⏸️' : '▶️'}</span>
          <span>🥁</span>
        </button>
      </div>

      {/* 4 Beat Lantern Cards */}
      <div class="grid grid-cols-4 gap-4 max-w-[640px] w-full mx-auto my-auto">
        {pattern.beats.map((b, idx) => {
          const isCurrent = idx === activeBeat;
          const isHit = hits[idx] ?? false;
          return (
            <div
              key={`${pattern.id}-${idx}`}
              class={[
                'clay-card h-32 rounded-[30px] flex flex-col items-center justify-center gap-1 border-2 border-b-[6px] transition-all',
                isCurrent
                  ? 'bg-gradient-to-b from-amber-100 to-amber-200 border-rose-400 border-b-rose-500 scale-105 glow-target'
                  : isHit
                    ? 'bg-gradient-to-b from-emerald-50 to-emerald-100 border-emerald-300 border-b-emerald-500'
                    : 'bg-white border-rose-200 border-b-rose-300',
              ].join(' ')}
            >
              <div class={['text-4xl', isCurrent ? 'float-slow' : ''].join(' ')}>
                {isHit ? '🌟' : b.animal}
              </div>
              <div class="text-2xl font-black text-stone-800">{b.jianpu}</div>
              <span
                class={[
                  'w-3 h-3 rounded-full mt-0.5',
                  isCurrent ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-stone-300',
                ].join(' ')}
              />
            </div>
          );
        })}
      </div>

      {/* Bottom Chinese Tanggu Drum Pad */}
      <div class="flex items-center justify-center pb-0.5">
        <button
          type="button"
          onClick={handleTapDrum}
          aria-label="敲响大鼓"
          class="group relative w-64 h-20 rounded-full bg-gradient-to-b from-red-500 via-red-600 to-red-700 border-4 border-amber-300 border-b-[7px] border-b-amber-500 shadow-xl flex items-center justify-center gap-4 text-4xl active:translate-y-1 transition-all"
        >
          <span class="w-2 h-2 rounded-full bg-amber-300 absolute left-4 top-1/2 -translate-y-1/2" />
          <span class="w-2 h-2 rounded-full bg-amber-300 absolute right-4 top-1/2 -translate-y-1/2" />
          <span class="drop-shadow">🥁</span>
          <span class="drop-shadow">👏</span>
          <span class="text-2xl">🌟</span>
        </button>
      </div>
    </div>
  );
}
