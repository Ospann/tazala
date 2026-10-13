import fs from 'node:fs';
import path from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';
import { withDangerousMod, type ConfigPlugin } from 'expo/config-plugins';

const APP_ID = process.env.TAZALA_APP_ID ?? 'app.tazala';
const VERSION = '1.0.0';

const RELEASE_MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
  xmlns:tools="http://schemas.android.com/tools">
  <uses-permission android:name="android.permission.INTERNET" tools:node="remove" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" tools:node="remove" />
  <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" tools:node="remove" />
</manifest>
`;

const withOfflineRelease: ConfigPlugin = (expoConfig) =>
  withDangerousMod(expoConfig, [
    'android',
    (modConfig) => {
      const directory = path.join(modConfig.modRequest.platformProjectRoot, 'app/src/release');
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'AndroidManifest.xml'), RELEASE_MANIFEST);
      return modConfig;
    },
  ]);

export default ({ config }: ConfigContext): ExpoConfig =>
  withOfflineRelease({
    ...config,
    name: 'Tazala',
    slug: 'tazala',
    owner: 'arystandev',
    version: VERSION,
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'tazala',
    userInterfaceStyle: 'automatic',
    locales: {
      en: './src/i18n/native/en.json',
      ru: './src/i18n/native/ru.json',
      kk: './src/i18n/native/kk.json',
    },
    ios: {
      bundleIdentifier: APP_ID,
      supportsTablet: false,
      infoPlist: {
        NSPhotoLibraryUsageDescription:
          'Tazala analyzes your photos and videos on this device to find duplicates, similar shots and large files. Nothing is uploaded.',
        PHPhotoLibraryPreventAutomaticLimitedAccessAlert: true,
        ITSAppUsesNonExemptEncryption: false,
        CFBundleAllowMixedLocalizations: true,
      },
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyCollectedDataTypes: [],
        NSPrivacyAccessedAPITypes: [],
      },
    },
    android: {
      package: APP_ID,
      adaptiveIcon: {
        backgroundColor: '#E6F7F3',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      blockedPermissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.ACCESS_MEDIA_LOCATION',
      ],
    },
    plugins: [
      'expo-router',
      'expo-sqlite',
      [
        'expo-font',
        {
          fonts: [
            './node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf',
          ],
        },
      ],
      [
        'expo-localization',
        { supportedLocales: { ios: ['en', 'ru', 'kk'], android: ['en', 'ru', 'kk'] } },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#E6F7F3',
          image: './assets/images/splash-icon.png',
          imageWidth: 120,
          dark: { backgroundColor: '#0A1614' },
        },
      ],
      [
        'expo-build-properties',
        {
          ios: { deploymentTarget: '16.4' },
          android: { minSdkVersion: 26 },
        },
      ],
    ],
    extra: {
      eas: {
        projectId: 'b921f983-23ea-47fb-bd6b-0ac4264880fe',
      },
    },
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  });
