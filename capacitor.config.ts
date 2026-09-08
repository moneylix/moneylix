import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'in.moneylix.app',
  appName: 'Moneylix',
  webDir: 'out',
  server: {
    // Points to the live website — always up to date
    url: 'https://moneylix.in',
    cleartext: false,
  },
  android: {
    backgroundColor: '#0a0f1a',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0f1a',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
}

export default config
