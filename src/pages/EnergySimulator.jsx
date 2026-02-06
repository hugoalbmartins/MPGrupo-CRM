import React, { useState } from "react";
import { Loader2, ExternalLink, RotateCcw, Maximize2, Minimize2 } from "lucide-react";

const SIMULATOR_URL = "https://mpgrupo-site.vercel.app";

const EnergySimulator = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  const handleReload = () => {
    setLoading(true);
    setError(false);
    const iframe = document.getElementById("simulator-iframe");
    if (iframe) {
      iframe.src = SIMULATOR_URL;
    }
  };

  return (
    <div className={`${fullscreen ? "fixed inset-0 z-50 bg-dark-900" : "h-full"} flex flex-col`}>
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.06] bg-dark-800/50 flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white">Simulador de Poupanca Energetica</h1>
          <p className="text-xs text-dark-400 mt-0.5">
            Simulador integrado do MPGrupo - atualizado automaticamente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReload}
            className="p-2 rounded-lg text-dark-300 hover:text-white hover:bg-white/5 transition-colors"
            title="Recarregar simulador"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-2 rounded-lg text-dark-300 hover:text-white hover:bg-white/5 transition-colors"
            title={fullscreen ? "Sair do ecra inteiro" : "Ecra inteiro"}
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <a
            href={SIMULATOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-dark-300 hover:text-white hover:bg-white/5 transition-colors"
            title="Abrir em nova aba"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-900/80 z-10">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-gold-400" />
              <p className="text-sm text-dark-300">A carregar simulador...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-900/80 z-10">
            <div className="text-center max-w-md px-6">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Simulador indisponivel
              </h2>
              <p className="text-dark-300 text-sm mb-6">
                Nao foi possivel carregar o simulador. Verifique a sua ligacao ou tente abrir diretamente.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleReload}
                  className="px-4 py-2 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-colors text-sm font-medium"
                >
                  Tentar novamente
                </button>
                <a
                  href={SIMULATOR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg btn-gold text-sm font-medium"
                >
                  Abrir em nova aba
                </a>
              </div>
            </div>
          </div>
        )}

        <iframe
          id="simulator-iframe"
          src={SIMULATOR_URL}
          onLoad={handleLoad}
          onError={handleError}
          title="Simulador de Poupanca Energetica"
          className="w-full h-full border-0"
          style={{ minHeight: fullscreen ? "calc(100vh - 56px)" : "calc(100vh - 120px)" }}
          allow="clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
};

export default EnergySimulator;
