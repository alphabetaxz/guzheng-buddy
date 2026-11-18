export interface ComingSoonScreenProps {
  icon: string;
  title: string;
  subtitle: string;
  onBack: () => void;
}

export function ComingSoonScreen({
  icon,
  title,
  subtitle,
  onBack,
}: ComingSoonScreenProps) {
  return (
    <div class="w-full h-full flex flex-col justify-between p-4 bg-gradient-to-b from-amber-50 to-emerald-50">
      <div class="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="返回首页"
          class="clay-card w-12 h-12 rounded-full bg-white border-2 border-amber-200 flex items-center justify-center text-2xl active:scale-90 transition"
        >
          🏠
        </button>
        <div class="w-12" />
      </div>

      <div class="clay-card my-auto mx-auto max-w-md w-full rounded-[32px] bg-white border-4 border-amber-300 p-6 flex flex-col items-center gap-3 text-center">
        <div class="text-5xl float-slow">{icon}</div>
        <h2 class="text-xl font-black text-stone-800">{title}</h2>
        <p class="text-sm text-stone-500">{subtitle}</p>
      </div>

      <div class="h-4" />
    </div>
  );
}
