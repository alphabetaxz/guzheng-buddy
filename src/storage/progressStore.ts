export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface StickerDefinition {
  id: string;
  emoji: string;
  name: string;
  voiceText: string;
  freq: number;
  bgClass: string;
}

export interface UserProgress {
  totalStars: number;
  completedLevelIds: string[];
  unlockedStickerIds: string[];
  muted: boolean;
}

export const PROGRESS_STORAGE_KEY = 'guzheng_buddy_progress_v1';

export const STICKER_CATALOG: readonly StickerDefinition[] = [
  {
    id: 'snake',
    emoji: '🐍',
    name: '绿小蛇',
    voiceText: '我是绿小蛇，5 Sol！',
    freq: 440.0,
    bgClass: 'from-emerald-100 to-emerald-200 border-emerald-400',
  },
  {
    id: 'rabbit',
    emoji: '🐰',
    name: '朵朵兔',
    voiceText: '我是朵朵兔，1 Do！',
    freq: 293.66,
    bgClass: 'from-red-100 to-red-200 border-red-400',
  },
  {
    id: 'swan',
    emoji: '🦢',
    name: '小天鹅',
    voiceText: '我是小天鹅，2 Re！',
    freq: 329.63,
    bgClass: 'from-orange-100 to-orange-200 border-orange-400',
  },
  {
    id: 'cat',
    emoji: '🐱',
    name: '小猫咪',
    voiceText: '我是小猫咪，3 Mi！',
    freq: 369.99,
    bgClass: 'from-amber-100 to-yellow-200 border-amber-400',
  },
  {
    id: 'koala',
    emoji: '🐨',
    name: '小考拉',
    voiceText: '我是小考拉，6 La！',
    freq: 493.88,
    bgClass: 'from-purple-100 to-purple-200 border-purple-400',
  },
  {
    id: 'green-finder',
    emoji: '🌟',
    name: '寻蛇小勇士',
    voiceText: '找到四条绿小蛇弦啦！',
    freq: 880.0,
    bgClass: 'from-teal-100 to-emerald-200 border-teal-400',
  },
  {
    id: 'tuo-master',
    emoji: '👍',
    name: '大指托能手',
    voiceText: '大指托一托，声音真响亮！',
    freq: 587.33,
    bgClass: 'from-amber-100 to-orange-200 border-amber-400',
  },
  {
    id: 'zoo-champion',
    emoji: '🏆',
    name: '五音小达人',
    voiceText: '五音动物园全部通关啦！',
    freq: 739.99,
    bgClass: 'from-indigo-100 to-purple-200 border-indigo-400',
  },
  {
    id: 'star-master',
    emoji: '👑',
    name: '十星小明星',
    voiceText: '哇！你已经攒够十颗小星星啦！',
    freq: 1174.66,
    bgClass: 'from-yellow-100 to-amber-200 border-yellow-400',
  },
];

const LEVEL_STICKER_REWARDS: Record<string, string[]> = {
  'level-1-green-snakes': ['snake', 'green-finder'],
  'level-2-wake-snake': ['snake', 'tuo-master'],
  'level-3-cat-koala': ['cat', 'koala'],
  'level-4-pentatonic-zoo': ['rabbit', 'swan', 'cat', 'snake', 'koala', 'zoo-champion'],
};

function resolveDefaultStorage(): StorageLike | null {
  try {
    const g = globalThis as unknown as { localStorage?: StorageLike };
    return g.localStorage ?? null;
  } catch {
    return null;
  }
}

function createInitialProgress(): UserProgress {
  return {
    totalStars: 0,
    completedLevelIds: [],
    unlockedStickerIds: [],
    muted: false,
  };
}

export class ProgressStore {
  private readonly storage: StorageLike | null;
  private progress: UserProgress;

  constructor(storage?: StorageLike | null) {
    this.storage = storage === undefined ? resolveDefaultStorage() : storage;
    this.progress = this.load();
  }

  private load(): UserProgress {
    if (!this.storage) return createInitialProgress();
    try {
      const raw = this.storage.getItem(PROGRESS_STORAGE_KEY);
      if (!raw) return createInitialProgress();
      const parsed = JSON.parse(raw) as Partial<UserProgress>;
      return {
        totalStars: typeof parsed.totalStars === 'number' && parsed.totalStars >= 0 ? parsed.totalStars : 0,
        completedLevelIds: Array.isArray(parsed.completedLevelIds)
          ? parsed.completedLevelIds.filter((x): x is string => typeof x === 'string')
          : [],
        unlockedStickerIds: Array.isArray(parsed.unlockedStickerIds)
          ? parsed.unlockedStickerIds.filter((x): x is string => typeof x === 'string')
          : [],
        muted: Boolean(parsed.muted),
      };
    } catch {
      return createInitialProgress();
    }
  }

  private save(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(this.progress));
    } catch {
      // Ignore storage quota / private mode errors gracefully
    }
  }

  getProgress(): UserProgress {
    return {
      totalStars: this.progress.totalStars,
      completedLevelIds: [...this.progress.completedLevelIds],
      unlockedStickerIds: [...this.progress.unlockedStickerIds],
      muted: this.progress.muted,
    };
  }

  addStars(delta: number, stickerIds: string[] = []): UserProgress {
    if (delta > 0) {
      this.progress.totalStars += delta;
    }
    this.unlockStickers(stickerIds);
    if (this.progress.totalStars >= 10) {
      this.unlockStickers(['star-master']);
    }
    this.save();
    return this.getProgress();
  }

  recordLevelCompletion(levelId: string, starsEarned: number): UserProgress {
    if (!this.progress.completedLevelIds.includes(levelId)) {
      this.progress.completedLevelIds.push(levelId);
    }
    const rewards = LEVEL_STICKER_REWARDS[levelId] ?? [];
    return this.addStars(starsEarned, rewards);
  }

  setMuted(muted: boolean): UserProgress {
    this.progress.muted = muted;
    this.save();
    return this.getProgress();
  }

  private unlockStickers(ids: string[]): void {
    for (const id of ids) {
      if (!this.progress.unlockedStickerIds.includes(id)) {
        this.progress.unlockedStickerIds.push(id);
      }
    }
  }
}
