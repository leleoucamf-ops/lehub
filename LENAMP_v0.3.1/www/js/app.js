(() => {
  'use strict';

  const audio = document.querySelector('#audio');
  const filePicker = document.querySelector('#filePicker');
  const playlistEl = document.querySelector('#playlist');
  const trackTitle = document.querySelector('#trackTitle');
  const timeDisplay = document.querySelector('#timeDisplay');
  const playlistClock = document.querySelector('#playlistClock');
  const seek = document.querySelector('#seek');
  const volume = document.querySelector('#volume');
  const balance = document.querySelector('#balance');
  const spectrum = document.querySelector('#spectrum');
  const visualStage = document.querySelector('#visualStage');
  const trackArtwork = document.querySelector('#trackArtwork');
  const statusLight = document.querySelector('#statusLight');
  const bitrate = document.querySelector('#bitrate');
  const sampleRate = document.querySelector('#sampleRate');
  const channelMode = document.querySelector('#channelMode');

  const controls = {
    prev: document.querySelector('#prevBtn'),
    play: document.querySelector('#playBtn'),
    pause: document.querySelector('#pauseBtn'),
    stop: document.querySelector('#stopBtn'),
    next: document.querySelector('#nextBtn'),
    eject: document.querySelector('#ejectBtn'),
    add: document.querySelector('#addBtn'),
    remove: document.querySelector('#removeBtn'),
    clear: document.querySelector('#clearBtn'),
    shuffle: document.querySelector('#shuffleBtn'),
    repeat: document.querySelector('#repeatBtn'),
    eqToggle: document.querySelector('#eqToggle'),
    eqReset: document.querySelector('#eqReset'),
  };

  const EQ_BANDS = [
    { label: 'PRE', frequency: 0 },
    { label: '70', frequency: 70 },
    { label: '180', frequency: 180 },
    { label: '320', frequency: 320 },
    { label: '600', frequency: 600 },
    { label: '1K', frequency: 1000 },
    { label: '3K', frequency: 3000 },
    { label: '6K', frequency: 6000 },
    { label: '12K', frequency: 12000 },
    { label: '14K', frequency: 14000 },
    { label: '16K', frequency: 16000 },
  ];

  let tracks = [];
  let currentIndex = -1;
  let selectedIndex = -1;
  let shuffle = false;
  let repeat = false;
  let eqEnabled = true;

  let audioContext = null;
  let sourceNode = null;
  let analyser = null;
  let gainNode = null;
  let pannerNode = null;
  let eqFilters = [];
  let animationFrame = null;
  let persistenceTimer = null;
  let playbackPersistTimer = null;
  let pendingResumeTime = 0;
  let lastMediaPositionUpdate = 0;
  let showArtwork = false;

  const storage = window.LENAMP_STORAGE || null;
  const mediaSession = window.LENAMP_MEDIA_SESSION || null;
  const metadataReader = window.LENAMP_METADATA || null;

  const createTrackId = () => (typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `track-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const stripExtension = (name) => name.replace(/\.[^/.]+$/, '');

  const formatSampleRate = (hz) => {
    if (!Number.isFinite(hz) || hz <= 0) return '-- kHz';
    const khz = hz / 1000;
    return `${Number.isInteger(khz) ? khz : khz.toFixed(1)} kHz`;
  };

  const renderTrackMeta = (track) => {
    const meta = track?.meta || {};
    bitrate.textContent = Number.isFinite(meta.bitrateKbps) ? `${meta.bitrateKbps} kbps` : '-- kbps';
    sampleRate.textContent = formatSampleRate(meta.sampleRateHz);
    channelMode.textContent = meta.channels === 1 ? 'mono' : meta.channels >= 2 ? 'estéreo' : '--';
  };

  const getTrackLabel = (track) => {
    if (!track) return 'LENAMP PRONTO';
    const title = track.meta?.title || track.name || 'Faixa';
    const artist = track.meta?.artist;
    return artist ? `${artist} - ${title}` : title;
  };

  const setArtworkSource = (track) => {
    const artworkUrl = track?.artworkUrl || './assets/icons/lenamp-icon.png';
    trackArtwork.src = artworkUrl;
    trackArtwork.classList.toggle('is-fallback', !track?.artworkUrl);
    trackArtwork.alt = track?.artworkUrl
      ? `Capa de ${track.meta?.title || track.name || 'faixa'}`
      : 'Ícone LENAMP usado como capa padrão';
  };

  const renderVisualMode = () => {
    spectrum.hidden = showArtwork;
    trackArtwork.hidden = !showArtwork;
    visualStage.setAttribute('aria-pressed', String(showArtwork));
  };

  const toggleVisualMode = () => {
    showArtwork = !showArtwork;
    setArtworkSource(tracks[currentIndex]);
    renderVisualMode();
  };

  const inspectAudioFile = async (file) => metadataReader?.inspect?.(file) || {};

  const persistTrack = async (track) => {
    if (!storage || !track) return;
    try {
      await storage.saveTrack(track);
    } catch (error) {
      console.warn('LENAMP: não foi possível salvar a faixa.', error);
    }
  };

  const collectState = () => ({
    trackOrder: tracks.map((track) => track.id),
    currentTrackId: tracks[currentIndex]?.id || null,
    shuffle,
    repeat,
    volume: Number(volume.value),
    balance: Number(balance.value),
    eqEnabled,
    eqValues: [...document.querySelectorAll('[data-eq-index]')].map((slider) => Number(slider.value)),
    currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
  });

  const persistState = async () => {
    if (!storage) return;
    try {
      await storage.saveState(collectState());
    } catch (error) {
      console.warn('LENAMP: não foi possível salvar o estado do player.', error);
    }
  };

  const schedulePersistState = () => {
    if (!storage) return;
    window.clearTimeout(persistenceTimer);
    persistenceTimer = window.setTimeout(() => {
      void persistState();
    }, 180);
  };

  const schedulePlaybackPersist = () => {
    if (!storage || playbackPersistTimer) return;
    playbackPersistTimer = window.setTimeout(() => {
      playbackPersistTimer = null;
      void persistState();
    }, 3000);
  };

  const hydrateTrackMetadata = async (track) => {
    if (!track) return;
    if (!track.metadataPromise) {
      track.metadataPromise = inspectAudioFile(track.file).then((meta) => {
        const { artworkBlob, ...persistableMeta } = meta || {};
        track.meta = { ...track.meta, ...persistableMeta };

        if (track.meta.title) track.name = track.meta.title;
        if (track.artworkUrl) URL.revokeObjectURL(track.artworkUrl);
        track.artworkUrl = artworkBlob instanceof Blob ? URL.createObjectURL(artworkBlob) : null;

        void persistTrack(track);
        return track.meta;
      });
    }

    await track.metadataPromise;
    renderPlaylist();
    if (tracks[currentIndex] === track) {
      trackTitle.textContent = getTrackLabel(track);
      renderTrackMeta(track);
      setArtworkSource(track);
      mediaSession?.setTrack?.(track);
    }
  };

  const ensureAudioGraph = async () => {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      sourceNode = audioContext.createMediaElementSource(audio);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.76;

      gainNode = audioContext.createGain();
      pannerNode = typeof audioContext.createStereoPanner === 'function'
        ? audioContext.createStereoPanner()
        : null;

      eqFilters = EQ_BANDS.slice(1).map((band) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = band.frequency;
        filter.Q.value = 1.05;
        filter.gain.value = 0;
        return filter;
      });

      let node = sourceNode;
      eqFilters.forEach((filter) => {
        node.connect(filter);
        node = filter;
      });

      node.connect(gainNode);
      if (pannerNode) {
        gainNode.connect(pannerNode);
        pannerNode.connect(analyser);
      } else {
        gainNode.connect(analyser);
      }
      analyser.connect(audioContext.destination);

      drawSpectrum();
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
  };

  const resizeSpectrumCanvas = () => {
    const rect = spectrum.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (spectrum.width !== width) spectrum.width = width;
    if (spectrum.height !== height) spectrum.height = height;
  };

  const spectrumObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(resizeSpectrumCanvas)
    : null;
  spectrumObserver?.observe(visualStage);
  window.addEventListener('resize', resizeSpectrumCanvas, { passive: true });
  resizeSpectrumCanvas();

  const drawSpectrum = () => {
    if (!analyser) return;
    const ctx = spectrum.getContext('2d');
    const data = new Uint8Array(analyser.frequencyBinCount);

    const render = () => {
      animationFrame = requestAnimationFrame(render);
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, spectrum.width, spectrum.height);
      ctx.fillStyle = '#070a07';
      ctx.fillRect(0, 0, spectrum.width, spectrum.height);

      const bars = 38;
      const barWidth = spectrum.width / bars;
      for (let i = 0; i < bars; i += 1) {
        const dataIndex = Math.floor(i * data.length / bars);
        const value = data[dataIndex] / 255;
        const height = Math.max(1, value * (spectrum.height - 4));
        const x = i * barWidth;
        const y = spectrum.height - height;

        if (value > 0.72) ctx.fillStyle = '#ff5454';
        else if (value > 0.48) ctx.fillStyle = '#f1d94b';
        else ctx.fillStyle = '#b99d3f';

        ctx.fillRect(x + 1, y, Math.max(1, barWidth - 2), height);
      }
    };

    render();
  };

  const buildEq = () => {
    const eqGrid = document.querySelector('#eqGrid');
    EQ_BANDS.forEach((band, index) => {
      const wrapper = document.createElement('label');
      wrapper.className = 'eq-band';

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '-12';
      slider.max = '12';
      slider.step = '1';
      slider.value = '0';
      slider.dataset.eqIndex = String(index);
      slider.setAttribute('aria-label', `${band.label} dB`);

      const caption = document.createElement('span');
      caption.textContent = band.label;

      slider.addEventListener('input', () => {
        const db = Number(slider.value);
        if (index === 0) {
          if (gainNode) gainNode.gain.value = eqEnabled ? Math.pow(10, db / 20) : 1;
        } else if (eqFilters[index - 1]) {
          eqFilters[index - 1].gain.value = eqEnabled ? db : 0;
        }
        schedulePersistState();
      });

      wrapper.append(slider, caption);
      eqGrid.append(wrapper);
    });
  };

  const revokeTrackUrls = () => {
    tracks.forEach((track) => {
      URL.revokeObjectURL(track.url);
      if (track.artworkUrl) URL.revokeObjectURL(track.artworkUrl);
    });
  };

  const addFiles = async (fileList) => {
    const incoming = [...fileList].filter((file) => file.type.startsWith('audio/'));
    if (!incoming.length) return;

    const wasEmpty = tracks.length === 0;
    const addedTracks = incoming.map((file) => ({
      id: createTrackId(),
      file,
      name: stripExtension(file.name),
      url: URL.createObjectURL(file),
      duration: 0,
      meta: {
        bitrateKbps: null,
        sampleRateHz: null,
        channels: null,
        title: null,
        artist: null,
        album: null,
      },
      artworkUrl: null,
      metadataPromise: null,
    }));

    tracks.push(...addedTracks);
    renderPlaylist();

    await Promise.allSettled(addedTracks.map((track) => persistTrack(track)));
    await persistState();

    if (wasEmpty) await loadTrack(0, false);
  };

  const renderPlaylist = () => {
    playlistEl.innerHTML = '';

    tracks.forEach((track, index) => {
      const item = document.createElement('li');
      item.dataset.index = String(index);
      if (index === currentIndex) item.classList.add('active');
      if (index === selectedIndex) item.classList.add('selected');

      const line = document.createElement('span');
      line.className = 'track-line';

      const name = document.createElement('span');
      name.textContent = getTrackLabel(track);

      const duration = document.createElement('span');
      duration.textContent = track.duration ? formatTime(track.duration) : '--:--';

      line.append(name, duration);
      item.append(line);

      item.addEventListener('click', () => {
        selectedIndex = index;
        renderPlaylist();
      });

      item.addEventListener('dblclick', () => loadTrack(index, true));
      playlistEl.append(item);
    });
  };

  const loadTrack = async (index, autoplay = true) => {
    if (!tracks[index]) return;
    currentIndex = index;
    selectedIndex = index;
    audio.src = tracks[index].url;
    trackTitle.textContent = getTrackLabel(tracks[index]);
    renderTrackMeta(tracks[index]);
    setArtworkSource(tracks[index]);
    mediaSession?.setTrack?.(tracks[index]);
    renderPlaylist();
    void hydrateTrackMetadata(tracks[index]);
    schedulePersistState();

    if (autoplay) {
      await ensureAudioGraph();
      await audio.play();
    }
  };

  const nextIndex = () => {
    if (!tracks.length) return -1;
    if (shuffle && tracks.length > 1) {
      let candidate = currentIndex;
      while (candidate === currentIndex) candidate = Math.floor(Math.random() * tracks.length);
      return candidate;
    }
    return (currentIndex + 1) % tracks.length;
  };

  const previousIndex = () => {
    if (!tracks.length) return -1;
    return (currentIndex - 1 + tracks.length) % tracks.length;
  };

  const playCurrent = async () => {
    if (!tracks.length) {
      filePicker.click();
      return;
    }
    if (currentIndex < 0) await loadTrack(0, false);
    await ensureAudioGraph();
    await audio.play();
  };

  const stopAudio = () => {
    audio.pause();
    audio.currentTime = 0;
    mediaSession?.setPlaybackState?.('none');
    schedulePersistState();
  };

  const playNext = async () => {
    const index = nextIndex();
    if (index >= 0) await loadTrack(index, true);
  };

  const playPrevious = async () => {
    const index = previousIndex();
    if (index >= 0) await loadTrack(index, true);
  };

  const seekBy = (seconds) => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + seconds));
  };

  const seekToSeconds = (seconds) => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0 || !Number.isFinite(seconds)) return;
    audio.currentTime = Math.min(audio.duration, Math.max(0, seconds));
  };

  visualStage.addEventListener('click', toggleVisualMode);
  visualStage.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleVisualMode();
  });

  controls.eject.addEventListener('click', () => filePicker.click());
  controls.add.addEventListener('click', () => filePicker.click());
  filePicker.addEventListener('change', () => {
    void addFiles(filePicker.files);
    filePicker.value = '';
  });

  controls.play.addEventListener('click', playCurrent);
  controls.pause.addEventListener('click', () => audio.pause());
  controls.stop.addEventListener('click', stopAudio);

  controls.next.addEventListener('click', playNext);
  controls.prev.addEventListener('click', playPrevious);

  controls.shuffle.addEventListener('click', () => {
    shuffle = !shuffle;
    controls.shuffle.classList.toggle('active', shuffle);
    schedulePersistState();
  });

  controls.repeat.addEventListener('click', () => {
    repeat = !repeat;
    controls.repeat.classList.toggle('active', repeat);
    schedulePersistState();
  });

  controls.remove.addEventListener('click', () => {
    if (selectedIndex < 0 || !tracks[selectedIndex]) return;
    const [removed] = tracks.splice(selectedIndex, 1);
    URL.revokeObjectURL(removed.url);
    if (removed.artworkUrl) URL.revokeObjectURL(removed.artworkUrl);
    if (storage) void storage.deleteTrack(removed.id).catch((error) => {
      console.warn('LENAMP: não foi possível remover a faixa salva.', error);
    });

    if (!tracks.length) {
      stopAudio();
      audio.removeAttribute('src');
      currentIndex = -1;
      selectedIndex = -1;
      trackTitle.textContent = 'LENAMP PRONTO';
      setArtworkSource(null);
      mediaSession?.clear?.();
    } else if (selectedIndex === currentIndex) {
      currentIndex = Math.min(selectedIndex, tracks.length - 1);
      loadTrack(currentIndex, false);
    } else {
      if (selectedIndex < currentIndex) currentIndex -= 1;
      selectedIndex = Math.min(selectedIndex, tracks.length - 1);
      renderPlaylist();
    }
    schedulePersistState();
  });

  controls.clear.addEventListener('click', () => {
    stopAudio();
    revokeTrackUrls();
    tracks = [];
    currentIndex = -1;
    selectedIndex = -1;
    audio.removeAttribute('src');
    trackTitle.textContent = 'LENAMP PRONTO';
    setArtworkSource(null);
    showArtwork = false;
    renderVisualMode();
    mediaSession?.clear?.();
    bitrate.textContent = '-- kbps';
    sampleRate.textContent = '-- kHz';
    channelMode.textContent = '--';
    timeDisplay.textContent = '0:00';
    playlistClock.textContent = '0:00 / 0:00';
    seek.value = 0;
    renderPlaylist();
    if (storage) {
      void storage.clearTracks().then(() => persistState()).catch((error) => {
        console.warn('LENAMP: não foi possível limpar a biblioteca salva.', error);
      });
    }
  });

  controls.eqToggle.addEventListener('click', () => {
    eqEnabled = !eqEnabled;
    controls.eqToggle.classList.toggle('active', eqEnabled);
    document.querySelectorAll('[data-eq-index]').forEach((slider) => {
      slider.dispatchEvent(new Event('input'));
    });
    schedulePersistState();
  });

  controls.eqReset.addEventListener('click', () => {
    document.querySelectorAll('[data-eq-index]').forEach((slider) => {
      slider.value = '0';
      slider.dispatchEvent(new Event('input'));
    });
    schedulePersistState();
  });

  volume.addEventListener('input', () => {
    audio.volume = Number(volume.value);
    schedulePersistState();
  });

  balance.addEventListener('input', () => {
    if (pannerNode) pannerNode.pan.value = Number(balance.value);
    schedulePersistState();
  });

  seek.addEventListener('input', () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
  });

  audio.addEventListener('loadedmetadata', () => {
    const track = tracks[currentIndex];
    if (!track) return;

    track.duration = audio.duration;

    // Fallback genérico: estima o bitrate médio quando o analisador do contêiner
    // não consegue obtê-lo. Funciona bem com arquivos locais MP3/M4A/OGG.
    if (
      !Number.isFinite(track.meta?.bitrateKbps) &&
      Number.isFinite(audio.duration) &&
      audio.duration > 0
    ) {
      track.meta.bitrateKbps = Math.round((track.file.size * 8) / audio.duration / 1000);
    }

    if (pendingResumeTime > 0) {
      audio.currentTime = Math.min(pendingResumeTime, Math.max(0, audio.duration - 0.25));
      pendingResumeTime = 0;
    }

    renderTrackMeta(track);
    renderPlaylist();
    mediaSession?.setPositionState?.({
      duration: audio.duration,
      position: audio.currentTime || 0,
      playbackRate: audio.playbackRate || 1,
    });
    void persistTrack(track);
  });

  audio.addEventListener('timeupdate', () => {
    const current = audio.currentTime || 0;
    const duration = audio.duration || 0;
    timeDisplay.textContent = formatTime(current);
    playlistClock.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    seek.value = duration > 0 ? Math.round((current / duration) * 1000) : 0;

    schedulePlaybackPersist();
    const now = performance.now();
    if (now - lastMediaPositionUpdate >= 900) {
      lastMediaPositionUpdate = now;
      mediaSession?.setPositionState?.({
        duration,
        position: current,
        playbackRate: audio.playbackRate || 1,
      });
    }
  });

  audio.addEventListener('play', () => {
    statusLight.classList.add('on');
    mediaSession?.setPlaybackState?.('playing');
  });
  audio.addEventListener('pause', () => {
    statusLight.classList.remove('on');
    if (audio.currentTime > 0 && !audio.ended) mediaSession?.setPlaybackState?.('paused');
    schedulePersistState();
  });

  audio.addEventListener('ended', async () => {
    if (repeat) {
      audio.currentTime = 0;
      await audio.play();
      return;
    }
    await playNext();
  });

  window.addEventListener('dragover', (event) => {
    event.preventDefault();
    document.querySelector('.lenamp-shell').classList.add('dragging');
  });

  window.addEventListener('dragleave', (event) => {
    if (event.relatedTarget === null) {
      document.querySelector('.lenamp-shell').classList.remove('dragging');
    }
  });

  window.addEventListener('drop', (event) => {
    event.preventDefault();
    document.querySelector('.lenamp-shell').classList.remove('dragging');
    if (event.dataTransfer?.files) void addFiles(event.dataTransfer.files);
  });

  window.addEventListener('beforeunload', () => {
    revokeTrackUrls();
    if (animationFrame) cancelAnimationFrame(animationFrame);
    window.clearTimeout(persistenceTimer);
    window.clearTimeout(playbackPersistTimer);
  });

  const restoreLibrary = async () => {
    if (!storage) return;

    try {
      const restored = await storage.loadLibrary();
      const state = restored.state || {};

      tracks = restored.tracks.map((track) => ({
        id: track.id || createTrackId(),
        file: track.file,
        name: track.name || stripExtension(track.file?.name || 'Faixa'),
        url: URL.createObjectURL(track.file),
        duration: Number.isFinite(track.duration) ? track.duration : 0,
        meta: {
          bitrateKbps: track.meta?.bitrateKbps ?? null,
          sampleRateHz: track.meta?.sampleRateHz ?? null,
          channels: track.meta?.channels ?? null,
          title: track.meta?.title ?? null,
          artist: track.meta?.artist ?? null,
          album: track.meta?.album ?? null,
        },
        artworkUrl: null,
        metadataPromise: null,
      })).filter((track) => track.file instanceof Blob);

      shuffle = Boolean(state.shuffle);
      repeat = Boolean(state.repeat);
      eqEnabled = state.eqEnabled !== false;

      if (Number.isFinite(state.volume)) volume.value = String(Math.min(1, Math.max(0, state.volume)));
      if (Number.isFinite(state.balance)) balance.value = String(Math.min(1, Math.max(-1, state.balance)));
      audio.volume = Number(volume.value);

      controls.shuffle.classList.toggle('active', shuffle);
      controls.repeat.classList.toggle('active', repeat);
      controls.eqToggle.classList.toggle('active', eqEnabled);

      if (Array.isArray(state.eqValues)) {
        document.querySelectorAll('[data-eq-index]').forEach((slider, index) => {
          if (Number.isFinite(state.eqValues[index])) slider.value = String(state.eqValues[index]);
        });
      }

      renderPlaylist();

      if (tracks.length) {
        pendingResumeTime = Number.isFinite(state.currentTime) ? Math.max(0, state.currentTime) : 0;
        const restoredIndex = state.currentTrackId
          ? tracks.findIndex((track) => track.id === state.currentTrackId)
          : 0;
        await loadTrack(restoredIndex >= 0 ? restoredIndex : 0, false);
      }
    } catch (error) {
      console.warn('LENAMP: biblioteca salva indisponível. O player continuará normalmente.', error);
    }
  };

  mediaSession?.bindActions?.({
    play: () => { void playCurrent(); },
    pause: () => audio.pause(),
    stop: stopAudio,
    previous: () => { void playPrevious(); },
    next: () => { void playNext(); },
    seekBackward: (offset = 10) => seekBy(-Math.abs(Number(offset) || 10)),
    seekForward: (offset = 10) => seekBy(Math.abs(Number(offset) || 10)),
    seekTo: (seconds) => seekToSeconds(Number(seconds)),
  });

  audio.volume = Number(volume.value);
  buildEq();
  renderPlaylist();
  setArtworkSource(null);
  renderVisualMode();
  void restoreLibrary();
})();
