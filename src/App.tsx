import { useEffect, useMemo, useState } from 'preact/hooks';
import { GuzhengSynth } from './audio/guzhengSynth';
import { DualChannelPitchInput } from './audio/pitchInput';
import { VoicePrompter } from './audio/voicePrompter';
import { StickerBookModal } from './components/StickerBookModal';
import type { LessonCoursePack } from './core/coursePack';
import { HomeScreen, type ScreenRoute } from './screens/HomeScreen';
import { ParentToolboxScreen } from './screens/ParentToolboxScreen';
import { PlayScreen } from './screens/PlayScreen';
import { RhythmScreen } from './screens/RhythmScreen';
import { TeacherPracticeScreen } from './screens/TeacherPracticeScreen';
import { TheoryScreen } from './screens/TheoryScreen';
import { CoursePackStore } from './storage/coursePackStore';
import { ProgressStore, type StickerDefinition } from './storage/progressStore';

/**
 * Root application shell for Guzheng Buddy MVP (Landscape Storybook UI).
 */
export function App() {
  const synth = useMemo(() => new GuzhengSynth(), []);
  const prompter = useMemo(() => new VoicePrompter(), []);
  const pitchInput = useMemo(() => new DualChannelPitchInput(), []);
  const progressStore = useMemo(() => new ProgressStore(), []);
  const coursePackStore = useMemo(() => new CoursePackStore(), []);

  const [route, setRoute] = useState<ScreenRoute>('home');
  const [progress, setProgress] = useState(() => progressStore.getProgress());
  const [allPacks, setAllPacks] = useState(() => coursePackStore.getAllPacks());
  const [activePack, setActivePack] = useState(() => coursePackStore.getActivePack());
  const [videoOverrides, setVideoOverrides] = useState<Record<string, string>>({});
  const [stickerBookOpen, setStickerBookOpen] = useState(false);

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

  const handleEarnStars = (stars: number) => {
    setProgress(progressStore.addStars(stars));
  };

  const handleCompleteLevel = (levelId: string, starsEarned: number) => {
    setProgress(progressStore.recordLevelCompletion(levelId, starsEarned));
  };

  const handleTapSticker = (sticker: StickerDefinition) => {
    void synth.unlock();
    synth.playTone(sticker.freq);
    prompter.speak(sticker.voiceText);
  };

  const handleSelectPack = (packId: string) => {
    const next = coursePackStore.setActivePack(packId);
    setActivePack(next);
  };

  const handleSavePack = (pack: LessonCoursePack, videoBlobUrl?: string) => {
    coursePackStore.savePack(pack, true);
    setAllPacks(coursePackStore.getAllPacks());
    setActivePack(coursePackStore.getActivePack());
    if (videoBlobUrl) {
      setVideoOverrides((prev) => ({ ...prev, [pack.id]: videoBlobUrl }));
    }
  };

  const handleDeletePack = (packId: string) => {
    coursePackStore.removePack(packId);
    setAllPacks(coursePackStore.getAllPacks());
    setActivePack(coursePackStore.getActivePack());
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
          onEarnStar={() => handleEarnStars(1)}
        />
      )}

      {route === 'rhythm' && (
        <RhythmScreen
          synth={synth}
          onBack={() => setRoute('home')}
          onEarnStar={() => handleEarnStars(1)}
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
        <TeacherPracticeScreen
          coursePack={activePack}
          overrideVideoUrl={videoOverrides[activePack.id] ?? null}
          synth={synth}
          prompter={prompter}
          pitchInput={pitchInput}
          onAttachVideoUrl={(url) =>
            setVideoOverrides((prev) => ({ ...prev, [activePack.id]: url }))
          }
          onBack={() => setRoute('home')}
          onEarnStars={handleEarnStars}
        />
      )}

      {route === 'parent' && (
        <ParentToolboxScreen
          synth={synth}
          pitchInput={pitchInput}
          allPacks={allPacks}
          activePackId={activePack.id}
          onSelectPack={handleSelectPack}
          onSavePack={handleSavePack}
          onDeletePack={handleDeletePack}
          onGoPractice={() => setRoute('video')}
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
