(() => {
  'use strict';

  const root = document.documentElement;

  // No Android o WebView pode mudar a área útil ao girar a tela, ocultar barras
  // do sistema ou voltar do background. Mantemos o CSS sincronizado com a área
  // visual real; o layout em si é responsivo e não depende de transform: scale().
  const syncViewport = () => {
    const visual = window.visualViewport;
    const width = Math.max(1, visual?.width || window.innerWidth || root.clientWidth);
    const height = Math.max(1, visual?.height || window.innerHeight || root.clientHeight);

    root.style.setProperty('--lenamp-vw', `${Math.round(width)}px`);
    root.style.setProperty('--lenamp-vh', `${Math.round(height)}px`);
    root.dataset.orientation = width >= height ? 'landscape' : 'portrait';
  };

  let frame = 0;
  const scheduleSync = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(syncViewport);
  };

  window.addEventListener('resize', scheduleSync, { passive: true });
  window.addEventListener('orientationchange', scheduleSync, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleSync, { passive: true });
  window.visualViewport?.addEventListener('scroll', scheduleSync, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleSync();
  });

  syncViewport();
  document.addEventListener('DOMContentLoaded', scheduleSync, { once: true });
  window.addEventListener('load', scheduleSync, { once: true });
})();
