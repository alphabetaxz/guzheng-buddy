import { useEffect, useRef, useState } from 'preact/hooks';

export interface ParentLockButtonProps {
  holdDurationMs?: number;
  onUnlock: () => void;
  onShortTap?: () => void;
}

/**
 * 2-second long-press lock button preventing 5-year-old accidental entry into Parent Toolbox.
 */
export function ParentLockButton({
  holdDurationMs = 2000,
  onUnlock,
  onShortTap,
}: ParentLockButtonProps) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const unlockedRef = useRef(false);

  const stopHold = (triggerShortTap: boolean) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (holding && !unlockedRef.current && triggerShortTap) {
      onShortTap?.();
    }
    setHolding(false);
    setProgress(0);
  };

  const startHold = () => {
    unlockedRef.current = false;
    setHolding(true);
    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const pct = Math.min(1, elapsed / holdDurationMs);
      setProgress(pct);
      if (pct >= 1) {
        unlockedRef.current = true;
        setHolding(false);
        setProgress(0);
        rafRef.current = null;
        onUnlock();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <button
      type="button"
      onPointerDown={startHold}
      onPointerUp={() => stopHold(true)}
      onPointerLeave={() => stopHold(false)}
      onPointerCancel={() => stopHold(false)}
      aria-label="家长锁（长按2秒进入）"
      class="relative w-12 h-12 rounded-full bg-white/85 hover:bg-white shadow border border-amber-200/80 flex items-center justify-center text-lg active:scale-95 transition select-none"
    >
      {holding && (
        <svg class="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 44 44">
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="#F59E0B"
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>
      )}
      <span>{holding ? '🔓' : '🔒'}</span>
    </button>
  );
}
