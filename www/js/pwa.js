(() => {
  'use strict';

  const installButton = document.querySelector('#installPwaBtn');
  const installStatus = document.querySelector('#installPwaStatus');
  let deferredPrompt = null;

  const isStandalone = () =>
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const setStatus = (message) => {
    if (!installStatus) return;
    installStatus.textContent = message;
    installStatus.hidden = !message;
  };

  const updateInstallUi = () => {
    if (!installButton) return;

    if (window.LENAMP_PLATFORM?.isNative) {
      installButton.hidden = true;
      setStatus('');
      return;
    }

    if (isStandalone()) {
      installButton.hidden = true;
      setStatus('LENAMP já está instalado neste dispositivo.');
      return;
    }

    installButton.hidden = !deferredPrompt;
    if (!deferredPrompt) {
      setStatus('No Chrome, use o menu ⋮ e escolha “Instalar app” ou “Adicionar à tela inicial”.');
    }
  };

  if (!window.LENAMP_PLATFORM?.isNative && 'serviceWorker' in navigator) {
    const secureEnough = window.isSecureContext || ['localhost', '127.0.0.1'].includes(location.hostname);
    if (secureEnough) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((error) => {
          console.warn('LENAMP: service worker não pôde ser registrado.', error);
        });
      });
    } else {
      setStatus('Para instalar pelo Chrome, abra o LENAMP por HTTPS.');
    }
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    updateInstallUi();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    updateInstallUi();
  });

  installButton?.addEventListener('click', async () => {
    if (!deferredPrompt) {
      updateInstallUi();
      return;
    }

    installButton.disabled = true;
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      deferredPrompt = null;
      installButton.disabled = false;
      updateInstallUi();
    }
  });

  updateInstallUi();
})();
