import { useEffect, useRef } from 'preact/hooks';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
}

const COLORS = ['#FBBF24', '#34D399', '#F472B6', '#60A5FA', '#FB923C', '#A78BFA'];

export interface ParticleFireworksProps {
  burstKey: number;
  intensity?: 'normal' | 'celebration';
}

/**
 * Lightweight Canvas particle burst overlay triggered whenever burstKey increments.
 */
export function ParticleFireworks({
  burstKey,
  intensity = 'normal',
}: ParticleFireworksProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (burstKey <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width;
    canvas.height = rect.height;

    const count = intensity === 'celebration' ? 56 : 24;
    const cx = rect.width * (0.35 + Math.random() * 0.3);
    const cy = rect.height * (0.3 + Math.random() * 0.3);

    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = (intensity === 'celebration' ? 3.5 : 2.2) + Math.random() * 4.5;
      particlesRef.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        radius: 3 + Math.random() * 4,
        color: COLORS[i % COLORS.length] ?? '#FBBF24',
        alpha: 1,
      });
    }

    if (rafRef.current !== null) return;

    const renderLoop = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const next: Particle[] = [];

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.14;
        p.alpha -= 0.022;
        if (p.alpha > 0.02) {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          next.push(p);
        }
      }

      particlesRef.current = next;
      if (next.length > 0) {
        rafRef.current = requestAnimationFrame(renderLoop);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(renderLoop);
  }, [burstKey, intensity]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      class="pointer-events-none fixed inset-0 z-40 h-full w-full"
    />
  );
}
