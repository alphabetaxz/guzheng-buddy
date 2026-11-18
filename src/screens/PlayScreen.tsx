import { useEffect, useRef, useState } from 'preact/hooks';
import type { GuzhengSynth } from '../audio/guzhengSynth';
import type { DualChannelPitchInput, MicInputStatus } from '../audio/pitchInput';
import type { VoicePrompter } from '../audio/voicePrompter';
import { GuzhengBoard } from '../components/GuzhengBoard';
import { ParticleFireworks } from '../components/ParticleFireworks';
import {
  BUILTIN_GAME_LEVELS,
  GameSession,
  formatStepVoicePrompt,
  type BoardZoom,
  type GameSessionState,
} from '../core/gameLevels';
import { FINGERING_META, type GuzhengString } from '../core/guzhengTuning';

export interface PlayScreenProps {
  synth: GuzhengSynth;
  prompter: VoicePrompter;
  pitchInput: DualChannelPitchInput;
  completedLevelIds: readonly string[];
  onBack: () => void;
  onCompleteLevel: (levelId: string, starsEarned: number) => void;
}

export function PlayScreen({
  synth,
  prompter,
  pitchInput,
  completedLevelIds,
  onBack,
  onCompleteLevel,
}: PlayScreenProps) {
  const [levelIdx, setLevelIdx] = useState(0);
  const currentLevel = BUILTIN_GAME_LEVELS[levelIdx] ?? BUILTIN_GAME_LEVELS[0]!;

  const sessionRef = useRef<GameSession>(new GameSession(currentLevel));
  const [sessionState, setSessionState] = useState<GameSessionState>(() =>
    sessionRef.current.getState(),
  );
  const [zoom, setZoom] = useState<BoardZoom>(currentLevel.defaultZoom);
  const [pluckedNum, setPluckedNum] = useState<number | null>(null);
  const [pluckNonce, setPluckNonce] = useState(0);
  const [fireworkKey, setFireworkKey] = useState(0);
  const [fireworkIntensity, setFireworkIntensity] = useState<'normal' | 'celebration'>('normal');
  const [micStatus, setMicStatus] = useState<MicInputStatus>(() => pitchInput.getStatus());
  const [heardHint, setHeardHint] = useState<string | null>(null);

  const selectLevel = (idx: number) => {
    const nextLevel = BUILTIN_GAME_LEVELS[idx] ?? BUILTIN_GAME_LEVELS[0]!;
    setLevelIdx(idx);
    sessionRef.current = new GameSession(nextLevel);
    setSessionState(sessionRef.current.getState());
    setZoom(nextLevel.defaultZoom);
    setHeardHint(null);
    void synth.unlock();
    prompter.speak(nextLevel.voiceIntro);
  };

  // Speak intro on initial mount
  useEffect(() => {
    prompter.speak(currentLevel.voiceIntro);
    // Stop mic stream cleanly when leaving PlayScreen
    return () => {
      void pitchInput.stopMicrophone();
    };
  }, []);

  // Subscribe to real-time PitchFrames from microphone / simulation channel
  useEffect(() => {
    const unsubscribe = pitchInput.subscribe((frame) => {
      const session = sessionRef.current;
      const prevState = session.getState();
      if (prevState.completed) return;

      const res = session.processPitchFrame(frame);
      if (res.matchResult?.detectedString && res.matchResult.status === 'wrong_string') {
        const d = res.matchResult.detectedString;
        setHeardHint(`${d.animalEmoji} ${d.num}弦`);
      }

      if (res.matched) {
        const hitStrNum = prevState.currentString?.num ?? null;
        if (hitStrNum !== null) {
          setPluckedNum(hitStrNum);
          setPluckNonce((n) => n + 1);
        }
        setHeardHint(null);
        handleStepSuccess(res.completed, res.starsEarned);
      }
    });

    return unsubscribe;
  }, [levelIdx]);

  const handleStepSuccess = (levelCompleted: boolean, starsEarned: number) => {
    const nextState = sessionRef.current.getState();
    setSessionState(nextState);

    if (levelCompleted) {
      setFireworkIntensity('celebration');
      setFireworkKey((k) => k + 1);
      synth.playWinChord();
      prompter.speak('太棒啦！全部过关啦！收集到小星星！');
      onCompleteLevel(nextState.level.id, starsEarned);
    } else {
      setFireworkIntensity('normal');
      setFireworkKey((k) => k + 1);
      synth.playStarChime();
      if (nextState.currentStep) {
        setTimeout(() => {
          prompter.speak(formatStepVoicePrompt(nextState.currentStep!));
        }, 320);
      }
    }
  };

  const handlePluckVirtualString = (str: GuzhengString) => {
    void synth.unlock();
    synth.playTone(str.frequency);
    setPluckedNum(str.num);
    setPluckNonce((n) => n + 1);

    const state = sessionRef.current.getState();
    if (state.completed) return;

    const res = sessionRef.current.submitStringHit(str.num);
    if (res.matched) {
      setHeardHint(null);
      handleStepSuccess(res.completed, res.starsEarned);
    } else {
      setHeardHint(`${str.animalEmoji} ${str.num}弦`);
      prompter.speak(str.animalName);
    }
  };

  const handleReplayTargetVoice = () => {
    void synth.unlock();
    const { currentStep, currentString } = sessionState;
    if (!currentStep || !currentString) return;
    synth.playTone(currentString.frequency);
    prompter.speak(formatStepVoicePrompt(currentStep));
  };

  const toggleMicrophone = async () => {
    void synth.unlock();
    if (micStatus === 'listening') {
      await pitchInput.stopMicrophone();
      setMicStatus(pitchInput.getStatus());
      return;
    }

    try {
      await pitchInput.startMicrophone();
      setMicStatus(pitchInput.getStatus());
      prompter.speak('打开小耳朵啦，请在古筝上弹一弹！');
    } catch {
      setMicStatus('error');
      prompter.speak('没有打开麦克风哦，可以直接点屏幕上的琴弦');
    }
  };

  const handleReplayLevel = () => {
    sessionRef.current.reset();
    setSessionState(sessionRef.current.getState());
    setHeardHint(null);
    prompter.speak(currentLevel.voiceIntro);
  };

  const currentStep = sessionState.currentStep;
  const currentString = sessionState.currentString;
  const fingerMeta = currentStep ? FINGERING_META[currentStep.finger] : null;
  const hasNextLevel = levelIdx + 1 < BUILTIN_GAME_LEVELS.length;

  return (
    <div class="w-full h-full flex flex-col justify-between p-2.5 bg-gradient-to-b from-[#FFFDF9] to-[#F5E6C8] relative overflow-hidden">
      <ParticleFireworks burstKey={fireworkKey} intensity={fireworkIntensity} />

      {/* Top HUD Bar */}
      <div class="flex items-center justify-between gap-2 px-1 relative z-10">
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              void pitchInput.stopMicrophone();
              onBack();
            }}
            aria-label="返回首页"
            class="clay-card w-11 h-11 rounded-full bg-white border-2 border-amber-200 flex items-center justify-center text-xl active:scale-90 transition"
          >
            🏠
          </button>

          {/* 4 Built-in Level Selector Pills */}
          <div class="flex items-center gap-1 bg-white/90 p-1 rounded-full border border-amber-200 shadow-sm">
            {BUILTIN_GAME_LEVELS.map((lvl, idx) => {
              const active = idx === levelIdx;
              const done = completedLevelIds.includes(lvl.id);
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => selectLevel(idx)}
                  aria-label={`第${lvl.order}关`}
                  class={[
                    'w-9 h-9 rounded-full flex items-center justify-center text-base font-black transition relative',
                    active
                      ? 'bg-gradient-to-b from-amber-400 to-orange-400 text-white shadow scale-105'
                      : done
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'text-stone-600 hover:bg-amber-50',
                  ].join(' ')}
                >
                  <span>{lvl.icon}</span>
                  {done && (
                    <span class="absolute -top-1 -right-1 text-[10px]">⭐</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Glowing Target Jade Pill */}
        {currentString && fingerMeta ? (
          <button
            type="button"
            onClick={handleReplayTargetVoice}
            aria-label="重听当前目标提示"
            class="clay-card flex items-center gap-2.5 bg-white px-4 py-1 rounded-full border-2 border-emerald-400 glow-target active:scale-95 transition"
          >
            <span class="text-2xl sm:text-3xl float-slow">{currentString.animalEmoji}</span>
            <div class="flex flex-col items-center leading-tight">
              <span class="text-xl sm:text-2xl font-black text-emerald-600">
                {currentString.jianpu}
              </span>
              <span class="text-[10px] font-black text-stone-500">{currentString.num}弦</span>
            </div>
            <div class="h-6 w-0.5 bg-amber-200" />
            <div class="flex items-center gap-1">
              <span class="text-2xl">{fingerMeta.emoji}</span>
              <span class="font-serif font-black text-base text-amber-800 bg-amber-100 px-1.5 rounded-md">
                {fingerMeta.symbol}
              </span>
            </div>
            <span class="text-base text-amber-500">🔊</span>
          </button>
        ) : (
          <div class="clay-card px-5 py-1.5 rounded-full bg-emerald-50 border-2 border-emerald-400 font-black text-emerald-700">
            🎉 🌟 × {sessionState.starsEarned}
          </div>
        )}

        {/* Right Controls: Step Progress Dots + Mic Toggle + Zoom Toggle */}
        <div class="flex items-center gap-1.5">
          {/* Step Progress Dots */}
          <div class="hidden md:flex items-center gap-1 bg-white/85 px-2.5 py-1.5 rounded-full border border-amber-200">
            {Array.from({ length: sessionState.totalSteps }).map((_, i) => (
              <span
                key={i}
                class={[
                  'text-sm transition-transform',
                  i < sessionState.starsEarned
                    ? 'scale-110'
                    : i === sessionState.stepIndex && !sessionState.completed
                      ? 'animate-pulse opacity-80'
                      : 'opacity-25',
                ].join(' ')}
              >
                {i < sessionState.starsEarned ? '🌟' : '⭐'}
              </span>
            ))}
          </div>

          {heardHint && (
            <span class="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full bg-white/90 border border-amber-300 text-xs font-black text-stone-700">
              {heardHint}
            </span>
          )}

          <button
            type="button"
            onClick={() => void toggleMicrophone()}
            aria-label={micStatus === 'listening' ? '关闭麦克风监听' : '开启麦克风监听'}
            class={[
              'clay-card w-11 h-11 rounded-full border-2 flex items-center justify-center text-lg active:scale-90 transition',
              micStatus === 'listening'
                ? 'bg-emerald-500 text-white border-emerald-200 ring-2 ring-emerald-300 animate-pulse'
                : micStatus === 'error'
                  ? 'bg-rose-100 border-rose-300 text-rose-700'
                  : 'bg-white border-amber-200 text-stone-700',
            ].join(' ')}
          >
            {micStatus === 'listening' ? '🎙️' : '🎤'}
          </button>

          <button
            type="button"
            onClick={() => setZoom((z) => (z === 'focus' ? 'full' : 'focus'))}
            aria-label={zoom === 'focus' ? '切换到21弦全景' : '放大中音区'}
            class="clay-card w-11 h-11 rounded-full bg-white border-2 border-amber-200 flex items-center justify-center text-lg active:scale-90 transition"
          >
            {zoom === 'focus' ? '🔍' : '🔎'}
          </button>
        </div>
      </div>

      {/* Main Horizontal Interactive Guzheng Soundboard */}
      <div class="flex-1 flex mt-1.5 min-h-0">
        <GuzhengBoard
          zoom={zoom}
          targetStringNum={currentString?.num ?? null}
          targetFinger={currentStep?.finger ?? 'tuo'}
          pluckedStringNum={pluckedNum}
          pluckNonce={pluckNonce}
          onPluckString={handlePluckVirtualString}
        />
      </div>

      {/* Level Completed Celebration Overlay */}
      {sessionState.completed && (
        <div class="fixed inset-0 z-30 bg-stone-950/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div class="clay-card rounded-[36px] bg-gradient-to-b from-white to-amber-50 border-4 border-amber-300 px-8 py-6 flex flex-col items-center gap-4 text-center shadow-2xl">
            <div class="text-5xl float-slow">🏆 🌟 🎉</div>
            <div class="flex items-center gap-1.5 text-3xl">
              {Array.from({ length: sessionState.starsEarned }).map((_, i) => (
                <span key={i}>🌟</span>
              ))}
            </div>
            <div class="flex items-center gap-4 mt-1">
              <button
                type="button"
                onClick={handleReplayLevel}
                aria-label="再玩一次"
                class="clay-card w-16 h-14 rounded-full bg-white border-2 border-amber-300 flex items-center justify-center text-3xl active:scale-90 transition"
              >
                🔄
              </button>
              {hasNextLevel && (
                <button
                  type="button"
                  onClick={() => selectLevel(levelIdx + 1)}
                  aria-label="下一关"
                  class="clay-card px-8 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-2 border-white flex items-center justify-center text-3xl shadow-lg active:scale-90 transition"
                >
                  ➡️
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
