import { describe, expect, it } from 'vitest';
import { parseCoursePack } from './coursePack';
import { buildCoursePackFromMarkers, exportCoursePackJson } from './markerBuilder';

describe('markerBuilder', () => {
  it('builds a valid CoursePack from marked segments and auto-fills jianpu & labels', () => {
    const result = buildCoursePackFromMarkers({
      id: 'lesson-custom-01',
      title: '沧海一声笑（片段）',
      videoUrl: 'blob:demo-video',
      segments: [
        {
          videoStartSec: 0,
          videoEndSec: 5.2,
          promptVoiceText: '先听老师弹一遍第一句哦！',
          steps: [
            { stringNum: 7, finger: 'tuo' },
            { stringNum: 8, finger: 'mo' },
            { stringNum: 9, finger: 'gou' },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.segments[0]?.id).toBe('seg-1');
      expect(result.data.segments[0]?.steps).toEqual([
        { stringNum: 7, jianpu: '6', finger: 'tuo', label: '托 7弦' },
        { stringNum: 8, jianpu: '5', finger: 'mo', label: '抹 8弦(绿)' },
        { stringNum: 9, jianpu: '3', finger: 'gou', label: '勾 9弦' },
      ]);

      const json = exportCoursePackJson(result.data);
      expect(parseCoursePack(json).success).toBe(true);
    }
  });

  it('rejects invalid marker drafts (e.g. empty steps or invalid time range)', () => {
    const bad = buildCoursePackFromMarkers({
      title: '空片段',
      videoUrl: './video.mp4',
      segments: [
        {
          videoStartSec: 5,
          videoEndSec: 3,
          promptVoiceText: '错误时间',
          steps: [{ stringNum: 8, finger: 'tuo' }],
        },
      ],
    });
    expect(bad.success).toBe(false);
  });
});
