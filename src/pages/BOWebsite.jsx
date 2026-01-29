import React, { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

const BOWebsite = () => {
  const iframeRef = useRef(null);
  const [loading, setLoading] = useState(true);

  const WEBSITE_URL = "https://www.mpgrupo.pt/login";

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setLoading(false);
    };

    iframe.addEventListener('load', handleLoad);

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, []);

  const openInNewTab = () => {
    window.open(WEBSITE_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="h-full w-full relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-gray-600">Carregando website...</p>
          </div>
        </div>
      )}

      <button
        onClick={openInNewTab}
        className="absolute top-4 right-4 z-20 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg"
      >
        <ExternalLink className="w-4 h-4" />
        Abrir em Nova Aba
      </button>

      <iframe
        ref={iframeRef}
        src={WEBSITE_URL}
        className="w-full h-full border-0"
        title="BO Website MP Grupo"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
        allow="fullscreen"
      />
    </div>
  );
};

export default BOWebsite;
