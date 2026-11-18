import { STICKER_CATALOG, type StickerDefinition } from '../storage/progressStore';

export interface StickerBookModalProps {
  open: boolean;
  totalStars: number;
  unlockedIds: readonly string[];
  onClose: () => void;
  onTapSticker: (sticker: StickerDefinition) => void;
}

/**
 * Visual zero-reading sticker book showing earned animal & milestone stickers.
 */
export function StickerBookModal({
  open,
  totalStars,
  unlockedIds,
  onClose,
  onTapSticker,
}: StickerBookModalProps) {
  if (!open) return null;

  return (
    <div class="fixed inset-0 z-50 bg-stone-950/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="clay-card w-full max-w-2xl rounded-[32px] bg-gradient-to-b from-[#FFFDF7] to-amber-50 border-4 border-amber-300 p-4 flex flex-col gap-3 max-h-[90vh]">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border-2 border-amber-300 shadow-sm">
            <span class="text-2xl">📖</span>
            <span class="text-xl">🌟</span>
            <span class="font-black text-lg text-amber-600">{totalStars}</span>
          </div>

          <div class="text-sm font-black text-amber-800/80">
            {unlockedIds.length} / {STICKER_CATALOG.length} ✨
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="关闭贴纸本"
            class="clay-card w-12 h-12 rounded-full bg-white border-2 border-rose-200 flex items-center justify-center text-2xl active:scale-90 transition"
          >
            ✖️
          </button>
        </div>

        <div class="grid grid-cols-3 sm:grid-cols-5 gap-3 overflow-y-auto p-1">
          {STICKER_CATALOG.map((sticker) => {
            const unlocked = unlockedIds.includes(sticker.id);
            return (
              <button
                key={sticker.id}
                type="button"
                onClick={() => unlocked && onTapSticker(sticker)}
                disabled={!unlocked}
                class={[
                  'clay-card h-24 rounded-3xl border-2 border-b-4 flex flex-col items-center justify-center gap-1 transition',
                  unlocked
                    ? `bg-gradient-to-b ${sticker.bgClass} hover:-translate-y-0.5 active:scale-95`
                    : 'bg-stone-100 border-stone-200 opacity-60 cursor-not-allowed',
                ].join(' ')}
              >
                <span class={['text-4xl', unlocked ? 'float-slow' : 'grayscale opacity-40'].join(' ')}>
                  {unlocked ? sticker.emoji : '🔒'}
                </span>
                <span class="text-xs font-black text-stone-700">
                  {unlocked ? sticker.name : '???'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
