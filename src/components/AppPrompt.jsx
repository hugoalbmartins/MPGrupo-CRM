import React, { useState, useEffect } from 'react';
import { X, Smartphone, Share, ArrowDown } from 'lucide-react';
import { Button } from './ui/button';

const isIOS = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isSafari = () =>
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const isInStandaloneMode = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true ||
  document.referrer.includes('android-app://');

export const AppPrompt = () => {
  const [mode, setMode] = useState(null);

  useEffect(() => {
    if (isInStandaloneMode()) return;

    const dismissed = localStorage.getItem('app-prompt-dismissed');
    const dismissedTime = parseInt(localStorage.getItem('app-prompt-dismissed-time') || '0');
    const daysSince = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    if (dismissed === 'permanent') return;
    if (dismissedTime && daysSince < 7) return;

    if (isIOS() && isSafari()) {
      setMode('ios');
      return;
    }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      window._deferredPWAPrompt = e;
      const isMobile = /Android|Mobile/i.test(navigator.userAgent);
      if (isMobile) setMode('android');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const dismiss = (permanent = false) => {
    setMode(null);
    if (permanent) {
      localStorage.setItem('app-prompt-dismissed', 'permanent');
    } else {
      localStorage.setItem('app-prompt-dismissed-time', Date.now().toString());
    }
  };

  const installAndroid = async () => {
    const prompt = window._deferredPWAPrompt;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      window._deferredPWAPrompt = null;
      setMode(null);
    }
  };

  if (!mode) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] md:left-auto md:right-4 md:max-w-sm animate-in slide-in-from-bottom-4 duration-400">
      <div className="bg-dark-900 border border-blue-500/25 rounded-2xl shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-semibold text-sm">Instalar App</span>
          </div>
          <button
            onClick={() => dismiss(true)}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3">
          {mode === 'ios' ? (
            <>
              <p className="text-slate-400 text-xs mb-3 leading-relaxed">
                Adicione esta app ao ecra inicial para acesso rapido, mesmo sem internet.
              </p>
              <ol className="space-y-2.5">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">1</span>
                  <div className="flex-1">
                    <span className="text-slate-200 text-xs">Toque em </span>
                    <span className="inline-flex items-center gap-1 text-blue-400 text-xs font-medium">
                      <Share className="w-3.5 h-3.5" />
                      Partilhar
                    </span>
                    <span className="text-slate-200 text-xs"> na barra do Safari</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">2</span>
                  <div className="flex-1">
                    <span className="text-slate-200 text-xs">Role para baixo e toque em </span>
                    <span className="text-blue-400 text-xs font-medium">"Adicionar ao Ecra Inicial"</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">3</span>
                  <div className="flex-1">
                    <span className="text-slate-200 text-xs">Toque em </span>
                    <span className="text-blue-400 text-xs font-medium">"Adicionar"</span>
                    <span className="text-slate-200 text-xs"> no canto superior direito</span>
                  </div>
                </li>
              </ol>
              <div className="mt-3 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-blue-300 text-[11px] leading-relaxed">
                  A app aparecera no ecra inicial como qualquer outra aplicacao.
                </p>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={() => dismiss(false)}
                  size="sm"
                  variant="outline"
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-8"
                >
                  Mais tarde
                </Button>
                <Button
                  onClick={() => dismiss(true)}
                  size="sm"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                >
                  Ok, entendi
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-slate-400 text-xs mb-3 leading-relaxed">
                Instale a app no seu dispositivo para acesso rapido e uma melhor experiencia.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={installAndroid}
                  size="sm"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 gap-1.5"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                  Instalar App
                </Button>
                <Button
                  onClick={() => dismiss(false)}
                  size="sm"
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-8"
                >
                  Agora nao
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
