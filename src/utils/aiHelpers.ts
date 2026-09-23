import { GoogleGenAI, Modality } from "@google/genai";

export const defaultAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const bufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const BLANK_FALLBACK_BASE64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

export const normalizeErrorMessage = (error: any, defaultMsg: string): string => {
  if (!error) return defaultMsg;
  let rawString = '';
  if (typeof error === 'string') {
    rawString = error;
  } else if (error instanceof Error && error.message) {
    rawString = error.message;
  } else if (typeof error === 'object') {
    if (typeof error.message === 'string') {
      rawString = error.message;
    } else if (typeof error.error === 'string') {
      rawString = error.error;
    } else if (error.error && typeof error.error === 'object' && error.error.message) {
      rawString = error.error.message;
    } else if (error.statusText) {
      rawString = `Error ${error.status || ''}: ${error.statusText}`;
    }
  }

  if (rawString.includes('{"error"') || (rawString.startsWith('{') && rawString.endsWith('}'))) {
    try {
      const parsed = JSON.parse(rawString);
      if (parsed?.error?.message) {
        rawString = parsed.error.message;
      } else if (parsed?.message) {
        rawString = parsed.message;
      }
    } catch {
      // ignore
    }
  }

  if (!rawString) return defaultMsg;

  if (
    rawString.includes('429') ||
    rawString.includes('RESOURCE_EXHAUSTED') ||
    rawString.includes('Quota exceeded') ||
    rawString.includes('quota') ||
    rawString.includes('rate-limits')
  ) {
    return 'Batas kuota gratis Google AI Studio sementara tercapai (Rate Limit 429). Silakan tunggu ~40 detik untuk coba lagi, atau beralih ke provider KIE.ai Gateway pada menu Kunci API.';
  }

  if (
    rawString.includes('503') ||
    rawString.includes('UNAVAILABLE') ||
    rawString.includes('high demand') ||
    rawString.includes('overloaded')
  ) {
    return 'Layanan AI sedang mengalami antrean padat (503 / High Demand). Silakan coba beberapa saat lagi atau gunakan KIE.ai Gateway.';
  }

  return rawString;
};

export const callGeminiTextWithFallback = async (
  contents: any,
  fallbackModels: string[] = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'],
  clientInstance: GoogleGenAI = defaultAI
) => {
  let lastError: any = null;

  for (const model of fallbackModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await clientInstance.models.generateContent({
          model,
          contents,
        });
        if (response && response.text) {
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = normalizeErrorMessage(err, '');
        console.warn(`[Gemini API] Model ${model} attempt ${attempt + 1} failed:`, errMsg);

        const isTransient = 
          errMsg.includes('503') || 
          errMsg.includes('429') || 
          errMsg.includes('UNAVAILABLE') || 
          errMsg.includes('RESOURCE_EXHAUSTED') || 
          errMsg.includes('high demand') ||
          errMsg.includes('overloaded') ||
          errMsg.includes('Rate Limit');

        if (isTransient && attempt < 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        } else {
          break;
        }
      }
    }
  }

  throw lastError || new Error("Layanan AI sedang sibuk sementara. Silakan coba beberapa saat lagi.");
};

export const optimizeImageForAI = async (
  input: string | File | Blob | any
): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  let dataUrl = '';

  try {
    if (!input) {
      return { inlineData: { data: BLANK_FALLBACK_BASE64, mimeType: 'image/jpeg' } };
    }

    if (typeof input === 'object') {
      if (input.dataUrl && typeof input.dataUrl === 'string') {
        dataUrl = input.dataUrl;
      } else if (input.src && typeof input.src === 'string') {
        dataUrl = input.src;
      } else if (input.file && (input.file instanceof Blob || typeof input.file.arrayBuffer === 'function')) {
        input = input.file;
      }
    }

    if (!dataUrl) {
      if (input instanceof Blob || (input && typeof input.arrayBuffer === 'function')) {
        try {
          const buf = await input.arrayBuffer();
          if (buf && buf.byteLength > 0) {
            const mime = input.type || 'image/jpeg';
            const b64 = bufferToBase64(buf);
            dataUrl = `data:${mime};base64,${b64}`;
          }
        } catch {
          // fallback
        }

        if (!dataUrl) {
          try {
            dataUrl = await new Promise<string>((res) => {
              const reader = new FileReader();
              reader.onload = () => res((reader.result as string) || '');
              reader.onerror = () => res('');
              reader.onabort = () => res('');
              reader.readAsDataURL(input);
            });
          } catch {
            dataUrl = '';
          }
        }
      } else if (typeof input === 'string') {
        if (input.startsWith('data:')) {
          dataUrl = input;
        } else if (input.startsWith('blob:') || input.startsWith('http://') || input.startsWith('https://')) {
          try {
            const resp = await fetch(input);
            const buf = await resp.arrayBuffer();
            if (buf && buf.byteLength > 0) {
              const mime = resp.headers.get('content-type') || 'image/jpeg';
              dataUrl = `data:${mime};base64,${bufferToBase64(buf)}`;
            }
          } catch {
            dataUrl = input;
          }
        } else {
          dataUrl = input;
        }
      }
    }
  } catch (err) {
    console.warn("Error reading image input, falling back:", err);
  }

  if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0]?.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64 = parts[1];

    if (base64 && base64.length > 20) {
      try {
        const optimized = await new Promise<{ data: string; mimeType: string } | null>((res) => {
          const img = new Image();
          const timer = setTimeout(() => res(null), 3000);
          img.onload = () => {
            clearTimeout(timer);
            try {
              const maxDim = 800;
              let width = img.naturalWidth || img.width || 800;
              let height = img.naturalHeight || img.height || 600;
              if (width > maxDim || height > maxDim) {
                if (width > height) {
                  height = Math.max(1, Math.round((height * maxDim) / width));
                  width = maxDim;
                } else {
                  width = Math.max(1, Math.round((width * maxDim) / height));
                  height = maxDim;
                }
              }
              const canvas = document.createElement('canvas');
              canvas.width = Math.max(width, 1);
              canvas.height = Math.max(height, 1);
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const compressed = canvas.toDataURL('image/jpeg', 0.82);
                const compParts = compressed.split(',');
                if (compParts[1] && compParts[1].length > 20) {
                  res({ data: compParts[1], mimeType: 'image/jpeg' });
                  return;
                }
              }
            } catch {
              // ignore
            }
            res(null);
          };
          img.onerror = () => {
            clearTimeout(timer);
            res(null);
          };
          img.src = dataUrl;
        });

        if (optimized) {
          return { inlineData: optimized };
        }
      } catch {
        // use raw base64
      }

      return {
        inlineData: {
          data: base64,
          mimeType,
        }
      };
    }
  }

  return {
    inlineData: {
      data: BLANK_FALLBACK_BASE64,
      mimeType: 'image/jpeg',
    }
  };
};

