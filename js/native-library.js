(() => {
  'use strict';

  const platform = window.LENAMP_PLATFORM || {};
  const plugin = window.Capacitor?.Plugins?.LenampLibrary || null;
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
