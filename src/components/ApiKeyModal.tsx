import React from 'react';
import { Key, X, Globe, Cpu, ShieldCheck, Eye, EyeOff, Check, ExternalLink } from 'lucide-react';
import { KIE_MODELS } from '../constants';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProvider: 'google' | 'kie';
  selectedKieModel: string;
  kieApiKey: string;
  googleApiKey: string;
  setKieApiKey: (key: string) => void;
  setGoogleApiKey: (key: string) => void;
  setSelectedKieModel: (model: any) => void;
  saveApiSettings: (provider?: 'google' | 'kie', kieModel?: any, kieKey?: string, googleKey?: string) => void;
  apiKeySaveToast: boolean;
  showKieKey: boolean;
  setShowKieKey: (show: boolean) => void;
  showGoogleKey: boolean;
  setShowGoogleKey: (show: boolean) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  selectedProvider,
  selectedKieModel,
  kieApiKey,
  googleApiKey,
  setKieApiKey,
  setGoogleApiKey,
  setSelectedKieModel,
  saveApiSettings,
  apiKeySaveToast,
  showKieKey,
  setShowKieKey,
  showGoogleKey,
  setShowGoogleKey,
}) => {
  if (!isOpen) return null;

  return (
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
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Pilih Provider AI Utama</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
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
                <p className="text-[11px] text-gray-400">SDK Resmi Google Studio (Gemini Flash)</p>
              </button>

              <button
                type="button"
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

          {/* Provider Configuration */}
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
                    placeholder="Masukkan API Key KIE.ai..."
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

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Pilih Model KIE.ai</label>
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
                  Secara default, aplikasi telah terintegrasi dengan Google AI Studio. Jika ingin menggunakan API Key pribadi khusus, isi di bawah ini.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
                  <span>Kunci API Google AI Studio (Opsional)</span>
                  {googleApiKey && (
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">✓ Kunci Pribadi Aktif</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showGoogleKey ? "text" : "password"}
                    value={googleApiKey}
                    onChange={(e) => setGoogleApiKey(e.target.value)}
                    placeholder="Kosongkan untuk menggunakan kunci bawaan"
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
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Tutup
            </button>
            <button
              onClick={() => {
                saveApiSettings();
                setTimeout(onClose, 400);
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
  );
};
