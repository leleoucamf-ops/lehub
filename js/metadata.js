(() => {
  'use strict';

  const readSynchsafe = (bytes, offset) => (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );

  const readUInt32BE = (bytes, offset) => (
    ((bytes[offset] << 24) >>> 0) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;

  const trimNulls = (value) => String(value || '').replace(/\u0000/g, '').trim();

  const decodeUtf16 = (bytes, littleEndian) => {
    if (bytes.length < 2) return '';
    const evenLength = bytes.length - (bytes.length % 2);
    const view = new DataView(bytes.buffer, bytes.byteOffset, evenLength);
    let result = '';
    for (let offset = 0; offset < evenLength; offset += 2) {
      result += String.fromCharCode(view.getUint16(offset, littleEndian));
    }
    return trimNulls(result);
  };

  const decodeText = (bytes, encoding = 0) => {
    if (!bytes?.length) return '';

    try {
      if (encoding === 3) return trimNulls(new TextDecoder('utf-8').decode(bytes));
      if (encoding === 0) return trimNulls(new TextDecoder('iso-8859-1').decode(bytes));
      if (encoding === 2) return decodeUtf16(bytes, false);
      if (encoding === 1) {
        if (bytes.length >= 2) {
          if (bytes[0] === 0xff && bytes[1] === 0xfe) return decodeUtf16(bytes.subarray(2), true);
          if (bytes[0] === 0xfe && bytes[1] === 0xff) return decodeUtf16(bytes.subarray(2), false);
        }
        return decodeUtf16(bytes, true);
      }
    } catch (error) {
      console.debug('LENAMP: codificação ID3 não suportada pelo navegador.', error);
    }

    return '';
  };

  const findTextTerminator = (bytes, start, encoding) => {
    if (encoding === 1 || encoding === 2) {
      for (let index = start; index + 1 < bytes.length; index += 2) {
        if (bytes[index] === 0 && bytes[index + 1] === 0) return index;
      }
      return bytes.length;
    }

    const index = bytes.indexOf(0, start);
    return index >= 0 ? index : bytes.length;
  };

  const parseApic = (frameBytes) => {
    if (!frameBytes?.length) return null;
    const encoding = frameBytes[0];
    let offset = 1;

    const mimeEnd = frameBytes.indexOf(0, offset);
    if (mimeEnd < 0) return null;
    const mime = decodeText(frameBytes.subarray(offset, mimeEnd), 0) || 'image/jpeg';
    offset = mimeEnd + 1;

    if (offset >= frameBytes.length) return null;
    offset += 1; // picture type

    const descriptionEnd = findTextTerminator(frameBytes, offset, encoding);
    offset = descriptionEnd + ((encoding === 1 || encoding === 2) ? 2 : 1);
    if (offset >= frameBytes.length) return null;

    return new Blob([frameBytes.slice(offset)], { type: mime });
  };

  const parseId3v2 = async (file) => {
    const header = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    if (
      header.length < 10 ||
      header[0] !== 0x49 || header[1] !== 0x44 || header[2] !== 0x33
    ) return {};

    const majorVersion = header[3];
    if (majorVersion < 3 || majorVersion > 4) return {};

    const tagSize = readSynchsafe(header, 6);
    const rawTag = new Uint8Array(await file.slice(10, 10 + tagSize).arrayBuffer());
    const result = {};
    let offset = 0;

    // Tags com cabeçalho estendido são válidas em ID3v2.3/v2.4.
    if ((header[5] & 0x40) !== 0 && rawTag.length >= 4) {
      const extendedSize = majorVersion === 4
        ? readSynchsafe(rawTag, 0)
        : readUInt32BE(rawTag, 0) + 4;
      if (extendedSize > 0 && extendedSize < rawTag.length) offset = extendedSize;
    }

    while (offset + 10 <= rawTag.length) {
      const frameId = String.fromCharCode(...rawTag.subarray(offset, offset + 4));
      if (!/^[A-Z0-9]{4}$/.test(frameId)) break;

      const frameSize = majorVersion === 4
        ? readSynchsafe(rawTag, offset + 4)
        : readUInt32BE(rawTag, offset + 4);

      if (!frameSize || offset + 10 + frameSize > rawTag.length) break;
      const frameBytes = rawTag.subarray(offset + 10, offset + 10 + frameSize);

      if (frameId === 'TIT2' || frameId === 'TPE1' || frameId === 'TALB') {
        const value = decodeText(frameBytes.subarray(1), frameBytes[0]);
        if (frameId === 'TIT2') result.title = value;
        if (frameId === 'TPE1') result.artist = value;
        if (frameId === 'TALB') result.album = value;
      } else if (frameId === 'APIC' && !result.artworkBlob) {
        result.artworkBlob = parseApic(frameBytes);
      }

      offset += 10 + frameSize;
    }

    return result;
  };

  const parseMp3FrameHeader = async (file) => {
    const firstTen = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    let start = 0;

    if (
      firstTen.length >= 10 &&
      firstTen[0] === 0x49 && firstTen[1] === 0x44 && firstTen[2] === 0x33
    ) {
      const tagSize = readSynchsafe(firstTen, 6);
      const hasFooter = (firstTen[5] & 0x10) !== 0;
      start = 10 + tagSize + (hasFooter ? 10 : 0);
    }

    const bytes = new Uint8Array(await file.slice(start, start + 128 * 1024).arrayBuffer());
    const bitrateMpeg1Layer3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
    const bitrateMpeg2Layer3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
    const sampleRates = {
      3: [44100, 48000, 32000],
      2: [22050, 24000, 16000],
      0: [11025, 12000, 8000],
    };

    for (let i = 0; i <= bytes.length - 4; i += 1) {
      const b0 = bytes[i];
      const b1 = bytes[i + 1];
      const b2 = bytes[i + 2];
      const b3 = bytes[i + 3];
      if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) continue;

      const versionBits = (b1 >> 3) & 0x03;
      const layerBits = (b1 >> 1) & 0x03;
      const bitrateIndex = (b2 >> 4) & 0x0f;
      const sampleRateIndex = (b2 >> 2) & 0x03;
      if (versionBits === 1 || layerBits !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) continue;

      const bitrateTable = versionBits === 3 ? bitrateMpeg1Layer3 : bitrateMpeg2Layer3;
      const sampleRateTable = sampleRates[versionBits];
      if (!sampleRateTable) continue;

      const channelModeBits = (b3 >> 6) & 0x03;
      return {
        bitrateKbps: bitrateTable[bitrateIndex],
        sampleRateHz: sampleRateTable[sampleRateIndex],
        channels: channelModeBits === 3 ? 1 : 2,
      };
    }

    return {};
  };

  const parseWavHeader = async (file) => {
    const buffer = await file.slice(0, 64 * 1024).arrayBuffer();
    const view = new DataView(buffer);
    const text = (offset, length) => {
      let value = '';
      for (let i = 0; i < length; i += 1) value += String.fromCharCode(view.getUint8(offset + i));
      return value;
    };

    if (view.byteLength < 12 || text(0, 4) !== 'RIFF' || text(8, 4) !== 'WAVE') return {};

    let offset = 12;
    while (offset + 8 <= view.byteLength) {
      const chunkId = text(offset, 4);
      const chunkSize = view.getUint32(offset + 4, true);
      const dataOffset = offset + 8;
      if (chunkId === 'fmt ' && dataOffset + 16 <= view.byteLength) {
        const channels = view.getUint16(dataOffset + 2, true);
        const sampleRateHz = view.getUint32(dataOffset + 4, true);
        const byteRate = view.getUint32(dataOffset + 8, true);
        return {
          bitrateKbps: Math.round((byteRate * 8) / 1000),
          sampleRateHz,
          channels,
        };
      }
      offset = dataOffset + chunkSize + (chunkSize % 2);
    }

    return {};
  };

  const inspect = async (file) => {
    if (!(file instanceof Blob)) return {};
    const name = String(file.name || '').toLowerCase();
    const type = String(file.type || '').toLowerCase();

    try {
      if (name.endsWith('.mp3') || type === 'audio/mpeg' || type === 'audio/mp3') {
        const [technical, id3] = await Promise.all([
          parseMp3FrameHeader(file),
          parseId3v2(file),
        ]);
        return { ...technical, ...id3 };
      }

      if (name.endsWith('.wav') || name.endsWith('.wave') || type.includes('wav')) {
        return await parseWavHeader(file);
      }
    } catch (error) {
      console.warn('LENAMP: não foi possível ler os metadados do arquivo.', error);
    }

    return {};
  };

  window.LENAMP_METADATA = Object.freeze({ inspect });
})();
