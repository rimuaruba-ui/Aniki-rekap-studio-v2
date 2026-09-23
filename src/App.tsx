import React, { useState, useEffect } from 'react';
import { 
  Home as HomeIcon, Scissors, FileImage, Volume2, Key, CheckCircle, 
  Sparkles, Layers, Play 
} from 'lucide-react';
import { PanelData, MangaPanelItem } from './types';
import { KIE_MODELS } from './constants';
import { ApiKeyModal } from './components/ApiKeyModal';
import { HomeView } from './components/HomeView';
import { ManhwaStudio } from './components/ManhwaStudio';
import { MangaStudio } from './components/MangaStudio';
import { TtsStudio } from './components/TtsStudio';

export default function App() {
  // Navigation State (Extend Image has been completely removed)
  const [activeTab, setActiveTab] = useState<'home' | 'manhwa-tool' | 'manga-script' | 'tts-tool'>('home');

  // Shared State across studios
  const [panels, setPanels] = useState<PanelData[]>([]);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [splitPoints, setSplitPoints] = useState<number[]>([0]);
  const [hiddenPanels, setHiddenPanels] = useState<number[]>([]);
  
  // Manga Studio State
  const [mangaPanels, setMangaPanels] = useState<MangaPanelItem[]>([]);
  const [generatedMangaScript, setGeneratedMangaScript] = useState('');

  // TTS Studio State
  const [ttsText, setTtsText] = useState('');

  // API Key & Model Configuration
  const [selectedProvider, setSelectedProvider] = useState<'google' | 'kie'>('google');
  const [selectedKieModel, setSelectedKieModel] = useState<typeof KIE_MODELS[number]['id']>('gemini-3-6-flash');
  const [kieApiKey, setKieApiKey] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeySaveToast, setApiKeySaveToast] = useState(false);
  const [showKieKey, setShowKieKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);

  // Sync Toast Notification
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);

  // Load Saved API Settings from localStorage
  useEffect(() => {
    try {
      const savedProvider = localStorage.getItem('aniki_ai_provider') as 'google' | 'kie' | null;
      if (savedProvider) setSelectedProvider(savedProvider);

      const savedKieModel = localStorage.getItem('aniki_kie_model');
      if (savedKieModel && KIE_MODELS.some(m => m.id === savedKieModel)) {
        setSelectedKieModel(savedKieModel as any);
      }

      const savedKieKey = localStorage.getItem('aniki_kie_api_key');
      if (savedKieKey) setKieApiKey(savedKieKey);

      const savedGoogleKey = localStorage.getItem('aniki_google_api_key');
      if (savedGoogleKey) setGoogleApiKey(savedGoogleKey);
    } catch {
      // localStorage might be unavailable in some sandboxes
    }
  }, []);

  const saveApiSettings = (
    provider: 'google' | 'kie' = selectedProvider,
    kieModel: typeof KIE_MODELS[number]['id'] = selectedKieModel,
    kieKey: string = kieApiKey,
    googleKey: string = googleApiKey
  ) => {
    try {
      localStorage.setItem('aniki_ai_provider', provider);
      localStorage.setItem('aniki_kie_model', kieModel);
      localStorage.setItem('aniki_kie_api_key', kieKey);
      localStorage.setItem('aniki_google_api_key', googleKey);
      setSelectedProvider(provider);
      setSelectedKieModel(kieModel);
      setKieApiKey(kieKey);
      setGoogleApiKey(googleKey);

      setApiKeySaveToast(true);
      setTimeout(() => setApiKeySaveToast(false), 2000);
      showSyncToast(`✓ Pengaturan AI diperbarui (${provider === 'kie' ? 'KIE.ai' : 'Google AI Studio'})`);
    } catch (err) {
      console.error("Error saving settings to localStorage:", err);
    }
  };

  const showSyncToast = (message: string) => {
    setSyncToastMessage(message);
    setTimeout(() => {
      setSyncToastMessage(null);
    }, 3500);
  };

  // Inter-studio transfer utilities
  const transferManhwaToMangaStudio = () => {
    if (panels.length === 0) {
      alert("Belum ada panel di Studio Manhwa. Unggah atau buat panel terlebih dahulu.");
      return;
    }

    const convertedMangaPanels: MangaPanelItem[] = panels.map((p, index) => ({
      id: `manhwa_panel_${p.id}_${index}`,
      src: p.imageSrc,
      dataUrl: p.imageSrc,
    }));

    setMangaPanels(convertedMangaPanels);
    const existingCombined = panels.map(p => p.script.trim()).filter(Boolean).join('\n\n');
    if (existingCombined) {
      setGeneratedMangaScript(existingCombined);
    }

    setActiveTab('manga-script');
    showSyncToast(`✓ ${panels.length} Panel & Naskah Manhwa berhasil dikirim ke Studio Manga!`);
  };

  const transferMangaToManhwaStudio = () => {
    if (mangaPanels.length === 0) {
      alert("Belum ada panel di Studio Manga. Unggah panel terlebih dahulu.");
      return;
    }

    const convertedPanels: PanelData[] = mangaPanels.map((mp, index) => ({
      id: index + 1,
      startY: -1 - index,
      imageSrc: mp.dataUrl || mp.src,
      script: '',
      voice: 'Aoede',
      audioUrl: null,
      isGeneratingScript: false,
      isGeneratingAudio: false,
      error: null,
    }));

    setOriginalImage(null);
    setSplitPoints([0]);
    setPanels(convertedPanels);

    if (generatedMangaScript.trim()) {
      const parts = generatedMangaScript.split(/\n\s*\n/).filter(p => p.trim());
      setPanels(prev => prev.map((p, idx) => ({
        ...p,
        script: parts[idx] || p.script,
      })));
    }

    setActiveTab('manhwa-tool');
    showSyncToast(`✓ ${mangaPanels.length} Panel Manga berhasil dikirim ke Studio Manhwa!`);
  };

  const transferMangaToTTSStudio = () => {
    if (!generatedMangaScript.trim()) {
      alert("Belum ada naskah manga yang digenerate. Buat naskah terlebih dahulu.");
      return;
    }

    setTtsText(generatedMangaScript);
    setActiveTab('tts-tool');
    showSyncToast(`✓ Naskah Manga berhasil dimuat ke Voiceover Studio!`);
  };

  const transferManhwaToTTSStudio = () => {
    const combinedScript = panels
      .map(p => p.script.trim())
      .filter(Boolean)
      .join('\n\n');

    if (!combinedScript) {
      alert("Belum ada naskah panel di Studio Manhwa. Buat naskah terlebih dahulu.");
      return;
    }

    setTtsText(combinedScript);
    setActiveTab('tts-tool');
    showSyncToast(`✓ Naskah Manhwa (${panels.length} panel) berhasil dimuat ke Voiceover Studio!`);
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans antialiased overflow-hidden">
      {/* Toast Notification */}
      {syncToastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-2.5 animate-bounce text-xs md:text-sm font-bold border border-emerald-400/40">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{syncToastMessage}</span>
        </div>
      )}

      {/* Desktop Sidebar Navigation */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col justify-between hidden md:flex z-20">
        <div>
          {/* Logo / Header */}
          <div className="p-6 border-b border-gray-800 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-sm tracking-tight text-white leading-tight">
                AniKi Recap Studio
              </h1>
              <p className="text-[10px] text-gray-400 font-medium">
                Story AI & Voiceover MP3
              </p>
            </div>
          </div>

          {/* Nav List (Extend option removed) */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveTab('home')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'home'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              }`}
            >
              <HomeIcon className="w-4 h-4" />
              <span>Beranda</span>
            </button>

            <button
              onClick={() => setActiveTab('manhwa-tool')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'manhwa-tool'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              }`}
            >
              <Scissors className="w-4 h-4" />
              <span>Alur Cerita Manhwa</span>
            </button>

            <button
              onClick={() => setActiveTab('manga-script')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'manga-script'
                  ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/25'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              }`}
            >
              <FileImage className="w-4 h-4" />
              <span>Naskah Manga RTL</span>
            </button>

            <button
              onClick={() => setActiveTab('tts-tool')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'tts-tool'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>Voiceover Studio (TTS)</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer / API Key trigger */}
        <div className="p-4 border-t border-gray-800 space-y-3">
          <div 
            onClick={() => setIsApiKeyModalOpen(true)}
            className="p-3 bg-gray-950/80 hover:bg-gray-800/80 border border-gray-800 rounded-2xl cursor-pointer transition-all flex items-center justify-between group"
          >
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl group-hover:scale-110 transition-transform flex-shrink-0">
                <Key className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate">Kunci API & Model</p>
                <p className="text-[10px] text-gray-400 truncate">
                  {selectedProvider === 'kie' ? `KIE: ${KIE_MODELS.find(m => m.id === selectedKieModel)?.name}` : 'Google AI Studio'}
                </p>
              </div>
            </div>
            <span className="text-xs text-gray-500 group-hover:text-white">⚙️</span>
          </div>

          <div className="text-[10px] text-gray-500 text-center">
            AniKi Recap Studio v3.2
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-gray-900/60 backdrop-blur border-b border-gray-800 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              {activeTab === 'home' && 'Beranda'}
              {activeTab === 'manhwa-tool' && 'Studio Alur Cerita Manhwa'}
              {activeTab === 'manga-script' && 'Studio Naskah Manga RTL'}
              {activeTab === 'tts-tool' && 'Studio Voiceover AI (MP3)'}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsApiKeyModalOpen(true)}
              className="px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl border border-gray-700 flex items-center space-x-2 transition-all cursor-pointer shadow-sm"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Provider:</span>
              <span className="text-amber-400 font-mono">
                {selectedProvider === 'kie' ? 'KIE.ai' : 'Google AI'}
              </span>
            </button>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto pb-16">
            {activeTab === 'home' && (
              <HomeView onSelectTab={(tab) => setActiveTab(tab)} />
            )}

            {activeTab === 'manhwa-tool' && (
              <ManhwaStudio
                panels={panels}
                setPanels={setPanels}
                originalImage={originalImage}
                setOriginalImage={setOriginalImage}
                splitPoints={splitPoints}
                setSplitPoints={setSplitPoints}
                hiddenPanels={hiddenPanels}
                setHiddenPanels={setHiddenPanels}
                mangaPanels={mangaPanels}
                transferMangaToManhwaStudio={transferMangaToManhwaStudio}
                transferManhwaToMangaStudio={transferManhwaToMangaStudio}
                transferManhwaToTTSStudio={transferManhwaToTTSStudio}
                selectedProvider={selectedProvider}
                selectedKieModel={selectedKieModel}
                kieApiKey={kieApiKey}
                googleApiKey={googleApiKey}
                saveApiSettings={saveApiSettings}
                setIsApiKeyModalOpen={setIsApiKeyModalOpen}
                showSyncToast={showSyncToast}
              />
            )}

            {activeTab === 'manga-script' && (
              <MangaStudio
                mangaPanels={mangaPanels}
                setMangaPanels={setMangaPanels}
                generatedMangaScript={generatedMangaScript}
                setGeneratedMangaScript={setGeneratedMangaScript}
                panels={panels}
                transferManhwaToMangaStudio={transferManhwaToMangaStudio}
                transferMangaToManhwaStudio={transferMangaToManhwaStudio}
                transferMangaToTTSStudio={transferMangaToTTSStudio}
                selectedProvider={selectedProvider}
                selectedKieModel={selectedKieModel}
                kieApiKey={kieApiKey}
                googleApiKey={googleApiKey}
                saveApiSettings={saveApiSettings}
                setIsApiKeyModalOpen={setIsApiKeyModalOpen}
                showSyncToast={showSyncToast}
              />
            )}

            {activeTab === 'tts-tool' && (
              <TtsStudio
                ttsText={ttsText}
                setTtsText={setTtsText}
                showSyncToast={showSyncToast}
                googleApiKey={googleApiKey}
              />
            )}
          </div>
        </main>

        {/* Mobile Navigation (Bottom Bar - Extend removed) */}
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
            onClick={() => setActiveTab('tts-tool')}
            className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
              activeTab === 'tts-tool' ? 'text-amber-400 bg-amber-950/60 font-bold' : 'text-gray-400'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">TTS MP3</span>
          </button>
        </div>

        {/* Footer */}
        <footer className="text-center text-gray-500 text-xs py-4 border-t border-gray-900 hidden md:block">
          <p>© 2026 AniKi Recap Studio • Batch Engine 6 Gambar & Studio Voiceover MP3</p>
        </footer>
      </div>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        selectedProvider={selectedProvider}
        selectedKieModel={selectedKieModel}
        kieApiKey={kieApiKey}
        googleApiKey={googleApiKey}
        setKieApiKey={setKieApiKey}
        setGoogleApiKey={setGoogleApiKey}
        setSelectedKieModel={setSelectedKieModel}
        saveApiSettings={saveApiSettings}
        apiKeySaveToast={apiKeySaveToast}
        showKieKey={showKieKey}
        setShowKieKey={setShowKieKey}
        showGoogleKey={showGoogleKey}
        setShowGoogleKey={setShowGoogleKey}
      />
    </div>
  );
}
