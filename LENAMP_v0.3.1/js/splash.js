(() => {
  'use strict';

  const splash = document.querySelector('#splashScreen');
  if (!splash) return;

  const config = window.LENAMP_CONFIG || {};
  const totalDuration = Number(config.splashTotalDurationMs) || 5000;
  const exitDuration = Number(config.splashExitDurationMs) || 380;
  const holdDuration = Math.max(0, totalDuration - exitDuration);

  const closeSplash = () => {
    if (splash.classList.contains('is-hidden')) return;
    splash.classList.add('is-hidden');
    window.setTimeout(() => splash.setAttribute('hidden', ''), exitDuration);
  };

  window.addEventListener('load', () => {
    window.setTimeout(closeSplash, holdDuration);
  }, { once: true });

  splash.addEventListener('click', closeSplash);
})();
