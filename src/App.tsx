import { useEffect, useMemo, useState } from 'preact/hooks';
import { GuzhengSynth } from './audio/guzhengSynth';
import { DualChannelPitchInput } from './audio/pitchInput';
import { VoicePrompter } from './audio/voicePrompter';
import { StickerBookModal } from './components/StickerBookModal';
import { HomeScreen, type ScreenRoute } from './screens/HomeScreen';
import { PlayScreen } from './screens/PlayScreen';
import { RhythmScreen } from './screens/RhythmScreen';
import { TheoryScreen } from './screens/TheoryScreen';
import { ComingSoonScreen } from './screens/ComingSoonScreen';
import { ProgressStore, type StickerDefinition } from './storage/progressStore';

/**
 * Root application shell for Guzheng Buddy MVP (Landscape Storybook UI).
 */
export function App() {
  const synth = useMemo(() => new GuzhengSynth(), []);
  const prompter = useMemo(() => new VoicePrompter(), []);
  const pitchInput = useMemo(() => new DualChannelPitchInput(), []);
  const progressStore = useMemo(() => new ProgressStore(), []);

  const [route, setRoute] = useState<ScreenRoute>('home');
  const [progress, setProgress] = useState(() => progressStore.getProgress());
  const [stickerBookOpen, setStickerBookOpen] = useState(false);

  // Sync persisted mute preference on mount
  useEffect(() => {
    synth.setMuted(progress.muted);
    prompter.setMuted(progress.muted);
  }, []);

  const handleToggleMute = () => {
    const nextMuted = !progress.muted;
    synth.setMuted(nextMuted);
    prompter.setMuted(nextMuted);
    setProgress(progressStore.setMuted(nextMuted));
  };

  const handleEarnStar = () => {
    setProgress(progressStore.addStars(1));
  };

  const handleCompleteLevel = (levelId: string, starsEarned: number) => {
    setProgress(progressStore.recordLevelCompletion(levelId, starsEarned));
  };

  const handleTapSticker = (sticker: StickerDefinition) => {
    void synth.unlock();
    synth.playTone(sticker.freq);
    prompter.speak(sticker.voiceText);
  };

  return (
    <main class="h-dvh w-screen overflow-hidden select-none bg-[#FFF9F0] text-stone-800">
      {route === 'home' && (
        <HomeScreen
          totalStars={progress.totalStars}
          completedLevelCount={progress.completedLevelIds.length}
          muted={progress.muted}
          synth={synth}
          prompter={prompter}
          onNavigate={setRoute}
          onOpenStickers={() => setStickerBookOpen(true)}
          onToggleMute={handleToggleMute}
        />
      )}

      {route === 'theory' && (
        <TheoryScreen
          synth={synth}
          prompter={prompter}
          onBack={() => setRoute('home')}
          onEarnStar={handleEarnStar}
        />
      )}

      {route === 'rhythm' && (
        <RhythmScreen
          synth={synth}
          onBack={() => setRoute('home')}
          onEarnStar={handleEarnStar}
        />
      )}

      {route === 'play' && (
        <PlayScreen
          synth={synth}
          prompter={prompter}
          pitchInput={pitchInput}
          completedLevelIds={progress.completedLevelIds}
          onBack={() => setRoute('home')}
          onCompleteLevel={handleCompleteLevel}
        />
      )}

      {route === 'video' && (
        <ComingSoonScreen
          icon="🎬"
          title="老师视频带练室"
          subtitle="将在 Step 4 接入左视频示范 + 右同步古筝分屏跟弹与课程包打点工具"
          onBack={() => setRoute('home')}
        />
      )}

      {route === 'parent' && (
        <ComingSoonScreen
          icon="🎛️"
          title="家长工具箱（21 弦调音器 & 课程包）"
          subtitle="将在 Step 4 接入 ±8 cents 精密调音表盘与老师课程包导入器"
          onBack={() => setRoute('home')}
        />
      )}

      <StickerBookModal
        open={stickerBookOpen}
        totalStars={progress.totalStars}
        unlockedIds={progress.unlockedStickerIds}
        onClose={() => setStickerBookOpen(false)}
        onTapSticker={handleTapSticker}
      />
    </main>
  );
}
