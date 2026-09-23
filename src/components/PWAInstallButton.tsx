import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return (
      <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold">
        <CheckCircle className="w-3.5 h-3.5" />
        <span>App Terpasang</span>
      </div>
    );
  }

  return (
    <>
      {isInstallable && (
        <button
          onClick={install}
          className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-600/25 flex items-center space-x-1.5 cursor-pointer active:scale-95 animate-pulse"
          title="Install AniKi Studio sebagai Aplikasi PWA"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>
      )}

      {isIOS && (
        <>
          <button
            onClick={() => setShowIOSGuide(true)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-xl border border-gray-700 flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5 text-pink-400" />
            <span>Install iOS</span>
          </button>

          {showIOSGuide && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
              <div className="w-full max-w-sm rounded-2xl bg-gray-900 border border-gray-700 p-6 shadow-2xl text-left space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-5 h-5 text-blue-400" />
                    <h3 className="text-base font-bold text-white">Install di iPhone / iPad</h3>
                  </div>
                  <button 
                    onClick={() => setShowIOSGuide(false)}
                    className="p-1 text-gray-400 hover:text-white rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="text-xs text-gray-300 space-y-2 leading-relaxed bg-gray-950 p-4 rounded-xl border border-gray-800">
                  <p>1. Buka halaman ini di browser <strong>Safari</strong>.</p>
                  <p>2. Tekan tombol <strong>Share / Bagikan</strong> (ikon kotak dengan panah ke atas) di bilah bawah.</p>
                  <p>3. Geser ke bawah lalu pilih <strong>Add to Home Screen (Tambah ke Layar Utama)</strong>.</p>
                </div>

                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Mengerti
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};
