import { useEffect, useRef, useState } from 'preact/hooks';
import type { GuzhengSynth } from '../audio/guzhengSynth';
import type { DualChannelPitchInput, MicInputStatus } from '../audio/pitchInput';
import type { LessonCoursePack } from '../core/coursePack';
import { parseCoursePack } from '../core/coursePack';
import {
  FINGERING_META,
  GUZHENG_21_STRINGS,
  type FingeringType,
} from '../core/guzhengTuning';
import {
  buildCoursePackFromMarkers,
  exportCoursePackJson,
  type MarkerStepDraft,
} from '../core/markerBuilder';
import { TunerSmoother, type SmoothedTunerReading } from '../core/tunerSmoother';

type ParentTab = 'tuner' | 'packs' | 'marker';

export interface ParentToolboxScreenProps {
  synth: GuzhengSynth;
  pitchInput: DualChannelPitchInput;
  allPacks: LessonCoursePack[];
  activePackId: string;
  onSelectPack: (packId: string) => void;
  onSavePack: (pack: LessonCoursePack, videoBlobUrl?: string) => void;
  onDeletePack: (packId: string) => void;
  onGoPractice: () => void;
  onBack: () => void;
}

export function ParentToolboxScreen({
  synth,
  pitchInput,
  allPacks,
  activePackId,
  onSelectPack,
  onSavePack,
  onDeletePack,
  onGoPractice,
  onBack,
}: ParentToolboxScreenProps) {
  const [tab, setTab] = useState<ParentTab>('tuner');

  // ==================== 1. 21-String Precision Tuner State ====================
  const smootherRef = useRef(new TunerSmoother());
  const [lockedStringNum, setLockedStringNum] = useState<number | null>(null);
  const [reading, setReading] = useState<SmoothedTunerReading | null>(null);
  const [micStatus, setMicStatus] = useState<MicInputStatus>(() => pitchInput.getStatus());

  // ==================== 2. Course Pack Importer State ====================
  const [jsonInput, setJsonInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const jsonFileRef = useRef<HTMLInputElement | null>(null);

  // ==================== 3. 60s Marker Tool State ====================
  const markerVideoRef = useRef<HTMLVideoElement | null>(null);
  const markerFileRef = useRef<HTMLInputElement | null>(null);
  const [markerVideoUrl, setMarkerVideoUrl] = useState('');
  const [markerTitle, setMarkerTitle] = useState('自定义跟练小曲');
  const [markerVoice, setMarkerVoice] = useState('先看老师示范一遍，再轮到宝贝哦！');
  const [segStartSec, setSegStartSec] = useState(0);
  const [segEndSec, setSegEndSec] = useState(6);
  const [markerFinger, setMarkerFinger] = useState<FingeringType>('tuo');
  const [markerSteps, setMarkerSteps] = useState<MarkerStepDraft[]>([]);
  const [exportedJson, setExportedJson] = useState<string | null>(null);
  const [markerError, setMarkerError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = pitchInput.subscribe((frame) => {
      const next = smootherRef.current.processFrame(frame);
      if (next) {
        setReading(next);
      }
    });
    return () => {
      unsub();
      void pitchInput.stopMicrophone();
    };
  }, []);

  const toggleTunerMic = async () => {
    void synth.unlock();
    if (micStatus === 'listening') {
      await pitchInput.stopMicrophone();
      setMicStatus(pitchInput.getStatus());
      return;
    }
    try {
      await pitchInput.startMicrophone();
      setMicStatus(pitchInput.getStatus());
    } catch {
      setMicStatus('error');
    }
  };

  const handleSelectTunerString = (num: number) => {
    void synth.unlock();
    synth.playString(num, 1.1);
    const nextLock = lockedStringNum === num ? null : num;
    smootherRef.current.setLockedString(nextLock);
    setLockedStringNum(nextLock);
    setReading(null);
  };

  const handleImportJsonText = (raw: string) => {
    setImportError(null);
    setImportSuccess(null);
    const parsed = parseCoursePack(raw);
    if (!parsed.success) {
      setImportError(parsed.errors.join('；'));
      return;
    }
    onSavePack(parsed.data);
    setImportSuccess(`已导入课程《${parsed.data.title}》并设为当前带练曲目`);
    setJsonInput('');
  };

  const handleLoadJsonFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    handleImportJsonText(text);
  };

  const handleFetchUrl = async () => {
    setImportError(null);
    setImportSuccess(null);
    if (!urlInput.trim()) return;
    try {
      const resp = await fetch(urlInput.trim());
      if (!resp.ok) {
        setImportError(`请求失败：HTTP ${resp.status}`);
        return;
      }
      const text = await resp.text();
      handleImportJsonText(text);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '加载 URL 失败');
    }
  };

  const handlePickMarkerVideo = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    setMarkerVideoUrl(blobUrl);
  };

  const handleMarkVideoTime = (which: 'start' | 'end') => {
    const v = markerVideoRef.current;
    if (!v) return;
    const t = Number(v.currentTime.toFixed(2));
    if (which === 'start') {
      setSegStartSec(t);
    } else {
      setSegEndSec(Math.max(t, segStartSec + 0.5));
    }
  };

  const handleAddMarkerStep = (stringNum: number) => {
    void synth.unlock();
    synth.playString(stringNum, 0.7);
    setMarkerSteps((prev) => [...prev, { stringNum, finger: markerFinger }]);
  };

  const handleBuildMarkerPack = (launchImmediately: boolean) => {
    setMarkerError(null);
    const res = buildCoursePackFromMarkers({
      title: markerTitle || '自定义课程',
      videoUrl: markerVideoUrl || './custom-lesson.mp4',
      segments: [
        {
          videoStartSec: segStartSec,
          videoEndSec: segEndSec,
          promptVoiceText: markerVoice || '跟着老师弹一弹吧！',
          steps: markerSteps,
        },
      ],
    });

    if (!res.success) {
      setMarkerError(res.errors.join('；'));
      return;
    }

    onSavePack(res.data, markerVideoUrl || undefined);
    setExportedJson(exportCoursePackJson(res.data));
    if (launchImmediately) {
      onGoPractice();
    }
  };

  const statusBadge =
    reading?.status === 'in_tune'
      ? { text: '音准完美 🟢', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400' }
      : reading?.status === 'flat'
        ? { text: '偏低 · 拧紧弦轴 ↑', cls: 'bg-amber-500/20 text-amber-300 border-amber-400' }
        : reading?.status === 'sharp'
          ? { text: '偏高 · 放松弦轴 ↓', cls: 'bg-rose-500/20 text-rose-300 border-rose-400' }
          : { text: '拨响任意琴弦开始测音', cls: 'bg-stone-700/60 text-stone-300 border-stone-600' };

  return (
    <div class="w-full h-full flex flex-col justify-between p-3 bg-stone-900 text-stone-100 overflow-hidden">
      {/* Top Bar & Tabs */}
      <div class="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            void pitchInput.stopMicrophone();
            onBack();
          }}
          aria-label="返回首页"
          class="w-10 h-10 rounded-full bg-stone-800 border border-stone-600 flex items-center justify-center text-lg active:scale-90 transition"
        >
          🏠
        </button>

        <div class="flex items-center gap-1.5 bg-stone-800 p-1 rounded-full border border-stone-700">
          <button
            type="button"
            onClick={() => setTab('tuner')}
            class={[
              'px-3.5 py-1 rounded-full text-xs font-black transition',
              tab === 'tuner' ? 'bg-emerald-500 text-stone-950' : 'text-stone-300',
            ].join(' ')}
          >
            🎛️ 21弦调音器
          </button>
          <button
            type="button"
            onClick={() => setTab('packs')}
            class={[
              'px-3.5 py-1 rounded-full text-xs font-black transition',
              tab === 'packs' ? 'bg-amber-400 text-stone-950' : 'text-stone-300',
            ].join(' ')}
          >
            📦 课程包导入
          </button>
          <button
            type="button"
            onClick={() => setTab('marker')}
            class={[
              'px-3.5 py-1 rounded-full text-xs font-black transition',
              tab === 'marker' ? 'bg-purple-400 text-stone-950' : 'text-stone-300',
            ].join(' ')}
          >
            ⏱️ 60秒打点器
          </button>
        </div>

        <button
          type="button"
          onClick={onGoPractice}
          class="px-3 py-1.5 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black transition"
        >
          🎬 去带练
        </button>
      </div>

      {/* TAB 1: 21-String Precision Tuner */}
      {tab === 'tuner' && (
        <div class="flex-1 flex flex-col justify-between py-2 min-h-0">
          <div class="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void toggleTunerMic()}
              class={[
                'px-4 py-1.5 rounded-full text-xs font-black border transition',
                micStatus === 'listening'
                  ? 'bg-emerald-500 text-stone-950 border-emerald-300 animate-pulse'
                  : 'bg-stone-800 text-stone-200 border-stone-600 hover:bg-stone-700',
              ].join(' ')}
            >
              {micStatus === 'listening' ? '🎙️ 正在监听古筝（点击停止）' : '🎤 开启实时调音'}
            </button>

            {lockedStringNum !== null && (
              <button
                type="button"
                onClick={() => {
                  smootherRef.current.setLockedString(null);
                  setLockedStringNum(null);
                }}
                class="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/50"
              >
                🔒 锁定第 {lockedStringNum} 弦（点击恢复自动识别）
              </button>
            )}
          </div>

          {/* Center Precision Gauge */}
          <div class="my-auto max-w-lg w-full mx-auto bg-stone-800/90 rounded-3xl p-4 border border-stone-700 text-center shadow-xl">
            <div class="flex items-center justify-between text-xs text-stone-400 mb-1">
              <span>-50 cents</span>
              <span class={`px-2.5 py-0.5 rounded-full border font-bold ${statusBadge.cls}`}>
                {statusBadge.text}
              </span>
              <span>+50 cents</span>
            </div>

            <div class="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
              {reading
                ? `${reading.string.num} 弦 ${reading.string.animalEmoji} (${reading.string.noteName} · ${reading.string.frequency.toFixed(1)}Hz)`
                : lockedStringNum
                  ? `${lockedStringNum} 弦（等待拨弦测音）`
                  : '等待拨响古筝琴弦…'}
            </div>

            <div class="text-sm font-bold text-stone-300 mt-1">
              {reading
                ? `${reading.cents >= 0 ? '+' : ''}${reading.cents.toFixed(1)} cents`
                : '±8 cents 内亮绿灯 · 点击下方弦号可试听基准音'}
            </div>

            {/* Needle Track */}
            <div class="mt-3 h-5 rounded-full bg-stone-950 relative overflow-hidden border border-stone-600">
              {/* ±8 cents green tolerance band (42%..58%) */}
              <div class="absolute inset-y-0 left-[42%] w-[16%] bg-emerald-500/30 border-x border-emerald-400/40" />
              <div class="absolute inset-y-0 left-1/2 w-0.5 bg-white/40 -translate-x-1/2" />
              <div
                style={{ left: `${reading ? reading.needlePercent : 50}%` }}
                class={[
                  'absolute inset-y-0.5 w-3.5 -translate-x-1/2 rounded-full transition-all duration-100',
                  reading?.status === 'in_tune'
                    ? 'bg-emerald-400 shadow-[0_0_12px_#34d399]'
                    : reading
                      ? 'bg-amber-400 shadow-[0_0_10px_#fbbf24]'
                      : 'bg-stone-500',
                ].join(' ')}
              />
            </div>
          </div>

          {/* Bottom 21-String Reference & Lock Bar */}
          <div class="flex items-center justify-between gap-1 bg-stone-800 p-1.5 rounded-2xl border border-stone-700 text-xs">
            {[...GUZHENG_21_STRINGS].reverse().map((s) => {
              const isSelected = lockedStringNum === s.num || reading?.string.num === s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => handleSelectTunerString(s.num)}
                  class={[
                    'flex-1 py-1.5 rounded-lg font-bold text-center transition',
                    isSelected
                      ? 'bg-amber-400 text-stone-950 ring-2 ring-white'
                      : s.isGreen
                        ? 'bg-emerald-600 text-white border border-emerald-300'
                        : 'bg-stone-700 hover:bg-stone-600 text-stone-200',
                  ].join(' ')}
                >
                  {s.num}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Course Pack Manager */}
      {tab === 'packs' && (
        <div class="flex-1 grid grid-cols-12 gap-3 py-2 min-h-0">
          {/* Left: Installed Packs */}
          <div class="col-span-5 bg-stone-800/80 rounded-2xl p-3 border border-stone-700 flex flex-col gap-2 overflow-y-auto">
            <div class="text-xs font-black text-stone-300">已加载课程包（点击切换）</div>
            {allPacks.map((pack) => {
              const active = pack.id === activePackId;
              return (
                <div
                  key={pack.id}
                  class={[
                    'p-2.5 rounded-xl border flex items-center justify-between gap-2',
                    active
                      ? 'bg-emerald-500/15 border-emerald-400'
                      : 'bg-stone-900/60 border-stone-700',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => onSelectPack(pack.id)}
                    class="flex-1 text-left"
                  >
                    <div class="text-xs font-black text-white">{pack.title}</div>
                    <div class="text-[11px] text-stone-400">
                      {pack.segments.length} 个分句 · {pack.id}
                    </div>
                  </button>
                  {pack.id !== 'lesson-twinkle-01' && (
                    <button
                      type="button"
                      onClick={() => onDeletePack(pack.id)}
                      class="px-2 py-1 rounded bg-rose-500/20 text-rose-300 text-xs"
                    >
                      删除
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Import JSON / URL */}
          <div class="col-span-7 bg-stone-800/80 rounded-2xl p-3 border border-stone-700 flex flex-col gap-2 overflow-y-auto">
            <div class="flex items-center gap-2">
              <input
                ref={jsonFileRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => void handleLoadJsonFile(e)}
                class="hidden"
              />
              <button
                type="button"
                onClick={() => jsonFileRef.current?.click()}
                class="px-3 py-1.5 rounded-lg bg-amber-400 text-stone-950 text-xs font-black"
              >
                📂 选择 lesson.json
              </button>

              <input
                type="url"
                value={urlInput}
                onInput={(e) => setUrlInput((e.currentTarget as HTMLInputElement).value)}
                placeholder="或输入局域网/云端 JSON URL"
                class="flex-1 px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs text-white"
              />
              <button
                type="button"
                onClick={() => void handleFetchUrl()}
                class="px-3 py-1.5 rounded-lg bg-stone-700 text-xs font-bold"
              >
                拉取
              </button>
            </div>

            <textarea
              value={jsonInput}
              onInput={(e) => setJsonInput((e.currentTarget as HTMLTextAreaElement).value)}
              placeholder='粘贴 lesson.json 内容进行 Zod 校验并导入...'
              class="flex-1 min-h-[110px] p-2 rounded-xl bg-stone-950 border border-stone-700 text-xs font-mono text-stone-200"
            />

            <div class="flex items-center justify-between gap-2">
              <div class="text-xs">
                {importError && <span class="text-rose-400">{importError}</span>}
                {importSuccess && <span class="text-emerald-400">{importSuccess}</span>}
              </div>
              <button
                type="button"
                onClick={() => handleImportJsonText(jsonInput)}
                class="px-4 py-1.5 rounded-lg bg-emerald-500 text-stone-950 text-xs font-black"
              >
                校验并导入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 60-Second Course Pack Marker Tool */}
      {tab === 'marker' && (
        <div class="flex-1 grid grid-cols-12 gap-3 py-2 min-h-0">
          {/* Left: Video Preview + A/B Time Markers */}
          <div class="col-span-5 bg-stone-800/80 rounded-2xl p-2.5 border border-stone-700 flex flex-col gap-2">
            <div class="flex items-center gap-1.5">
              <input
                ref={markerFileRef}
                type="file"
                accept="video/*"
                onChange={handlePickMarkerVideo}
                class="hidden"
              />
              <button
                type="button"
                onClick={() => markerFileRef.current?.click()}
                class="px-2.5 py-1 rounded-lg bg-purple-400 text-stone-950 text-xs font-black"
              >
                🎬 选老师视频
              </button>
              <input
                type="text"
                value={markerTitle}
                onInput={(e) => setMarkerTitle((e.currentTarget as HTMLInputElement).value)}
                placeholder="课程名称"
                class="flex-1 px-2 py-1 rounded-lg bg-stone-950 border border-stone-700 text-xs"
              />
            </div>

            <div class="flex-1 rounded-xl bg-stone-950 border border-stone-700 overflow-hidden flex items-center justify-center min-h-[110px]">
              {markerVideoUrl ? (
                <video
                  ref={markerVideoRef}
                  src={markerVideoUrl}
                  controls
                  class="w-full h-full object-contain"
                />
              ) : (
                <span class="text-xs text-stone-500">选择老师 MP4 后边播边打点，也可直接点右弦生成</span>
              )}
            </div>

            <div class="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => handleMarkVideoTime('start')}
                class="py-1 rounded-lg bg-stone-700 hover:bg-stone-600 font-bold"
              >
                📍 起点 A ({segStartSec}s)
              </button>
              <button
                type="button"
                onClick={() => handleMarkVideoTime('end')}
                class="py-1 rounded-lg bg-stone-700 hover:bg-stone-600 font-bold"
              >
                🏁 终点 B ({segEndSec}s)
              </button>
            </div>
          </div>

          {/* Right: Fingering Picker + 21-String Quick Tapper + Export */}
          <div class="col-span-7 bg-stone-800/80 rounded-2xl p-2.5 border border-stone-700 flex flex-col justify-between gap-2 overflow-y-auto">
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1 bg-stone-900 p-1 rounded-xl border border-stone-700">
                {(['tuo', 'mo', 'gou'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setMarkerFinger(f)}
                    class={[
                      'px-2.5 py-1 rounded-lg text-xs font-black',
                      markerFinger === f ? 'bg-amber-400 text-stone-950' : 'text-stone-300',
                    ].join(' ')}
                  >
                    {FINGERING_META[f].emoji} {FINGERING_META[f].label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={markerVoice}
                onInput={(e) => setMarkerVoice((e.currentTarget as HTMLInputElement).value)}
                placeholder="语音引导提示"
                class="flex-1 px-2 py-1 rounded-lg bg-stone-950 border border-stone-700 text-xs"
              />
            </div>

            {/* 21 Strings Grid */}
            <div class="grid grid-cols-7 gap-1">
              {GUZHENG_21_STRINGS.map((s) => (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => handleAddMarkerStep(s.num)}
                  class={[
                    'py-1 rounded-lg text-xs font-black transition active:scale-95',
                    s.isGreen
                      ? 'bg-emerald-600 text-white border border-emerald-300'
                      : 'bg-stone-700 hover:bg-stone-600 text-stone-100',
                  ].join(' ')}
                >
                  {s.num} {s.animalEmoji}
                </button>
              ))}
            </div>

            {/* Recorded Steps Chips */}
            <div class="flex flex-wrap items-center gap-1 min-h-[28px] bg-stone-950/70 p-1.5 rounded-xl border border-stone-700">
              {markerSteps.length === 0 && (
                <span class="text-[11px] text-stone-500">点击上方弦号即可按顺序打点（点击已打点标签可删除）</span>
              )}
              {markerSteps.map((st, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setMarkerSteps((prev) => prev.filter((_, i) => i !== idx))}
                  class="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-200 text-xs font-bold"
                >
                  {FINGERING_META[st.finger].label}{st.stringNum}弦 ×
                </button>
              ))}
            </div>

            <div class="flex items-center justify-between gap-2">
              <div class="text-xs text-rose-400 truncate">
                {markerError ?? (exportedJson ? '✅ 已生成 JSON 并保存到课程库' : '')}
              </div>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleBuildMarkerPack(false)}
                  class="px-3 py-1.5 rounded-lg bg-stone-700 text-xs font-black"
                >
                  💾 仅保存/生成JSON
                </button>
                <button
                  type="button"
                  onClick={() => handleBuildMarkerPack(true)}
                  class="px-3 py-1.5 rounded-lg bg-emerald-500 text-stone-950 text-xs font-black"
                >
                  🎬 保存并立即带练
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
