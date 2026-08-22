(() => {
  'use strict';

  const capacitor = window.Capacitor;
  const native = Boolean(capacitor?.isNativePlatform?.());
  const platform = capacitor?.getPlatform?.() || 'web';

  document.documentElement.dataset.lenampPlatform = platform;

  window.LENAMP_PLATFORM = Object.freeze({
    platform,
    isNative: native,
    isAndroid: native && platform === 'android',
    isWeb: !native || platform === 'web',
  });
})();
