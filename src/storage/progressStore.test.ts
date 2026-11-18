import { describe, expect, it } from 'vitest';
import { ProgressStore, STICKER_CATALOG, type StorageLike } from './progressStore';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

describe('ProgressStore', () => {
  it('initializes with default progress and persists stars/levels/stickers', () => {
    const storage = createMemoryStorage();
    const store = new ProgressStore(storage);

    expect(store.getProgress()).toMatchObject({
      totalStars: 0,
      completedLevelIds: [],
      unlockedStickerIds: [],
      muted: false,
    });

    store.recordLevelCompletion('level-1-green-snakes', 4);
    const updated = store.getProgress();
    expect(updated.totalStars).toBe(4);
    expect(updated.completedLevelIds).toEqual(['level-1-green-snakes']);
    expect(updated.unlockedStickerIds).toContain('snake');
    expect(updated.unlockedStickerIds).toContain('green-finder');

    // Reload from same storage verifies persistence
    const reloaded = new ProgressStore(storage);
    expect(reloaded.getProgress()).toEqual(updated);
  });

  it('awards stars incrementally and unlocks milestone stickers', () => {
    const storage = createMemoryStorage();
    const store = new ProgressStore(storage);

    store.addStars(3, ['cat']);
    expect(store.getProgress().totalStars).toBe(3);
    expect(store.getProgress().unlockedStickerIds).toContain('cat');

    // Reaching >= 10 stars unlocks star-master trophy sticker
    store.addStars(7);
    expect(store.getProgress().totalStars).toBe(10);
    expect(store.getProgress().unlockedStickerIds).toContain('star-master');

    // Completing level 4 unlocks pentatonic-zoo animals
    store.recordLevelCompletion('level-4-pentatonic-zoo', 5);
    const ids = store.getProgress().unlockedStickerIds;
    expect(ids).toContain('rabbit');
    expect(ids).toContain('swan');
    expect(ids).toContain('koala');
    expect(ids).toContain('zoo-champion');
    expect(STICKER_CATALOG.length).toBeGreaterThanOrEqual(8);
  });

  it('recovers gracefully from corrupted JSON in storage and persists mute setting', () => {
    const storage = createMemoryStorage();
    storage.setItem('guzheng_buddy_progress_v1', '{invalid json');
    const store = new ProgressStore(storage);
    expect(store.getProgress().totalStars).toBe(0);

    store.setMuted(true);
    expect(new ProgressStore(storage).getProgress().muted).toBe(true);
  });
});
