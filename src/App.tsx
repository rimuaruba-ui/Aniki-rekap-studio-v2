import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import JSZip from 'jszip';
import { 
  Upload, Scissors, FileText, Download, Play, Trash2, Loader2, 
  Volume2, Home as HomeIcon, LayoutGrid, Info, Settings, Images, 
  Maximize2, FileImage, Copy, Check, Sparkles, RefreshCw, Layers,
  ListOrdered, AlignLeft, Eye, EyeOff, ArrowRight, Key, ExternalLink,
  ShieldCheck, Cpu, Globe, X, FileAudio, Music, Split, Combine,
  VolumeX, Pause, FastForward
} from 'lucide-react';
import { 
  base64ToArrayBuffer, 
  pcm16ToMp3Blob, 
  pcmToWavBlob, 
  mergePcmBuffers, 
  splitTextIntoChunks 
} from './utils/audioMp3';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const KIE_MODELS = [
  {
    id: 'gemini-3-6-flash' as const,
    name: 'Gemini 3.6 Flash',
    badge: 'Stream Native',
    desc: 'Model flagship mutakhir dari KIE.ai dengan kecepatan tinggi dan konsistensi alur cerita sangat baik.',
    endpoint: 'https://api.kie.ai/gemini/v1/models/gemini-3-6-flash:streamGenerateContent',
  },
  {
    id: 'gemini-3.1-pro' as const,
    name: 'Gemini 3.1 Pro',
    badge: 'OpenAI Chat',
    desc: 'Model Pro penalaran tinggi untuk komik kompleks dengan deskripsi adegan mendalam.',
    endpoint: 'https://api.kie.ai/gemini-3.1-pro/v1/chat/completions',
  },
  {
    id: 'gemini-3-5-flash' as const,
    name: 'Gemini 3.5 Flash',
    badge: 'Stream Native',
    desc: 'Model cepat dan efisien cocok untuk naskah komik panjang dengan banyak gambar.',
    endpoint: 'https://api.kie.ai/gemini/v1/models/gemini-3-5-flash:streamGenerateContent',
  },
  {
    id: 'gemini-3-pro' as const,
    name: 'Gemini 3 Pro',
    badge: 'OpenAI Chat',
    desc: 'Model Pro standar dengan kualitas penceritaan yang seimbang dan kaya.',
    endpoint: 'https://api.kie.ai/gemini-3-pro/v1/chat/completions',
  },
];

const VOICES = [
  { name: 'Aoede (Perempuan - Elegan & Natural)', value: 'Aoede', gender: 'female' },
  { name: 'Kore (Laki-laki - Tegas & Mantap)', value: 'Kore', gender: 'male' },
  { name: 'Orus (Laki-laki - Berwibawa & Dalam)', value: 'Orus', gender: 'male' },
  { name: 'Puck (Laki-laki - Ceria & Dinamis)', value: 'Puck', gender: 'male' },
  { name: 'Fenrir (Laki-laki - Berat & Sinematik)', value: 'Fenrir', gender: 'male' },
  { name: 'Charon (Laki-laki - Misterius & Tenang)', value: 'Charon', gender: 'male' },
  { name: 'Zephyr (Perempuan - Tenang & Lembut)', value: 'Zephyr', gender: 'female' },
  { name: 'Leda (Perempuan - Muda & Hidup)', value: 'Leda', gender: 'female' },
  { name: 'Achird (Perempuan - Ramah & Hangat)', value: 'Achird', gender: 'female' },
];

export interface TtsPart {
  id: string;
  partNumber: number;
  text: string;
  charCount: number;
  isGenerating: boolean;
  pcmData: Int16Array | null;
  sampleRate: number;
  mp3Url: string | null;
  mp3Blob: Blob | null;
  error: string | null;
}

interface PanelData {
  id: number;
  startY: number;
  imageSrc: string;
  script: string;
  voice: string;
  audioUrl: string | null;
  mp3Blob?: Blob | null;
  pcmData?: Int16Array | null;
  isGeneratingScript: boolean;
  isGeneratingAudio: boolean;
  error: string | null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'manhwa-tool' | 'extend-image' | 'tts-tool' | 'manga-script'>('home');
  
  // AI Provider & API Key Configuration State
  const [selectedProvider, setSelectedProvider] = useState<'google' | 'kie'>(() => {
    return (localStorage.getItem('ai_provider') as 'google' | 'kie') || 'google';
  });
  const [selectedKieModel, setSelectedKieModel] = useState<'gemini-3-6-flash' | 'gemini-3-pro' | 'gemini-3.1-pro' | 'gemini-3-5-flash'>(() => {
    return (localStorage.getItem('kie_model') as any) || 'gemini-3-6-flash';
  });
  const [kieApiKey, setKieApiKey] = useState<string>(() => localStorage.getItem('kie_api_key') || '');
  const [googleApiKey, setGoogleApiKey] = useState<string>(() => localStorage.getItem('google_api_key') || '');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [showKieKey, setShowKieKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [apiKeySaveToast, setApiKeySaveToast] = useState(false);

  const saveApiSettings = (newProvider?: 'google' | 'kie', newKieModel?: any, newKieKey?: string, newGoogleKey?: string) => {
    const p = newProvider !== undefined ? newProvider : selectedProvider;
    const km = newKieModel !== undefined ? newKieModel : selectedKieModel;
    const kk = newKieKey !== undefined ? newKieKey : kieApiKey;
    const gk = newGoogleKey !== undefined ? newGoogleKey : googleApiKey;

    localStorage.setItem('ai_provider', p);
    localStorage.setItem('kie_model', km);
    localStorage.setItem('kie_api_key', kk);
    localStorage.setItem('google_api_key', gk);

    setSelectedProvider(p);
    setSelectedKieModel(km);
    setKieApiKey(kk);
    setGoogleApiKey(gk);

    setApiKeySaveToast(true);
    setTimeout(() => setApiKeySaveToast(false), 3000);
  };

  // Manga Script Tool State
  const [mangaPanels, setMangaPanels] = useState<{ id: string; src: string; file?: File; dataUrl?: string }[]>([]);
  const [generatedMangaScript, setGeneratedMangaScript] = useState('');
  const [isGeneratingMangaScript, setIsGeneratingMangaScript] = useState(false);
  const [mangaScriptProgress, setMangaScriptProgress] = useState<{ currentBatch: number; totalBatches: number; status: string } | null>(null);
  const [mangaScriptError, setMangaScriptError] = useState<string | null>(null);
  const [mangaBatchError, setMangaBatchError] = useState<{ failedBatchIndex: number; totalBatches: number; errorMessage: string } | null>(null);
  const [mangaMaxWords, setMangaMaxWords] = useState(1000);
  const [mangaNarrationStyle, setMangaNarrationStyle] = useState<'baku' | 'santai'>('santai');
  const [mangaIncludeHook, setMangaIncludeHook] = useState(true);
  const [mangaIncludeClosing, setMangaIncludeClosing] = useState(true);
  const [mangaCopied, setMangaCopied] = useState(false);
  const isMangaCancelledRef = useRef<boolean>(false);
  const mangaAccumulatorRef = useRef<string[]>([]);

  // Manhwa Tool State
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [splitPoints, setSplitPoints] = useState<number[]>([0]);
  const [panels, setPanels] = useState<PanelData[]>([]);
  const [hiddenPanels, setHiddenPanels] = useState<number[]>([]);
  const [show169Guide, setShow169Guide] = useState(false);
  const [manhwaNarrationStyle, setManhwaNarrationStyle] = useState<'santai' | 'dramatis' | 'baku'>('santai');
  const [isBatchGeneratingManhwa, setIsBatchGeneratingManhwa] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ currentBatch: number; totalBatches: number; processedCount: number; totalCount: number; currentPanelRange: string } | null>(null);
  const [manhwaBatchError, setManhwaBatchError] = useState<{ failedBatchIndex: number; totalBatches: number; errorMessage: string } | null>(null);
  const [mergedCopied, setMergedCopied] = useState(false);
  const [readingOrder, setReadingOrder] = useState<'webtoon' | 'manga'>('webtoon'); // webtoon (Top-to-Bottom) or manga (Right-to-Left)
  const [mergedScriptCustom, setMergedScriptCustom] = useState<string>('');
  const [isCustomMergedEdited, setIsCustomMergedEdited] = useState(false);
  const isBatchManhwaCancelledRef = useRef<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasWidth = 800;

  // Multi-Part & Multi-Engine TTS Studio State
  const [ttsText, setTtsText] = useState('');
  const [ttsParts, setTtsParts] = useState<TtsPart[]>([]);
  const [ttsVoice, setTtsVoice] = useState(VOICES[0].value);
  const [ttsEngine, setTtsEngine] = useState<'gemini' | 'browser'>('gemini');
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedBrowserVoice, setSelectedBrowserVoice] = useState<string>('');
  const [browserSpeed, setBrowserSpeed] = useState<number>(1.0);
  const [browserPitch, setBrowserPitch] = useState<number>(1.0);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [isGeneratingBatchTTS, setIsGeneratingBatchTTS] = useState(false);
  const [isMergingAllParts, setIsMergingAllParts] = useState(false);
  const [mergedFullMp3Url, setMergedFullMp3Url] = useState<string | null>(null);
  const [mergedFullMp3Blob, setMergedFullMp3Blob] = useState<Blob | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [activePlayingPartId, setActivePlayingPartId] = useState<string | null>(null);
  const isTtsBatchCancelledRef = useRef<boolean>(false);

  // Initialize Web Speech API Voices (Speechma Free Mode)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setBrowserVoices(voices);
        if (voices.length > 0) {
          const idVoice = voices.find(v => v.lang.startsWith('id') || v.lang.includes('ID'));
          if (idVoice) {
            setSelectedBrowserVoice(`${idVoice.name}||${idVoice.lang}`);
          } else if (!selectedBrowserVoice) {
            setSelectedBrowserVoice(`${voices[0].name}||${voices[0].lang}`);
          }
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Synchronize and auto-split text into parts <= 2500 chars whenever ttsText changes
  useEffect(() => {
    const trimmed = ttsText.trim();
    if (!trimmed) {
      setTtsParts([]);
      setMergedFullMp3Url(null);
      setMergedFullMp3Blob(null);
      return;
    }

    const chunks = splitTextIntoChunks(trimmed, 2500);
    setTtsParts(prevParts => {
      return chunks.map((chunk, index) => {
        const partNumber = index + 1;
        const existing = prevParts.find(p => p.partNumber === partNumber && p.text === chunk);
        return {
          id: existing?.id || `part_${Date.now()}_${index}`,
          partNumber,
          text: chunk,
          charCount: chunk.length,
          isGenerating: existing?.isGenerating || false,
          pcmData: existing?.pcmData || null,
          sampleRate: existing?.sampleRate || 24000,
          mp3Url: existing?.mp3Url || null,
          mp3Blob: existing?.mp3Blob || null,
          error: null,
        };
      });
    });
  }, [ttsText]);

  // Extend Image State
  const [extendImage, setExtendImage] = useState<string | null>(null);
  const [extendedResult, setExtendedResult] = useState<string | null>(null);
  const [isExtending, setIsExtending] = useState(false);
  const [extendPrompt, setExtendPrompt] = useState('Extend this image into a cinematic 16:9 widescreen format. Use your AI imagination to expand the background and environment naturally while maintaining the exact same art style, lighting, and characters. The final result must be a high-quality 16:9 landscape image.');

  // Handle Multi / Single Image Upload for Manhwa Tool
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 200) {
      alert("Maksimal upload adalah 200 gambar sekaligus.");
      return;
    }

    if (files.length === 1) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setOriginalImage(img);
          setSplitPoints([0]);
          setPanels([]);
          setIsCustomMergedEdited(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      // Multi-upload for Manhwa Tool
      setOriginalImage(null);
      setSplitPoints([0]);
      setIsCustomMergedEdited(false);
      
      const filesArray = Array.from(files) as File[];
      const newPanelsData = await Promise.all(filesArray.map((file: File) => {
        return new Promise<{src: string, type: string}>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve({ src: ev.target?.result as string, type: file.type });
          reader.readAsDataURL(file);
        });
      }));

      const newPanels: PanelData[] = newPanelsData.map((data, index) => ({
        id: index + 1,
        startY: -1 - index,
        imageSrc: data.src,
        script: '',
        voice: VOICES[0].value,
        audioUrl: null,
        isGeneratingScript: false,
        isGeneratingAudio: false,
        error: null
      }));
      setPanels(newPanels);
    }
  };

  // Draw Canvas for Long Strip Splitting
  useEffect(() => {
    if (originalImage && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const aspectRatio = originalImage.height / originalImage.width;
        canvas.width = Math.min(originalImage.width, canvasWidth);
        canvas.height = canvas.width * aspectRatio;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);

        splitPoints.forEach(y => {
          if (y > 0) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
          }
        });

        if (show169Guide) {
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 2;
          const guideHeight = canvas.width * (9 / 16);
          for (let y = 0; y < canvas.height; y += guideHeight) {
            ctx.beginPath();
            ctx.moveTo(0, y + guideHeight);
            ctx.lineTo(canvas.width, y + guideHeight);
            ctx.stroke();
          }
        }
      }
      updatePanels();
    }
  }, [originalImage, splitPoints, hiddenPanels]);

  const updatePanels = () => {
    if (!originalImage || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const finalPoints = [...splitPoints, canvas.height].sort((a, b) => a - b);
    const newPanels: PanelData[] = [];

    let visibleCounter = 1;
    for (let i = 0; i < finalPoints.length - 1; i++) {
      const startY = finalPoints[i];
      const endY = finalPoints[i + 1];
      const height = endY - startY;

      if (height <= 5) continue;
      if (hiddenPanels.includes(startY)) continue;

      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCanvas.width = canvas.width;
        tempCanvas.height = height;
        
        const scale = originalImage.width / canvas.width;
        tempCtx.drawImage(
          originalImage,
          0, startY * scale,
          originalImage.width, height * scale,
          0, 0,
          canvas.width, height
        );

        const panelImageSrc = tempCanvas.toDataURL();
        
        const existingPanel = panels.find(p => Math.abs(p.startY - startY) < 1);
        newPanels.push({
          id: visibleCounter++,
          startY: startY,
          imageSrc: panelImageSrc,
          script: existingPanel?.script || '',
          voice: existingPanel?.voice || VOICES[0].value,
          audioUrl: existingPanel?.audioUrl || null,
          isGeneratingScript: false,
          isGeneratingAudio: false,
          error: null
        });
      }
    }
    setPanels(newPanels);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;

    if (!splitPoints.includes(y)) {
      setSplitPoints(prev => [...prev, y].sort((a, b) => a - b));
    }
  };

  const resetSplits = () => {
    setSplitPoints([0]);
    setPanels([]);
    setHiddenPanels([]);
    setIsCustomMergedEdited(false);
  };

  const hidePanel = (startY: number) => {
    setHiddenPanels(prev => [...prev, startY]);
    if (!originalImage) {
      setPanels(prev => prev.filter(p => p.startY !== startY));
    }
  };

