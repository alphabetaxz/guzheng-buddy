import { describe, expect, it, vi } from 'vitest';
import { VoicePrompter, type SpeechSynthesisLike } from './voicePrompter';

describe('VoicePrompter', () => {
  it('speaks Chinese guidance with child-friendly pitch/rate and cancels previous utterance', () => {
    const spoken: Array<{ text: string; lang: string; rate: number; pitch: number }> = [];
    const mockSynth: SpeechSynthesisLike = {
      cancel: vi.fn(),
      speak: vi.fn((utterance) => {
        spoken.push({
          text: utterance.text,
          lang: utterance.lang,
          rate: utterance.rate,
          pitch: utterance.pitch,
        });
      }),
    };

    const prompter = new VoicePrompter({
      synthesis: mockSynth,
      createUtterance: (text) => ({ text, lang: '', rate: 1, pitch: 1 }),
    });

    const ok = prompter.speak('找到绿色小蛇弦啦！');
    expect(ok).toBe(true);
    expect(mockSynth.cancel).toHaveBeenCalledTimes(1);
    expect(spoken[0]).toEqual({
      text: '找到绿色小蛇弦啦！',
      lang: 'zh-CN',
      rate: 0.95,
      pitch: 1.2,
    });
  });

  it('respects mute toggle, empty text, and missing browser SpeechSynthesis', () => {
    const mockSynth: SpeechSynthesisLike = {
      cancel: vi.fn(),
      speak: vi.fn(),
    };
    const prompter = new VoicePrompter({
      synthesis: mockSynth,
      createUtterance: (text) => ({ text, lang: '', rate: 1, pitch: 1 }),
    });

    prompter.setMuted(true);
    expect(prompter.isMuted()).toBe(true);
    expect(mockSynth.cancel).toHaveBeenCalledTimes(1);
    expect(prompter.speak('你好')).toBe(false);
    expect(mockSynth.speak).not.toHaveBeenCalled();

    prompter.setMuted(false);
    expect(prompter.speak('   ')).toBe(false);

    prompter.stop();
    expect(mockSynth.cancel).toHaveBeenCalledTimes(2);

    const noSpeech = new VoicePrompter({ synthesis: null });
    expect(noSpeech.speak('测试')).toBe(false);
  });
});
