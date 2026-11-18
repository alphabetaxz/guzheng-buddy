import {
  BUILTIN_DEMO_COURSE_PACK,
  parseCoursePack,
  type LessonCoursePack,
} from '../core/coursePack';
import type { StorageLike } from './progressStore';

export const COURSE_PACKS_STORAGE_KEY = 'guzheng_buddy_courses_v1';

interface StoredCourseState {
  activePackId: string;
  customPacks: LessonCoursePack[];
}

function resolveDefaultStorage(): StorageLike | null {
  try {
    const g = globalThis as unknown as { localStorage?: StorageLike };
    return g.localStorage ?? null;
  } catch {
    return null;
  }
}

export class CoursePackStore {
  private readonly storage: StorageLike | null;
  private activePackId: string = BUILTIN_DEMO_COURSE_PACK.id;
  private customPacks: LessonCoursePack[] = [];

  constructor(storage?: StorageLike | null) {
    this.storage = storage === undefined ? resolveDefaultStorage() : storage;
    this.load();
  }

  private load(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(COURSE_PACKS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<StoredCourseState>;
      if (Array.isArray(parsed.customPacks)) {
        const valid: LessonCoursePack[] = [];
        for (const item of parsed.customPacks) {
          const res = parseCoursePack(item);
          if (res.success && res.data.id !== BUILTIN_DEMO_COURSE_PACK.id) {
            valid.push(res.data);
          }
        }
        this.customPacks = valid;
      }
      if (typeof parsed.activePackId === 'string') {
        const exists =
          parsed.activePackId === BUILTIN_DEMO_COURSE_PACK.id ||
          this.customPacks.some((p) => p.id === parsed.activePackId);
        if (exists) {
          this.activePackId = parsed.activePackId;
        }
      }
    } catch {
      this.customPacks = [];
      this.activePackId = BUILTIN_DEMO_COURSE_PACK.id;
    }
  }

  private save(): void {
    if (!this.storage) return;
    try {
      const payload: StoredCourseState = {
        activePackId: this.activePackId,
        customPacks: this.customPacks,
      };
      this.storage.setItem(COURSE_PACKS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota / restricted storage errors
    }
  }

  getAllPacks(): LessonCoursePack[] {
    return [BUILTIN_DEMO_COURSE_PACK, ...this.customPacks];
  }

  getActivePack(): LessonCoursePack {
    return (
      this.getAllPacks().find((p) => p.id === this.activePackId) ??
      BUILTIN_DEMO_COURSE_PACK
    );
  }

  setActivePack(packId: string): LessonCoursePack {
    const exists = this.getAllPacks().some((p) => p.id === packId);
    if (exists) {
      this.activePackId = packId;
      this.save();
    }
    return this.getActivePack();
  }

  savePack(pack: LessonCoursePack, setAsActive: boolean = true): LessonCoursePack {
    if (pack.id === BUILTIN_DEMO_COURSE_PACK.id) {
      return BUILTIN_DEMO_COURSE_PACK;
    }
    const idx = this.customPacks.findIndex((p) => p.id === pack.id);
    if (idx >= 0) {
      this.customPacks[idx] = pack;
    } else {
      this.customPacks.push(pack);
    }
    if (setAsActive) {
      this.activePackId = pack.id;
    }
    this.save();
    return pack;
  }

  removePack(packId: string): void {
    if (packId === BUILTIN_DEMO_COURSE_PACK.id) return;
    this.customPacks = this.customPacks.filter((p) => p.id !== packId);
    if (this.activePackId === packId) {
      this.activePackId = BUILTIN_DEMO_COURSE_PACK.id;
    }
    this.save();
  }
}
