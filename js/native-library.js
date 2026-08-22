(() => {
  'use strict';

  const platform = window.LENAMP_PLATFORM || {};
  let plugin = null;

  const resolvePlugin = () => {
    if (!platform.isAndroid) return null;
    if (plugin) return plugin;

    const capacitor = window.Capacitor || null;

    if (typeof capacitor?.registerPlugin === 'function') {
      try {
        plugin = capacitor.registerPlugin('LenampLibrary');
      } catch (error) {
        console.warn('LENAMP: falha ao registrar a ponte LenampLibrary.', error);
      }
    }

    if (!plugin) plugin = capacitor?.Plugins?.LenampLibrary || null;
    return plugin;
  };

  const isAvailable = () => Boolean(platform.isAndroid && resolvePlugin());

  const call = async (method, payload = {}) => {
    const currentPlugin = resolvePlugin();
    if (!isAvailable() || typeof currentPlugin?.[method] !== 'function') {
      throw new Error(`LENAMP: biblioteca Android indisponível (${method}).`);
    }
    return currentPlugin[method](payload);
  };

  const api = {
    checkAccess: () => call('checkAccess'),
    requestAccess: () => call('requestAccess'),
    listTracks: () => call('listTracks'),
    getDetails: (uri) => call('getDetails', { uri: String(uri || '') }),
    getArtwork: (uri) => call('getArtwork', { uri: String(uri || '') }),
  };

  Object.defineProperty(api, 'available', {
    enumerable: true,
    get: isAvailable,
  });

  window.LENAMP_NATIVE_LIBRARY = Object.freeze(api);
})();
