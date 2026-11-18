import { describe, expect, it } from 'vitest';
import { OCTAVE_QUESTIONS, RHYTHM_PATTERNS, SYMBOL_QUESTIONS } from './theoryRhythm';

describe('theoryRhythm', () => {
  it('defines fingering symbol quiz questions (tuo, mo, gou)', () => {
    expect(SYMBOL_QUESTIONS).toHaveLength(3);
    expect(SYMBOL_QUESTIONS.map((q) => q.symbol)).toEqual(['L', '\\', '∧']);
  });

  it('defines octave dot quiz questions for high, mid, and low green snake (5)', () => {
    expect(OCTAVE_QUESTIONS).toHaveLength(3);
    expect(OCTAVE_QUESTIONS.map((q) => q.freq)).toEqual([880.0, 440.0, 220.0]);
    expect(OCTAVE_QUESTIONS.map((q) => q.dotPos)).toEqual(['top', 'mid', 'bot']);
  });

  it('defines 3 4-beat rhythm patterns matching prototype.html', () => {
    expect(RHYTHM_PATTERNS).toHaveLength(3);
    for (const pat of RHYTHM_PATTERNS) {
      expect(pat.beats).toHaveLength(4);
    }
  });
});
