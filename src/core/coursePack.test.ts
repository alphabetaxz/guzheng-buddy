import { describe, expect, it } from 'vitest';
import { BUILTIN_DEMO_COURSE_PACK, CoursePackSchema, parseCoursePack } from './coursePack';

describe('coursePack', () => {
  it('validates the built-in demo course pack from mvp-plan.md', () => {
    const parsed = parseCoursePack(BUILTIN_DEMO_COURSE_PACK);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.id).toBe('lesson-twinkle-01');
      expect(parsed.data.tuning).toBe('D');
      expect(parsed.data.segments).toHaveLength(2);
      expect(parsed.data.segments[0]?.steps).toHaveLength(4);
    }
  });

  it('parses a valid JSON string course pack', () => {
    const json = JSON.stringify(BUILTIN_DEMO_COURSE_PACK);
    const parsed = parseCoursePack(json);
    expect(parsed.success).toBe(true);
  });

  it('rejects malformed JSON strings cleanly', () => {
    const parsed = parseCoursePack('{ bad json');
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects invalid segment time ranges (videoEndSec <= videoStartSec)', () => {
    const invalid = {
      ...BUILTIN_DEMO_COURSE_PACK,
      segments: [
        {
          ...BUILTIN_DEMO_COURSE_PACK.segments[0]!,
          videoStartSec: 8,
          videoEndSec: 5,
        },
      ],
    };
    const res = CoursePackSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it('rejects out-of-range stringNum or mismatched jianpu for D tuning', () => {
    const badStringNum = {
      ...BUILTIN_DEMO_COURSE_PACK,
      segments: [
        {
          ...BUILTIN_DEMO_COURSE_PACK.segments[0]!,
          steps: [{ stringNum: 25, jianpu: '1', finger: 'tuo', label: 'bad' }],
        },
      ],
    };
    expect(parseCoursePack(badStringNum).success).toBe(false);

    // String 8 in D tuning is '5' (Sol), not '1' (Do)
    const mismatchedJianpu = {
      ...BUILTIN_DEMO_COURSE_PACK,
      segments: [
        {
          ...BUILTIN_DEMO_COURSE_PACK.segments[0]!,
          steps: [{ stringNum: 8, jianpu: '1', finger: 'tuo', label: 'wrong jianpu' }],
        },
      ],
    };
    expect(parseCoursePack(mismatchedJianpu).success).toBe(false);
  });

  it('rejects duplicate segment IDs and empty segments/steps', () => {
    const duplicateIds = {
      ...BUILTIN_DEMO_COURSE_PACK,
      segments: [
        BUILTIN_DEMO_COURSE_PACK.segments[0]!,
        { ...BUILTIN_DEMO_COURSE_PACK.segments[1]!, id: 'seg-1' },
      ],
    };
    expect(parseCoursePack(duplicateIds).success).toBe(false);

    const emptySegments = {
      ...BUILTIN_DEMO_COURSE_PACK,
      segments: [],
    };
    expect(parseCoursePack(emptySegments).success).toBe(false);
  });
});
