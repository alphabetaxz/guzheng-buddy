export interface SymbolQuestion {
  id: 'tuo' | 'mo' | 'gou';
  symbol: string;
  answer: string;
  arrow: string;
  voice: string;
}

export interface OctaveQuestion {
  display: string;
  dotPos: 'top' | 'mid' | 'bot';
  freq: number;
  icon: string;
  voice: string;
}

export interface RhythmBeat {
  type: 'hit' | 'hold';
  animal: string;
  jianpu: string;
  freq: number;
}

export interface RhythmPattern {
  id: string;
  label: string;
  beats: readonly RhythmBeat[];
}

export const SYMBOL_QUESTIONS: readonly SymbolQuestion[] = [
  { id: 'tuo', symbol: 'L', answer: '👍', arrow: '⬆️', voice: '大指托，向外拨' },
  { id: 'mo', symbol: '\\', answer: '☝️', arrow: '⬇️', voice: '食指抹，向里弯' },
  { id: 'gou', symbol: '∧', answer: '👌', arrow: '⬇️', voice: '中指勾，像小山' },
];

export const OCTAVE_QUESTIONS: readonly OctaveQuestion[] = [
  { display: '5̇', dotPos: 'top', freq: 880.0, icon: '🐦', voice: '头顶戴小点，高音绿小蛇！' },
  { display: '5', dotPos: 'mid', freq: 440.0, icon: '🐍', voice: '中间没有点，中音绿小蛇！' },
  { display: '5̣', dotPos: 'bot', freq: 220.0, icon: '🐘', voice: '脚下踩小点，低音绿小蛇！' },
];

export const RHYTHM_PATTERNS: readonly RhythmPattern[] = [
  {
    id: 'pat-steady',
    label: '🐍 🐍 🐍 🐍',
    beats: [
      { type: 'hit', animal: '🐍', jianpu: '5', freq: 440.0 },
      { type: 'hit', animal: '🐍', jianpu: '5', freq: 440.0 },
      { type: 'hit', animal: '🐍', jianpu: '5', freq: 440.0 },
      { type: 'hit', animal: '🐍', jianpu: '5', freq: 440.0 },
    ],
  },
  {
    id: 'pat-half',
    label: '🐰 — 🐍 —',
    beats: [
      { type: 'hit', animal: '🐰', jianpu: '1', freq: 293.66 },
      { type: 'hold', animal: '〰️', jianpu: '—', freq: 293.66 },
      { type: 'hit', animal: '🐍', jianpu: '5', freq: 440.0 },
      { type: 'hold', animal: '〰️', jianpu: '—', freq: 440.0 },
    ],
  },
  {
    id: 'pat-syncopated',
    label: '🐱 🐱 🐍 —',
    beats: [
      { type: 'hit', animal: '🐱', jianpu: '3', freq: 369.99 },
      { type: 'hit', animal: '🐱', jianpu: '3', freq: 369.99 },
      { type: 'hit', animal: '🐍', jianpu: '5', freq: 440.0 },
      { type: 'hold', animal: '〰️', jianpu: '—', freq: 440.0 },
    ],
  },
];
