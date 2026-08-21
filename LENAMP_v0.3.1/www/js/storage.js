(() => {
  'use strict';

  const DB_NAME = 'lenamp-library';
  const DB_VERSION = 1;
  const TRACKS_STORE = 'tracks';
  const STATE_STORE = 'state';
  const APP_STATE_KEY = 'player';

  let dbPromise = null;

  const requestToPromise = (request) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const transactionDone = (transaction) => new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Transação IndexedDB cancelada.'));
  });

  const openDatabase = () => {
    if (!('indexedDB' in window)) {
      return Promise.reject(new Error('IndexedDB não está disponível neste ambiente.'));
    }

    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;

          if (!db.objectStoreNames.contains(TRACKS_STORE)) {
            db.createObjectStore(TRACKS_STORE, { keyPath: 'id' });
          }

          if (!db.objectStoreNames.contains(STATE_STORE)) {
            db.createObjectStore(STATE_STORE, { keyPath: 'key' });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    return dbPromise;
  };

  const serializeTrack = (track) => ({
    id: track.id,
    file: track.file,
    name: track.name,
    duration: Number.isFinite(track.duration) ? track.duration : 0,
    meta: {
      bitrateKbps: Number.isFinite(track.meta?.bitrateKbps) ? track.meta.bitrateKbps : null,
      sampleRateHz: Number.isFinite(track.meta?.sampleRateHz) ? track.meta.sampleRateHz : null,
      channels: Number.isFinite(track.meta?.channels) ? track.meta.channels : null,
      title: track.meta?.title || null,
      artist: track.meta?.artist || null,
      album: track.meta?.album || null,
    },
  });

  const saveTrack = async (track) => {
    const db = await openDatabase();
    const tx = db.transaction(TRACKS_STORE, 'readwrite');
    tx.objectStore(TRACKS_STORE).put(serializeTrack(track));
    await transactionDone(tx);
  };

  const deleteTrack = async (trackId) => {
    const db = await openDatabase();
    const tx = db.transaction(TRACKS_STORE, 'readwrite');
    tx.objectStore(TRACKS_STORE).delete(trackId);
    await transactionDone(tx);
  };

  const clearTracks = async () => {
    const db = await openDatabase();
    const tx = db.transaction(TRACKS_STORE, 'readwrite');
    tx.objectStore(TRACKS_STORE).clear();
    await transactionDone(tx);
  };

  const saveState = async (state) => {
    const db = await openDatabase();
    const tx = db.transaction(STATE_STORE, 'readwrite');
    tx.objectStore(STATE_STORE).put({ key: APP_STATE_KEY, ...state });
    await transactionDone(tx);
  };

  const loadLibrary = async () => {
    const db = await openDatabase();
    const tx = db.transaction([TRACKS_STORE, STATE_STORE], 'readonly');
    const tracksRequest = tx.objectStore(TRACKS_STORE).getAll();
    const stateRequest = tx.objectStore(STATE_STORE).get(APP_STATE_KEY);

    const [storedTracks, state] = await Promise.all([
      requestToPromise(tracksRequest),
      requestToPromise(stateRequest),
      transactionDone(tx),
    ]);

    const byId = new Map(storedTracks.map((track) => [track.id, track]));
    const orderedTracks = [];

    (state?.trackOrder || []).forEach((id) => {
      const track = byId.get(id);
      if (!track) return;
      orderedTracks.push(track);
      byId.delete(id);
    });

    // Mantém arquivos órfãos legíveis mesmo se um estado antigo estiver incompleto.
    byId.forEach((track) => orderedTracks.push(track));

    return {
      tracks: orderedTracks,
      state: state || null,
    };
  };

  window.LENAMP_STORAGE = Object.freeze({
    loadLibrary,
    saveTrack,
    deleteTrack,
    clearTracks,
    saveState,
  });
})();
