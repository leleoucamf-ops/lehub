(() => {
  'use strict';

  const platform = window.LENAMP_PLATFORM || {};
  const capacitor = window.Capacitor || null;
  let plugin = null;

  if (platform.isAndroid && typeof capacitor?.registerPlugin === 'function') {
    try {
      plugin = capacitor.registerPlugin('LenampLibrary');
    } catch (error) {
      console.warn('LENAMP: falha ao registrar a ponte LenampLibrary.', error);
    }
  }

  // Fallback para runtimes Capacitor que ainda expõem Plugins globalmente.
  if (!plugin) plugin = capacitor?.Plugins?.LenampLibrary || null;
  const available = Boolean(platform.isAndroid && plugin);

  const call = async (method, payload = {}) => {
    if (!available || typeof plugin?.[method] !== 'function') {
      throw new Error(`LENAMP: biblioteca Android indisponível (${method}).`);
    }
    return plugin[method](payload);
  };

  window.LENAMP_NATIVE_LIBRARY = Object.freeze({
    available,
    checkAccess: () => call('checkAccess'),
    requestAccess: () => call('requestAccess'),
    listTracks: () => call('listTracks'),
    getDetails: (uri) => call('getDetails', { uri: String(uri || '') }),
    getArtwork: (uri) => call('getArtwork', { uri: String(uri || '') }),
  });
})();
