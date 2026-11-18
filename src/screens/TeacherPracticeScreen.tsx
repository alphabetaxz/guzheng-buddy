import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { GuzhengSynth } from '../audio/guzhengSynth';
import type { DualChannelPitchInput, MicInputStatus } from '../audio/pitchInput';
import type { VoicePrompter } from '../audio/voicePrompter';
import { GuzhengBoard } from '../components/GuzhengBoard';
import { ParticleFireworks } from '../components/ParticleFireworks';
import type { LessonCoursePack } from '../core/coursePack';
import {
  FINGERING_META,
  GUZHENG_21_STRINGS,
  getGuzhengString,
  type GuzhengString,
} from '../core/guzhengTuning';
import {
  PracticeSession,
  type PracticeMode,
  type PracticeSessionState,
} from '../core/practiceSession';

export interface TeacherPracticeScreenProps {
  coursePack: LessonCoursePack;
  overrideVideoUrl: string | null;
  synth: GuzhengSynth;
  prompter: VoicePrompter;
  pitchInput: DualChannelPitchInput;
  onAttachVideoUrl: (url: string) => void;
  onBack: () => void;
  onEarnStars: (stars: number) => void;
}

export function TeacherPracticeScreen({
  coursePack,
  overrideVideoUrl,
  synth,
  prompter,
  pitchInput,
  onAttachVideoUrl,
  onBack,
  onEarnStars,
}: TeacherPracticeScreenProps) {
  const [mode, setMode] = useState<PracticeMode>('watch_then_play');
  const sessionRef = useRef<PracticeSession>(new PracticeSession(coursePack, { mode }));
  const [state, setState] = useState<PracticeSessionState>(() => sessionRef.current.getState());

  const [slowSpeed, setSlowSpeed] = useState(true);
  const [abLoop, setAbLoop] = useState(true);
  const [mirrored, setMirrored] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [demoStepIdx, setDemoStepIdx] = useState<number | null>(null);

  const [pluckedNum, setPluckedNum] = useState<number | null>(null);
  const [pluckNonce, setPluckNonce] = useState(0);
  const [fireworkKey, setFireworkKey] = useState(0);
  const [fireworkIntensity, setFireworkIntensity] = useState<'normal' | 'celebration'>('normal');
  const [micStatus, setMicStatus] = useState<MicInputStatus>(() => pitchInput.getStatus());

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const demoTimersRef = useRef<number[]>([]);

  const effectiveVideoUrl = overrideVideoUrl ?? coursePack.videoUrl;
  const hasRealVideo = useMemo(() => {
    if (videoFailed) return false;
    return (
      effectiveVideoUrl.startsWith('blob:') ||
      effectiveVideoUrl.startsWith('http://') ||
      effectiveVideoUrl.startsWith('https://') ||
      effectiveVideoUrl.startsWith('data:')
    );
  }, [effectiveVideoUrl, videoFailed]);

  // Compute aligned string range covering all steps in the lesson (at least 7..13)
  const stringRange = useMemo<[number, number]>(() => {
    let min = 7;
    let max = 13;
    for (const seg of coursePack.segments) {
      for (const st of seg.steps) {
        if (st.stringNum < min) min = st.stringNum;
        if (st.stringNum > max) max = st.stringNum;
      }
    }
    return [min, max];
  }, [coursePack]);

  const demoStrings = useMemo(
    () =>
      [...GUZHENG_21_STRINGS]
        .reverse()
        .filter((s) => s.num >= stringRange[0] && s.num <= stringRange[1]),
    [stringRange],
  );

  const clearDemoTimers = () => {
    for (const id of demoTimersRef.current) {
      window.clearTimeout(id);
    }
    demoTimersRef.current = [];
  };

  // Re-initialize session when coursePack changes
  useEffect(() => {
    clearDemoTimers();
    sessionRef.current = new PracticeSession(coursePack, { mode });
    setState(sessionRef.current.getState());
    setVideoFailed(false);
    setDemoStepIdx(null);
  }, [coursePack]);

  // Cleanup mic & timers on unmount
  useEffect(() => {
    return () => {
      clearDemoTimers();
      void pitchInput.stopMicrophone();
    };
  }, []);

  // Sync video playbackRate whenever slowSpeed changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = slowSpeed ? 0.6 : 1.0;
    (video as HTMLVideoElement & { preservesPitch?: boolean }).preservesPitch = true;
  }, [slowSpeed, hasRealVideo]);

  // Subscribe to microphone frames
  useEffect(() => {
    const unsub = pitchInput.subscribe((frame) => {
      const session = sessionRef.current;
      const before = session.getState();
      if (before.phase !== 'follow') return;

      const res = session.processPitchFrame(frame);
      if (res.stepCompleted) {
        const hitNum = before.currentStep?.stringNum ?? null;
        if (hitNum !== null) {
          setPluckedNum(hitNum);
          setPluckNonce((n) => n + 1);
        }
        handleStepAdvanced(res.segmentCompleted, res.courseCompleted);
      }
    });
    return unsub;
  }, [coursePack]);

  const handleStepAdvanced = (segmentCompleted: boolean, courseCompleted: boolean) => {
    const nextState = sessionRef.current.getState();
    setState(nextState);

    if (courseCompleted) {
      setFireworkIntensity('celebration');
      setFireworkKey((k) => k + 1);
      synth.playWinChord();
      prompter.speak('太棒啦！整首曲子都跟弹完成啦！');
      onEarnStars(nextState.starsEarned);
      return;
    }

    setFireworkIntensity('normal');
    setFireworkKey((k) => k + 1);
    synth.playStarChime();

    if (segmentCompleted && nextState.currentSegment) {
      setTimeout(() => {
        prompter.speak(nextState.currentSegment!.promptVoiceText);
        if (nextState.phase === 'demo') {
          playCurrentSegmentDemo();
        }
      }, 360);
    }
  };

  const playCurrentSegmentDemo = () => {
    void synth.unlock();
    clearDemoTimers();
    const curState = sessionRef.current.getState();
    const seg = curState.currentSegment;
    if (!seg) return;

    prompter.speak(seg.promptVoiceText);

    if (hasRealVideo && videoRef.current) {
      const video = videoRef.current;
      video.currentTime = seg.videoStartSec;
      video.playbackRate = slowSpeed ? 0.6 : 1.0;
      void video.play().then(() => setVideoPlaying(true)).catch(() => {});
      return;
    }

    // Built-in animated overhead guzheng demo playback synced at 0.6x / 1.0x
    const intervalMs = slowSpeed ? 560 : 340;
    setVideoPlaying(true);

    seg.steps.forEach((step, idx) => {
      const t = window.setTimeout(() => {
        setDemoStepIdx(idx);
        synth.playString(step.stringNum, slowSpeed ? 1.1 : 0.85);
      }, idx * intervalMs);
      demoTimersRef.current.push(t);
    });

    const endTimer = window.setTimeout(() => {
      setDemoStepIdx(null);
      setVideoPlaying(false);
      if (sessionRef.current.getState().phase === 'demo') {
        sessionRef.current.completeDemo();
        setState(sessionRef.current.getState());
        prompter.speak('轮到宝贝啦！');
      } else if (abLoop && mode === 'play_along') {
        playCurrentSegmentDemo();
      }
    }, seg.steps.length * intervalMs + 260);
    demoTimersRef.current.push(endTimer);
  };

  const handleVideoTimeUpdate = () => {
    const video = videoRef.current;
    const seg = state.currentSegment;
    if (!video || !seg) return;

    if (video.currentTime >= seg.videoEndSec) {
      if (state.phase === 'demo') {
        video.pause();
        video.currentTime = seg.videoEndSec;
        setVideoPlaying(false);
        sessionRef.current.completeDemo();
        setState(sessionRef.current.getState());
        prompter.speak('轮到宝贝啦！');
      } else if (abLoop) {
        video.currentTime = seg.videoStartSec;
        void video.play().catch(() => {});
      } else {
        video.pause();
        setVideoPlaying(false);
      }
    }
  };

  const handleTogglePlayPause = () => {
    void synth.unlock();
    if (hasRealVideo && videoRef.current) {
      const video = videoRef.current;
      if (videoPlaying) {
        video.pause();
        setVideoPlaying(false);
      } else {
        const seg = state.currentSegment;
        if (seg && (video.currentTime < seg.videoStartSec || video.currentTime >= seg.videoEndSec)) {
          video.currentTime = seg.videoStartSec;
        }
        void video.play().then(() => setVideoPlaying(true)).catch(() => {});
      }
      return;
    }

    if (videoPlaying) {
      clearDemoTimers();
      setVideoPlaying(false);
      setDemoStepIdx(null);
    } else {
      playCurrentSegmentDemo();
    }
  };

  const handleSwitchMode = (nextMode: PracticeMode) => {
    clearDemoTimers();
    setMode(nextMode);
    sessionRef.current.setMode(nextMode);
    setState(sessionRef.current.getState());
    if (nextMode === 'play_along') {
      prompter.speak('边看边弹模式，一起弹吧！');
    } else {
      prompter.speak('先看老师示范，再轮到宝贝哦！');
    }
  };

  const handleReset = () => {
    clearDemoTimers();
    setVideoPlaying(false);
    setDemoStepIdx(null);
    sessionRef.current.reset();
    setState(sessionRef.current.getState());
  };

  const handlePluckString = (str: GuzhengString) => {
    void synth.unlock();
    synth.playTone(str.frequency);
    setPluckedNum(str.num);
    setPluckNonce((n) => n + 1);

    const cur = sessionRef.current.getState();
    if (cur.phase === 'completed') {
      handleReset();
      return;
    }
    if (cur.phase === 'demo') {
      prompter.speak('先看老师示范一遍哦');
      return;
    }

    const res = sessionRef.current.submitStringHit(str.num);
    if (res.stepCompleted) {
      handleStepAdvanced(res.segmentCompleted, res.courseCompleted);
    } else {
      prompter.speak(str.animalName);
    }
  };

  const handlePickLocalVideo = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    setVideoFailed(false);
    onAttachVideoUrl(blobUrl);
  };

  const toggleMic = async () => {
    void synth.unlock();
    if (micStatus === 'listening') {
      await pitchInput.stopMicrophone();
      setMicStatus(pitchInput.getStatus());
      return;
    }
    try {
      await pitchInput.startMicrophone();
      setMicStatus(pitchInput.getStatus());
      prompter.speak('打开小耳朵啦！');
    } catch {
      setMicStatus('error');
    }
  };

  const activeSeg = state.currentSegment;
  const activeStep = state.currentStep;
  const demoActiveStep =
    demoStepIdx !== null && activeSeg ? activeSeg.steps[demoStepIdx] ?? null : null;
  const highlightedStringNum =
    state.phase === 'demo'
      ? (demoActiveStep?.stringNum ?? activeStep?.stringNum ?? null)
      : (activeStep?.stringNum ?? null);
  const highlightedFinger =
    state.phase === 'demo'
      ? (demoActiveStep?.finger ?? activeStep?.finger ?? 'tuo')
      : (activeStep?.finger ?? 'tuo');

  return (
    <div class="w-full h-full flex flex-col justify-between p-2.5 bg-gradient-to-b from-[#FFFDF9] to-[#F5E6C8] relative overflow-hidden">
      <ParticleFireworks burstKey={fireworkKey} intensity={fireworkIntensity} />

      {/* Top HUD Bar */}
      <div class="flex items-center justify-between gap-2 px-1 relative z-10">
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              clearDemoTimers();
              void pitchInput.stopMicrophone();
              onBack();
            }}
            aria-label="返回首页"
            class="clay-card w-11 h-11 rounded-full bg-white border-2 border-amber-200 flex items-center justify-center text-xl active:scale-90 transition"
          >
            🏠
          </button>

          {/* Dual Mode Switch: Watch-then-Play vs Play-Along */}
          <button
            type="button"
            onClick={() =>
              handleSwitchMode(mode === 'watch_then_play' ? 'play_along' : 'watch_then_play')
            }
            aria-label="切换跟练模式"
            class="clay-card px-3 h-10 rounded-full bg-white border-2 border-purple-200 text-xs font-black text-purple-700 flex items-center gap-1 active:scale-95 transition"
          >
            <span>{mode === 'watch_then_play' ? '👀' : '🎵'}</span>
            <span class="hidden sm:inline">
              {mode === 'watch_then_play' ? '先看后弹' : '边看边弹'}
            </span>
          </button>

          {/* Quick Local MP4 Loader */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handlePickLocalVideo}
            class="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="加载老师本地视频"
            class="clay-card w-10 h-10 rounded-full bg-white border-2 border-amber-200 flex items-center justify-center text-lg active:scale-90 transition"
          >
            📂
          </button>
        </div>

        {/* Center Step Bubbles for Current Segment */}
        <div class="flex items-center gap-2">
          <span class="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-xs font-black text-amber-800">
            {state.segmentIndex + 1}/{state.totalSegments}
          </span>
          <div class="flex items-center gap-2">
            {(activeSeg?.steps ?? []).map((st, idx) => {
              const done = state.phase === 'completed' || idx < state.stepIndex;
              const active = state.phase === 'follow' && idx === state.stepIndex;
              const strInfo = getGuzhengString(st.stringNum);
              const fingerInfo = FINGERING_META[st.finger];
              return (
                <div
                  key={`${activeSeg?.id}-${idx}`}
                  class={[
                    'clay-card px-2.5 h-10 rounded-2xl flex items-center justify-center gap-0.5 text-base sm:text-lg border-2 transition-all',
                    done
                      ? 'bg-emerald-100 border-emerald-400'
                      : active
                        ? 'bg-gradient-to-b from-amber-100 to-amber-300 border-amber-500 scale-110 glow-target'
                        : 'bg-white/75 border-stone-200 opacity-60',
                  ].join(' ')}
                >
                  {done ? '🌟' : `${strInfo?.animalEmoji ?? '🎵'}${fingerInfo.emoji}`}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Controls + Phase 2 Hand-Pose PiP Reserved Slot */}
        <div class="flex items-center gap-1.5">
          {/* Phase 2 Camera PiP Mount Reservation */}
          <div
            data-pip-mount="hand-pose-phase2"
            aria-hidden="true"
            class="hidden lg:flex w-12 h-10 rounded-xl border border-dashed border-amber-400/60 bg-white/40 items-center justify-center text-xs text-stone-400"
            title="Phase 2 手型识别画中画预留位"
          >
            📷
          </div>

          <button
            type="button"
            onClick={() => void toggleMic()}
            aria-label={micStatus === 'listening' ? '关闭麦克风' : '开启麦克风'}
            class={[
              'clay-card w-11 h-11 rounded-full border-2 flex items-center justify-center text-lg active:scale-90 transition',
              micStatus === 'listening'
                ? 'bg-emerald-500 text-white border-emerald-200 animate-pulse'
                : 'bg-white border-amber-200 text-stone-700',
            ].join(' ')}
          >
            {micStatus === 'listening' ? '🎙️' : '🎤'}
          </button>

          <button
            type="button"
            onClick={handleReset}
            aria-label="重新开始"
            class="clay-card w-11 h-11 rounded-full bg-white border-2 border-amber-200 flex items-center justify-center text-lg active:scale-90 transition"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Golden Split: Left 52% Teacher Video Player | Right 48% Aligned Follow-Along Board */}
      <div class="flex-1 grid grid-cols-[52fr_48fr] gap-2.5 mt-1.5 min-h-0">
        {/* Left: Teacher Video Frame + Large Icon Controls */}
        <div class="rounded-[22px] bg-stone-900 border-2 border-stone-700 shadow-lg relative overflow-hidden flex flex-col justify-between p-2.5">
          <div
            class={[
              'flex-1 rounded-2xl overflow-hidden relative flex flex-col justify-between bg-stone-950 transition-transform duration-300',
              mirrored ? 'scale-y-[-1]' : '',
            ].join(' ')}
          >
            {hasRealVideo ? (
              <video
                ref={videoRef}
                src={effectiveVideoUrl}
                playsInline
                onTimeUpdate={handleVideoTimeUpdate}
                onError={() => setVideoFailed(true)}
                class="w-full h-full object-cover"
              />
            ) : (
              /* Built-in Animated Overhead Teacher Guzheng Stage */
              <div class="w-full h-full guzheng-wood border border-amber-900/90 flex flex-col justify-between py-3 px-2.5 relative">
                <div class="absolute top-0 bottom-0 right-5 w-2.5 rosewood-frame border-x border-amber-400/50 pointer-events-none" />
                {demoStrings.map((s) => {
                  const isDemoHit = demoActiveStep?.stringNum === s.num;
                  const fingerEmoji = demoActiveStep
                    ? FINGERING_META[demoActiveStep.finger].emoji
                    : '👍';
                  return (
                    <div
                      key={s.num}
                      class={[
                        'relative flex items-center flex-1',
                        isDemoHit ? 'pluck-anim' : '',
                      ].join(' ')}
                    >
                      <div
                        class={[
                          'w-full rounded-full transition-all',
                          s.isGreen
                            ? 'h-1 bg-emerald-400 shadow-[0_0_8px_#34d399]'
                            : isDemoHit
                              ? 'h-[3px] bg-amber-300 shadow-[0_0_10px_#fcd34d]'
                              : 'h-[2px] bg-amber-100/65',
                        ].join(' ')}
                      />
                      {isDemoHit && (
                        <span class="absolute right-8 -top-3 text-2xl float-slow drop-shadow">
                          {fingerEmoji}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Phase Badge Pill */}
            <div
              class={[
                'absolute top-2 left-2 px-2.5 py-0.5 rounded-full text-xs font-black shadow border',
                mirrored ? 'scale-y-[-1]' : '',
                state.phase === 'demo'
                  ? 'bg-purple-600/90 text-white border-purple-300'
                  : state.phase === 'follow'
                    ? 'bg-emerald-500/95 text-white border-emerald-200 animate-pulse'
                    : 'bg-amber-400 text-stone-900 border-white',
              ].join(' ')}
            >
              {state.phase === 'demo'
                ? '👩‍🏫 示范中'
                : state.phase === 'follow'
                  ? '🌟 轮到宝贝啦'
                  : '🎉 弹完啦'}
            </div>
          </div>

          {/* 4 Large Icon Control Buttons (Play, 0.6x Turtle, AB Loop, Mirror) */}
          <div class="mt-2 grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={handleTogglePlayPause}
              aria-label={videoPlaying ? '暂停示范' : '播放老师示范'}
              class="h-11 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white flex items-center justify-center text-xl shadow-md border border-white/30 active:scale-95 transition"
            >
              {videoPlaying ? '⏸️' : '▶️'}
            </button>

            <button
              type="button"
              onClick={() => setSlowSpeed((v) => !v)}
              aria-label="慢速0.6x切换"
              class={[
                'h-11 rounded-xl text-white flex items-center justify-center gap-1 text-lg font-black shadow-md active:scale-95 transition',
                slowSpeed
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 ring-2 ring-emerald-300'
                  : 'bg-stone-700 text-white/70',
              ].join(' ')}
            >
              <span>🐢</span>
              <span class="text-xs">{slowSpeed ? '0.6x' : '1.0x'}</span>
            </button>

            <button
              type="button"
              onClick={() => setAbLoop((v) => !v)}
              aria-label="AB分句循环"
              class={[
                'h-11 rounded-xl text-white flex items-center justify-center text-xl shadow-md active:scale-95 transition',
                abLoop
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 ring-2 ring-amber-300'
                  : 'bg-stone-700 text-white/70',
              ].join(' ')}
            >
              🔁
            </button>

            <button
              type="button"
              onClick={() => setMirrored((v) => !v)}
              aria-label="镜像翻转"
              class={[
                'h-11 rounded-xl text-white flex items-center justify-center text-xl shadow-md active:scale-95 transition',
                mirrored
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 ring-2 ring-sky-300'
                  : 'bg-stone-700 text-white/75',
              ].join(' ')}
            >
              🪞
            </button>
          </div>
        </div>

        {/* Right: Aligned Interactive Follow-Along Guzheng Strings */}
        <div class="flex min-h-0 relative">
          <GuzhengBoard
            zoom="focus"
            stringRange={stringRange}
            targetStringNum={highlightedStringNum}
            targetFinger={highlightedFinger}
            pluckedStringNum={pluckedNum}
            pluckNonce={pluckNonce}
            onPluckString={handlePluckString}
          />

          {state.phase === 'demo' && (
            <button
              type="button"
              onClick={() => {
                clearDemoTimers();
                setVideoPlaying(false);
                setDemoStepIdx(null);
                sessionRef.current.completeDemo();
                setState(sessionRef.current.getState());
                prompter.speak('轮到宝贝啦！');
              }}
              class="clay-card absolute bottom-3 right-3 z-20 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-sm border-2 border-white shadow-lg active:scale-95 transition"
            >
              ✋ 我来弹
            </button>
          )}
        </div>
      </div>

      {/* Course Completed Overlay */}
      {state.phase === 'completed' && (
        <div class="fixed inset-0 z-30 bg-stone-950/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div class="clay-card rounded-[36px] bg-gradient-to-b from-white to-amber-50 border-4 border-amber-300 px-8 py-6 flex flex-col items-center gap-3 text-center shadow-2xl">
            <div class="text-5xl float-slow">🏆 🌟 🎶</div>
            <div class="text-lg font-black text-stone-800">{coursePack.title}</div>
            <div class="text-2xl font-black text-amber-600">🌟 × {state.starsEarned}</div>
            <button
              type="button"
              onClick={handleReset}
              aria-label="再弹一遍"
              class="clay-card mt-1 px-8 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-2 border-white text-2xl font-black shadow-lg active:scale-90 transition"
            >
              🔄 再弹一遍
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
