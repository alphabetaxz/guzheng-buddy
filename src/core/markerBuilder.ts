import {
  parseCoursePack,
  type LessonCoursePack,
  type ParseCoursePackResult,
} from './coursePack';
import { FINGERING_META, getGuzhengString, type FingeringType } from './guzhengTuning';

export interface MarkerStepDraft {
  stringNum: number;
  finger: FingeringType;
}

export interface MarkerSegmentDraft {
  id?: string;
  videoStartSec: number;
  videoEndSec: number;
  promptVoiceText: string;
  steps: readonly MarkerStepDraft[];
}

export interface MarkerCourseDraft {
  id?: string;
  title: string;
  videoUrl: string;
  segments: readonly MarkerSegmentDraft[];
}

export function buildCoursePackFromMarkers(draft: MarkerCourseDraft): ParseCoursePackResult {
  const courseId =
    draft.id?.trim() || `lesson-custom-${Date.now().toString(36)}`;

  const normalized = {
    id: courseId,
    title: draft.title.trim(),
    tuning: 'D' as const,
    videoUrl: draft.videoUrl.trim(),
    segments: draft.segments.map((seg, segIdx) => ({
      id: seg.id?.trim() || `seg-${segIdx + 1}`,
      videoStartSec: Number(seg.videoStartSec.toFixed(2)),
      videoEndSec: Number(seg.videoEndSec.toFixed(2)),
      promptVoiceText: seg.promptVoiceText.trim(),
      steps: seg.steps.map((step) => {
        const str = getGuzhengString(step.stringNum);
        const fingerMeta = FINGERING_META[step.finger];
        const greenSuffix = str?.isGreen ? '(绿)' : '';
        return {
          stringNum: step.stringNum,
          jianpu: str?.jianpu ?? '1',
          finger: step.finger,
          label: `${fingerMeta.label} ${step.stringNum}弦${greenSuffix}`,
        };
      }),
    })),
  };

  return parseCoursePack(normalized);
}

export function exportCoursePackJson(pack: LessonCoursePack): string {
  return JSON.stringify(pack, null, 2);
}
