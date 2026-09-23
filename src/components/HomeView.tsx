import React from 'react';
import { Sparkles, Scissors, FileImage, Volume2, ArrowRight, Info } from 'lucide-react';

interface HomeViewProps {
  onSelectTab: (tab: 'manhwa-tool' | 'manga-script' | 'tts-tool') => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onSelectTab }) => {
  return (
    <div className="space-y-10 py-6">
      <header className="text-center space-y-5">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Engine Naskah Multi-Batch 6 Gambar & Studio Voiceover MP3</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight">
          Studio Alur Cerita <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Manhwa & Manga AI</span>
        </h1>
        <p className="text-base md:text-lg text-gray-400 max-w-2xl mx-auto font-light">
          Solusi terpadu recap video YouTube & TikTok: upload hingga 200 panel, AI proses per 6 gambar secara berkesinambungan (1 gambar = 1 paragraf), hitung karakter instan, dan buat voiceover audio MP3 berkualitas.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          onClick={() => onSelectTab('manhwa-tool')}
          className="bg-gray-900 p-7 rounded-3xl border border-gray-800 hover:border-blue-500/60 transition-all cursor-pointer group shadow-xl hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Scissors className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="text-xl font-bold text-white">Alur Cerita Manhwa</h3>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full">Batch 6</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Batch 6 gambar per giliran dengan memori alur cerita. Dilengkapi fitur gabung naskah, hitung karakter tanpa spasi, dan unduh satu klik.
            </p>
          </div>
          <div className="flex items-center text-blue-400 font-bold text-sm">
            <span>Buka Studio Manhwa</span>
            <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        <div 
          onClick={() => onSelectTab('manga-script')}
          className="bg-gray-900 p-7 rounded-3xl border border-gray-800 hover:border-pink-500/60 transition-all cursor-pointer group shadow-xl hover:shadow-2xl hover:shadow-pink-500/10 flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 bg-pink-500/10 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <FileImage className="w-6 h-6 text-pink-400" />
            </div>
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="text-xl font-bold text-white">Naskah Manga RTL</h3>
              <span className="text-[10px] bg-pink-500/20 text-pink-300 font-bold px-2 py-0.5 rounded-full">RTL</span>
            </div>
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
          onClick={() => onSelectTab('tts-tool')}
          className="bg-gray-900 p-7 rounded-3xl border border-gray-800 hover:border-amber-500/60 transition-all cursor-pointer group shadow-xl hover:shadow-2xl hover:shadow-amber-500/10 flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Volume2 className="w-6 h-6 text-amber-400" />
            </div>
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="text-xl font-bold text-white">Voiceover Studio (TTS)</h3>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full">MP3 AI</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Ubah naskah cerita menjadi audio MP3 suara studio dengan pilihan vokal pria & wanita ekspresif, pembagian otomatis part 2.500 karakter, dan merger audio utuh.
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
  );
};
