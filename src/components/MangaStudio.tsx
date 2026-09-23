import React, { useState, useRef } from 'react';
import { 
  FileImage, Upload, Trash2, Cpu, Key, Play, RefreshCw, 
  Sparkles, Loader2, Copy, Check, Scissors, Volume2, Info, ArrowRight, Download 
} from 'lucide-react';
import { KIE_MODELS } from '../constants';
import { PanelData, MangaPanelItem } from '../types';
import { 
  optimizeImageForAI, 
  executeUnifiedAIGeneration, 
  parseBatchParagraphs, 
  normalizeErrorMessage,
  bufferToBase64 
} from '../utils/aiHelpers';

interface MangaStudioProps {
  mangaPanels: MangaPanelItem[];
  setMangaPanels: React.Dispatch<React.SetStateAction<MangaPanelItem[]>>;
  generatedMangaScript: string;
  setGeneratedMangaScript: (script: string) => void;
  panels: PanelData[];
  transferManhwaToMangaStudio: () => void;
  transferMangaToManhwaStudio: () => void;
  transferMangaToTTSStudio: () => void;
  selectedProvider: 'google' | 'kie';
  selectedKieModel: any;
  kieApiKey: string;
  googleApiKey: string;
  saveApiSettings: (provider?: 'google' | 'kie', kieModel?: any, kieKey?: string, googleKey?: string) => void;
  setIsApiKeyModalOpen: (open: boolean) => void;
  showSyncToast: (msg: string) => void;
}

