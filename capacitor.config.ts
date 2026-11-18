import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.guzhengbuddy.app',
  appName: 'GuzhengBuddy',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
