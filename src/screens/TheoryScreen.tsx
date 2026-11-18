import { useState } from 'preact/hooks';
import type { GuzhengSynth } from '../audio/guzhengSynth';
import type { VoicePrompter } from '../audio/voicePrompter';
import { OCTAVE_QUESTIONS, SYMBOL_QUESTIONS } from '../core/theoryRhythm';

export interface TheoryScreenProps {
  synth: GuzhengSynth;
  prompter: VoicePrompter;
  onBack: () => void;
  onEarnStar: () => void;
}

export function TheoryScreen({
  synth,
  prompter,
  onBack,
  onEarnStar,
}: TheoryScreenProps) {
  const [mode, setMode] = useState<'symbol' | 'octave'>('symbol');
  const [symIdx, setSymIdx] = useState(0);
  const [octIdx, setOctIdx] = useState(0);
  const [localStars, setLocalStars] = useState(0);

  const curSym = SYMBOL_QUESTIONS[symIdx] ?? SYMBOL_QUESTIONS[0]!;
  const curOct = OCTAVE_QUESTIONS[octIdx] ?? OCTAVE_QUESTIONS[0]!;

  const handleSymbolPick = (pickedSymbol: string) => {
    void synth.unlock();
    if (pickedSymbol === curSym.symbol) {
      setLocalStars((s) => s + 1);
      onEarnStar();
      synth.playWinChord();
      prompter.speak(curSym.voice);
      setTimeout(() => {
        setSymIdx((i) => (i + 1) % SYMBOL_QUESTIONS.length);
      }, 650);
    } else {
      synth.playGentleRetry();
      prompter.speak(curSym.voice);
    }
  };

  const handleOctavePick = (dotPos: 'top' | 'mid' | 'bot', freq: number) => {
    void synth.unlock();
    synth.playTone(freq);
    if (dotPos === curOct.dotPos) {
      setLocalStars((s) => s + 1);
      onEarnStar();
      setTimeout(() => synth.playWinChord(), 220);
      prompter.speak(curOct.voice);
      setTimeout(() => {
        setOctIdx((i) => (i + 1) % OCTAVE_QUESTIONS.length);
      }, 750);
    } else {
      prompter.speak(curOct.voice);
    }
  };

  return (
    <div
      class="w-full h-full flex flex-col justify-between p-3.5 relative overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 20%, #FFFBEB 0%, #FEF3C7 60%, #FDE68A 100%)',
      }}
    >
      {/* Top Bar */}
      <div class="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="返回首页"
          class="clay-card w-12 h-12 rounded-full bg-white border-2 border-amber-200 flex items-center justify-center text-2xl active:scale-90 transition"
        >
          🏠
        </button>

        <div class="flex items-center gap-2 bg-white/90 p-1 rounded-full shadow-md border-2 border-amber-200">
          <button
            type="button"
            onClick={() => setMode('symbol')}
            class={[
              'px-5 py-1.5 rounded-full text-sm font-black flex items-center gap-1.5 transition',
              mode === 'symbol'
                ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow'
                : 'text-stone-600',
            ].join(' ')}
          >
            <span class="font-serif text-base">L \ ∧</span>
            <span>👋</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('octave')}
            class={[
              'px-5 py-1.5 rounded-full text-sm font-black flex items-center gap-1.5 transition',
              mode === 'octave'
                ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow'
                : 'text-stone-600',
            ].join(' ')}
          >
            <span>5̇ · 5 · 5̣</span>
            <span>🐍</span>
          </button>
        </div>

        <div class="clay-card px-4 py-1.5 rounded-full bg-white border-2 border-amber-300 font-black text-base text-amber-600">
          🌟 {localStars}
        </div>
      </div>

      {/* Center Stage */}
      {mode === 'symbol' ? (
        <div class="flex-1 my-2 flex flex-col items-center justify-between">
          <button
            type="button"
            onClick={() => prompter.speak(curSym.voice)}
            class="clay-card my-auto w-52 h-32 rounded-[32px] bg-gradient-to-b from-white to-amber-50 border-4 border-amber-400 flex items-center justify-center gap-3 float-slow glow-target"
          >
            <span class="font-serif text-6xl font-black text-stone-800 drop-shadow">
              {curSym.symbol}
            </span>
            <span class="text-2xl text-amber-500">🔊</span>
          </button>

          <div class="grid grid-cols-3 gap-6 w-full max-w-[540px] pb-1">
            {SYMBOL_QUESTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSymbolPick(opt.symbol)}
                class="clay-card h-24 rounded-[28px] bg-white hover:bg-amber-50 border-2 border-amber-200 border-b-[6px] border-b-amber-400 flex items-center justify-center gap-2 text-4xl active:translate-y-1 transition-all"
              >
                <span>{opt.answer}</span>
                <span class="text-2xl">{opt.arrow}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div class="flex-1 my-2 flex flex-col items-center justify-between">
          <button
            type="button"
            onClick={() => {
              synth.playTone(curOct.freq);
              prompter.speak(curOct.voice);
            }}
            class="clay-card my-auto w-52 h-32 rounded-[32px] bg-gradient-to-b from-white to-emerald-50 border-4 border-emerald-400 flex items-center justify-center gap-3 float-slow glow-target"
          >
            <div class="flex flex-col items-center leading-none">
              <span class="text-2xl font-black text-emerald-600 h-4">
                {curOct.dotPos === 'top' ? '•' : ''}
              </span>
              <span class="text-5xl font-black text-emerald-700">5</span>
              <span class="text-2xl font-black text-emerald-600 h-4">
                {curOct.dotPos === 'bot' ? '•' : ''}
              </span>
            </div>
            <span class="text-4xl">🐍</span>
            <span class="text-xl text-amber-500">🔊</span>
          </button>

          <div class="grid grid-cols-3 gap-6 w-full max-w-[540px] pb-1">
            {OCTAVE_QUESTIONS.map((opt) => (
              <button
                key={opt.dotPos}
                type="button"
                onClick={() => handleOctavePick(opt.dotPos, opt.freq)}
                class="clay-card h-24 rounded-[28px] bg-white hover:bg-emerald-50 border-2 border-emerald-200 border-b-[6px] border-b-emerald-400 flex items-center justify-center gap-2.5 text-4xl active:translate-y-1 transition-all"
              >
                <span>{opt.icon}</span>
                <span class="text-2xl font-black text-emerald-700">{opt.display}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