// Helper to safely extract clean error message from any error/event
const normalizeErrorMessage = (error: any, defaultMsg: string): string => {
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

  // Try parsing JSON if rawString contains a serialized error
  if (rawString.includes('{"error"') || (rawString.startsWith('{') && rawString.endsWith('}'))) {
    try {
      const parsed = JSON.parse(rawString);
      if (parsed?.error?.message) {
        rawString = parsed.error.message;
      } else if (parsed?.message) {
        rawString = parsed.message;
      }
    } catch {
      // not pure json
    }
  }

  if (!rawString) return defaultMsg;

  // Detect quota exhaustion (429 / RESOURCE_EXHAUSTED)
  if (
    rawString.includes('429') ||
    rawString.includes('RESOURCE_EXHAUSTED') ||
    rawString.includes('Quota exceeded') ||
    rawString.includes('quota') ||
    rawString.includes('rate-limits')
  ) {
    return 'Batas kuota gratis Google AI Studio sementara tercapai (Rate Limit 429). Silakan tunggu ~40 detik untuk coba lagi, atau beralih ke provider KIE.ai Gateway pada menu Kunci API.';
  }

  // Detect server overloaded (503 / UNAVAILABLE)
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

// Helper for robust Gemini text generation with retry & fallback models (handles 503/429 spikes)
const callGeminiTextWithFallback = async (
  contents: any,
  fallbackModels: string[] = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'],
  clientInstance: GoogleGenAI = ai
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
          // Switch to next fallback model immediately
          break;
        }
      }
    }
  }

  throw lastError || new Error("Layanan AI sedang sibuk sementara. Silakan coba beberapa saat lagi.");
};

  // Unified AI Generation Router (Google AI Studio vs KIE.ai 4 Endpoints)
  const executeUnifiedAIGeneration = async (
    prompt: string,
    imageParts: { inlineData: { data: string; mimeType: string } }[]
  ): Promise<{ text: string }> => {
    if (selectedProvider === 'kie') {
      if (!kieApiKey || !kieApiKey.trim()) {
        setIsApiKeyModalOpen(true);
        throw new Error("Kunci API KIE.ai belum dimasukkan. Silakan isi API Key Anda pada jendela Pengaturan API Key yang terbuka.");
      }

      const payloadImages = imageParts.map(p => ({
        base64: p.inlineData.data,
        mimeType: p.inlineData.mimeType || 'image/jpeg',
      }));

      let res: Response;
      try {
        res = await fetch('/api/kie-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: kieApiKey.trim(),
            modelType: selectedKieModel,
            prompt,
            images: payloadImages,
          }),
        });
      } catch (networkErr: any) {
        throw new Error(`Gagal terhubung ke proxy KIE AI: ${normalizeErrorMessage(networkErr, 'Koneksi jaringan terputus')}`);
      }

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
      // Google AI Studio
      const client = googleApiKey && googleApiKey.trim()
        ? new GoogleGenAI({ apiKey: googleApiKey.trim() })
        : ai;

      const contents = [{ parts: [{ text: prompt }, ...imageParts] }];
      const res = await callGeminiTextWithFallback(
        contents,
        ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'],
        client
      );
      return { text: res.text || '' };
    }
  };

// Helper to convert ArrayBuffer to Base64 safely
const bufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// 1x1 Blank Fallback JPEG Base64
const BLANK_FALLBACK_BASE64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