export const MangaStudio: React.FC<MangaStudioProps> = ({
  mangaPanels,
  setMangaPanels,
  generatedMangaScript,
  setGeneratedMangaScript,
  panels,
  transferManhwaToMangaStudio,
  transferMangaToManhwaStudio,
  transferMangaToTTSStudio,
  selectedProvider,
  selectedKieModel,
  kieApiKey,
  googleApiKey,
  saveApiSettings,
  setIsApiKeyModalOpen,
  showSyncToast,
}) => {
  const [mangaNarrationStyle, setMangaNarrationStyle] = useState<'santai' | 'formal'>('santai');
  const [mangaIncludeHook, setMangaIncludeHook] = useState(true);
  const [mangaIncludeClosing, setMangaIncludeClosing] = useState(true);
  const [isGeneratingMangaScript, setIsGeneratingMangaScript] = useState(false);
  const [mangaScriptProgress, setMangaScriptProgress] = useState<{ currentBatch: number; totalBatches: number; status: string } | null>(null);
  const [mangaScriptError, setMangaScriptError] = useState<string | null>(null);
  const [mangaBatchError, setMangaBatchError] = useState<{ failedBatchIndex: number; totalBatches: number; errorMessage: string } | null>(null);
  const [mangaCopied, setMangaCopied] = useState(false);

  const mangaAccumulatorRef = useRef<string[]>([]);
  const isMangaCancelledRef = useRef<boolean>(false);
  const mangaFileInputRef = useRef<HTMLInputElement>(null);

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
          }).catch(() => {});
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

  const handleCancelMangaBatch = () => {
    isMangaCancelledRef.current = true;
    setIsGeneratingMangaScript(false);
    setMangaScriptProgress(null);
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

        const response = await executeUnifiedAIGeneration(
          prompt, 
          imageParts,
          selectedProvider,
          selectedKieModel,
          kieApiKey,
          googleApiKey,
          () => setIsApiKeyModalOpen(true)
        );

        const batchText = response.text || '';
        const parsed = parseBatchParagraphs(batchText, batchPanels.length);
        fullScriptAccumulator.push(...parsed);
        mangaAccumulatorRef.current = fullScriptAccumulator;
        setGeneratedMangaScript(fullScriptAccumulator.join('\n\n'));
      }
    } catch (error: any) {
      console.error("Error generating manga script:", error);
      const rawMsg = normalizeErrorMessage(error, `Gagal membuat naskah manga pada Batch ${currentRunningBatch + 1} dari ${totalBatches}.`);
      setMangaBatchError({
        failedBatchIndex: currentRunningBatch,
        totalBatches,
        errorMessage: rawMsg
      });
      setMangaScriptError(rawMsg);
    } finally {
      setIsGeneratingMangaScript(false);
      setMangaScriptProgress(null);
    }
  };

  const totalMangaCharsWithoutSpaces = generatedMangaScript.replace(/\s+/g, '').length;
  const totalMangaWords = generatedMangaScript.trim() ? generatedMangaScript.trim().split(/\s+/).length : 0;
  const totalMangaParagraphs = generatedMangaScript.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

  return (
    <div className="space-y-8">
      {/* Manga Tool Header */}
      <header className="text-center space-y-3">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-bold">
          <FileImage className="w-3.5 h-3.5" />
          <span>Manga RTL Mode • Batch 6 Gambar • 1 Gambar 1 Paragraf</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
          Studio Naskah <span className="text-pink-400">Manga (Right to Left)</span>
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-sm md:text-base font-light">
          Unggah potongan panel manga berurutan (baca kanan ke kiri). AI akan merangkai naskah narasi lengkap yang berkesinambungan siap dijadikan konten video voiceover.
        </p>
      </header>

      {/* Upload Section */}
      <section className="bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-800 shadow-xl text-center space-y-4">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-pink-500/10 rounded-2xl">
            <Upload className="w-8 h-8 text-pink-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Unggah Panel Gambar Manga</h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto mt-1">
              Pilih panel gambar manga berurutan sesuai alur baca (hingga 200 gambar).
            </p>
          </div>

          {panels.length > 0 && (
            <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-500/20 text-blue-300 rounded-xl flex-shrink-0">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Tersedia {panels.length} Panel di Studio Manhwa</p>
                  <p className="text-[11px] text-blue-300/70">Gunakan potongan panel dari studio Manhwa secara langsung.</p>
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

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button 
              onClick={() => mangaFileInputRef.current?.click()}
              className="px-6 py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-pink-600/20 flex items-center space-x-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Pilih Gambar Manga</span>
            </button>

            {mangaPanels.length > 0 && (
              <button
                onClick={() => {
                  setMangaPanels([]);
                  setGeneratedMangaScript('');
                }}
                className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-red-400 hover:text-red-300 font-semibold rounded-xl transition-all border border-gray-700 text-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Kosongkan Panel ({mangaPanels.length})</span>
              </button>
            )}
          </div>

          <input 
            type="file" 
            ref={mangaFileInputRef}
            multiple
            onChange={handleMangaUpload}
            accept="image/*" 
            className="hidden"
          />
        </div>
      </section>

      {/* Model & Setting Selector */}
      {mangaPanels.length > 0 && (
        <section className="bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-800 shadow-xl space-y-6">
          <div className="p-4 bg-gradient-to-r from-pink-950/40 via-purple-950/20 to-gray-900 rounded-2xl border border-pink-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-pink-500/10 text-pink-400 rounded-xl border border-pink-500/20">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-gray-200">Model Manga:</span>
                  <span className="text-xs font-mono font-bold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-lg border border-pink-500/20">
                    {selectedProvider === 'kie' 
                      ? `KIE.ai • ${KIE_MODELS.find(m => m.id === selectedKieModel)?.name}` 
                      : 'Google AI Studio (Gemini Flash)'}
                  </span>
                </div>
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
                className="bg-gray-950 border border-gray-700 text-gray-200 text-xs font-semibold rounded-xl px-3 py-2 focus:border-pink-500 outline-none cursor-pointer"
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
                <span>Kunci API</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Gaya Narasi</label>
              <div className="grid grid-cols-2 gap-2 bg-gray-950 p-1.5 rounded-2xl border border-gray-800">
                <button
                  onClick={() => setMangaNarrationStyle('santai')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                    mangaNarrationStyle === 'santai' ? 'bg-pink-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Santai / Gaul (YouTube)
                </button>
                <button
                  onClick={() => setMangaNarrationStyle('formal')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                    mangaNarrationStyle === 'formal' ? 'bg-pink-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Formal / Baku
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-4 pt-6">
              <label className="flex items-center space-x-2 text-xs text-gray-300 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={mangaIncludeHook}
                  onChange={(e) => setMangaIncludeHook(e.target.checked)}
                  className="rounded text-pink-600 focus:ring-pink-500 bg-gray-950 border-gray-700"
                />
                <span>Sertakan Hook Pembuka</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-gray-300 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={mangaIncludeClosing}
                  onChange={(e) => setMangaIncludeClosing(e.target.checked)}
                  className="rounded text-pink-600 focus:ring-pink-500 bg-gray-950 border-gray-700"
                />
                <span>Sertakan Outro Penutup</span>
              </label>
            </div>
          </div>

          {/* Batch Generate Button & Error Handling */}
          <div className="pt-2 space-y-4">
            {mangaBatchError && !isGeneratingMangaScript && (
              <div className="bg-amber-950/40 border-2 border-amber-500/50 p-5 rounded-2xl space-y-4 shadow-xl">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl flex-shrink-0">
                    <Info className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-amber-200">
                      Batch {mangaBatchError.failedBatchIndex + 1} dari {mangaBatchError.totalBatches} Terkendala
                    </h4>
                    <p className="text-xs text-amber-300/80 leading-relaxed">
                      {mangaBatchError.errorMessage}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={() => generateMangaScript(mangaBatchError.failedBatchIndex)}
                    className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center space-x-2 cursor-pointer active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>▶️ Lanjutkan Batch ({mangaBatchError.failedBatchIndex + 1} s/d {mangaBatchError.totalBatches})</span>
                  </button>

                  <button
                    onClick={() => generateMangaScript(0)}
                    className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-semibold text-xs rounded-xl transition-all border border-gray-700 flex items-center space-x-2 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Mulai Dari Awal (Batch 1)</span>
                  </button>
                </div>
              </div>
            )}

            {!isGeneratingMangaScript && (!mangaBatchError || mangaBatchError.failedBatchIndex === 0) && (
              <button
                onClick={() => generateMangaScript(0)}
                disabled={isGeneratingMangaScript || mangaPanels.length === 0}
                className="w-full py-4 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:from-gray-800 disabled:to-gray-800 text-white font-black text-base rounded-2xl transition-all shadow-xl shadow-pink-600/25 flex items-center justify-center space-x-3 cursor-pointer"
              >
                <Sparkles className="w-5 h-5 text-amber-300" />
                <span>🚀 Generate Naskah Manga ({mangaPanels.length} Panel • Batch 6 Gambar)</span>
              </button>
            )}

            {isGeneratingMangaScript && mangaScriptProgress && (
              <div className="bg-pink-950/50 border border-pink-500/30 p-4 rounded-2xl space-y-3 shadow-xl">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-pink-300 flex items-center space-x-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-400" />
                    <span>{mangaScriptProgress.status}</span>
                  </span>
                  <span className="text-white font-mono">
                    {Math.round((mangaScriptProgress.currentBatch / mangaScriptProgress.totalBatches) * 100)}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-pink-500 to-amber-400 transition-all duration-500"
                    style={{ width: `${(mangaScriptProgress.currentBatch / mangaScriptProgress.totalBatches) * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-gray-400 italic">
                    AI sedang menganalisis gambar dengan alur baca Kanan ke Kiri...
                  </p>
                  <button
                    onClick={handleCancelMangaBatch}
                    className="px-3.5 py-1.5 bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all flex items-center space-x-1 cursor-pointer"
                  >
                    <span>Batalkan</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Generated Script Display & Quick Actions */}
      {generatedMangaScript && (
        <section className="bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-800 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center">
                <FileImage className="w-5 h-5 mr-2 text-pink-400" />
                Naskah Alur Cerita Manga Selesai
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Naskah berkesinambungan (1 panel = 1 paragraf) siap dipindahkan ke TTS Studio.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedMangaScript);
                  setMangaCopied(true);
                  setTimeout(() => setMangaCopied(false), 2000);
                }}
                className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-pink-600/20 flex items-center space-x-1.5 cursor-pointer"
              >
                {mangaCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{mangaCopied ? 'Tersalin!' : 'Salin Naskah'}</span>
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-950 p-3 rounded-2xl border border-gray-800 text-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Karakter (Tanpa Spasi)</span>
              <span className="text-lg font-black text-pink-400 font-mono">{totalMangaCharsWithoutSpaces.toLocaleString()}</span>
            </div>
            <div className="bg-gray-950 p-3 rounded-2xl border border-gray-800 text-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Total Kata</span>
              <span className="text-lg font-black text-emerald-400 font-mono">{totalMangaWords.toLocaleString()}</span>
            </div>
            <div className="bg-gray-950 p-3 rounded-2xl border border-gray-800 text-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Total Paragraf</span>
              <span className="text-lg font-black text-amber-400 font-mono">{totalMangaParagraphs}</span>
            </div>
            <div className="bg-gray-950 p-3 rounded-2xl border border-gray-800 text-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Estimasi Voiceover</span>
              <span className="text-lg font-black text-blue-400 font-mono">~{Math.ceil(totalMangaWords / 130)} Menit</span>
            </div>
          </div>

          <textarea
            value={generatedMangaScript}
            onChange={(e) => setGeneratedMangaScript(e.target.value)}
            rows={10}
            className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs md:text-sm text-gray-200 focus:ring-2 focus:ring-pink-500 outline-none transition-all resize-none leading-relaxed font-light"
          />

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-800">
            <button
              type="button"
              onClick={transferMangaToTTSStudio}
              className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs md:text-sm rounded-xl transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
            >
              <Volume2 className="w-4 h-4" />
              <span>⚡ Pindahkan Naskah ke Voiceover Studio (TTS MP3)</span>
            </button>

            <button
              type="button"
              onClick={transferMangaToManhwaStudio}
              className="w-full sm:w-auto px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-xs rounded-xl transition-all border border-gray-700 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Scissors className="w-4 h-4" />
              <span>Buka Gambar di Studio Manhwa</span>
            </button>
          </div>
        </section>
      )}

      {/* Panels Gallery */}
      {mangaPanels.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-base font-bold text-white flex items-center">
              <FileImage className="w-5 h-5 mr-2 text-pink-400" />
              <span>Daftar Panel Manga Urut ({mangaPanels.length})</span>
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {mangaPanels.map((panel, idx) => (
              <div 
                key={panel.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden relative group aspect-[3/4] flex items-center justify-center"
              >
                <img 
                  src={panel.src} 
                  alt={`Manga Panel ${idx + 1}`} 
                  className="max-h-full max-w-full object-contain"
                />
                <div className="absolute top-2 left-2 bg-pink-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md shadow">
                  #{idx + 1}
                </div>
                <button
                  onClick={() => removeMangaPanel(panel.id)}
                  className="absolute top-2 right-2 p-1 bg-gray-900/80 hover:bg-red-600 text-gray-300 hover:text-white rounded-md transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
