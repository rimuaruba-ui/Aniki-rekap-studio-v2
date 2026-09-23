import React, { useState, useRef, useEffect } from 'react';
import { 
  Volume2, Settings, Music, Sparkles, Loader2, Check, Download, 
  Copy, Trash2, Split, Combine, ListOrdered, FileAudio, X 
} from 'lucide-react';
import { VOICES } from '../constants';
import { TtsPart } from '../types';
import { 
  base64ToArrayBuffer, 
  pcm16ToMp3Blob, 
  mergePcmBuffers, 
  splitTextIntoChunks 
} from '../utils/audioMp3';
import { callGeminiTTSWithRetry, defaultAI } from '../utils/aiHelpers';
import { GoogleGenAI } from '@google/genai';

interface TtsStudioProps {
  ttsText: string;
  setTtsText: (text: string) => void;
  showSyncToast: (msg: string) => void;
  googleApiKey: string;
}

export const TtsStudio: React.FC<TtsStudioProps> = ({
  ttsText,
  setTtsText,
  showSyncToast,
  googleApiKey,
}) => {
  const [ttsParts, setTtsParts] = useState<TtsPart[]>([]);
  const [ttsVoice, setTtsVoice] = useState(VOICES[0].value);
  const [isGeneratingBatchTTS, setIsGeneratingBatchTTS] = useState(false);
  const [isMergingAllParts, setIsMergingAllParts] = useState(false);
  const [mergedFullMp3Url, setMergedFullMp3Url] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const isTtsBatchCancelledRef = useRef<boolean>(false);

  // Auto-split text into parts <= 2500 chars whenever ttsText changes
  useEffect(() => {
    const trimmed = ttsText.trim();
    if (!trimmed) {
      setTtsParts([]);
      setMergedFullMp3Url(null);
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

  const getGenAiClient = () => {
    return googleApiKey && googleApiKey.trim()
      ? new GoogleGenAI({ apiKey: googleApiKey.trim() })
      : defaultAI;
  };

  // Generate Single Part Audio (MP3)
  const generateSinglePartTTS = async (partIndex: number) => {
    const part = ttsParts[partIndex];
    if (!part || !part.text.trim()) return;

    setTtsParts(prev => prev.map((p, idx) => idx === partIndex ? { ...p, isGenerating: true, error: null } : p));
    setTtsError(null);

    try {
      const client = getGenAiClient();
      const response = await callGeminiTTSWithRetry(part.text, ttsVoice, client);

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

      const mergedPcm = mergePcmBuffers(pcmBuffers, 0.25, sampleRate);
      const mergedMp3 = pcm16ToMp3Blob(mergedPcm, 1, sampleRate, 128);

      if (mergedFullMp3Url) {
        URL.revokeObjectURL(mergedFullMp3Url);
      }

      const newUrl = URL.createObjectURL(mergedMp3);
      setMergedFullMp3Url(newUrl);

      showSyncToast(`✓ Berhasil menggabungkan ${readyParts.length} bagian menjadi 1 file MP3 utuh!`);
    } catch (err: any) {
      console.error("Error merging audio parts:", err);
      alert("Gagal menggabungkan audio: " + (err?.message || err));
    } finally {
      setIsMergingAllParts(false);
    }
  };

  const updatePartText = (partIndex: number, newText: string) => {
    setTtsParts(prev => prev.map((p, idx) => {
      if (idx === partIndex) {
        return {
          ...p,
          text: newText,
          charCount: newText.length,
          mp3Url: p.text === newText ? p.mp3Url : null,
          mp3Blob: p.text === newText ? p.mp3Blob : null,
          pcmData: p.text === newText ? p.pcmData : null,
        };
      }
      return p;
    }));
  };

  return (
    <div className="space-y-8 py-4">
      <header className="text-center space-y-3">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
          <Volume2 className="w-3.5 h-3.5" />
          <span>Multi-Part Voiceover & MP3 Merger Studio</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
          Studio <span className="text-amber-400">Text to Speech AI</span>
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-sm md:text-base font-light">
          Ubah naskah cerita manhwa/manga menjadi audio berformat <strong className="text-amber-300 font-semibold">.MP3</strong>. Naskah panjang otomatis dipecah per bagian (maksimal 2.500 karakter) dan dapat digabungkan menjadi 1 file audio utuh.
        </p>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Settings Box */}
        <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Settings className="w-4 h-4 text-amber-400" />
                <span>Karakter Suara AI Neural</span>
              </h2>
              <p className="text-xs text-gray-400">Pilihan model vokal voiceover alami bersuara jernih kualitas studio.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300">Pilih Karakter Suara (Output MP3 128kbps)</label>
              <select 
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-gray-200 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                {VOICES.map(v => (
                  <option key={v.value} value={v.value}>
                    {v.gender === 'female' ? '👩' : '👨'} {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center space-x-3 text-xs text-amber-300">
              <Music className="w-5 h-5 flex-shrink-0 text-amber-400" />
              <span>Semua bagian audio langsung dikonversi ke format <strong>MP3</strong> audio standar yang kompatibel dengan CapCut, Premiere, dan media player.</span>
            </div>
          </div>
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
                  <span>✓ Terbagi menjadi <strong className="text-amber-300">{ttsParts.length} bagian</strong> (maks 2.500 karakter/part).</span>
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

                <textarea 
                  value={part.text}
                  onChange={(e) => updatePartText(index, e.target.value)}
                  rows={4}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-gray-200 outline-none focus:ring-1 focus:ring-amber-500 transition-all resize-none leading-relaxed font-light"
                />

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
                    <button
                      type="button"
                      onClick={() => generateSinglePartTTS(index)}
                      disabled={part.isGenerating || isGeneratingBatchTTS}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-800 text-white font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-md shadow-amber-600/20 active:scale-95"
                    >
                      {part.isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                      <span>{part.mp3Url ? 'Buat Ulang MP3' : 'Hasilkan Suara MP3'}</span>
                    </button>

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

        {/* MASTER AUDIO MERGER SECTION */}
        {ttsParts.length > 0 && (
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
  );
};
