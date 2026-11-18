import { describe, expect, it } from 'vitest';
import { BUILTIN_DEMO_COURSE_PACK } from '../core/coursePack';
import type { StorageLike } from './progressStore';
import { CoursePackStore } from './coursePackStore';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

describe('CoursePackStore', () => {
  it('defaults to built-in demo course pack and persists newly saved packs', () => {
    const storage = createMemoryStorage();
    const store = new CoursePackStore(storage);

    expect(store.getAllPacks()).toHaveLength(1);
    expect(store.getActivePack().id).toBe(BUILTIN_DEMO_COURSE_PACK.id);

    const custom = {
      ...BUILTIN_DEMO_COURSE_PACK,
      id: 'lesson-custom-99',
      title: '老师新录小曲',
    };
    store.savePack(custom, true);

    expect(store.getAllPacks()).toHaveLength(2);
    expect(store.getActivePack().id).toBe('lesson-custom-99');

    // Reload from storage verifies persistence
    const reloaded = new CoursePackStore(storage);
    expect(reloaded.getAllPacks()).toHaveLength(2);
    expect(reloaded.getActivePack().id).toBe('lesson-custom-99');
  });

  it('prevents deleting built-in pack and falls back cleanly if active pack is removed', () => {
    const storage = createMemoryStorage();
    const store = new CoursePackStore(storage);
    const custom = { ...BUILTIN_DEMO_COURSE_PACK, id: 'custom-1', title: '测试曲目' };

    store.savePack(custom, true);
    store.removePack(BUILTIN_DEMO_COURSE_PACK.id);
    expect(store.getAllPacks()).toHaveLength(2);

    store.removePack('custom-1');
    expect(store.getAllPacks()).toHaveLength(1);
    expect(store.getActivePack().id).toBe(BUILTIN_DEMO_COURSE_PACK.id);
  });
});
