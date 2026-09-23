import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Scissors, Trash2, Loader2, Maximize2, Settings, 
  ListOrdered, Play, RefreshCw, Sparkles, Check, Copy, Download, 
  Images, FileImage, Volume2, Info, ArrowRight, Cpu, Key, Layers
} from 'lucide-react';
import JSZip from 'jszip';
import { VOICES, KIE_MODELS } from '../constants';
import { PanelData, MangaPanelItem } from '../types';
import { 
  optimizeImageForAI, 
  executeUnifiedAIGeneration, 
  parseBatchParagraphs, 
  normalizeErrorMessage,
  callGeminiTTSWithRetry,
  defaultAI
} from '../utils/aiHelpers';
import { base64ToArrayBuffer, pcm16ToMp3Blob } from '../utils/audioMp3';
import { GoogleGenAI } from '@google/genai';

interface ManhwaStudioProps {
  panels: PanelData[];
  setPanels: React.Dispatch<React.SetStateAction<PanelData[]>>;
  originalImage: HTMLImageElement | null;
  setOriginalImage: (img: HTMLImageElement | null) => void;
  splitPoints: number[];
  setSplitPoints: React.Dispatch<React.SetStateAction<number[]>>;
  hiddenPanels: number[];
  setHiddenPanels: React.Dispatch<React.SetStateAction<number[]>>;
  mangaPanels: MangaPanelItem[];
  transferMangaToManhwaStudio: () => void;
  transferManhwaToMangaStudio: () => void;
  transferManhwaToTTSStudio: () => void;
  selectedProvider: 'google' | 'kie';
  selectedKieModel: any;
  kieApiKey: string;
  googleApiKey: string;
  saveApiSettings: (provider?: 'google' | 'kie', kieModel?: any, kieKey?: string, googleKey?: string) => void;
  setIsApiKeyModalOpen: (open: boolean) => void;
  showSyncToast: (msg: string) => void;
}

