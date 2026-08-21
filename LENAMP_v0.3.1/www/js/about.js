(() => {
  'use strict';

  const screen = document.querySelector('#aboutScreen');
  const openButton = document.querySelector('#openAboutBtn');
  const closeButtons = document.querySelectorAll('[data-close-about]');
  const version = document.querySelector('#aboutVersion');

  if (!screen || !openButton) return;

  if (version) {
    version.textContent = window.LENAMP_CONFIG?.appVersion || '0.1.8';
  }

  const openAbout = () => {
    screen.hidden = false;
    requestAnimationFrame(() => screen.classList.add('is-open'));
    document.body.classList.add('overlay-open');
  };

  const closeAbout = () => {
    screen.classList.remove('is-open');
    document.body.classList.remove('overlay-open');
    window.setTimeout(() => {
      if (!screen.classList.contains('is-open')) screen.hidden = true;
    }, 220);
  };

  openButton.addEventListener('click', openAbout);
  closeButtons.forEach((button) => button.addEventListener('click', closeAbout));

  screen.addEventListener('click', (event) => {
    if (event.target === screen) closeAbout();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && screen.classList.contains('is-open')) closeAbout();
  });
})();
