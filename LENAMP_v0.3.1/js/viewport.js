(() => {
  'use strict';

  const shell = document.querySelector('.lenamp-shell');
  const dialogScreens = [...document.querySelectorAll('.lenamp-dialog-screen')];
  const EDGE_GAP = 8;

  const availableSize = () => ({
    width: Math.max(1, window.innerWidth - EDGE_GAP * 2),
    height: Math.max(1, window.innerHeight - EDGE_GAP * 2),
  });

  const fitShell = () => {
    if (!shell) return;

    // Mede o layout em escala natural para evitar rolagem externa.
    shell.style.setProperty('--app-scale', '1');
    const { width, height } = shell.getBoundingClientRect();
    const available = availableSize();
    const scale = Math.min(1, available.width / width, available.height / height);

    shell.style.setProperty('--app-scale', scale.toFixed(4));
  };

  const fitDialog = (screen) => {
    const card = screen?.querySelector('.lenamp-dialog-card');
    if (!card || screen.hidden) return;

    card.style.setProperty('--dialog-scale', '1');
    const { width, height } = card.getBoundingClientRect();
    const available = availableSize();
    const scale = Math.min(1, available.width / width, available.height / height);

    card.style.setProperty('--dialog-scale', scale.toFixed(4));
  };

  const fitAll = () => {
    fitShell();
    dialogScreens.forEach(fitDialog);
  };

  let frame = 0;
  const scheduleFit = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fitAll);
  };

  const observer = new MutationObserver(scheduleFit);
  dialogScreens.forEach((screen) => observer.observe(screen, {
    attributes: true,
    attributeFilter: ['hidden', 'class'],
  }));

  if ('ResizeObserver' in window && shell) {
    const resizeObserver = new ResizeObserver(scheduleFit);
    resizeObserver.observe(shell);
  }

  window.addEventListener('resize', scheduleFit, { passive: true });
  window.addEventListener('orientationchange', scheduleFit, { passive: true });
  window.addEventListener('load', scheduleFit, { once: true });
  document.addEventListener('DOMContentLoaded', scheduleFit, { once: true });
})();
