(() => {
  'use strict';

  const screen = document.querySelector('#ratingScreen');
  const openButton = document.querySelector('#openRatingBtn');
  const closeButtons = document.querySelectorAll('[data-close-rating]');
  const stars = [...document.querySelectorAll('.rating-star')];
  const storeButton = document.querySelector('#playStoreBtn');
  const notice = document.querySelector('#ratingNotice');

  if (!screen || !openButton || !storeButton) return;

  let selectedRating = 5;

  const renderStars = () => {
    stars.forEach((star, index) => {
      const active = index < selectedRating;
      star.classList.toggle('is-active', active);
      star.setAttribute('aria-pressed', String(active));
    });
  };

  const openRating = () => {
    screen.hidden = false;
    requestAnimationFrame(() => screen.classList.add('is-open'));
    document.body.classList.add('overlay-open');
    storeButton.focus({ preventScroll: true });
  };

  const closeRating = () => {
    screen.classList.remove('is-open');
    document.body.classList.remove('overlay-open');
    window.setTimeout(() => {
      if (!screen.classList.contains('is-open')) screen.hidden = true;
    }, 220);
  };

  stars.forEach((star, index) => {
    star.addEventListener('click', () => {
      selectedRating = index + 1;
      renderStars();
    });
  });

  openButton.addEventListener('click', openRating);
  closeButtons.forEach((button) => button.addEventListener('click', closeRating));

  screen.addEventListener('click', (event) => {
    if (event.target === screen) closeRating();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && screen.classList.contains('is-open')) closeRating();
  });

  storeButton.addEventListener('click', () => {
    const url = window.LENAMP_CONFIG?.playStoreUrl?.trim();
    if (!url) {
      notice.textContent = 'Link da Play Store ainda não configurado. Defina playStoreUrl em js/config.js quando o app for publicado.';
      notice.hidden = false;
      return;
    }

    notice.hidden = true;
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  renderStars();
})();
