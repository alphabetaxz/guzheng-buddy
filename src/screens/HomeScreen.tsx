import { useState } from 'preact/hooks';
import type { GuzhengSynth } from '../audio/guzhengSynth';
import type { VoicePrompter } from '../audio/voicePrompter';
import { ParentLockButton } from '../components/ParentLockButton';

export type ScreenRoute = 'home' | 'theory' | 'rhythm' | 'play' | 'video' | 'parent';

export interface HomeScreenProps {
  totalStars: number;
  completedLevelCount: number;
  muted: boolean;
  synth: GuzhengSynth;
  prompter: VoicePrompter;
  onNavigate: (route: ScreenRoute) => void;
  onOpenStickers: () => void;
  onToggleMute: () => void;
}

const ANIMAL_MEDALLIONS = [
  {
    jianpu: '1',
    emoji: '🐰',
    freq: 293.66,
    voice: '朵朵兔，Do',
    bg: 'from-red-50 to-red-200 border-red-400',
    badgeBg: 'bg-red-500',
  },
  {
    jianpu: '2',
    emoji: '🦢',
    freq: 329.63,
    voice: '小天鹅，Re',
    bg: 'from-orange-50 to-orange-200 border-orange-400',
    badgeBg: 'bg-orange-500',
  },
  {
    jianpu: '3',
    emoji: '🐱',
    freq: 369.99,
    voice: '小猫咪，Mi',
    bg: 'from-yellow-50 to-amber-200 border-amber-400',
    badgeBg: 'bg-amber-500',
  },
  {
    jianpu: '5',
    emoji: '🐍',
    freq: 440.0,
    voice: '绿小蛇，Sol',
    bg: 'from-emerald-50 to-emerald-200 border-emerald-500 ring-2 ring-emerald-300/60',
    badgeBg: 'bg-emerald-600',
  },
  {
    jianpu: '6',
    emoji: '🐨',
    freq: 493.88,
    voice: '小考拉，La',
    bg: 'from-purple-50 to-purple-200 border-purple-400',
    badgeBg: 'bg-purple-600',
  },
] as const;

