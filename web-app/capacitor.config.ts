import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kunjalpurohit.sammyspalate',
  appName: "Sammys Palate",
  webDir: 'public', // placeholder, required even though we're using server mode
  server: {
    url: 'https://ucsc-dining-tracker.vercel.app/',
    cleartext: false
  }
};

export default config;
