import { Mp3Encoder } from '@breezystack/lamejs';

/**
 * Convert Base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert 16-bit PCM samples to MP3 Blob using lamejs
 */
export function pcm16ToMp3Blob(
  pcm16: Int16Array,
  numChannels: number = 1,
  sampleRate: number = 24000,
  kbps: number = 128
): Blob {
  const encoder = new Mp3Encoder(numChannels, sampleRate, kbps);
  const mp3Data: Uint8Array[] = [];
  const sampleBlockSize = 1152;

  for (let i = 0; i < pcm16.length; i += sampleBlockSize) {
    const chunk = pcm16.subarray(i, Math.min(i + sampleBlockSize, pcm16.length));
    let mp3buf: Uint8Array;
    if (numChannels === 1) {
      mp3buf = encoder.encodeBuffer(chunk);
    } else {
      mp3buf = encoder.encodeBuffer(chunk, chunk);
    }
    if (mp3buf && mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }

  const endBuf = encoder.flush();
  if (endBuf && endBuf.length > 0) {
    mp3Data.push(endBuf);
  }

  return new Blob(mp3Data, { type: 'audio/mp3' });
}

/**
 * Convert 16-bit PCM samples to WAV Blob
 */
export function pcmToWavBlob(
  pcmData: Int16Array,
  numChannels: number = 1,
  sampleRate: number = 24000
): Blob {
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);
  const writeString = (v: DataView, o: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      v.setUint8(o + i, s.charCodeAt(i));
    }
  };
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(view, 36, 'data');
  view.setUint32(40, pcmData.length * 2, true);
  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(44 + i * 2, pcmData[i], true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Merge multiple Int16Array PCM buffers into a single Int16Array with optional silence gap
 */
export function mergePcmBuffers(
  buffers: Int16Array[],
  silenceSeconds: number = 0.25,
  sampleRate: number = 24000
): Int16Array {
  const silenceSamples = Math.floor(silenceSeconds * sampleRate);
  let totalLength = 0;

  buffers.forEach((buf, idx) => {
    totalLength += buf.length;
    if (idx < buffers.length - 1) {
      totalLength += silenceSamples;
    }
  });

  const merged = new Int16Array(totalLength);
  let offset = 0;

  buffers.forEach((buf, idx) => {
    merged.set(buf, offset);
    offset += buf.length;
    if (idx < buffers.length - 1) {
      // fill with silence (zeros)
      offset += silenceSamples;
    }
  });

  return merged;
}

/**
 * Intelligent text splitter that chunks text into parts of maxChars (default 2500)
 * Respects paragraph boundaries and sentence ends (. ! ? \n)
 */
export function splitTextIntoChunks(text: string, maxChars: number = 2500): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const chunks: string[] = [];
  // Split by double newline (paragraphs) first
  const paragraphs = trimmed.split(/\n\s*\n/);
  let currentChunk = '';

  for (const para of paragraphs) {
    const candidate = currentChunk ? `${currentChunk}\n\n${para}` : para;
    if (candidate.length <= maxChars) {
      currentChunk = candidate;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      // If a single paragraph is larger than maxChars, split by sentences
      if (para.length > maxChars) {
        // match sentences ending with . ! ? or newline
        const sentences = para.match(/[^.!?\n]+[.!?\n]+/g) || [para];
        let subChunk = '';
        for (const sentence of sentences) {
          const subCandidate = subChunk ? `${subChunk} ${sentence}` : sentence;
          if (subCandidate.length <= maxChars) {
            subChunk = subCandidate;
          } else {
            if (subChunk) {
              chunks.push(subChunk.trim());
            }
            if (sentence.length > maxChars) {
              // Word level fallback
              const words = sentence.split(/\s+/);
              let wordChunk = '';
              for (const word of words) {
                if ((wordChunk + ' ' + word).length <= maxChars) {
                  wordChunk = wordChunk ? `${wordChunk} ${word}` : word;
                } else {
                  if (wordChunk) chunks.push(wordChunk.trim());
                  wordChunk = word;
                }
              }
              subChunk = wordChunk;
            } else {
              subChunk = sentence;
            }
          }
        }
        if (subChunk) {
          currentChunk = subChunk;
        }
      } else {
        currentChunk = para;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
