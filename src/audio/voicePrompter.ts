export interface SpeechUtteranceLike {
  text: string;
  lang: string;
  rate: number;
  pitch: number;
}

export interface SpeechSynthesisLike {
  cancel(): void;
  speak(utterance: SpeechUtteranceLike): void;
}

export interface VoicePrompterOptions {
  synthesis?: SpeechSynthesisLike | null;
  createUtterance?: (text: string) => SpeechUtteranceLike;
  defaultLang?: string;
  defaultRate?: number;
  defaultPitch?: number;
}

function resolveDefaultSynthesis(): SpeechSynthesisLike | null {
  const g = globalThis as unknown as { speechSynthesis?: SpeechSynthesisLike };
  return g.speechSynthesis ?? null;
}

function defaultCreateUtterance(text: string): SpeechUtteranceLike {
  const g = globalThis as unknown as {
    SpeechSynthesisUtterance?: new (t: string) => SpeechUtteranceLike;
  };
  if (g.SpeechSynthesisUtterance) {
    return new g.SpeechSynthesisUtterance(text);
  }
  return { text, lang: 'zh-CN', rate: 1, pitch: 1 };
}

/**
 * Child-friendly Chinese voice prompter backed by Web Speech API with mute & safe fallback.
 */
export class VoicePrompter {
  private readonly synthesis: SpeechSynthesisLike | null;
  private readonly createUtterance: (text: string) => SpeechUtteranceLike;
  private readonly defaultLang: string;
  private readonly defaultRate: number;
  private readonly defaultPitch: number;
  private muted = false;

  constructor(options?: VoicePrompterOptions) {
    this.synthesis =
      options && 'synthesis' in options ? (options.synthesis ?? null) : resolveDefaultSynthesis();
    this.createUtterance = options?.createUtterance ?? defaultCreateUtterance;
    this.defaultLang = options?.defaultLang ?? 'zh-CN';
    this.defaultRate = options?.defaultRate ?? 0.95;
    this.defaultPitch = options?.defaultPitch ?? 1.2;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stop();
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  speak(
    text: string,
    options?: { rate?: number; pitch?: number; interrupt?: boolean },
  ): boolean {
    if (this.muted || !this.synthesis) {
      return false;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return false;
    }

    if (options?.interrupt ?? true) {
      this.synthesis.cancel();
    }

    const utterance = this.createUtterance(trimmed);
    utterance.lang = this.defaultLang;
    utterance.rate = options?.rate ?? this.defaultRate;
    utterance.pitch = options?.pitch ?? this.defaultPitch;
    this.synthesis.speak(utterance);
    return true;
  }

  stop(): void {
    this.synthesis?.cancel();
  }
}
