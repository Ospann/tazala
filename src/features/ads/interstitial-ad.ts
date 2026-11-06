import { Platform } from 'react-native';
import mobileAds, {
  AdEventType,
  InterstitialAd,
  MaxAdContentRating,
  TestIds,
} from 'react-native-google-mobile-ads';

const PRODUCTION_UNIT_ID: string | undefined =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS
    : process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID;

const UNIT_ID: string = __DEV__ || !PRODUCTION_UNIT_ID ? TestIds.INTERSTITIAL : PRODUCTION_UNIT_ID;
const SHOW_TIMEOUT_MS = 4000;

let initialization: Promise<void> | null = null;
let ad: InterstitialAd | null = null;
let loaded = false;
let loading = false;

export function initAds(): Promise<void> {
  initialization ??= mobileAds()
    .setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.PG })
    .then(() => mobileAds().initialize())
    .then(() => undefined)
    .catch((error: unknown) => {
      initialization = null;
      if (__DEV__) console.warn(error);
    });
  return initialization;
}

export function preloadInterstitial(): void {
  if (loaded || loading) return;
  loading = true;
  void initAds().then(() => {
    const next = InterstitialAd.createForAdRequest(UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });
    next.addAdEventListener(AdEventType.LOADED, () => {
      loaded = true;
      loading = false;
    });
    next.addAdEventListener(AdEventType.ERROR, (error) => {
      loading = false;
      if (ad === next) ad = null;
      next.removeAllListeners();
      if (__DEV__) console.warn(error);
    });
    ad = next;
    next.load();
  });
}

export function showInterstitial(): Promise<void> {
  const current = ad;
  if (!current || !loaded) {
    preloadInterstitial();
    return Promise.resolve();
  }
  ad = null;
  loaded = false;
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(openTimeout);
      current.removeAllListeners();
      preloadInterstitial();
      resolve();
    };
    const openTimeout = setTimeout(finish, SHOW_TIMEOUT_MS);
    current.addAdEventListener(AdEventType.OPENED, () => clearTimeout(openTimeout));
    current.addAdEventListener(AdEventType.CLOSED, finish);
    current.addAdEventListener(AdEventType.ERROR, finish);
    current.show().catch(finish);
  });
}
