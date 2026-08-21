(() => {
  'use strict';

  const platform = window.LENAMP_PLATFORM || {};
  const plugin = window.Capacitor?.Plugins?.LenampAudio || null;
  const available = Boolean(platform.isAndroid && plugin);

  const call = async (method, payload = {}) => {
    if (!available || typeof plugin?.[method] !== 'function') {
      throw new Error(`LENAMP: áudio nativo indisponível (${method}).`);
    }
    return plugin[method](payload);
  };

  const normalizeTrack = (track) => ({
    id: String(track?.id || ''),
    uri: String(track?.nativeUri || ''),
    title: track?.meta?.title || track?.name || 'Faixa',
    artist: track?.meta?.artist || 'LENAMP',
    album: track?.meta?.album || 'Biblioteca local',
    artworkUri: track?.nativeArtworkUri || '',
  });

  const loadPlaylist = async (tracks, currentIndex = 0, positionMs = 0, autoplay = false) => {
    const nativeTracks = (Array.isArray(tracks) ? tracks : [])
      .filter((track) => typeof track?.nativeUri === 'string' && track.nativeUri.length > 0)
      .map(normalizeTrack);

    if (!nativeTracks.length) {
      return { loaded: false, reason: 'no-native-uris' };
    }

    return call('loadPlaylist', {
      tracks: nativeTracks,
      currentIndex: Math.max(0, Number(currentIndex) || 0),
      positionMs: Math.max(0, Number(positionMs) || 0),
      autoplay: Boolean(autoplay),
    });
  };

  const addListener = (eventName, listener) => {
    if (!available || typeof plugin?.addListener !== 'function') return null;
    return plugin.addListener(eventName, listener);
  };

  window.LENAMP_NATIVE_AUDIO = Object.freeze({
    available,
    loadPlaylist,
    play: () => call('play'),
    pause: () => call('pause'),
    stop: () => call('stop'),
    seekTo: (positionMs) => call('seekTo', { positionMs: Math.max(0, Number(positionMs) || 0) }),
    setVolume: (value) => call('setVolume', { value: Math.min(1, Math.max(0, Number(value) || 0)) }),
    setRepeat: (enabled) => call('setRepeat', { enabled: Boolean(enabled) }),
    setShuffle: (enabled) => call('setShuffle', { enabled: Boolean(enabled) }),
    getState: () => call('getState'),
    addListener,
  });
})();