export function HomeScreen({
  totalStars,
  completedLevelCount,
  muted,
  synth,
  prompter,
  onNavigate,
  onOpenStickers,
  onToggleMute,
}: HomeScreenProps) {
  const [lockHint, setLockHint] = useState(false);

  const handleAnimalTap = (freq: number, voice: string) => {
    void synth.unlock();
    synth.playTone(freq);
    prompter.speak(voice);
  };

  const handleShortLockTap = () => {
    setLockHint(true);
    prompter.speak('请爸爸妈妈长按两秒进入家长设置');
    setTimeout(() => setLockHint(false), 1800);
  };

  return (
    <div
      class="w-full h-full flex flex-col justify-between p-3 sm:p-4 relative overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 0%, #FFFBEB 0%, #FDE68A 45%, #D1FAE5 100%)',
      }}
    >
      {/* Decorative Distant Pastel Mountains SVG */}
      <svg
        class="absolute inset-x-0 bottom-0 w-full h-36 pointer-events-none opacity-65"
        viewBox="0 0 800 160"
        preserveAspectRatio="none"
      >
        <path d="M0,160 L0,95 Q120,30 260,90 T540,75 T800,95 L800,160 Z" fill="#A7F3D0" />
        <path d="M0,160 L0,120 Q180,65 360,115 T720,90 L800,115 L800,160 Z" fill="#6EE7B7" />
      </svg>

      {/* Top HUD Bar */}
      <div class="relative z-10 flex items-center justify-between gap-2">
        {/* Star Counter + Sticker Book Trigger */}
        <button
          type="button"
          onClick={onOpenStickers}
          aria-label="打开我的贴纸本"
          class="clay-card flex items-center gap-2 bg-white/95 backdrop-blur px-4 py-2 rounded-full border-2 border-amber-300 active:scale-95 transition"
        >
          <span class="text-xl drop-shadow">🌟</span>
          <span class="font-black text-base text-amber-600 tracking-wide">{totalStars}</span>
          <span class="text-base ml-0.5">📖</span>
        </button>

        {/* 5 Pentatonic Animal Jade Medallions */}
        <div class="flex items-center gap-2 sm:gap-2.5 bg-white/85 backdrop-blur-md px-3 py-1.5 rounded-full shadow-md border border-white/80">
          {ANIMAL_MEDALLIONS.map((item) => (
            <button
              key={item.jianpu}
              type="button"
              onClick={() => handleAnimalTap(item.freq, item.voice)}
              aria-label={item.voice}
              class={`group relative w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-b ${item.bg} border-2 shadow hover:-translate-y-0.5 active:scale-90 transition flex items-center justify-center`}
            >
              <span class="text-xl sm:text-2xl">{item.emoji}</span>
              <span
                class={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${item.badgeBg} text-white text-[10px] font-black flex items-center justify-center shadow`}
              >
                {item.jianpu}
              </span>
            </button>
          ))}
        </div>

        {/* Mute Toggle + 2s Long-Press Parent Lock */}
        <div class="relative flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? '开启声音' : '静音'}
            class="w-12 h-12 rounded-full bg-white/85 hover:bg-white shadow border border-amber-200/80 flex items-center justify-center text-xl active:scale-90 transition"
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <ParentLockButton
            onUnlock={() => onNavigate('parent')}
            onShortTap={handleShortLockTap}
          />
          {lockHint && (
            <div class="absolute right-0 top-14 whitespace-nowrap bg-stone-900/85 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
              长按 🔒 2秒进入家长工具
            </div>
          )}
        </div>
      </div>

      {/* Center: 4 Exquisite 3D Storybook Island Cards */}
      <div class="relative z-10 grid grid-cols-4 gap-3 sm:gap-4 max-w-[780px] w-full mx-auto my-auto">
        {/* Island 1: Music Theory Symbols */}
        <button
          type="button"
          onClick={() => onNavigate('theory')}
          aria-label="乐理符号"
          class="clay-card h-44 sm:h-48 rounded-[30px] bg-gradient-to-b from-white via-amber-50/60 to-amber-100/80 border-2 border-amber-300 border-b-[6px] border-b-amber-400 hover:-translate-y-1.5 active:translate-y-0 transition-all flex flex-col items-center justify-between p-3"
        >
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-300 to-orange-400 shadow-md flex items-center justify-center text-4xl float-slow border-2 border-white">
            🎼
          </div>
          <div class="flex items-center gap-1.5 bg-white/90 px-3 py-1 rounded-2xl border border-amber-200 shadow-inner">
            <span class="w-6 h-6 rounded-lg bg-amber-100 text-amber-900 font-serif font-black text-sm flex items-center justify-center">
              L
            </span>
            <span class="w-6 h-6 rounded-lg bg-orange-100 text-orange-900 font-serif font-black text-sm flex items-center justify-center">
              \
            </span>
            <span class="w-6 h-6 rounded-lg bg-yellow-100 text-yellow-900 font-serif font-black text-sm flex items-center justify-center">
              ∧
            </span>
          </div>
          <div class="w-16 h-9 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-center text-base shadow-md border border-white/60">
            ▶
          </div>
        </button>

        {/* Island 2: Rhythm Sense Training */}
        <button
          type="button"
          onClick={() => onNavigate('rhythm')}
          aria-label="节奏感训练"
          class="clay-card h-44 sm:h-48 rounded-[30px] bg-gradient-to-b from-white via-rose-50/60 to-rose-100/80 border-2 border-rose-300 border-b-[6px] border-b-rose-400 hover:-translate-y-1.5 active:translate-y-0 transition-all flex flex-col items-center justify-between p-3"
        >
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 shadow-md flex items-center justify-center text-4xl float-slow border-2 border-white">
            🥁
          </div>
          <div class="flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-2xl border border-rose-200 shadow-inner">
            <span class="w-4 h-4 rounded-full bg-rose-500 shadow-sm" />
            <span class="w-4 h-4 rounded-full bg-rose-400" />
            <span class="w-4 h-4 rounded-full bg-amber-400" />
            <span class="w-4 h-4 rounded-full bg-emerald-400" />
          </div>
          <div class="w-16 h-9 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white flex items-center justify-center text-base shadow-md border border-white/60">
            ▶
          </div>
        </button>

        {/* Island 3: Real Guzheng Strings (4 Built-in Levels) */}
        <button
          type="button"
          onClick={() => onNavigate('play')}
          aria-label="真琴寻音闯关"
          class="relative clay-card h-44 sm:h-48 rounded-[30px] bg-gradient-to-b from-white via-emerald-50/60 to-emerald-100/80 border-2 border-emerald-300 border-b-[6px] border-b-emerald-500 hover:-translate-y-1.5 active:translate-y-0 transition-all flex flex-col items-center justify-between p-3"
        >
          {completedLevelCount > 0 && (
            <span class="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-amber-400 text-stone-900 text-xs font-black border-2 border-white shadow">
              🏆 {completedLevelCount}/4
            </span>
          )}
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-md flex items-center justify-center text-4xl float-slow border-2 border-white">
            🐍
          </div>
          <div class="w-24 bg-[#7A4B2A] px-2.5 py-1.5 rounded-xl border border-amber-900 shadow-inner flex flex-col gap-1">
            <div class="h-0.5 bg-amber-100/80 rounded-full" />
            <div class="h-1 bg-emerald-400 rounded-full shadow-[0_0_6px_#34d399]" />
            <div class="h-0.5 bg-amber-100/80 rounded-full" />
          </div>
          <div class="w-16 h-9 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center justify-center text-base shadow-md border border-white/60">
            ▶
          </div>
        </button>

        {/* Island 4: Teacher Video Follow-Along (Step 4) */}
        <button
          type="button"
          onClick={() => onNavigate('video')}
          aria-label="老师视频带练"
          class="clay-card h-44 sm:h-48 rounded-[30px] bg-gradient-to-b from-white via-purple-50/60 to-indigo-100/80 border-2 border-purple-300 border-b-[6px] border-b-purple-500 hover:-translate-y-1.5 active:translate-y-0 transition-all flex flex-col items-center justify-between p-3"
        >
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-400 to-indigo-500 shadow-md flex items-center justify-center text-4xl float-slow border-2 border-white">
            🎬
          </div>
          <div class="flex items-center gap-1 bg-white/90 px-2.5 py-1 rounded-2xl border border-purple-200 text-base shadow-inner">
            <span>🐰</span>
            <span>🐰</span>
            <span>🐍</span>
            <span>🐍</span>
          </div>
          <div class="w-16 h-9 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white flex items-center justify-center text-base shadow-md border border-white/60">
            ▶
          </div>
        </button>
      </div>

      <div class="h-1" />
    </div>
  );
}
