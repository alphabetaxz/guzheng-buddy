import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = path.resolve(__dirname, '..');

describe('Android Capacitor configuration (Step 5)', () => {
  it('locks orientation to sensorLandscape and declares RECORD_AUDIO permission', () => {
    const manifestPath = path.join(ROOT_DIR, 'android/app/src/main/AndroidManifest.xml');
    const manifest = fs.readFileSync(manifestPath, 'utf8');

    expect(manifest).toContain('android:screenOrientation="sensorLandscape"');
    expect(manifest).toContain('android.permission.RECORD_AUDIO');
    expect(manifest).toContain('android.permission.MODIFY_AUDIO_SETTINGS');
  });

  it('configures arm64-v8a ABI filtering and R8 code/resource shrinking', () => {
    const gradlePath = path.join(ROOT_DIR, 'android/app/build.gradle');
    const gradle = fs.readFileSync(gradlePath, 'utf8');

    expect(gradle).toContain('abiFilters "arm64-v8a"');
    expect(gradle).toContain('minifyEnabled true');
    expect(gradle).toContain('shrinkResources true');
  });

  it('keeps MainActivity awake during practice sessions', () => {
    const activityPath = path.join(
      ROOT_DIR,
      'android/app/src/main/java/com/guzhengbuddy/app/MainActivity.java',
    );
    const activity = fs.readFileSync(activityPath, 'utf8');

    expect(activity).toContain('FLAG_KEEP_SCREEN_ON');
  });
});