export const executeUnifiedAIGeneration = async (
  prompt: string,
  imageParts: { inlineData: { data: string; mimeType: string } }[],
  provider: 'google' | 'kie',
  kieModel: string,
  kieApiKey: string,
  googleApiKey: string,
  onRequireKeyModal?: () => void
): Promise<{ text: string }> => {
  if (provider === 'kie') {
    if (!kieApiKey || !kieApiKey.trim()) {
      if (onRequireKeyModal) onRequireKeyModal();
      throw new Error("Kunci API KIE.ai belum dimasukkan. Silakan isi API Key Anda pada pengaturan API Key.");
    }

    const payloadImages = imageParts.map(p => ({
      base64: p.inlineData.data,
      mimeType: p.inlineData.mimeType || 'image/jpeg',
    }));

    const res = await fetch('/api/kie-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: kieApiKey.trim(),
        modelType: kieModel,
        prompt,
        images: payloadImages,
      }),
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      const textErr = await res.text().catch(() => '');
      throw new Error(`KIE AI Response Error (${res.status}): ${textErr || 'Respon tidak valid'}`);
    }

    if (!res.ok || data.error) {
      throw new Error(data.error || `KIE AI Error (${res.status})`);
    }

    return { text: data.text || '' };
  } else {
    const client = googleApiKey && googleApiKey.trim()
      ? new GoogleGenAI({ apiKey: googleApiKey.trim() })
      : defaultAI;

    const contents = [{ parts: [{ text: prompt }, ...imageParts] }];
    const res = await callGeminiTextWithFallback(
      contents,
      ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'],
      client
    );
    return { text: res.text || '' };
  }
};

export const callGeminiTTSWithRetry = async (text: string, voiceName: string, client: GoogleGenAI = defaultAI) => {
  const ttsModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
  let lastError: any = null;

  for (const model of ttsModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: [{ parts: [{ text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errStr = (err?.message || '') + ' ' + JSON.stringify(err);
        console.warn(`[Gemini TTS] Model ${model} Attempt ${attempt + 1} failed:`, err?.message || err);
        const isTransient = 
          errStr.includes('503') || 
          errStr.includes('429') || 
          errStr.includes('UNAVAILABLE') || 
          errStr.includes('RESOURCE_EXHAUSTED') || 
          errStr.includes('high demand');
        if (isTransient && attempt < 1) {
          await new Promise(r => setTimeout(r, 1200));
          continue;
        }
        break;
      }
    }
  }
  throw lastError || new Error("Gagal memproses suara TTS. Silakan coba sesaat lagi.");
};

export const parseBatchParagraphs = (rawText: string, expectedCount: number): string[] => {
  const regex = /(?:(?:^|\n)(?:\[(?:Gambar|Panel|Paragraf)?\s*(\d+)\]|(?:\b(?:Gambar|Panel|Paragraf)\s*(\d+)[:.-])|(\d+)[\.\)]))\s*([\s\S]*?)(?=(?:(?:^|\n)(?:\[(?:Gambar|Panel|Paragraf)?\s*\d+\]|(?:\b(?:Gambar|Panel|Paragraf)\s*\d+[:.-])|\d+[\.\)]))|$)/gi;
  
  const parsed: { index: number; text: string }[] = [];
  let match;
  while ((match = regex.exec(rawText)) !== null) {
    const idx = parseInt(match[1] || match[2] || match[3], 10);
    const content = (match[4] || '').trim();
    if (!isNaN(idx) && content) {
      parsed.push({ index: idx, text: content });
    }
  }

  if (parsed.length >= expectedCount) {
    return parsed.slice(0, expectedCount).map(p => p.text);
  }

  const rawParagraphs = rawText
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0 && !p.toLowerCase().startsWith('berikut') && !p.toLowerCase().startsWith('analisis'));

  if (rawParagraphs.length >= expectedCount) {
    return rawParagraphs.slice(0, expectedCount);
  }

  const result: string[] = [];
  for (let i = 0; i < expectedCount; i++) {
    if (parsed[i]) {
      result.push(parsed[i].text);
    } else if (rawParagraphs[i]) {
      result.push(rawParagraphs[i]);
    } else {
      result.push(rawText.trim());
    }
  }
  return result;
};
