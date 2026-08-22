(() => {
  'use strict';

  const getCapacitor = () => window.Capacitor || null;

  const getBridgePlatform = () => {
    const capacitor = getCapacitor();
    try {
      return capacitor?.getPlatform?.() || 'web';
    } catch {
      return 'web';
    }
  };

  const hasNativeBridge = () => {
    const capacitor = getCapacitor();
    try {
      return Boolean(capacitor?.isNativePlatform?.());
    } catch {
      return false;
    }
  };

  // Fallback defensivo para Android WebView/Capacitor. Ele existe para impedir
  // que uma leitura precoce do bridge faça o app nativo se identificar como web.
  // Chrome/PWA normal não usa o marcador "wv" e continua sendo tratado como web.
  const isAndroidNativeWebView = () => {
    const userAgent = navigator.userAgent || '';
    const isAndroid = /Android/i.test(userAgent);
    const isWebView = /(?:;\s*wv\)|\bwv\b)/i.test(userAgent);
    const isCapacitorHost = ['localhost', '127.0.0.1'].includes(location.hostname);
    return isAndroid && isWebView && isCapacitorHost;
  };

  const snapshot = () => {
    let platform = getBridgePlatform();
    let native = hasNativeBridge();

    if (!native && isAndroidNativeWebView()) {
      native = true;
      platform = 'android';
    }

    return {
      platform,
      native,
      android: native && platform === 'android',
    };
  };

  const syncDataset = () => {
    const state = snapshot();
    document.documentElement.dataset.lenampPlatform = state.platform;
    document.documentElement.dataset.lenampNative = state.native ? 'true' : 'false';
    return state;
  };

  const api = {};
  Object.defineProperties(api, {
    platform: { enumerable: true, get: () => snapshot().platform },
    isNative: { enumerable: true, get: () => snapshot().native },
    isAndroid: { enumerable: true, get: () => snapshot().android },
    isWeb: { enumerable: true, get: () => !snapshot().native },
  });

  api.refresh = () => {
    const state = syncDataset();
    window.dispatchEvent(new CustomEvent('lenamp:platformchange', { detail: state }));
    return state;
  };

  window.LENAMP_PLATFORM = Object.freeze(api);
  api.refresh();

  window.addEventListener('DOMContentLoaded', () => api.refresh(), { once: true });
  window.addEventListener('load', () => api.refresh(), { once: true });
  window.addEventListener('pageshow', () => api.refresh());
})();
