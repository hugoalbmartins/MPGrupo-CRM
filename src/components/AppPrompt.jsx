import React, { useState, useEffect } from 'react';
import { X, Smartphone } from 'lucide-react';
import { Button } from './ui/button';

export const AppPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const checkIfShouldShowPrompt = () => {
      const promptDismissed = localStorage.getItem('app-prompt-dismissed');
      const dismissedTime = localStorage.getItem('app-prompt-dismissed-time');

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          window.navigator.standalone ||
                          document.referrer.includes('android-app://');

      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (dismissedTime) {
        const daysSinceDismissal = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissal < 7) {
          return;
        }
      }

      if (isMobile && !isStandalone && promptDismissed !== 'permanent') {
        setShowPrompt(true);
      }
    };

    checkIfShouldShowPrompt();
  }, []);

  const handleDismiss = (permanent = false) => {
    setShowPrompt(false);
    if (permanent) {
      localStorage.setItem('app-prompt-dismissed', 'permanent');
    } else {
      localStorage.setItem('app-prompt-dismissed-time', Date.now().toString());
    }
  };

  const handleOpenApp = () => {
    const appUrl = window.location.origin;
    window.location.href = appUrl;
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-500 md:left-auto md:right-4 md:max-w-md">
      <div className="bg-gradient-to-br from-dark-900 to-dark-850 border border-cyan-500/20 rounded-xl shadow-2xl shadow-cyan-500/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm mb-1">
              Usar App Instalada
            </h3>
            <p className="text-slate-400 text-xs mb-3">
              Para uma melhor experiencia, recomendamos que use a aplicacao instalada no seu dispositivo.
            </p>

            <div className="flex gap-2">
              <Button
                onClick={handleOpenApp}
                size="sm"
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs"
              >
                Abrir App
              </Button>
              <Button
                onClick={() => handleDismiss(false)}
                size="sm"
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-800 text-xs"
              >
                Mais tarde
              </Button>
            </div>
          </div>

          <button
            onClick={() => handleDismiss(true)}
            className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Fechar permanentemente"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
