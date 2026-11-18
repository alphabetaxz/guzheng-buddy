import { z } from 'zod';
import { getGuzhengString } from './guzhengTuning';

export const FingeringSchema = z.enum(['tuo', 'mo', 'gou']);
export const JianpuSchema = z.enum(['1', '2', '3', '5', '6']);

export const CourseStepSchema = z
  .object({
    stringNum: z.number().int().min(1).max(21),
    jianpu: JianpuSchema,
    finger: FingeringSchema,
    label: z.string().min(1).optional(),
  })
  .superRefine((step, ctx) => {
    const stringSpec = getGuzhengString(step.stringNum);
    if (!stringSpec) {
      ctx.addIssue({
        code: 'custom',
        path: ['stringNum'],
        message: `String ${step.stringNum} is out of 1..21 range`,
      });
      return;
    }
    if (stringSpec.jianpu !== step.jianpu) {
      ctx.addIssue({
        code: 'custom',
        path: ['jianpu'],
        message: `String ${step.stringNum} in D tuning has jianpu "${stringSpec.jianpu}", got "${step.jianpu}"`,
      });
    }
  });

export const CourseSegmentSchema = z
  .object({
    id: z.string().min(1),
    videoStartSec: z.number().min(0),
    videoEndSec: z.number().positive(),
    promptVoiceText: z.string().min(1),
    steps: z.array(CourseStepSchema).min(1),
  })
  .superRefine((segment, ctx) => {
    if (segment.videoEndSec <= segment.videoStartSec) {
      ctx.addIssue({
        code: 'custom',
        path: ['videoEndSec'],
        message: 'videoEndSec must be greater than videoStartSec',
      });
    }
  });

export const CoursePackSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    tuning: z.literal('D').default('D'),
    videoUrl: z.string().min(1),
    segments: z.array(CourseSegmentSchema).min(1),
  })
  .superRefine((pack, ctx) => {
    const seen = new Set<string>();
    pack.segments.forEach((seg, idx) => {
      if (seen.has(seg.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['segments', idx, 'id'],
          message: `Duplicate segment id "${seg.id}"`,
        });
      }
      seen.add(seg.id);
    });
  });

export type CourseStep = z.infer<typeof CourseStepSchema>;
export type CourseSegment = z.infer<typeof CourseSegmentSchema>;
export type LessonCoursePack = z.infer<typeof CoursePackSchema>;

export type ParseCoursePackResult =
  | { success: true; data: LessonCoursePack }
  | { success: false; errors: string[] };

export function parseCoursePack(input: unknown): ParseCoursePackResult {
  let candidate: unknown = input;
  if (typeof input === 'string') {
    try {
      candidate = JSON.parse(input);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON';
      return { success: false, errors: [`JSON parse error: ${msg}`] };
    }
  }

  const parsed = CoursePackSchema.safeParse(candidate);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  return {
    success: false,
    errors: parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    }),
  };
}

export const BUILTIN_DEMO_COURSE_PACK: LessonCoursePack = {
  id: 'lesson-twinkle-01',
  title: '小星星（第一句）',
  tuning: 'D',
  videoUrl: './twinkle-part1.mp4',
  segments: [
    {
      id: 'seg-1',
      videoStartSec: 0.0,
      videoEndSec: 6.5,
      promptVoiceText: '先看老师弹一遍：一闪一闪亮晶晶，注意大指托和食指抹哦！',
      steps: [
        { stringNum: 11, jianpu: '1', finger: 'tuo', label: '托 11弦' },
        { stringNum: 11, jianpu: '1', finger: 'mo', label: '抹 11弦' },
        { stringNum: 8, jianpu: '5', finger: 'tuo', label: '托 8弦(绿)' },
        { stringNum: 8, jianpu: '5', finger: 'mo', label: '抹 8弦(绿)' },
      ],
    },
    {
      id: 'seg-2',
      videoStartSec: 6.5,
      videoEndSec: 13.0,
      promptVoiceText: '太棒啦！接着看下一句：满天都是小星星！',
      steps: [
        { stringNum: 7, jianpu: '6', finger: 'tuo', label: '托 7弦' },
        { stringNum: 7, jianpu: '6', finger: 'mo', label: '抹 7弦' },
        { stringNum: 8, jianpu: '5', finger: 'gou', label: '勾 8弦(绿)' },
      ],
    },
  ],
};