export const ManhwaStudio: React.FC<ManhwaStudioProps> = ({
  panels,
  setPanels,
  originalImage,
  setOriginalImage,
  splitPoints,
  setSplitPoints,
  hiddenPanels,
  setHiddenPanels,
  mangaPanels,
  transferMangaToManhwaStudio,
  transferManhwaToMangaStudio,
  transferManhwaToTTSStudio,
  selectedProvider,
  selectedKieModel,
  kieApiKey,
  googleApiKey,
  saveApiSettings,
  setIsApiKeyModalOpen,
  showSyncToast,
}) => {
  const [show169Guide, setShow169Guide] = useState(false);
  const [manhwaNarrationStyle, setManhwaNarrationStyle] = useState<'santai' | 'dramatis' | 'baku'>('santai');
  const [isBatchGeneratingManhwa, setIsBatchGeneratingManhwa] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ currentBatch: number; totalBatches: number; processedCount: number; totalCount: number; currentPanelRange: string } | null>(null);
  const [manhwaBatchError, setManhwaBatchError] = useState<{ failedBatchIndex: number; totalBatches: number; errorMessage: string } | null>(null);
  const [mergedCopied, setMergedCopied] = useState(false);
  const [readingOrder, setReadingOrder] = useState<'webtoon' | 'manga'>('webtoon');
  const [mergedScriptCustom, setMergedScriptCustom] = useState<string>('');
  const [isCustomMergedEdited, setIsCustomMergedEdited] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const isBatchManhwaCancelledRef = useRef<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasWidth = 800;

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

  const handleCancelBatchManhwa = () => {
    isBatchManhwaCancelledRef.current = true;
    setIsBatchGeneratingManhwa(false);
    setBatchProgress(null);
    setPanels(prev => prev.map(p => ({ ...p, isGeneratingScript: false })));
  };

  const generateAllPanelsBatch = async (fromBatchIndex: number = 0) => {
    if (panels.length === 0) return;
    setIsBatchGeneratingManhwa(true);
    setManhwaBatchError(null);
    isBatchManhwaCancelledRef.current = false;
    
    const BATCH_SIZE = 6;
    const totalPanels = panels.length;
    const totalBatches = Math.ceil(totalPanels / BATCH_SIZE);
    const updatedPanels = [...panels];

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

        setPanels(prev => prev.map((p, idx) => (idx >= startIdx && idx < endIdx) ? { ...p, isGeneratingScript: true, error: null } : p));

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
3. KONEKSI ANTAR BATCH: Naskah pada Gambar 1 di batch ini WAJIB menyambung secara alami dan mulus dari akhir cerita sebelumnya tanpa mengulang cerita lama.
4. FORMAT OUTPUT WAJIB:
   Tuliskan setiap paragraf dengan penomoran jelas:
   [Panel ${startIdx + 1}] (Isi narasi 2-4 kalimat untuk panel ini...)
   [Panel ${startIdx + 2}] (Isi narasi 2-4 kalimat lanjutan untuk panel ini...)
   ...hingga [Panel ${endIdx}]
5. DILARANG KERAS menyertakan kata pengantar. Langsung berikan hasil teks narasi per panel.
        `.trim();

        const response = await executeUnifiedAIGeneration(
          prompt, 
          imageParts, 
          selectedProvider, 
          selectedKieModel, 
          kieApiKey, 
          googleApiKey,
          () => setIsApiKeyModalOpen(true)
        );

        const rawResult = response.text || '';
        const parsedParagraphs = parseBatchParagraphs(rawResult, batchImageCount);

        for (let i = 0; i < batchImageCount; i++) {
          const panelGlobalIdx = startIdx + i;
          const paragraphText = parsedParagraphs[i] || `Adegan pada panel ${panelGlobalIdx + 1}.`;
          updatedPanels[panelGlobalIdx].script = paragraphText;
          updatedPanels[panelGlobalIdx].isGeneratingScript = false;
          cumulativeStoryContext += `\n${paragraphText}`;
        }

        setPanels([...updatedPanels]);
      }
    } catch (error: any) {
      console.error("Batch script generation error:", error);
      const rawMsg = normalizeErrorMessage(error, `Gagal memproses Batch ${currentBatchRunning + 1} dari ${totalBatches}.`);
      setManhwaBatchError({
        failedBatchIndex: currentBatchRunning,
        totalBatches,
        errorMessage: rawMsg
      });
    } finally {
      setIsBatchGeneratingManhwa(false);
      setBatchProgress(null);
      setPanels(prev => prev.map(p => ({ ...p, isGeneratingScript: false })));
    }
  };

  const generateScript = async (panelId: number) => {
    const panelIdx = panels.findIndex(p => p.id === panelId);
    if (panelIdx === -1) return;
    const panel = panels[panelIdx];

    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, isGeneratingScript: true, error: null } : p));

    try {
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
3. JANGAN tulis kata pengantar seperti "Berikut adalah...". Murni 1 paragraf narasi siap baca.
      `.trim();

      const imagePart = await optimizeImageForAI(panel.imageSrc);

      const response = await executeUnifiedAIGeneration(
        prompt, 
        [imagePart],
        selectedProvider,
        selectedKieModel,
        kieApiKey,
        googleApiKey,
        () => setIsApiKeyModalOpen(true)
      );

      const generatedText = (response.text || '').replace(/^\[Panel\s*\d+\]\s*/i, '').trim();
      setPanels(prev => prev.map(p => p.id === panelId ? { ...p, script: generatedText, isGeneratingScript: false } : p));
    } catch (error: any) {
      console.error("Error generating single script:", error);
      setPanels(prev => prev.map(p => p.id === panelId ? { ...p, error: error.message, isGeneratingScript: false } : p));
    }
  };

  const generateAudio = async (panelId: number) => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel || !panel.script.trim()) return;

    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, isGeneratingAudio: true, error: null } : p));

    try {
      const client = googleApiKey && googleApiKey.trim()
        ? new GoogleGenAI({ apiKey: googleApiKey.trim() })
        : defaultAI;

      const response = await callGeminiTTSWithRetry(
        `Ucapkan dengan intonasi dan emosi yang sesuai: ${panel.script}`,
        panel.voice,
        client
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

  const computedMergedScript = panels
    .map((p) => p.script.trim() || `[Panel #${p.id}: Belum ada naskah]`)
    .join('\n\n');

  const activeMergedScriptText = isCustomMergedEdited ? mergedScriptCustom : computedMergedScript;
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

  return (
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
                Total Panel: <strong className="text-blue-400">{panels.length}</strong>
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
                <span>Manga RTL</span>
              </button>
            </div>
          </div>

          {/* Model Selector */}
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
                      : 'Google AI Studio (Gemini Flash)'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {selectedProvider === 'kie'
                    ? `Endpoint aktif: ${KIE_MODELS.find(m => m.id === selectedKieModel)?.endpoint}`
                    : 'Model bawaan dengan failover otomatis.'}
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
                  <option value="google">Google AI Studio (Default)</option>
                </optgroup>
                <optgroup label="KIE.ai Gateway">
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
            {manhwaBatchError && !isBatchGeneratingManhwa && (
              <div className="bg-amber-950/40 border-2 border-amber-500/50 p-5 rounded-2xl space-y-4 shadow-xl">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl flex-shrink-0">
                    <Info className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-amber-200">
                      Batch {manhwaBatchError.failedBatchIndex + 1} dari {manhwaBatchError.totalBatches} Terkendala
                    </h4>
                    <p className="text-xs text-amber-300/80 leading-relaxed">
                      {manhwaBatchError.errorMessage}
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

      {/* Merged Script Viewer with Live Character Calculator */}
      {panels.length > 0 && (
        <section className="bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-800 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center">
                <ListOrdered className="w-5 h-5 mr-2 text-blue-400" />
                Gabungan Naskah Cerita Lengkap
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Semua paragraf dari setiap panel digabung secara utuh. Dapat diedit langsung di bawah.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleCopyMergedScript}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center space-x-1.5 cursor-pointer"
              >
                {mergedCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{mergedCopied ? 'Tersalin!' : 'Salin Semua Naskah'}</span>
              </button>
            </div>
          </div>

          {/* Stats Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-950 p-3 rounded-2xl border border-gray-800 text-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Karakter (Tanpa Spasi)</span>
              <span className="text-lg font-black text-blue-400 font-mono">{totalCharsWithoutSpaces.toLocaleString()}</span>
            </div>
            <div className="bg-gray-950 p-3 rounded-2xl border border-gray-800 text-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Total Kata</span>
              <span className="text-lg font-black text-emerald-400 font-mono">{totalWords.toLocaleString()}</span>
            </div>
            <div className="bg-gray-950 p-3 rounded-2xl border border-gray-800 text-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Total Paragraf</span>
              <span className="text-lg font-black text-amber-400 font-mono">{totalParagraphsCount}</span>
            </div>
            <div className="bg-gray-950 p-3 rounded-2xl border border-gray-800 text-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Estimasi Voiceover</span>
              <span className="text-lg font-black text-pink-400 font-mono">~{Math.ceil(totalWords / 130)} Menit</span>
            </div>
          </div>

          <textarea
            value={activeMergedScriptText}
            onChange={(e) => {
              setMergedScriptCustom(e.target.value);
              setIsCustomMergedEdited(true);
            }}
            rows={8}
            className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs md:text-sm text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none leading-relaxed font-light"
            placeholder="Naskah gabungan akan muncul di sini secara otomatis..."
          />
        </section>
      )}

      {/* Step 3: Panel Cards Grid */}
      {panels.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-base font-bold text-white flex items-center">
              <Layers className="w-5 h-5 mr-2 text-blue-400" />
              <span>Daftar Panel Gambar & Naskah Narasi ({panels.length})</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {panels.map((panel, index) => (
              <div 
                key={panel.id}
                className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between group hover:border-gray-700 transition-all"
              >
                <div>
                  <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
                    <img 
                      src={panel.imageSrc} 
                      alt={`Panel ${panel.id}`} 
                      className="max-h-full max-w-full object-contain"
                    />
                    <div className="absolute top-3 left-3 bg-blue-600 text-white font-black text-xs px-2.5 py-1 rounded-xl shadow-lg">
                      #{panel.id}
                    </div>
                    <button
                      onClick={() => hidePanel(panel.startY)}
                      className="absolute top-3 right-3 p-1.5 bg-gray-900/80 hover:bg-red-600 text-gray-300 hover:text-white rounded-xl transition-all cursor-pointer"
                      title="Sembunyikan Panel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span className="font-bold uppercase tracking-wider">Naskah Cerita Panel #{panel.id}</span>
                        {panel.script && (
                          <span className="text-[10px] font-mono text-blue-400">{panel.script.length} Karakter</span>
                        )}
                      </div>
                      <textarea 
                        value={panel.script}
                        onChange={(e) => {
                          const newScript = e.target.value;
                          setPanels(prev => prev.map(p => p.id === panel.id ? { ...p, script: newScript } : p));
                        }}
                        placeholder="Naskah alur cerita panel ini..."
                        rows={4}
                        className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-gray-200 outline-none focus:ring-1 focus:ring-blue-500 transition-all resize-none leading-relaxed font-light"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0 space-y-3">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => generateScript(panel.id)}
                      disabled={panel.isGeneratingScript || isBatchGeneratingManhwa}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-md shadow-blue-600/20 active:scale-95"
                    >
                      {panel.isGeneratingScript ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>{panel.script ? 'Tulis Ulang AI' : 'Buat Naskah AI'}</span>
                    </button>

                    <button
                      onClick={() => generateAudio(panel.id)}
                      disabled={panel.isGeneratingAudio || !panel.script.trim()}
                      className="px-3 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-800 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-md shadow-amber-600/20 active:scale-95"
                      title="Generate Suara MP3"
                    >
                      {panel.isGeneratingAudio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                      <span>MP3</span>
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
                  <p className="text-[10px] text-amber-300/70">Ubah gabungan naskah menjadi audio MP3</p>
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
  );
};