// Helper to optimize and compress image before sending to Gemini API to prevent 503 overload and payload issues
const optimizeImageForAI = async (
  input: string | File | Blob | any
): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  // Step 1: Extract dataUrl or raw base64 from whatever input was provided
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
          // fallback to FileReader
        }

        if (!dataUrl) {
          try {
            dataUrl = await new Promise<string>((res, rej) => {
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

  // If dataUrl already has a valid base64 payload
  if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0]?.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64 = parts[1];

    if (base64 && base64.length > 20) {
      // Try optional downscaling to prevent token payload explosion
      try {
        const optimized = await new Promise<{ data: string; mimeType: string } | null>((res) => {
          const img = new Image();
          const timer = setTimeout(() => res(null), 3000); // 3s timeout
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

  // If input is an external or blob URL that couldn't be fetched
  if (typeof dataUrl === 'string' && dataUrl.length > 0) {
    try {
      const rendered = await new Promise<{ data: string; mimeType: string } | null>((res) => {
        const img = new Image();
        if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
          img.crossOrigin = "anonymous";
        }
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

      if (rendered) {
        return { inlineData: rendered };
      }
    } catch {
      // fallback
    }
  }

  // Final fallback safe placeholder so batch generation never crashes
  return {
    inlineData: {
      data: BLANK_FALLBACK_BASE64,
      mimeType: 'image/jpeg',
    }
  };
};

// Helper for TTS audio generation with retry & model fallback
const callGeminiTTSWithRetry = async (text: string, voiceName: string) => {
  const ttsModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
  let lastError: any = null;

  for (const model of ttsModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ parts: [{ text: text }] }],
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

// Helper to convert base64 image data for Gemini API
  const getPanelInlineData = (imageSrc: string) => {
    const parts = imageSrc.split(',');
    const mimeMatch = parts[0]?.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const base64Data = parts[1] || '';
    return {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    };
  };

  // Parse structured paragraph response from AI
  const parseBatchParagraphs = (rawText: string, expectedCount: number): string[] => {
    // Try to match [1], [2] or 1., 2. or PARAGRAF 1: patterns
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

    // Fallback: Split by double newlines if explicit markers weren't strictly formatted
    const rawParagraphs = rawText
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0 && !p.toLowerCase().startsWith('berikut') && !p.toLowerCase().startsWith('analisis'));

    if (rawParagraphs.length >= expectedCount) {
      return rawParagraphs.slice(0, expectedCount);
    }

    // Second fallback: If fewer paragraphs returned, pad or slice
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

  // Cancel Handlers (Instant UI release)
  const handleCancelBatchManhwa = () => {
    isBatchManhwaCancelledRef.current = true;
    setIsBatchGeneratingManhwa(false);
    setBatchProgress(null);
    setPanels(prev => prev.map(p => ({ ...p, isGeneratingScript: false })));
  };

  const handleCancelBatchManga = () => {
    isMangaCancelledRef.current = true;
    setIsGeneratingMangaScript(false);
    setMangaScriptProgress(null);
    setMangaBatchError({
      failedBatchIndex: mangaScriptProgress?.currentBatch ? Math.max(0, mangaScriptProgress.currentBatch - 1) : 0,
      totalBatches: Math.ceil(mangaPanels.length / 6) || 1,
      errorMessage: "Pemrosesan naskah manga telah dihentikan. Naskah yang sudah selesai tetap tersimpan."
    });
  };

  // BATCH GENERATION ENGINE (BATCH SIZE = 6, STRICT CONTINUITY & 1 IMAGE = 1 PARAGRAPH)
  const generateAllPanelsBatch = async (fromBatchIndex: number = 0) => {
    if (panels.length === 0) return;
    setIsBatchGeneratingManhwa(true);
    setManhwaBatchError(null);
    isBatchManhwaCancelledRef.current = false;
    
    const BATCH_SIZE = 6;
    const totalPanels = panels.length;
    const totalBatches = Math.ceil(totalPanels / BATCH_SIZE);

    const updatedPanels = [...panels];

    // Build cumulative context from previously generated panels if continuing
    let cumulativeStoryContext = "";
    if (fromBatchIndex > 0) {
      const precedingPanels = updatedPanels.slice(0, fromBatchIndex * BATCH_SIZE);
      cumulativeStoryContext = precedingPanels
        .map(p => p.script.trim())
        .filter(Boolean)
        .join('\n');
    }

    let currentBatchRunning = fromBatchIndex;

    try {
      for (let batchIndex = fromBatchIndex; batchIndex < totalBatches; batchIndex++) {
        currentBatchRunning = batchIndex;

        // Check if user requested cancellation
        if (isBatchManhwaCancelledRef.current) {
          setManhwaBatchError({
            failedBatchIndex: batchIndex,
            totalBatches,
            errorMessage: `Pemrosesan batch dihentikan pada Batch ${batchIndex + 1} dari ${totalBatches}. Naskah yang sudah selesai tetap tersimpan.`
          });
          break;
        }

        const startIdx = batchIndex * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, totalPanels);
        const currentBatchPanels = updatedPanels.slice(startIdx, endIdx);
        const batchImageCount = currentBatchPanels.length;

        setBatchProgress({
          currentBatch: batchIndex + 1,
          totalBatches,
          processedCount: startIdx,
          totalCount: totalPanels,
          currentPanelRange: `Panel #${startIdx + 1} s/d #${endIdx}`
        });

        // Mark current batch panels as generating in UI
        setPanels(prev => prev.map((p, idx) => (idx >= startIdx && idx < endIdx) ? { ...p, isGeneratingScript: true, error: null } : p));

        // Prepare optimized image parts for this batch to prevent payload/503 overload
        const imageParts = await Promise.all(currentBatchPanels.map(p => optimizeImageForAI(p.imageSrc)));

        if (isBatchManhwaCancelledRef.current) {
          setManhwaBatchError({
            failedBatchIndex: batchIndex,
            totalBatches,
            errorMessage: `Pemrosesan batch dihentikan pada Batch ${batchIndex + 1} dari ${totalBatches}. Naskah yang sudah selesai tetap tersimpan.`
          });
          break;
        }

        const styleInstruction = manhwaNarrationStyle === 'santai'
          ? `Gaya narasi SANTAI, RECAP GAUL YOUTUBE/TIKTOK (Gunakan bahasa lu-gua yang ekspresif, asik, hidup, mengalir seru seperti sedang menceritakan kembali manga/manhwa viral).`
          : manhwaNarrationStyle === 'dramatis'
          ? `Gaya narasi SANGAT DRAMATIS & SINEMATIK (Gunakan bahasa puitis, intens, penuh emosi dan ketegangan alur cerita laga/fantasi).`
          : `Gaya narasi BAKU & FORMAL (Bahasa Indonesia EYD yang rapi, elegan, jelas dan deskriptif).`;

        const readingOrderRule = readingOrder === 'manga'
          ? `PENTING: Urutan gambar dalam batch ini mengikuti format MANGA (Kanan ke Kiri / Right-to-Left). Analisis panel secara berurutan dari 1 sampai ${batchImageCount}.`
          : `PENTING: Urutan gambar dalam batch ini mengikuti format WEBTOON / MANHWA (Atas ke Bawah / Kronologis). Analisis panel secara berurutan dari 1 sampai ${batchImageCount}.`;

        const contextSection = cumulativeStoryContext.trim()
          ? `KONTEKS CERITA SEBELUMNYA (JANGAN DIULANG, LANJUTKAN SECARA NYAMBUNG):\n"""\n${cumulativeStoryContext.slice(-1200)}\n"""\n`
          : `Ini adalah AWAL DARI CERITA (Batch Pertama).\n`;

        const prompt = `
Anda adalah Narator Ahli Recap Cerita Komik / Manhwa / Manga Profesional.

TUGAS UTAMA:
Buat narasi cerita yang SANGAT BERKESINAMBUNGAN (SEAMLESS STORY FLOW) untuk ${batchImageCount} gambar panel yang diberikan dalam batch ini (Gambar #${startIdx + 1} sampai Gambar #${endIdx}).

${readingOrderRule}
${styleInstruction}

${contextSection}

ATURAN SANGAT KETAT & WAJIB DIPATUHI:
1. ATURAN 1 GAMBAR = 1 PARAGRAF: Anda HARUS menghasilkan TEPAT ${batchImageCount} PARAGRAF untuk batch ini!
   - Paragraf 1 menjelaskan kejadian pada Gambar 1 (Panel #${startIdx + 1}).
   - Paragraf 2 melanjutkan alur kejadian pada Gambar 2 (Panel #${startIdx + 2}).
   ... dan seterusnya sampai Gambar ${batchImageCount} (Panel #${endIdx}).
2. JANGAN LOMPAT-LOMPAT & JANGAN BERBELIT-BELIT: Ceritakan kronologis adegan demi adegan secara teratur dan berurutan sesuai gambar.
3. KONEKSI ANTAR BATCH: Naskah pada Gambar 1 di batch ini WAJIB menyambung secara alami dan mulus dari akhir cerita sebelumnya tanpa mengulang cerita lama dan tanpa patah alur.
4. FORMAT OUTPUT WAJIB:
   Tuliskan setiap paragraf dengan penomoran jelas:
   [Panel ${startIdx + 1}] (Isi narasi 2-4 kalimat untuk panel ini...)
   [Panel ${startIdx + 2}] (Isi narasi 2-4 kalimat lanjutan untuk panel ini...)
   ...hingga [Panel ${endIdx}]
5. DILARANG KERAS menyertakan kata pengantar seperti "Berikut naskahnya:", "Analisis panel:", atau penjelasan tambahan apapun. Langsung berikan hasil teks narasi per panel.
        `.trim();

        const response = await executeUnifiedAIGeneration(prompt, imageParts);

        const rawResult = response.text || '';
        const parsedParagraphs = parseBatchParagraphs(rawResult, batchImageCount);

        // Assign to panels and update cumulative context
        for (let i = 0; i < batchImageCount; i++) {
          const panelGlobalIdx = startIdx + i;
          const paragraphText = parsedParagraphs[i] || `Adegan pada panel ${panelGlobalIdx + 1}.`;
          updatedPanels[panelGlobalIdx].script = paragraphText;
          updatedPanels[panelGlobalIdx].isGeneratingScript = false;
          cumulativeStoryContext += `\n${paragraphText}`;
        }

        // Update state progressively so user sees real-time progress
        setPanels([...updatedPanels]);
      }
    } catch (error: any) {
      console.error("Batch script generation error:", error);
      const rawMsg = normalizeErrorMessage(error, `Gagal memproses Batch ${currentBatchRunning + 1} dari ${totalBatches}.`);
      const userFriendlyMsg = rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('high demand')
        ? `Server AI sedang mengalami antrean tinggi pada Batch ${currentBatchRunning + 1} dari ${totalBatches}. Naskah yang sudah digenerate sebelumnya tetap tersimpan aman.`
        : rawMsg;
      
      setManhwaBatchError({
        failedBatchIndex: currentBatchRunning,
        totalBatches,
        errorMessage: userFriendlyMsg
      });
    } finally {
      setIsBatchGeneratingManhwa(false);
      setBatchProgress(null);
      setPanels(prev => prev.map(p => ({ ...p, isGeneratingScript: false })));
    }
  };

  // Generate Single Panel Script with full preceding context
  const generateScript = async (panelId: number) => {
    const panelIdx = panels.findIndex(p => p.id === panelId);
    if (panelIdx === -1) return;
    const panel = panels[panelIdx];

    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, isGeneratingScript: true, error: null } : p));

    try {
      // Gather previous scripts as continuous context
      const precedingScripts = panels
        .slice(0, panelIdx)
        .map(p => p.script.trim())
        .filter(Boolean);

      const previousContext = precedingScripts.length > 0
        ? `Konteks cerita sebelumnya:\n"""\n${precedingScripts.slice(-3).join('\n')}\n"""\n`
        : `Ini adalah adegan pembuka cerita.\n`;

      const styleDesc = manhwaNarrationStyle === 'santai'
        ? 'Gaya narasi santai, lu-gua, gaya recap komik YouTube yang asik dan dinamis.'
        : manhwaNarrationStyle === 'dramatis'
        ? 'Gaya narasi sinematik dramatis, penuh emosi, dan berbobot.'
        : 'Gaya narasi baku, EYD, dan elegan.';

      const prompt = `
Tugas: Buat TEPAT 1 PARAGRAF narasi alur cerita (2-4 kalimat) untuk adegan panel komik ini.
${previousContext}
GAYA: ${styleDesc}

ATURAN:
1. Langsung tulis naskah narasi yang menyambung alur cerita dari konteks sebelumnya secara mulus.
2. Fokus langsung ke aksi, ekspresi karakter, dan alur adegan di gambar ini.
3. JANGAN tulis kata pengantar seperti "Berikut adalah..." atau label seperti "Panel:". Murni 1 paragraf narasi siap baca.
      `.trim();

      const imagePart = await optimizeImageForAI(panel.imageSrc);

      const response = await executeUnifiedAIGeneration(prompt, [imagePart]);

      const generatedText = (response.text || '').replace(/^\[Panel\s*\d+\]\s*/i, '').trim();
      setPanels(prev => prev.map(p => p.id === panelId ? { ...p, script: generatedText, isGeneratingScript: false } : p));
    } catch (error: any) {
      console.error("Error generating single script:", error);
      setPanels(prev => prev.map(p => p.id === panelId ? { ...p, error: error.message, isGeneratingScript: false } : p));
    }
  };

  // Generate Audio for Single Panel (Manhwa Studio - now outputs MP3)
  const generateAudio = async (panelId: number) => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel || !panel.script.trim()) return;

    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, isGeneratingAudio: true, error: null } : p));

    try {
      const response = await callGeminiTTSWithRetry(
        `Ucapkan dengan intonasi dan emosi yang sesuai: ${panel.script}`,
        panel.voice
      );

      const part = response.candidates?.[0]?.content?.parts?.[0];
      const audioData = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType;

      if (!audioData) throw new Error("Respon API audio tidak valid.");
      
      let sampleRate = 24000;
      if (mimeType) {
        const sampleRateMatch = mimeType.match(/rate=(\d+)/);
        if (sampleRateMatch) sampleRate = parseInt(sampleRateMatch[1], 10);
      }
      
      const pcmData = base64ToArrayBuffer(audioData);
      const pcm16 = new Int16Array(pcmData);
      const mp3Blob = pcm16ToMp3Blob(pcm16, 1, sampleRate, 128);
      const audioUrl = URL.createObjectURL(mp3Blob);
      
      setPanels(prev => prev.map(p => p.id === panelId ? { ...p, audioUrl, mp3Blob, pcmData: pcm16, isGeneratingAudio: false } : p));
    } catch (error: any) {
      console.error("Error generating audio:", error);
      setPanels(prev => prev.map(p => p.id === panelId ? { ...p, error: error.message, isGeneratingAudio: false } : p));
    }
  };

  // Browser Speech Synthesis (100% Free / Speechma Mode)
  const playBrowserSpeech = (text: string, partId?: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert("Browser Anda tidak mendukung Web Speech API.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = browserSpeed;
    utterance.pitch = browserPitch;

    if (selectedBrowserVoice) {
      const [vName, vLang] = selectedBrowserVoice.split('||');
      const v = browserVoices.find(voice => voice.name === vName && (!vLang || voice.lang === vLang)) || browserVoices.find(voice => voice.name === selectedBrowserVoice);
      if (v) utterance.voice = v;
    }

    if (partId) {
      setActivePlayingPartId(partId);
      utterance.onend = () => setActivePlayingPartId(null);
      utterance.onerror = () => setActivePlayingPartId(null);
    }

    window.speechSynthesis.speak(utterance);
  };

  const stopBrowserSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setActivePlayingPartId(null);
    }
  };

  // Generate Single Part Audio in TTS Studio (Outputs MP3)
  const generateSinglePartTTS = async (partIndex: number) => {
    const part = ttsParts[partIndex];
    if (!part || !part.text.trim()) return;

    setTtsParts(prev => prev.map((p, idx) => idx === partIndex ? { ...p, isGenerating: true, error: null } : p));
    setTtsError(null);

    try {
      if (ttsEngine === 'browser') {
        playBrowserSpeech(part.text, part.id);
        setTtsParts(prev => prev.map((p, idx) => idx === partIndex ? { ...p, isGenerating: false } : p));
        return;
      }

      const response = await callGeminiTTSWithRetry(part.text, ttsVoice);

      const candidate = response.candidates?.[0]?.content?.parts?.[0];
      const audioData = candidate?.inlineData?.data;
      const mimeType = candidate?.inlineData?.mimeType;

      if (!audioData) throw new Error("Respon API audio tidak valid.");

      let sampleRate = 24000;
      if (mimeType) {
        const sampleRateMatch = mimeType.match(/rate=(\d+)/);
        if (sampleRateMatch) sampleRate = parseInt(sampleRateMatch[1], 10);
      }

      const pcmData = base64ToArrayBuffer(audioData);
      const pcm16 = new Int16Array(pcmData);
      const mp3Blob = pcm16ToMp3Blob(pcm16, 1, sampleRate, 128);
      const mp3Url = URL.createObjectURL(mp3Blob);

      setTtsParts(prev => prev.map((p, idx) => idx === partIndex ? {
        ...p,
        isGenerating: false,
        pcmData: pcm16,
        sampleRate,
        mp3Blob,
        mp3Url,
        error: null,
      } : p));
    } catch (error: any) {
      console.error(`Error generating TTS Part ${partIndex + 1}:`, error);
      const msg = error?.message || 'Gagal menghasilkan audio untuk bagian ini.';
      setTtsParts(prev => prev.map((p, idx) => idx === partIndex ? { ...p, isGenerating: false, error: msg } : p));
    }
  };

  // Generate All Parts TTS Sequentially
  const generateAllTtsParts = async () => {
    if (ttsParts.length === 0) return;
    setIsGeneratingBatchTTS(true);
    isTtsBatchCancelledRef.current = false;
    setTtsError(null);

    try {
      for (let i = 0; i < ttsParts.length; i++) {
        if (isTtsBatchCancelledRef.current) break;
        await generateSinglePartTTS(i);
        // Short pause between calls
        if (i < ttsParts.length - 1) {
          await new Promise(r => setTimeout(r, 600));
        }
      }
    } catch (err: any) {
      console.error("Error generating all TTS parts:", err);
      setTtsError(err?.message || "Terjadi kesalahan saat memproses semua bagian audio.");
    } finally {
      setIsGeneratingBatchTTS(false);
    }
  };

  const handleCancelTtsBatch = () => {
    isTtsBatchCancelledRef.current = true;
    setIsGeneratingBatchTTS(false);
    setTtsParts(prev => prev.map(p => ({ ...p, isGenerating: false })));
  };

  // Merge All Generated Audio Parts into 1 Unified MP3
  const mergeAllTtsAudioParts = () => {
    const readyParts = ttsParts.filter(p => p.pcmData && p.pcmData.length > 0);

    if (readyParts.length === 0) {
      alert("Belum ada bagian audio yang selesai dibuat. Hasilkan suara pada part terlebih dahulu.");
      return;
    }

    if (readyParts.length < ttsParts.length) {
      const confirmMerge = window.confirm(
        `Perhatian: Baru ${readyParts.length} dari ${ttsParts.length} bagian yang sudah memiliki audio. Lanjutkan penggabungan audio yang sudah ada?`
      );
      if (!confirmMerge) return;
    }

    setIsMergingAllParts(true);
    try {
      const pcmBuffers: Int16Array[] = readyParts.map(p => p.pcmData!);
      const sampleRate = readyParts[0].sampleRate || 24000;

      // Merge PCM buffers with 0.25s silence gap between parts
      const mergedPcm = mergePcmBuffers(pcmBuffers, 0.25, sampleRate);
      const mergedMp3 = pcm16ToMp3Blob(mergedPcm, 1, sampleRate, 128);

      if (mergedFullMp3Url) {
        URL.revokeObjectURL(mergedFullMp3Url);
      }

      const newUrl = URL.createObjectURL(mergedMp3);
      setMergedFullMp3Blob(mergedMp3);
      setMergedFullMp3Url(newUrl);

      showSyncToast(`✓ Berhasil menggabungkan ${readyParts.length} bagian menjadi 1 file MP3 utuh!`);
    } catch (err: any) {
      console.error("Error merging audio parts:", err);
      alert("Gagal menggabungkan audio: " + (err?.message || err));
    } finally {
      setIsMergingAllParts(false);
    }
  };

  // Update specific part text
  const updatePartText = (partIndex: number, newText: string) => {
    setTtsParts(prev => prev.map((p, idx) => {
      if (idx === partIndex) {
        return {
          ...p,
          text: newText,
          charCount: newText.length,
          // If text changed, mark audio as stale
          mp3Url: p.text === newText ? p.mp3Url : null,
          mp3Blob: p.text === newText ? p.mp3Blob : null,
          pcmData: p.text === newText ? p.pcmData : null,
        };
      }
      return p;
    }));
  };

  // Manga Script Functions (with batch continuity)
  const handleMangaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (files.length + mangaPanels.length > 200) {
        alert("Maksimal total adalah 200 gambar.");
        return;
      }
      const filesArray = Array.from(files);
      const newPanels = filesArray.map((file: File) => {
        const id = Math.random().toString(36).substr(2, 9);
        const src = URL.createObjectURL(file);
        return {
          id,
          src,
          file,
        };
      });

      setMangaPanels(prev => [...prev, ...newPanels]);

      // Pre-convert to dataUrl in background to prevent detached file handles
      filesArray.forEach((file: File, index: number) => {
        const panelId = newPanels[index]?.id;
        if (!panelId) return;

        if (typeof file.arrayBuffer === 'function') {
          file.arrayBuffer().then((buf: ArrayBuffer) => {
            if (buf && buf.byteLength > 0) {
              const mime = file.type || 'image/jpeg';
              const b64 = bufferToBase64(buf);
              const dataUrl = `data:${mime};base64,${b64}`;
              setMangaPanels(current => current.map(p => p.id === panelId ? { ...p, dataUrl } : p));
            }
          }).catch(() => {
            // fallback
          });
        }
      });
    }
  };

  const removeMangaPanel = (id: string) => {
    setMangaPanels(prev => {
      const filtered = prev.filter(p => p.id !== id);
      const removed = prev.find(p => p.id === id);
      if (removed) URL.revokeObjectURL(removed.src);
      return filtered;
    });
  };

  const generateMangaScript = async (fromBatchIndex: number = 0) => {
    if (mangaPanels.length === 0) return;
    setIsGeneratingMangaScript(true);
    setMangaScriptError(null);
    setMangaBatchError(null);
    isMangaCancelledRef.current = false;

    if (fromBatchIndex === 0) {
      mangaAccumulatorRef.current = [];
      setGeneratedMangaScript('');
    }

    const BATCH_SIZE = 6;
    const totalPanels = mangaPanels.length;
    const totalBatches = Math.ceil(totalPanels / BATCH_SIZE);
    let fullScriptAccumulator: string[] = [...mangaAccumulatorRef.current];
    let currentRunningBatch = fromBatchIndex;

    try {
      for (let b = fromBatchIndex; b < totalBatches; b++) {
        currentRunningBatch = b;

        if (isMangaCancelledRef.current) {
          setMangaBatchError({
            failedBatchIndex: b,
            totalBatches,
            errorMessage: `Pemrosesan naskah manga dihentikan pada Batch ${b + 1} dari ${totalBatches}. Naskah sebelumnya tetap tersimpan.`
          });
          break;
        }

        const start = b * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, totalPanels);
        const batchPanels = mangaPanels.slice(start, end);

        setMangaScriptProgress({
          currentBatch: b + 1,
          totalBatches,
          status: `Memproses Batch ${b + 1}/${totalBatches} (Panel #${start + 1} s/d #${end})...`
        });

        const imageParts = await Promise.all(batchPanels.map((panel) => optimizeImageForAI(panel)));

        if (isMangaCancelledRef.current) {
          setMangaBatchError({
            failedBatchIndex: b,
            totalBatches,
            errorMessage: `Pemrosesan naskah manga dihentikan pada Batch ${b + 1} dari ${totalBatches}. Naskah sebelumnya tetap tersimpan.`
          });
          break;
        }

        const isFirstBatch = b === 0;
        const isLastBatch = b === totalBatches - 1;
        const previousContext = fullScriptAccumulator.length > 0
          ? `ALUR CERITA SEBELUMNYA:\n"""\n${fullScriptAccumulator.slice(-3).join('\n\n')}\n"""\n`
          : `Ini adalah batch awal cerita.\n`;

        const prompt = `
Analisis ${batchPanels.length} gambar panel manga berikut ini (Panel #${start + 1} sampai #${end}).
Urutan baca manga: KANAN KE KIRI (Right to Left).

${previousContext}

TUGAS:
Buat TEPAT ${batchPanels.length} paragraf narasi alur cerita berurutan (1 gambar = 1 paragraf) yang saling menyambung mulus dengan cerita sebelumnya.

GAYA NARASI: ${mangaNarrationStyle === 'santai' ? 'SANTAI / RECAP GAUL YOUTUBE (Gunakan lu, gua, seru dan mengalir)' : 'BAKU & FORMAL (Bahasa Indonesia EYD yang rapi)'}

${isFirstBatch && mangaIncludeHook ? 'Di awal paragraf pertama, berikan kalimat hook pembuka yang menarik perhatian pendengar.' : ''}
${isLastBatch && mangaIncludeClosing ? 'Di akhir paragraf terakhir, berikan kalimat penutup outro yang membuat penonton penasaran untuk kelanjutannya.' : ''}

ATURAN:
1. Buat TEPAT ${batchPanels.length} paragraf berurutan:
   [1] Narasi untuk gambar 1
   [2] Narasi untuk gambar 2
   ...hingga [${batchPanels.length}]
2. Naskah harus to the point langsung cerita tanpa kata pengantar ("Berikut ini...", "Analisis:", dll).
        `.trim();

        const response = await executeUnifiedAIGeneration(prompt, imageParts);

        const batchText = response.text || '';
        const parsed = parseBatchParagraphs(batchText, batchPanels.length);
        fullScriptAccumulator.push(...parsed);
        mangaAccumulatorRef.current = fullScriptAccumulator;
        setGeneratedMangaScript(fullScriptAccumulator.join('\n\n'));
      }
    } catch (error: any) {
      console.error("Error generating manga script:", error);
      const rawMsg = normalizeErrorMessage(error, `Gagal membuat naskah manga pada Batch ${currentRunningBatch + 1} dari ${totalBatches}.`);
      const msg = rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('high demand')
        ? `Server AI sedang dalam antrean tinggi pada Batch ${currentRunningBatch + 1} dari ${totalBatches}. Naskah yang sudah digenerate sebelumnya tetap aman tersimpan.`
        : rawMsg;
      
      setMangaBatchError({
        failedBatchIndex: currentRunningBatch,
        totalBatches,
        errorMessage: msg
      });
      setMangaScriptError(msg);
    } finally {
      setIsGeneratingMangaScript(false);
      setMangaScriptProgress(null);
    }
  };

  // Download all images as ZIP
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const downloadAllImages = async () => {
    if (panels.length === 0) return;
    setIsDownloadingAll(true);
    try {
      const zip = new JSZip();
      panels.forEach((panel) => {
        const base64Data = panel.imageSrc.split(',')[1];
        zip.file(`panel_${panel.id}.png`, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'semua_panel_komik.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Error generating zip:', err);
      alert('Gagal mengunduh gambar. Silakan coba lagi.');
    } finally {
      setIsDownloadingAll(false);
    }
  };

  // Compute merged script
  const computedMergedScript = panels
    .map((p, idx) => p.script.trim() || `[Panel #${p.id}: Belum ada naskah]`)
    .join('\n\n');

  const activeMergedScriptText = isCustomMergedEdited ? mergedScriptCustom : computedMergedScript;
  
  // Character count statistics
  const totalCharsWithSpaces = activeMergedScriptText.length;
  const totalCharsWithoutSpaces = activeMergedScriptText.replace(/\s+/g, '').length;
  const totalWords = activeMergedScriptText.trim() ? activeMergedScriptText.trim().split(/\s+/).length : 0;
  const totalParagraphsCount = activeMergedScriptText.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

  const handleCopyMergedScript = () => {
    if (!activeMergedScriptText.trim()) return;
    navigator.clipboard.writeText(activeMergedScriptText);
    setMergedCopied(true);
    setTimeout(() => setMergedCopied(false), 2500);
  };

  const exportScript = () => {
    let fullScript = `ALUR CERITA KOMIK / MANHWA\n==============================\nTotal Panel: ${panels.length}\nTotal Karakter (Tanpa Spasi): ${totalCharsWithoutSpaces}\nTotal Kata: ${totalWords}\n==============================\n\n`;
    panels.forEach((panel) => {
      fullScript += `PANEL #${panel.id}\n------------------------------\n${panel.script || '(Belum ada naskah)'}\n\n`;
    });
    const blob = new Blob([fullScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'naskah_alur_cerita_komik.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Sync Notification Toast between Studios
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);
  const showSyncToast = (msg: string) => {
    setSyncToastMessage(msg);
    setTimeout(() => setSyncToastMessage(null), 3500);
  };

  // Cross-Studio Bridge: Manga -> Manhwa Studio (Batch 6 & Per-Panel Voiceover)
  const transferMangaToManhwaStudio = () => {
    if (mangaPanels.length === 0) {
      alert("Belum ada panel manga yang diunggah di Studio Manga.");
      return;
    }

    const scriptParagraphs = mangaAccumulatorRef.current.length > 0 
      ? mangaAccumulatorRef.current 
      : (generatedMangaScript ? generatedMangaScript.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean) : []);

    const newPanels: PanelData[] = mangaPanels.map((mp, index) => {
      return {
        id: index + 1,
        startY: index * 100,
        height: 100,
        imageSrc: mp.dataUrl || mp.src,
        script: scriptParagraphs[index] || '',
        voice: 'Aoede',
        isGeneratingScript: false,
        isGeneratingAudio: false,
      };
    });

    setOriginalImage(null);
    setPanels(newPanels);
    if (generatedMangaScript) {
      setMergedScriptCustom(generatedMangaScript);
      setIsCustomMergedEdited(false);
    }
    setActiveTab('manhwa');
    showSyncToast(`✓ Berhasil memindahkan ${newPanels.length} panel & naskah manga ke Studio Manhwa!`);
  };

  // Cross-Studio Bridge: Manhwa -> Manga Studio (Batch RTL Analysis)
  const transferManhwaToMangaStudio = () => {
    if (panels.length === 0) {
      alert("Belum ada panel di Studio Manhwa. Unggah gambar manhwa terlebih dahulu.");
      return;
    }

    const newMangaPanels = panels.map((p) => ({
      id: Math.random().toString(36).substr(2, 9),
      src: p.imageSrc,
      dataUrl: p.imageSrc.startsWith('data:') ? p.imageSrc : undefined,
    }));

    setMangaPanels(newMangaPanels);
    if (activeMergedScriptText.trim()) {
      setGeneratedMangaScript(activeMergedScriptText);
      mangaAccumulatorRef.current = panels.map(p => p.script.trim()).filter(Boolean);
    }
    setActiveTab('manga-script');
    showSyncToast(`✓ Berhasil memindahkan ${newMangaPanels.length} panel dari Manhwa ke Studio Manga!`);
  };

  // Cross-Studio Bridge: Manga -> TTS Studio
  const transferMangaToTTSStudio = () => {
    if (!generatedMangaScript.trim()) {
      alert("Naskah manga masih kosong. Silakan generate naskah manga terlebih dahulu.");
      return;
    }
    setTtsText(generatedMangaScript);
    setActiveTab('tts');
    showSyncToast('✓ Naskah manga siap diproses menjadi Voiceover Audio di TTS Studio!');
  };

  // Cross-Studio Bridge: Manhwa -> TTS Studio
  const transferManhwaToTTSStudio = () => {
    if (!activeMergedScriptText.trim()) {
      alert("Naskah manhwa masih kosong. Silakan generate naskah terlebih dahulu.");
      return;
    }
    setTtsText(activeMergedScriptText);
    setActiveTab('tts');
    showSyncToast('✓ Naskah manhwa siap diproses menjadi Voiceover Audio di TTS Studio!');
  };

  // Export Manga Script TXT
  const exportMangaScriptTxt = () => {
    if (!generatedMangaScript.trim()) return;
    const fullScript = `NASKAH ALUR CERITA MANGA (RTL)\n==============================\nTotal Panel: ${mangaPanels.length}\nTotal Karakter (Tanpa Spasi): ${generatedMangaScript.replace(/\s+/g, '').length}\nTotal Kata: ${generatedMangaScript.trim().split(/\s+/).length}\n==============================\n\n${generatedMangaScript}`;
    const blob = new Blob([fullScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'naskah_alur_cerita_manga.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExtendUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setExtendImage(event.target?.result as string);
        setExtendedResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const processExtend = async () => {
    if (!extendImage) return;
    setIsExtending(true);
    try {
      const base64Data = extendImage.split(',')[1];
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'image/png' } },
            { text: extendPrompt }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: '16:9'
          }
        }
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setExtendedResult(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (err) {
      console.error('Error extending image:', err);
      alert('Gagal memproses perpanjangan gambar. Silakan coba kembali.');
    } finally {
      setIsExtending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans flex flex-col md:flex-row antialiased relative">
      {/* Floating Sync Notification */}
      {syncToastMessage && (
        <div className="fixed top-5 right-5 z-50 max-w-md bg-gray-900 border border-emerald-500/50 text-emerald-300 text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2.5 shadow-emerald-500/10">
          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{syncToastMessage}</span>
        </div>
      )}

      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-gray-900 border-r border-gray-800 h-screen sticky top-0">
        <div className="p-6 flex flex-col items-center space-y-4 border-b border-gray-800">
          <div className="flex items-center space-x-3 w-full">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20">
              <LayoutGrid className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-black text-white tracking-tight block">AniKi Recap</span>
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Story Studio AI</span>
            </div>
          </div>
          <button 
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
              } else {
                document.exitFullscreen();
              }
            }}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition-all border border-gray-700 hover:border-gray-600"
          >
            <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Mode Layar Penuh</span>
          </button>
        </div>
        
        <div className="flex-grow p-4 space-y-1.5 overflow-y-auto">
          <button
            onClick={() => setActiveTab('home')}
            className={`w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center space-x-3 ${
              activeTab === 'home' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <HomeIcon className="w-4 h-4" />
            <span>Beranda</span>
          </button>
          
          <button
            onClick={() => setActiveTab('manhwa-tool')}
            className={`w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-between ${
              activeTab === 'manhwa-tool' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Scissors className="w-4 h-4" />
              <span>Alur Cerita Manhwa</span>
            </div>
            <span className="text-[10px] bg-blue-500/30 text-blue-200 px-1.5 py-0.5 rounded font-mono font-bold">Batch 6</span>
          </button>

          <button
            onClick={() => setActiveTab('manga-script')}
            className={`w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center space-x-3 ${
              activeTab === 'manga-script' ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30 font-bold' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <FileImage className="w-4 h-4" />
            <span>Naskah Manga RTL</span>
          </button>

          <button
            onClick={() => setActiveTab('extend-image')}
            className={`w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center space-x-3 ${
              activeTab === 'extend-image' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-bold' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Maximize2 className="w-4 h-4" />
            <span>Extend Gambar (16:9)</span>
          </button>

          <button
            onClick={() => setActiveTab('tts-tool')}
            className={`w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center space-x-3 ${
              activeTab === 'tts-tool' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30 font-bold' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>Fitur Suara (TTS)</span>
          </button>

          <div className="pt-2">
            <button
              onClick={() => setIsApiKeyModalOpen(true)}
              className="w-full px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-blue-500/10 hover:from-amber-500/20 hover:to-blue-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-400 shadow cursor-pointer group"
            >
              <div className="flex items-center space-x-2.5">
                <Key className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
                <span>Kunci API & Model</span>
              </div>
              <span className="text-[10px] bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded-full font-mono font-bold">
                {selectedProvider === 'kie' ? 'KIE.ai' : 'Google'}
              </span>
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-gray-800">
          <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 text-xs text-gray-400 space-y-1">
            <p className="font-bold text-gray-300 flex items-center justify-between">
              <span className="flex items-center">
                <Sparkles className="w-3.5 h-3.5 text-blue-400 mr-1.5" />
                Model Aktif
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">
                {selectedProvider === 'kie' 
                  ? KIE_MODELS.find(m => m.id === selectedKieModel)?.name 
                  : 'Gemini Flash'}
              </span>
            </p>
            <p className="text-[11px] text-gray-500">
              {selectedProvider === 'kie' 
                ? 'Terhubung via KIE.ai multi-model endpoint.' 
                : 'Terhubung ke Google AI Studio standard.'}
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <LayoutGrid className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-base font-bold text-white tracking-tight">AniKi Recap Studio</span>
            <span className="text-[10px] text-blue-400 block -mt-1">Batch 6 • Multi-Model</span>
          </div>
        </div>
        <button
          onClick={() => setIsApiKeyModalOpen(true)}
          className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-bold flex items-center space-x-1.5"
        >
          <Key className="w-3.5 h-3.5 text-amber-400" />
          <span>Kunci API</span>
        </button>
      </div>

      <div className="flex-grow flex flex-col overflow-y-auto">
        <div className="flex-grow p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'home' ? (
              <div className="space-y-10 py-6">
                <header className="text-center space-y-5">
                  <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Engine Naskah Multi-Batch 6 Gambar & Penggabung Naskah</span>
                  </div>
                  <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight">
                    Studio Alur Cerita <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Manhwa & Manga AI</span>
                  </h1>
                  <p className="text-base md:text-lg text-gray-400 max-w-2xl mx-auto font-light">
                    Solusi terpadu recap video YouTube & TikTok: upload hingga 200 panel, AI proses per 6 gambar secara berkesinambungan (1 gambar = 1 paragraf), dan gabung naskah lengkap dengan kalkulator karakter instan.
                  </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div 
                    onClick={() => setActiveTab('manhwa-tool')}
                    className="bg-gray-900 p-7 rounded-3xl border border-gray-800 hover:border-blue-500/60 transition-all cursor-pointer group shadow-xl hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                        <Scissors className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-xl font-bold text-white">Alur Cerita Manhwa</h3>
                        <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full">BARU</span>
                      </div>
                      <p className="text-gray-400 text-sm leading-relaxed mb-6">
                        Batch 6 gambar per giliran dengan memori konteks agar naskah tidak melompat. Dilengkapi fitur gabung naskah, hitung karakter tanpa spasi, dan unduh satu klik.
                      </p>
                    </div>
                    <div className="flex items-center text-blue-400 font-bold text-sm">
                      <span>Buka Studio Manhwa</span>
                      <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  <div 
                    onClick={() => setActiveTab('manga-script')}
                    className="bg-gray-900 p-7 rounded-3xl border border-gray-800 hover:border-pink-500/60 transition-all cursor-pointer group shadow-xl hover:shadow-2xl hover:shadow-pink-500/10 flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-12 h-12 bg-pink-500/10 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                        <FileImage className="w-6 h-6 text-pink-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Naskah Manga RTL</h3>
                      <p className="text-gray-400 text-sm leading-relaxed mb-6">
                        Unggah multi-panel manga dengan urutan baca Kanan ke Kiri (Right to Left). Hasilkan alur cerita recap dengan gaya santai atau formal.
                      </p>
                    </div>
                    <div className="flex items-center text-pink-400 font-bold text-sm">
                      <span>Buka Naskah Manga</span>
                      <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  <div 
                    onClick={() => setActiveTab('tts-tool')}
                    className="bg-gray-900 p-7 rounded-3xl border border-gray-800 hover:border-amber-500/60 transition-all cursor-pointer group shadow-xl hover:shadow-2xl hover:shadow-amber-500/10 flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                        <Volume2 className="w-6 h-6 text-amber-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Voiceover Studio (TTS)</h3>
                      <p className="text-gray-400 text-sm leading-relaxed mb-6">
                        Ubah naskah cerita komik menjadi suara voiceover berkualitas studio dengan pilihan vokal pria & wanita yang ekspresif.
                      </p>
                    </div>
                    <div className="flex items-center text-amber-400 font-bold text-sm">
                      <span>Buka Studio Suara</span>
                      <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>

                <section className="bg-gray-900/90 border border-blue-500/20 p-6 md:p-8 rounded-3xl space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-blue-500/10 rounded-2xl">
                      <Info className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-bold text-white">Cara Kerja Alur Cerita Terurut (Batch 6 Gambar & 1 Gambar = 1 Paragraf)</h4>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        Saat Anda mengunggah banyak gambar (misal 20 gambar), sistem membaginya menjadi batch berisi <strong>6 gambar per sesi</strong>. AI menganalisis setiap batch secara berurutan dan menghubungkannya dengan rangkuman naskah dari batch sebelumnya. Dengan formula <strong>1 gambar = 1 paragraf</strong>, alur cerita mengalir teratur tanpa melompat scene atau berbelit-belit!
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            ) : activeTab === 'manhwa-tool' ? (
              <div className="space-y-8">
                {/* Manhwa Tool Header */}
                <header className="text-center space-y-3">
                  <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Mode Batch 6 Gambar • 1 Gambar 1 Paragraf Terurut</span>
                  </div>
                  <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                    Studio Alur Cerita <span className="text-blue-400">Manhwa & Komik</span>
                  </h1>
                  <p className="text-gray-400 max-w-2xl mx-auto text-sm md:text-base font-light">
                    Unggah lembaran panjang (strip) atau banyak file gambar sekaligus. Hasilkan naskah berkesinambungan tanpa lompat scene dan gabungkan seluruh cerita dengan detail karakter instan.
                  </p>
                </header>

                {/* Step 1: Upload */}
                <section className="bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-800 shadow-xl text-center">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="p-4 bg-blue-500/10 rounded-2xl">
                      <Upload className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Langkah 1: Unggah Gambar Manhwa / Komik</h2>
                      <p className="text-gray-400 text-sm max-w-md mx-auto mt-1">
                        Pilih 1 gambar strip panjang untuk dipotong, atau pilih sekaligus hingga 200 file gambar panel komik.
                      </p>
                    </div>
                    
                    {/* Cross-Tool Bridge: Import from Manga */}
                    {mangaPanels.length > 0 && (
                      <div className="p-3 bg-pink-950/40 border border-pink-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                        <div className="flex items-center space-x-2.5">
                          <div className="p-2 bg-pink-500/20 text-pink-300 rounded-xl flex-shrink-0">
                            <FileImage className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">Tersedia {mangaPanels.length} Panel di Studio Manga</p>
                            <p className="text-[11px] text-pink-300/70">Gunakan gambar dari tab Manga secara langsung tanpa upload ulang.</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={transferMangaToManhwaStudio}
                          className="px-3.5 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-pink-600/20 flex-shrink-0 flex items-center space-x-1.5 cursor-pointer active:scale-95"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Gunakan Panel Manga</span>
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap justify-center gap-3 pt-2">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-600/20 flex items-center space-x-2 cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Pilih Gambar (Hingga 200 Panel)</span>
                      </button>

                      {panels.length > 0 && (
                        <button
                          onClick={() => {
                            setPanels([]);
                            setOriginalImage(null);
                            setSplitPoints([0]);
                            setIsCustomMergedEdited(false);
                          }}
                          className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-red-400 hover:text-red-300 font-semibold rounded-xl transition-all border border-gray-700 text-xs flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Kosongkan Gambar</span>
                        </button>
                      )}
                    </div>

                    <input 
                      type="file" 
                      ref={fileInputRef}
                      multiple
                      onChange={handleImageUpload}
                      accept="image/*" 
                      className="hidden"
                    />

                    {panels.length > 0 && (
                      <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
                        <span className="bg-gray-800 px-3 py-1 rounded-full border border-gray-700 text-gray-300 font-mono">
                          Total Panel Terdeteksi: <strong className="text-blue-400">{panels.length}</strong>
                        </span>
                        <span className="bg-blue-950/80 px-3 py-1 rounded-full border border-blue-800/60 text-blue-300 font-mono">
                          Akan Diproses Dalam: <strong className="text-white">{Math.ceil(panels.length / 6)} Batch</strong> (6 gambar/batch)
                        </span>
                      </div>
                    )}
                  </div>
                </section>

                {/* Step 2: Splitter for Long Strip Image */}
                {originalImage && (
                  <section className="bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-800 shadow-xl">
                    <div className="flex flex-col items-center space-y-5">
                      <div className="flex items-center space-x-3">
                        <Scissors className="w-6 h-6 text-blue-400" />
                        <h2 className="text-xl font-bold text-white">Langkah 2: Potong Strip Menjadi Panel</h2>
                      </div>
                      <p className="text-gray-400 text-center text-xs md:text-sm max-w-xl">
                        Klik pada strip gambar untuk menandai garis potong merah antar adegan. Setiap potongan akan menjadi 1 panel mandiri.
                      </p>
                      
                      <div className="flex flex-wrap gap-3">
                        <button 
                          onClick={resetSplits}
                          className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl text-xs border border-gray-700 transition-colors"
                        >
                          Reset Potongan
                        </button>
                        <button 
                          onClick={() => setShow169Guide(!show169Guide)}
                          className={`px-5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 border ${
                            show169Guide ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Panduan Rasio 16:9 {show169Guide ? 'Aktif' : 'Nonaktif'}</span>
                        </button>
                      </div>

                      <div className="relative group max-w-full overflow-x-auto">
                        <canvas 
                          ref={canvasRef}
                          onClick={handleCanvasClick}
                          className="cursor-crosshair rounded-2xl border-2 border-dashed border-gray-700 hover:border-blue-500 transition-colors shadow-2xl mx-auto"
                        />
                      </div>
                    </div>
                  </section>
                )}

                {/* Control Panel: Settings & Batch Generation */}
                {panels.length > 0 && (
                  <section className="bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-800 shadow-xl space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-800">
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center">
                          <Settings className="w-5 h-5 mr-2 text-blue-400" />
                          Pengaturan Alur Cerita & Batch Engine
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">
                          Konfigurasikan gaya penceritaan dan urutan sebelum memulai proses AI.
                        </p>
                      </div>

                      {/* Reading order switch */}
                      <div className="flex items-center space-x-2 bg-gray-950 p-1 rounded-2xl border border-gray-800">
                        <button
                          onClick={() => setReadingOrder('webtoon')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                            readingOrder === 'webtoon' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          <ListOrdered className="w-3.5 h-3.5" />
                          <span>Manhwa / Webtoon</span>
                        </button>
                        <button
                          onClick={() => setReadingOrder('manga')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                            readingOrder === 'manga' ? 'bg-pink-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          <FileImage className="w-3.5 h-3.5" />
                          <span>Manga RTL (Kanan ke Kiri)</span>
                        </button>
                      </div>
                    </div>

                    {/* AI Engine & Model Selector */}
                    <div className="p-4 bg-gradient-to-r from-blue-950/40 via-purple-950/20 to-gray-900 rounded-2xl border border-blue-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                          <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-gray-200">AI Story Engine:</span>
                            <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20">
                              {selectedProvider === 'kie' 
                                ? `KIE.ai • ${KIE_MODELS.find(m => m.id === selectedKieModel)?.name}` 
                                : 'Google AI Studio (Gemini 2.5 Flash)'}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {selectedProvider === 'kie'
                              ? `Endpoint aktif: ${KIE_MODELS.find(m => m.id === selectedKieModel)?.endpoint}`
                              : 'Model bawaan dengan failover otomatis ke model cadangan.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <select
                          value={selectedProvider === 'google' ? 'google' : selectedKieModel}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'google') {
                              saveApiSettings('google', selectedKieModel);
                            } else {
                              saveApiSettings('kie', val as any);
                            }
                          }}
                          className="bg-gray-950 border border-gray-700 text-gray-200 text-xs font-semibold rounded-xl px-3 py-2 focus:border-blue-500 outline-none cursor-pointer"
                        >
                          <optgroup label="Google AI Studio">
                            <option value="google">Google AI Studio (Default SDK)</option>
                          </optgroup>
                          <optgroup label="KIE.ai Multi-Model Gateway">
                            {KIE_MODELS.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.badge})
                              </option>
                            ))}
                          </optgroup>
                        </select>

                        <button
                          onClick={() => setIsApiKeyModalOpen(true)}
                          className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Key className="w-3.5 h-3.5 text-amber-400" />
                          <span>Pengaturan Key</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Gaya Bahasa Narasi</label>
                        <div className="grid grid-cols-3 gap-2 bg-gray-950 p-1.5 rounded-2xl border border-gray-800">
                          <button
                            onClick={() => setManhwaNarrationStyle('santai')}
                            className={`py-2 px-2 text-xs font-bold rounded-xl transition-all ${
                              manhwaNarrationStyle === 'santai' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            Recap Gaul
                          </button>
                          <button
                            onClick={() => setManhwaNarrationStyle('dramatis')}
                            className={`py-2 px-2 text-xs font-bold rounded-xl transition-all ${
                              manhwaNarrationStyle === 'dramatis' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            Dramatis
                          </button>
                          <button
                            onClick={() => setManhwaNarrationStyle('baku')}
                            className={`py-2 px-2 text-xs font-bold rounded-xl transition-all ${
                              manhwaNarrationStyle === 'baku' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            Baku (EYD)
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Metode Pemrosesan</label>
                        <div className="p-3 bg-gray-950 rounded-2xl border border-gray-800 text-xs text-gray-300 flex items-center justify-between">
                          <span>Batching 6 Gambar + Jembatan Memori Cerita</span>
                          <span className="text-emerald-400 font-bold">1 Gambar = 1 Paragraf</span>
                        </div>
                      </div>
                    </div>

                    {/* Batch Generate Button & Progress */}
                    <div className="pt-2 space-y-4">
                      {/* Error & Resume Recovery Banner */}
                      {manhwaBatchError && !isBatchGeneratingManhwa && (
                        <div className="bg-amber-950/40 border-2 border-amber-500/50 p-5 rounded-2xl space-y-4 shadow-xl">
                          <div className="flex items-start space-x-3">
                            <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl flex-shrink-0">
                              <Info className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-sm font-bold text-amber-200 flex items-center gap-2">
                                <span>⚠️ Batch {manhwaBatchError.failedBatchIndex + 1} dari {manhwaBatchError.totalBatches} Terkendala</span>
                              </h4>
                              <p className="text-xs text-amber-300/80 leading-relaxed">
                                {manhwaBatchError.errorMessage}
                              </p>
                              <p className="text-[11px] text-emerald-400 font-semibold">
                                ✓ Naskah dari batch sebelumnya tetap tersimpan dan tidak hilang.
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            <button
                              onClick={() => generateAllPanelsBatch(manhwaBatchError.failedBatchIndex)}
                              className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center space-x-2 cursor-pointer active:scale-95"
                            >
                              <Play className="w-4 h-4 fill-current" />
                              <span>▶️ Lanjutkan Batch ({manhwaBatchError.failedBatchIndex + 1} s/d {manhwaBatchError.totalBatches})</span>
                            </button>

                            <button
                              onClick={() => generateAllPanelsBatch(0)}
                              className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-semibold text-xs rounded-xl transition-all border border-gray-700 flex items-center space-x-2 cursor-pointer"
                            >
                              <RefreshCw className="w-4 h-4" />
                              <span>Mulai Ulang Dari Awal (Batch 1)</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {!isBatchGeneratingManhwa && (!manhwaBatchError || manhwaBatchError.failedBatchIndex === 0) && (
                        <button
                          onClick={() => generateAllPanelsBatch(0)}
                          disabled={isBatchGeneratingManhwa || panels.length === 0}
                          className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-gray-800 disabled:to-gray-800 text-white font-black text-base rounded-2xl transition-all shadow-xl shadow-blue-600/25 flex items-center justify-center space-x-3 cursor-pointer"
                        >
                          <Sparkles className="w-5 h-5 text-amber-300" />
                          <span>🚀 Generate Semua Naskah Otomatis ({panels.length} Panel • Batch 6 Gambar)</span>
                        </button>
                      )}

                      {isBatchGeneratingManhwa && batchProgress && (
                        <div className="bg-blue-950/50 border border-blue-500/30 p-4 rounded-2xl space-y-3 shadow-xl">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-blue-300 flex items-center space-x-2">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                              <span>Batch {batchProgress.currentBatch} dari {batchProgress.totalBatches} ({batchProgress.currentPanelRange})</span>
                            </span>
                            <span className="text-white font-mono">
                              {Math.round((batchProgress.currentBatch / batchProgress.totalBatches) * 100)}%
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500"
                              style={{ width: `${(batchProgress.currentBatch / batchProgress.totalBatches) * 100}%` }}
                            />
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                            <p className="text-[11px] text-gray-400 italic">
                              AI sedang menganalisis 6 gambar batch ini dan merangkai alur cerita berurutan...
                            </p>
                            <button
                              onClick={handleCancelBatchManhwa}
                              className="px-4 py-1.5 bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-1.5 shadow-md shadow-red-600/20 active:scale-95 cursor-pointer self-end sm:self-auto"
                            >
                              <span>Batalkan Pemrosesan</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* FEATURE REQUEST: GABUNG SEMUA NASKAH DENGAN STATS KARAKTER TANPA SPASI */}
                {panels.length > 0 && (
                  <section className="bg-gray-900 rounded-3xl border border-blue-500/30 shadow-2xl p-6 md:p-8 space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-800">
                      <div>
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                            📜
                          </div>
                          <h3 className="text-xl font-bold text-white">Naskah Terpadu (Gabungan Semua Panel)</h3>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Naskah utuh hasil gabungan per panel yang siap dibacakan, di-copy, atau diubah langsung.
                        </p>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={handleCopyMergedScript}
                          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all cursor-pointer ${
                            mergedCopied 
                              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' 
                              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20'
                          }`}
                        >
                          {mergedCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          <span>{mergedCopied ? 'Tersalin ke Clipboard!' : 'Salin Semua Naskah'}</span>
                        </button>

                        <button
                          onClick={exportScript}
                          className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all"
                        >
                          <Download className="w-4 h-4 text-emerald-400" />
                          <span>Unduh File .TXT</span>
                        </button>

                        {isCustomMergedEdited && (
                          <button
                            onClick={() => {
                              setIsCustomMergedEdited(false);
                              setMergedScriptCustom('');
                            }}
                            className="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-amber-400 border border-gray-700 rounded-xl font-medium text-xs flex items-center space-x-1.5"
                            title="Kembalikan ke naskah otomatis per panel"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Sinkron Ulang</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stats Dashboard: Character count without space, with space, words, paragraphs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800 flex flex-col justify-center">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Karakter (Tanpa Spasi)</span>
                        <div className="flex items-baseline space-x-1 mt-1">
                          <span className="text-2xl md:text-3xl font-black text-white font-mono">{totalCharsWithoutSpaces.toLocaleString()}</span>
                          <span className="text-[10px] text-gray-500">huruf</span>
                        </div>
                      </div>

                      <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800 flex flex-col justify-center">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Karakter</span>
                        <div className="flex items-baseline space-x-1 mt-1">
                          <span className="text-2xl md:text-3xl font-black text-gray-300 font-mono">{totalCharsWithSpaces.toLocaleString()}</span>
                          <span className="text-[10px] text-gray-500">karakter</span>
                        </div>
                      </div>

                      <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800 flex flex-col justify-center">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Kata</span>
                        <div className="flex items-baseline space-x-1 mt-1">
                          <span className="text-2xl md:text-3xl font-black text-gray-300 font-mono">{totalWords.toLocaleString()}</span>
                          <span className="text-[10px] text-gray-500">kata</span>
                        </div>
                      </div>

                      <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800 flex flex-col justify-center">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Jumlah Paragraf</span>
                        <div className="flex items-baseline space-x-1 mt-1">
                          <span className="text-2xl md:text-3xl font-black text-emerald-300 font-mono">{totalParagraphsCount}</span>
                          <span className="text-[10px] text-gray-500">/ {panels.length} panel</span>
                        </div>
                      </div>
                    </div>

                    {/* Merged Script Textarea */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Area Naskah Gabungan (Bisa diedit langsung):</span>
                        {isCustomMergedEdited && (
                          <span className="text-amber-400 text-[11px] font-bold">● Naskah telah dimodifikasi secara manual</span>
                        )}
                      </div>
                      <textarea
                        value={activeMergedScriptText}
                        onChange={(e) => {
                          setIsCustomMergedEdited(true);
                          setMergedScriptCustom(e.target.value);
                        }}
                        placeholder="Naskah gabungan dari semua panel akan tampil di sini setelah Anda generate naskah..."
                        rows={10}
                        className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-sm text-gray-200 leading-relaxed focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-light resize-y custom-scrollbar"
                      />
                    </div>
                  </section>
                )}

                {/* Step 3: Per-Panel Scripting & Voiceover Cards */}
                {panels.length > 0 && (
                  <section className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-blue-400" />
                        <h2 className="text-xl font-bold text-white">Naskah Per Panel & Voiceover ({panels.length} Panel)</h2>
                      </div>
                      <span className="text-xs text-gray-400">1 Panel = 1 Paragraf Terurut</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {panels.map((panel, index) => (
                        <div key={panel.id} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden flex flex-col hover:border-gray-700 transition-all group">
                          <div className="relative bg-black flex items-center justify-center min-h-[160px] max-h-[220px] overflow-hidden">
                            <img 
                              src={panel.imageSrc} 
                              alt={`Panel ${panel.id}`} 
                              className="w-full h-full object-contain"
                            />
                            <div className="absolute top-3 left-3 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                              Panel #{panel.id}
                            </div>
                            <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md text-[10px] text-gray-300 px-2 py-0.5 rounded font-mono">
                              Paragraf {panel.id}
                            </div>
                          </div>
                          
                          <div className="p-4 flex-grow flex flex-col space-y-3">
                            <div className="flex justify-between items-center text-xs">
                              <a 
                                href={panel.imageSrc} 
                                download={`panel_${panel.id}.png`}
                                className="text-gray-400 hover:text-blue-400 flex items-center space-x-1"
                              >
                                <Download className="w-3 h-3" />
                                <span>Unduh Gambar</span>
                              </a>
                              <button 
                                onClick={() => hidePanel(panel.startY)}
                                className="text-red-400 hover:text-red-300 flex items-center space-x-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Hapus</span>
                              </button>
                            </div>

                            <textarea 
                              value={panel.script}
                              onChange={(e) => {
                                setPanels(prev => prev.map(p => p.id === panel.id ? { ...p, script: e.target.value } : p));
                                setIsCustomMergedEdited(false);
                              }}
                              placeholder={`Tulis narasi untuk adegan panel #${panel.id}...`}
                              className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none min-h-[100px] leading-relaxed"
                            />

                            <button 
                              onClick={() => generateScript(panel.id)}
                              disabled={panel.isGeneratingScript || isBatchGeneratingManhwa}
                              className="w-full py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800/50 text-blue-400 hover:text-blue-300 text-xs font-semibold rounded-xl border border-gray-700 transition-all flex items-center justify-center space-x-1.5"
                            >
                              {panel.isGeneratingScript ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                              )}
                              <span>{panel.isGeneratingScript ? 'Menyusun Cerita...' : 'Buat Naskah Panel Ini'}</span>
                            </button>

                            <div className="pt-3 border-t border-gray-800 flex flex-col space-y-2">
                              <div className="flex items-center space-x-2">
                                <select 
                                  value={panel.voice}
                                  onChange={(e) => setPanels(prev => prev.map(p => p.id === panel.id ? { ...p, voice: e.target.value } : p))}
                                  className="flex-grow bg-gray-950 border border-gray-800 rounded-lg p-2 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  {VOICES.map(v => (
                                    <option key={v.value} value={v.value}>{v.name}</option>
                                  ))}
                                </select>
                                <button 
                                  onClick={() => generateAudio(panel.id)}
                                  disabled={panel.isGeneratingAudio || !panel.script.trim()}
                                  className="p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white rounded-lg transition-all"
                                  title="Generate Audio Suara"
                                >
                                  {panel.isGeneratingAudio ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Volume2 className="w-4 h-4" />
                                  )}
                                </button>
                              </div>

                              {panel.audioUrl && (
                                <audio controls src={panel.audioUrl} className="w-full h-8" />
                              )}

                              {panel.error && (
                                <p className="text-red-400 text-[10px] text-center italic">
                                  {panel.error}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Step 4: Export & Inter-Studio Integration Section */}
                {panels.length > 0 && (
                  <section className="bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-800 shadow-xl space-y-5">
                    <div className="text-center space-y-1">
                      <h2 className="text-xl font-bold text-white">Ekspor & Hubungkan ke Studio Lain</h2>
                      <p className="text-xs text-gray-400">Gunakan naskah dan panel ini di studio Manga atau buat voiceover langsung di TTS Studio.</p>
                    </div>

                    {/* Quick Studio Bridges */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        onClick={transferManhwaToMangaStudio}
                        className="p-3.5 bg-gradient-to-r from-pink-950/50 to-pink-900/30 hover:from-pink-900/60 hover:to-pink-800/40 border border-pink-500/40 rounded-2xl flex items-center justify-between text-left transition-all group cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-pink-500/20 text-pink-300 rounded-xl group-hover:scale-110 transition-transform">
                            <FileImage className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">Buka di Studio Manga (RTL)</p>
                            <p className="text-[10px] text-pink-300/70">Kirim {panels.length} panel & naskah ke Studio Manga</p>
                          </div>
                        </div>
                        <span className="text-xs text-pink-400 font-bold">Buka →</span>
                      </button>

                      <button
                        type="button"
                        onClick={transferManhwaToTTSStudio}
                        className="p-3.5 bg-gradient-to-r from-amber-950/50 to-amber-900/30 hover:from-amber-900/60 hover:to-amber-800/40 border border-amber-500/40 rounded-2xl flex items-center justify-between text-left transition-all group cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl group-hover:scale-110 transition-transform">
                            <Volume2 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">Buat Voiceover di TTS Studio</p>
                            <p className="text-[10px] text-amber-300/70">Ubah gabungan naskah menjadi audio WAV</p>
                          </div>
                        </div>
                        <span className="text-xs text-amber-400 font-bold">Buka →</span>
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3 border-t border-gray-800">
                      <button 
                        onClick={exportScript}
                        className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 cursor-pointer text-xs md:text-sm"
                      >
                        <Download className="w-4 h-4" />
                        <span>Unduh Naskah Alur Cerita (.TXT)</span>
                      </button>
                      
                      <button 
                        onClick={downloadAllImages}
                        disabled={isDownloadingAll}
                        className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center space-x-2 cursor-pointer text-xs md:text-sm"
                      >
                        {isDownloadingAll ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Images className="w-4 h-4" />
                        )}
                        <span>{isDownloadingAll ? 'Mengemas ZIP...' : 'Unduh Semua Gambar (ZIP)'}</span>
                      </button>
                    </div>
                  </section>
                )}
              </div>
            ) : activeTab === 'manga-script' ? (
              <div className="space-y-8 py-4">
                <header className="text-center space-y-3">
                  <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-bold">
                    <FileImage className="w-3.5 h-3.5" />
                    <span>Mode Multi-Batch Manga RTL</span>
                  </div>
                  <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                    Multi-Panel <span className="text-pink-400">Manga Script Studio</span>
                  </h1>
                  <p className="text-gray-400 max-w-2xl mx-auto text-sm md:text-base font-light">
                    Unggah panel-panel komik Jepang secara massal. AI akan memproses per 6 gambar secara berkesinambungan dengan urutan Kanan ke Kiri.
                  </p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <section className="space-y-6">
                    <div className="bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-800 shadow-xl text-center space-y-4">
                      {/* Cross-Tool Bridge: Import from Manhwa */}
                      {panels.length > 0 && (
                        <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                          <div className="flex items-center space-x-2.5">
                            <div className="p-2 bg-blue-500/20 text-blue-300 rounded-xl flex-shrink-0">
                              <Scissors className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">Tersedia {panels.length} Panel di Studio Manhwa</p>
                              <p className="text-[11px] text-blue-300/70">Gunakan potongan panel dari tab Manhwa langsung di studio Manga.</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={transferManhwaToMangaStudio}
                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-600/20 flex-shrink-0 flex items-center space-x-1.5 cursor-pointer active:scale-95"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Gunakan Panel Manhwa</span>
                          </button>
                        </div>
                      )}

                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="p-4 bg-pink-500/10 rounded-2xl">
                          <Upload className="w-8 h-8 text-pink-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Unggah Multi Panel Manga</h2>
                        <p className="text-gray-400 text-xs md:text-sm">
                          Pilih beberapa gambar panel sekaligus (Maksimal 200). Urutan baca diatur dari Kanan ke Kiri.
                        </p>
                        <button 
                          type="button"
                          onClick={() => document.getElementById('manga-upload')?.click()}
                          className="mt-2 px-6 py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-pink-600/20 cursor-pointer active:scale-95"
                        >
                          Pilih Multi Panel Manga
                        </button>
                        <input 
                          type="file" 
                          id="manga-upload"
                          multiple
                          onChange={handleMangaUpload}
                          accept="image/*" 
                          className="hidden"
                        />
                      </div>
                    </div>

                    {mangaPanels.length > 0 && (
                      <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 space-y-5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-white">Panel Terunggah ({mangaPanels.length})</h3>
                          <button 
                            onClick={() => {
                              mangaPanels.forEach(p => URL.revokeObjectURL(p.src));
                              setMangaPanels([]);
                            }}
                            className="text-xs text-red-400 hover:text-red-300 flex items-center space-x-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Hapus Semua</span>
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-56 overflow-y-auto custom-scrollbar p-1">
                          {mangaPanels.map((panel, idx) => (
                            <div key={panel.id} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-800">
                              <img src={panel.src} alt="Panel" className="w-full h-full object-cover" />
                              <button 
                                onClick={() => removeMangaPanel(panel.id)}
                                className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[9px] text-white py-0.5 text-center font-mono">
                                #{idx + 1}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-4 pt-3 border-t border-gray-800">
                          {/* AI Engine & Model Selector for Manga */}
                          <div className="p-3.5 bg-gray-950 rounded-2xl border border-pink-500/20 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-300 flex items-center">
                                <Cpu className="w-3.5 h-3.5 mr-1.5 text-pink-400" />
                                Model AI:
                              </span>
                              <button
                                onClick={() => setIsApiKeyModalOpen(true)}
                                className="text-[11px] font-bold text-amber-300 hover:text-amber-200 flex items-center space-x-1"
                              >
                                <Key className="w-3 h-3 text-amber-400" />
                                <span>Kunci API</span>
                              </button>
                            </div>
                            <select
                              value={selectedProvider === 'google' ? 'google' : selectedKieModel}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'google') {
                                  saveApiSettings('google', selectedKieModel);
                                } else {
                                  saveApiSettings('kie', val as any);
                                }
                              }}
                              className="w-full bg-gray-900 border border-gray-700 text-gray-200 text-xs font-semibold rounded-xl px-3 py-2 focus:border-pink-500 outline-none cursor-pointer"
                            >
                              <optgroup label="Google AI Studio">
                                <option value="google">Google AI Studio (Default)</option>
                              </optgroup>
                              <optgroup label="KIE.ai Multi-Model Gateway">
                                {KIE_MODELS.map(m => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} ({m.badge})
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => setMangaIncludeHook(!mangaIncludeHook)}
                              className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                                mangaIncludeHook ? 'bg-pink-500/20 border-pink-500 text-pink-400' : 'bg-gray-950 border-gray-800 text-gray-400'
                              }`}
                            >
                              {mangaIncludeHook ? '✓ Pakai Hook Awal' : 'Tanpa Hook'}
                            </button>
                            <button
                              onClick={() => setMangaIncludeClosing(!mangaIncludeClosing)}
                              className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                                mangaIncludeClosing ? 'bg-pink-500/20 border-pink-500 text-pink-400' : 'bg-gray-950 border-gray-800 text-gray-400'
                              }`}
                            >
                              {mangaIncludeClosing ? '✓ Pakai Penutup Outro' : 'Tanpa Penutup'}
                            </button>
                          </div>

                          <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800">
                            <button
                              onClick={() => setMangaNarrationStyle('baku')}
                              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                mangaNarrationStyle === 'baku' ? 'bg-pink-600 text-white' : 'text-gray-400'
                              }`}
                            >
                              Formal (Baku)
                            </button>
                            <button
                              onClick={() => setMangaNarrationStyle('santai')}
                              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                mangaNarrationStyle === 'santai' ? 'bg-pink-600 text-white' : 'text-gray-400'
                              }`}
                            >
                              Santai (Recap Gaul)
                            </button>
                          </div>
                        </div>

                        {/* Error & Resume Recovery Banner */}
                        {mangaBatchError && !isGeneratingMangaScript && (
                          <div className="bg-pink-950/40 border-2 border-pink-500/50 p-4 rounded-2xl space-y-3 shadow-xl">
                            <div className="flex items-start space-x-3">
                              <div className="p-2 bg-pink-500/20 text-pink-300 rounded-xl flex-shrink-0">
                                <Info className="w-4 h-4" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-xs font-bold text-pink-200">
                                  Batch {mangaBatchError.failedBatchIndex + 1} dari {mangaBatchError.totalBatches} Terkendala
                                </h4>
                                <p className="text-[11px] text-pink-300/80 leading-relaxed">
                                  {mangaBatchError.errorMessage}
                                </p>
                                <p className="text-[10px] text-emerald-400 font-semibold">
                                  ✓ Naskah manga yang sudah digenerate sebelumnya tetap tersimpan aman.
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => generateMangaScript(mangaBatchError.failedBatchIndex)}
                                className="px-4 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-pink-600/20 flex items-center space-x-1.5 cursor-pointer active:scale-95 touch-manipulation"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>▶️ Lanjutkan Batch ({mangaBatchError.failedBatchIndex + 1} s/d {mangaBatchError.totalBatches})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => generateMangaScript(0)}
                                className="px-3.5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-semibold text-xs rounded-xl transition-all border border-gray-700 flex items-center space-x-1.5 cursor-pointer active:scale-95 touch-manipulation"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Mulai Ulang Dari Awal</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {!isGeneratingMangaScript && !mangaBatchError && (
                          <button 
                            type="button"
                            onClick={() => generateMangaScript(0)}
                            disabled={isGeneratingMangaScript || mangaPanels.length === 0}
                            className="w-full py-3.5 bg-pink-600 hover:bg-pink-500 disabled:bg-gray-800 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg shadow-pink-600/20 cursor-pointer active:scale-98 touch-manipulation"
                          >
                            <Sparkles className="w-5 h-5" />
                            <span>Hasilkan Naskah Manga ({Math.ceil(mangaPanels.length / 6)} Batch)</span>
                          </button>
                        )}

                        {isGeneratingMangaScript && mangaScriptProgress && (
                          <div className="bg-pink-950/40 border border-pink-500/30 p-4 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-pink-300 flex items-center space-x-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-400" />
                                <span>Batch {mangaScriptProgress.currentBatch} dari {mangaScriptProgress.totalBatches}</span>
                              </span>
                              <span className="text-white font-mono">
                                {Math.round((mangaScriptProgress.currentBatch / mangaScriptProgress.totalBatches) * 100)}%
                              </span>
                            </div>
                            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-pink-500 to-rose-400 transition-all duration-500"
                                style={{ width: `${(mangaScriptProgress.currentBatch / mangaScriptProgress.totalBatches) * 100}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              <p className="text-[11px] text-gray-400 italic">
                                AI sedang menganalisis batch gambar RTL...
                              </p>
                              <button
                                type="button"
                                onClick={handleCancelBatchManga}
                                className="px-3 py-1.5 bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 shadow-md shadow-red-600/20 active:scale-95 cursor-pointer"
                              >
                                <span>Batalkan Pemrosesan</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  <section className="space-y-6">
                    <div className="bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-800 min-h-[480px] flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
                          <h3 className="text-base font-bold text-white flex items-center">
                            <FileText className="w-4 h-4 mr-2 text-pink-400" />
                            Naskah Alur Cerita Manga
                          </h3>
                          {generatedMangaScript && (
                            <button 
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(generatedMangaScript);
                                setMangaCopied(true);
                                setTimeout(() => setMangaCopied(false), 2000);
                              }}
                              className="text-xs text-pink-400 hover:text-pink-300 font-semibold flex items-center space-x-1 cursor-pointer"
                            >
                              {mangaCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{mangaCopied ? 'Tersalin!' : 'Salin Naskah'}</span>
                            </button>
                          )}
                        </div>

                        {!generatedMangaScript && !isGeneratingMangaScript && (
                          <div className="py-20 text-center text-gray-500 space-y-3">
                            <FileText className="w-12 h-12 mx-auto opacity-20" />
                            <p className="text-sm">Naskah alur cerita akan muncul di sini.</p>
                          </div>
                        )}

                        {isGeneratingMangaScript && (
                          <div className="py-16 text-center space-y-4">
                            <Loader2 className="w-12 h-12 text-pink-500 animate-spin mx-auto" />
                            <div className="space-y-1">
                              <p className="text-pink-400 font-bold text-sm">{mangaScriptProgress?.status || 'AI sedang menganalisis...'}</p>
                              <p className="text-gray-400 text-xs">Memproses batch 6 gambar dengan urutan Kanan ke Kiri.</p>
                            </div>
                          </div>
                        )}

                        {generatedMangaScript && (
                          <div className="mt-4 bg-gray-950 p-4 rounded-2xl border border-gray-800 text-gray-300 text-xs md:text-sm leading-relaxed whitespace-pre-wrap max-h-[460px] overflow-y-auto custom-scrollbar font-light">
                            {generatedMangaScript}
                          </div>
                        )}
                      </div>

                      {generatedMangaScript && (
                        <div className="space-y-3 pt-4 border-t border-gray-800">
                          <div className="flex items-center justify-between text-xs text-gray-400 pb-1">
                            <span>Karakter (Tanpa Spasi): <strong className="text-pink-400 font-mono">{generatedMangaScript.replace(/\s+/g, '').length}</strong></span>
                            <span>Total Kata: <strong className="text-white font-mono">{generatedMangaScript.trim().split(/\s+/).length}</strong></span>
                          </div>

                          {/* Connected Action Bridge to Manhwa & TTS */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={transferMangaToManhwaStudio}
                              className="p-3 bg-gradient-to-r from-blue-950/60 to-indigo-950/40 hover:from-blue-900/60 hover:to-indigo-900/50 border border-blue-500/40 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer group"
                            >
                              <div className="flex items-center space-x-2.5">
                                <div className="p-1.5 bg-blue-500/20 text-blue-300 rounded-lg group-hover:scale-110 transition-transform">
                                  <Scissors className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-white">Kirim ke Studio Manhwa</p>
                                  <p className="text-[10px] text-blue-300/70">Olah Batch 6 & Voiceover per panel</p>
                                </div>
                              </div>
                              <span className="text-xs text-blue-400 font-bold">Buka →</span>
                            </button>

                            <button
                              type="button"
                              onClick={transferMangaToTTSStudio}
                              className="p-3 bg-gradient-to-r from-amber-950/60 to-amber-900/40 hover:from-amber-900/60 hover:to-amber-800/50 border border-amber-500/40 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer group"
                            >
                              <div className="flex items-center space-x-2.5">
                                <div className="p-1.5 bg-amber-500/20 text-amber-300 rounded-lg group-hover:scale-110 transition-transform">
                                  <Volume2 className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-white">Kirim ke TTS Studio</p>
                                  <p className="text-[10px] text-amber-300/70">Buat narasi audio WAV lengkap</p>
                                </div>
                              </div>
                              <span className="text-xs text-amber-400 font-bold">Buka →</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={exportMangaScriptTxt}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 cursor-pointer text-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Unduh Naskah Manga (.TXT)</span>
                          </button>
                        </div>
                      )}

                      {mangaScriptError && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center">
                          {mangaScriptError}
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            ) : activeTab === 'extend-image' ? (
              <div className="space-y-8 py-4">
                <header className="text-center space-y-3">
                  <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Format Rasio 16:9 Sinematik</span>
                  </div>
                  <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                    Extend Gambar AI <span className="text-emerald-400">(16:9)</span>
                  </h1>
                  <p className="text-gray-400 max-w-2xl mx-auto text-sm md:text-base font-light">
                    Perluas gambar komik atau ilustrasi menjadi format layar lebar 16:9 yang cocok untuk video recap YouTube.
                  </p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <section className="space-y-6">
                    <div className="bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-800 shadow-xl text-center">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="p-4 bg-emerald-500/10 rounded-2xl">
                          <Maximize2 className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Unggah Gambar Input</h2>
                        <button 
                          onClick={() => document.getElementById('extend-upload')?.click()}
                          className="mt-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
                        >
                          Pilih Gambar
                        </button>
                        <input 
                          type="file" 
                          id="extend-upload"
                          onChange={handleExtendUpload}
                          accept="image/*" 
                          className="hidden"
                        />
                      </div>
                    </div>

                    {extendImage && (
                      <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 space-y-4">
                        <h3 className="text-sm font-bold text-white">Prompt Perluasan</h3>
                        <textarea 
                          value={extendPrompt}
                          onChange={(e) => setExtendPrompt(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none min-h-[90px]"
                        />
                        <button 
                          onClick={processExtend}
                          disabled={isExtending}
                          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-emerald-600/20"
                        >
                          {isExtending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Maximize2 className="w-5 h-5" />}
                          <span>{isExtending ? 'Sedang Memperluas Gambar...' : 'Proses Extend ke 16:9'}</span>
                        </button>
                      </div>
                    )}
                  </section>

                  <section className="space-y-6">
                    <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 min-h-[400px] flex flex-col items-center justify-center relative">
                      {!extendImage && !extendedResult && (
                        <div className="text-center text-gray-500">
                          <Images className="w-14 h-14 mx-auto mb-3 opacity-20" />
                          <p className="text-xs">Hasil perluasan 16:9 akan tampil di sini</p>
                        </div>
                      )}
                      
                      {extendImage && !extendedResult && !isExtending && (
                        <div className="space-y-3 text-center">
                          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Preview Input</p>
                          <img src={extendImage} alt="Input" className="max-w-full max-h-[360px] rounded-xl shadow-2xl mx-auto" />
                        </div>
                      )}

                      {isExtending && (
                        <div className="text-center space-y-3">
                          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mx-auto" />
                          <p className="text-emerald-400 font-bold text-xs animate-pulse">AI sedang melukis area baru format 16:9...</p>
                        </div>
                      )}

                      {extendedResult && (
                        <div className="space-y-4 text-center w-full">
                          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest font-mono">Hasil Perluasan 16:9</p>
                          <img src={extendedResult} alt="Result" className="max-w-full max-h-[380px] rounded-xl shadow-2xl mx-auto" />
                          <a 
                            href={extendedResult} 
                            download="extended_16_9.png"
                            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all"
                          >
                            <Download className="w-4 h-4" />
                            <span>Unduh Gambar 16:9</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <div className="space-y-8 py-4">
                <header className="text-center space-y-3">
                  <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Multi-Part Voiceover & MP3 Merger Studio</span>
                  </div>
                  <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                    Studio <span className="text-amber-400">Text to Speech</span>
                  </h1>
                  <p className="text-gray-400 max-w-2xl mx-auto text-sm md:text-base font-light">
                    Ubah naskah cerita manhwa/manga menjadi audio berformat <strong className="text-amber-300 font-semibold">.MP3</strong>. Naskah panjang otomatis dipecah per bagian (maksimal 2.500 karakter) dan dapat digabungkan menjadi 1 file audio utuh.
                  </p>
                </header>

                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Engine & Settings Box */}
                  <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 shadow-xl space-y-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-800">
                      <div>
                        <h2 className="text-base font-bold text-white flex items-center space-x-2">
                          <Settings className="w-4 h-4 text-amber-400" />
                          <span>Pilihan Engine & Suara</span>
                        </h2>
                        <p className="text-xs text-gray-400">Pilih antara AI Neural Ultra Natural atau Browser Native (100% Free tanpa kuota/API).</p>
                      </div>

                      {/* Engine Selector */}
                      <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800">
                        <button
                          type="button"
                          onClick={() => setTtsEngine('gemini')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                            ttsEngine === 'gemini' 
                              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20' 
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Gemini AI (MP3)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTtsEngine('browser')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                            ttsEngine === 'browser' 
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>Speechma Free (Tanpa API)</span>
                        </button>
                      </div>
                    </div>

                    {/* Voice Controls */}
                    {ttsEngine === 'gemini' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-gray-300">Karakter Suara AI (Output MP3 128kbps)</label>
                          <select 
                            value={ttsVoice}
                            onChange={(e) => setTtsVoice(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-gray-200 outline-none focus:ring-2 focus:ring-amber-500"
                          >
                            {VOICES.map(v => (
                              <option key={v.value} value={v.value}>
                                {v.gender === 'female' ? '👩' : '👨'} {v.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center space-x-3 text-xs text-amber-300">
                          <Music className="w-5 h-5 flex-shrink-0 text-amber-400" />
                          <span>Semua bagian audio langsung dikonversi ke format <strong>MP3</strong> audio standar yang kompatibel dengan CapCut, Premiere, dan media player.</span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-gray-300">Suara Browser (100% Free)</label>
                          <select 
                            value={selectedBrowserVoice}
                            onChange={(e) => setSelectedBrowserVoice(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            {browserVoices.length > 0 ? (
                              browserVoices.map((v, vIdx) => (
                                <option key={`${v.name}-${v.lang}-${vIdx}`} value={`${v.name}||${v.lang}`}>
                                  {v.name} ({v.lang})
                                </option>
                              ))
                            ) : (
                              <option value="">Default Browser Voice</option>
                            )}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <label className="font-bold text-gray-300">Kecepatan Bicara</label>
                            <span className="text-emerald-400 font-mono">{browserSpeed.toFixed(1)}x</span>
                          </div>
                          <input 
                            type="range" 
                            min="0.7" 
                            max="1.5" 
                            step="0.1" 
                            value={browserSpeed}
                            onChange={(e) => setBrowserSpeed(parseFloat(e.target.value))}
                            className="w-full accent-emerald-500 cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <label className="font-bold text-gray-300">Tinggi Nada (Pitch)</label>
                            <span className="text-emerald-400 font-mono">{browserPitch.toFixed(1)}</span>
                          </div>
                          <input 
                            type="range" 
                            min="0.8" 
                            max="1.3" 
                            step="0.1" 
                            value={browserPitch}
                            onChange={(e) => setBrowserPitch(parseFloat(e.target.value))}
                            className="w-full accent-emerald-500 cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Main Input Text Box */}
                  <div className="bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-800 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="space-y-0.5">
                        <label className="font-bold text-white text-sm">Naskah Cerita Utuh</label>
                        <p className="text-[11px] text-gray-400">
                          Ketik atau tempel naskah cerita di sini. Sistem akan otomatis membagi per bagian (maks 2.500 karakter/bagian).
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="px-2.5 py-1 bg-gray-950 border border-gray-800 rounded-lg text-gray-300 font-mono">
                          Total Karakter: <strong className="text-amber-400">{ttsText.length}</strong>
                        </span>
                        {ttsParts.length > 1 && (
                          <span className="px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold rounded-lg flex items-center space-x-1">
                            <Split className="w-3 h-3" />
                            <span>{ttsParts.length} Bagian</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <textarea 
                      value={ttsText}
                      onChange={(e) => setTtsText(e.target.value)}
                      placeholder="Masukkan atau tempel naskah cerita manhwa/manga yang ingin diubah menjadi suara..."
                      className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs md:text-sm text-gray-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all resize-none min-h-[140px] leading-relaxed custom-scrollbar font-light"
                    />

                    {/* Quick Tools for Text */}
                    {ttsText && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                        <div className="text-gray-400 text-[11px]">
                          {ttsParts.length > 0 ? (
                            <span>✓ Terbagi menjadi <strong className="text-amber-300">{ttsParts.length} bagian</strong> (tidak melebihi 2.500 karakter/part).</span>
                          ) : (
                            <span>Naskah kosong</span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(ttsText);
                              showSyncToast("✓ Naskah berhasil disalin!");
                            }}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-all flex items-center space-x-1 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Salin Semua</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setTtsText('')}
                            className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 rounded-xl transition-all flex items-center space-x-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Bersihkan</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Batch Action Bar */}
                  {ttsParts.length > 0 && (
                    <div className="p-4 bg-gradient-to-r from-amber-950/40 via-gray-900 to-indigo-950/40 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center space-x-3 text-left">
                        <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl flex-shrink-0">
                          <Volume2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Proses Audio Per Bagian ({ttsParts.length} Part)</h3>
                          <p className="text-xs text-gray-400">
                            {ttsParts.filter(p => p.mp3Url).length} dari {ttsParts.length} bagian sudah memiliki audio MP3.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 w-full sm:w-auto">
                        {!isGeneratingBatchTTS ? (
                          <button
                            type="button"
                            onClick={generateAllTtsParts}
                            className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-amber-600/25 flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>⚡ Hasilkan Suara Semua Part (1 s/d {ttsParts.length})</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleCancelTtsBatch}
                            className="w-full sm:w-auto px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                          >
                            <X className="w-4 h-4" />
                            <span>Batalkan Pemrosesan</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Individual Parts Grid / List */}
                  {ttsParts.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-gray-300 flex items-center space-x-2 px-1">
                        <ListOrdered className="w-4 h-4 text-amber-400" />
                        <span>Daftar Bagian Naskah & Audio (Maks 2.500 Karakter Per Part)</span>
                      </h3>

                      {ttsParts.map((part, index) => (
                        <div 
                          key={part.id} 
                          className="bg-gray-900 border border-gray-800 rounded-3xl p-5 md:p-6 shadow-xl space-y-4 transition-all hover:border-gray-700"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-800">
                            <div className="flex items-center space-x-3">
                              <span className="w-7 h-7 bg-amber-500/20 text-amber-300 font-black rounded-lg flex items-center justify-center text-xs">
                                #{part.partNumber}
                              </span>
                              <div>
                                <h4 className="text-sm font-bold text-white">Bagian {part.partNumber} dari {ttsParts.length}</h4>
                                <span className={`text-[11px] font-mono ${part.charCount > 2500 ? 'text-red-400' : 'text-emerald-400'}`}>
                                  {part.charCount.toLocaleString()} / 2.500 Karakter
                                </span>
                              </div>
                            </div>

                            {/* Part Status */}
                            <div className="flex items-center space-x-2">
                              {part.isGenerating && (
                                <span className="text-xs text-amber-400 flex items-center space-x-1.5 animate-pulse">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Sedang memproses...</span>
                                </span>
                              )}
                              {part.mp3Url && !part.isGenerating && (
                                <span className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-lg flex items-center space-x-1">
                                  <Check className="w-3 h-3" />
                                  <span>Audio MP3 Siap</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Editable Text for this part */}
                          <textarea 
                            value={part.text}
                            onChange={(e) => updatePartText(index, e.target.value)}
                            rows={4}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-gray-200 outline-none focus:ring-1 focus:ring-amber-500 transition-all resize-none leading-relaxed font-light"
                          />

                          {/* Part Controls & Audio Player */}
                          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
                            <div className="flex-grow">
                              {part.mp3Url ? (
                                <audio controls src={part.mp3Url} className="w-full h-9 rounded-lg" />
                              ) : (
                                <div className="text-xs text-gray-500 italic py-1.5">
                                  Audio untuk bagian ini belum dihasilkan.
                                </div>
                              )}
                            </div>

                            <div className="flex items-center space-x-2 flex-shrink-0">
                              {ttsEngine === 'browser' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (activePlayingPartId === part.id) {
                                      stopBrowserSpeech();
                                    } else {
                                      playBrowserSpeech(part.text, part.id);
                                    }
                                  }}
                                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
                                >
                                  {activePlayingPartId === part.id ? (
                                    <>
                                      <Pause className="w-3.5 h-3.5" />
                                      <span>Hentikan Suara</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-3.5 h-3.5" />
                                      <span>Putar Suara (Free)</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => generateSinglePartTTS(index)}
                                  disabled={part.isGenerating || isGeneratingBatchTTS}
                                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-800 text-white font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-md shadow-amber-600/20 active:scale-95"
                                >
                                  {part.isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                                  <span>{part.mp3Url ? 'Buat Ulang MP3' : 'Hasilkan Suara MP3'}</span>
                                </button>
                              )}

                              {part.mp3Url && (
                                <a 
                                  href={part.mp3Url} 
                                  download={`narasi_part_${part.partNumber}.mp3`}
                                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-amber-400 hover:text-amber-300 font-bold text-xs rounded-xl transition-all border border-gray-700 flex items-center space-x-1.5"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Unduh .MP3</span>
                                </a>
                              )}
                            </div>
                          </div>

                          {part.error && (
                            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                              {part.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* MASTER AUDIO MERGER SECTION (Gabung Semua Audio Terurut) */}
                  {ttsParts.length > 0 && ttsEngine === 'gemini' && (
                    <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-amber-950/40 p-6 md:p-8 rounded-3xl border border-amber-500/40 shadow-2xl space-y-6 mt-8">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-800">
                        <div className="flex items-center space-x-3">
                          <div className="p-3 bg-amber-500/20 text-amber-300 rounded-2xl flex-shrink-0">
                            <Combine className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-base font-black text-white">Gabung Semua Audio Menjadi 1 File MP3 Utuh</h3>
                            <p className="text-xs text-gray-400">
                              Menyatukan audio dari Part 1 s/d Part {ttsParts.length} secara berurutan dengan jeda transisi natural.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={mergeAllTtsAudioParts}
                          disabled={isMergingAllParts || ttsParts.filter(p => p.mp3Url).length === 0}
                          className="px-5 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:from-gray-800 disabled:to-gray-800 text-white font-bold text-xs md:text-sm rounded-xl transition-all shadow-xl shadow-amber-600/30 flex items-center space-x-2 cursor-pointer active:scale-95"
                        >
                          {isMergingAllParts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Combine className="w-4 h-4" />}
                          <span>Gabungkan Semua Audio ({ttsParts.filter(p => p.mp3Url).length}/{ttsParts.length} Part)</span>
                        </button>
                      </div>

                      {/* Merged Audio Result Card */}
                      {mergedFullMp3Url && (
                        <div className="p-5 bg-gray-950/80 border border-emerald-500/40 rounded-2xl space-y-4 animate-fade-in">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center space-x-2.5">
                              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                                <FileAudio className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-white">File Audio Lengkap Siap (.MP3)</h4>
                                <p className="text-[11px] text-emerald-400 font-mono">
                                  Format: MP3 • Total {ttsParts.filter(p => p.mp3Url).length} Bagian Digabungkan
                                </p>
                              </div>
                            </div>

                            <a
                              href={mergedFullMp3Url}
                              download="narasi_cerita_lengkap_full.mp3"
                              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs md:text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
                            >
                              <Download className="w-4 h-4" />
                              <span>⬇️ Unduh Audio Final (.MP3)</span>
                            </a>
                          </div>

                          <audio controls src={mergedFullMp3Url} className="w-full" />
                        </div>
                      )}
                    </div>
                  )}

                  {ttsError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs text-center">
                      {ttsError}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation (Bottom) */}
        <div className="md:hidden bg-gray-900 border-t border-gray-800 flex justify-around p-2 sticky bottom-0 z-50">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
              activeTab === 'home' ? 'text-blue-400 bg-blue-950/60' : 'text-gray-400'
            }`}
          >
            <HomeIcon className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Beranda</span>
          </button>
          <button
            onClick={() => setActiveTab('manhwa-tool')}
            className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
              activeTab === 'manhwa-tool' ? 'text-blue-400 bg-blue-950/60 font-bold' : 'text-gray-400'
            }`}
          >
            <Scissors className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Manhwa</span>
          </button>
          <button
            onClick={() => setActiveTab('manga-script')}
            className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
              activeTab === 'manga-script' ? 'text-pink-400 bg-pink-950/60 font-bold' : 'text-gray-400'
            }`}
          >
            <FileImage className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Manga</span>
          </button>
          <button
            onClick={() => setActiveTab('extend-image')}
            className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
              activeTab === 'extend-image' ? 'text-emerald-400 bg-emerald-950/60 font-bold' : 'text-gray-400'
            }`}
          >
            <Maximize2 className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Extend</span>
          </button>
          <button
            onClick={() => setActiveTab('tts-tool')}
            className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
              activeTab === 'tts-tool' ? 'text-amber-400 bg-amber-950/60 font-bold' : 'text-gray-400'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">TTS</span>
          </button>
        </div>

        <footer className="text-center text-gray-500 text-xs py-6 border-t border-gray-900 space-y-3">
          <div className="flex flex-col items-center space-y-1.5">
            <p className="font-bold text-gray-400">Created by AniKi Recap Studio</p>
            <div className="flex items-center space-x-4">
              <a 
                href="https://www.youtube.com/@AniKiID" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-red-400 transition-colors flex items-center space-x-1"
              >
                <Play className="w-3.5 h-3.5" />
                <span>YouTube: AniKi ID</span>
              </a>
              <a 
                href="https://wa.me/6285696720468" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-green-400 transition-colors flex items-center space-x-1"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>WA: 085696720468</span>
              </a>
            </div>
          </div>
          <p>© 2026 AI Story Studio • Batch Engine 6 Gambar & Multi-Model Engine</p>
        </footer>
      </div>

      {/* API Key & Multi-Model Configuration Modal */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col custom-scrollbar">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gray-900/95 backdrop-blur z-10">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Pengaturan Kunci API & Model</h3>
                  <p className="text-xs text-gray-400">Pilih provider dan masukkan API Key untuk generate naskah cerita.</p>
                </div>
              </div>
              <button
                onClick={() => setIsApiKeyModalOpen(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Provider Selection Tabs */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Pilih Provider AI Utama</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => saveApiSettings('google')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      selectedProvider === 'google'
                        ? 'bg-blue-600/10 border-blue-500 ring-2 ring-blue-500/20 shadow-lg'
                        : 'bg-gray-950/60 border-gray-800 hover:border-gray-700 text-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white flex items-center">
                        <Globe className="w-4 h-4 mr-1.5 text-blue-400" />
                        Google AI Studio
                      </span>
                      {selectedProvider === 'google' && (
                        <span className="w-2 h-2 rounded-full bg-blue-400 ring-4 ring-blue-400/20"></span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400">SDK Resmi Google Studio (Gemini 2.5 Flash Bawaan)</p>
                  </button>

                  <button
                    onClick={() => saveApiSettings('kie')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      selectedProvider === 'kie'
                        ? 'bg-pink-600/10 border-pink-500 ring-2 ring-pink-500/20 shadow-lg'
                        : 'bg-gray-950/60 border-gray-800 hover:border-gray-700 text-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white flex items-center">
                        <Cpu className="w-4 h-4 mr-1.5 text-pink-400" />
                        KIE.ai Gateway
                      </span>
                      {selectedProvider === 'kie' && (
                        <span className="w-2 h-2 rounded-full bg-pink-400 ring-4 ring-pink-400/20"></span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400">Gemini 3.6 Flash, 3.1 Pro, 3.5 Flash, 3 Pro</p>
                  </button>
                </div>
              </div>

              {/* Provider Config Section */}
              {selectedProvider === 'kie' ? (
                <div className="space-y-5 bg-gray-950/80 p-5 rounded-2xl border border-pink-500/20">
                  <div className="flex items-center justify-between gap-3 bg-pink-950/30 p-3.5 rounded-xl border border-pink-500/30">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-pink-400 flex-shrink-0" />
                      <h4 className="text-xs font-bold text-pink-200">
                        Dapatkan / Buat Kunci API KIE.ai
                      </h4>
                    </div>
                    <a
                      href="https://kie.ai/id/api-key"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 shadow-md shadow-pink-600/20 flex-shrink-0 cursor-pointer"
                    >
                      <span>kie.ai/id/api-key</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* API Key Input */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
                      <span>Kunci API KIE.ai (API Key)</span>
                      {kieApiKey && (
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">✓ Tersimpan di Browser</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showKieKey ? "text" : "password"}
                        value={kieApiKey}
                        onChange={(e) => setKieApiKey(e.target.value)}
                        placeholder="Contoh: c097451f... atau e3a28ce6..."
                        className="w-full bg-gray-900 border border-gray-700 focus:border-pink-500 text-white text-xs font-mono rounded-xl pl-3.5 pr-10 py-3 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKieKey(!showKieKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                      >
                        {showKieKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* KIE Models Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Pilih Model KIE.ai Yang Digunakan</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {KIE_MODELS.map((model) => {
                        const isSelected = selectedKieModel === model.id;
                        return (
                          <div
                            key={model.id}
                            onClick={() => setSelectedKieModel(model.id)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                              isSelected
                                ? 'bg-pink-900/20 border-pink-500 ring-1 ring-pink-500'
                                : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-white">{model.name}</span>
                              <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                                {model.badge}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">{model.desc}</p>
                            <span className="text-[9px] font-mono text-gray-500 truncate block">
                              {model.endpoint}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 bg-gray-950/80 p-5 rounded-2xl border border-blue-500/20">
                  <div className="bg-blue-950/30 p-3.5 rounded-xl border border-blue-500/30 space-y-1">
                    <h4 className="text-xs font-bold text-blue-200 flex items-center">
                      <Globe className="w-4 h-4 mr-1 text-blue-400" />
                      Google AI Studio (Bawaan Sistem)
                    </h4>
                    <p className="text-[11px] text-blue-300/80 leading-relaxed">
                      Secara default, aplikasi telah terintegrasi dengan Google AI Studio SDK. Jika ingin menggunakan API Key pribadi khusus, Anda dapat mengisinya di bawah.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
                      <span>Kunci API Google AI Studio (Opsional / Override)</span>
                      {googleApiKey && (
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">✓ Kunci Pribadi Aktif</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showGoogleKey ? "text" : "password"}
                        value={googleApiKey}
                        onChange={(e) => setGoogleApiKey(e.target.value)}
                        placeholder="Kosongkan untuk menggunakan kunci environment bawaan"
                        className="w-full bg-gray-900 border border-gray-700 focus:border-blue-500 text-white text-xs font-mono rounded-xl pl-3.5 pr-10 py-3 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGoogleKey(!showGoogleKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                      >
                        {showGoogleKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-800 flex items-center justify-between sticky bottom-0 bg-gray-900/95 backdrop-blur z-10">
              <div className="text-xs text-gray-400 flex items-center space-x-1.5">
                {apiKeySaveToast ? (
                  <span className="text-emerald-400 font-bold flex items-center animate-bounce">
                    <Check className="w-4 h-4 mr-1" />
                    Pengaturan Tersimpan!
                  </span>
                ) : (
                  <span>Data tersimpan aman di browser Anda.</span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsApiKeyModalOpen(false)}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    saveApiSettings();
                    setTimeout(() => setIsApiKeyModalOpen(false), 500);
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-black text-xs rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center space-x-1.5 cursor-pointer active:scale-95"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Simpan & Terapkan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
