(() => {
  'use strict';

  const supported = 'mediaSession' in navigator;

  const safeSetActionHandler = (action, handler) => {
    if (!supported) return;
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (error) {
      // Alguns navegadores reconhecem Media Session, mas não todas as ações.
      console.debug(`LENAMP: ação de mídia não suportada: ${action}`, error);
    }
  };

  const setTrack = (track) => {
    if (!supported || !track) return;

    try {
      const artworkSrc = track.artworkUrl || './assets/icons/lenamp-icon-512.png';
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.meta?.title || track.name || 'LENAMP',
        artist: track.meta?.artist || 'LENAMP',
        album: track.meta?.album || 'Biblioteca local',
        artwork: [
          { src: artworkSrc },
        ],
      });
    } catch (error) {
      console.debug('LENAMP: não foi possível atualizar os metadados do sistema.', error);
    }
  };

  const setPlaybackState = (state) => {
    if (!supported) return;
    try {
      navigator.mediaSession.playbackState = state;
    } catch (error) {
      console.debug('LENAMP: estado de reprodução do sistema indisponível.', error);
    }
  };

  const setPositionState = ({ duration, position, playbackRate = 1 }) => {
    if (!supported || typeof navigator.mediaSession.setPositionState !== 'function') return;
    if (!Number.isFinite(duration) || duration <= 0) return;

    const safePosition = Math.min(duration, Math.max(0, Number(position) || 0));
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1,
        position: safePosition,
      });
    } catch (error) {
      console.debug('LENAMP: posição da mídia não pôde ser enviada ao sistema.', error);
    }
  };

  const clear = () => {
    if (!supported) return;
    try {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    } catch (error) {
      console.debug('LENAMP: não foi possível limpar a sessão de mídia.', error);
    }
  };

  const bindActions = ({
    play,
    pause,
    stop,
    previous,
    next,
    seekBackward,
    seekForward,
    seekTo,
  }) => {
    safeSetActionHandler('play', play);
    safeSetActionHandler('pause', pause);
    safeSetActionHandler('stop', stop);
    safeSetActionHandler('previoustrack', previous);
    safeSetActionHandler('nexttrack', next);
    safeSetActionHandler('seekbackward', (details) => seekBackward(details?.seekOffset));
    safeSetActionHandler('seekforward', (details) => seekForward(details?.seekOffset));
    safeSetActionHandler('seekto', (details) => seekTo(details?.seekTime));
  };

  window.LENAMP_MEDIA_SESSION = Object.freeze({
    supported,
    bindActions,
    setTrack,
    setPlaybackState,
    setPositionState,
    clear,
  });
})();
