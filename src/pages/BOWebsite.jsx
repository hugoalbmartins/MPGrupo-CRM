import React, { useEffect } from "react";
import { ExternalLink, Globe } from "lucide-react";

const BOWebsite = () => {
  const WEBSITE_URL = "https://www.mpgrupo.pt/login";

  useEffect(() => {
    window.open(WEBSITE_URL, '_blank', 'noopener,noreferrer');
  }, []);

  const openWebsite = () => {
    window.open(WEBSITE_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="text-center max-w-2xl px-8">
        <div className="mb-8 inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold-400/10">
          <Globe className="w-10 h-10 text-gold-400" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-4">
          Backoffice do Website MP Grupo
        </h1>

        <p className="text-lg text-dark-300 mb-8">
          Por questoes de seguranca, o website abre numa nova aba do navegador.
        </p>

        <button
          onClick={openWebsite}
          className="inline-flex items-center gap-3 px-8 py-4 btn-gold text-lg font-medium rounded-xl transition-all shadow-lg hover:shadow-xl"
        >
          <ExternalLink className="w-5 h-5" />
          Abrir Backoffice do Website
        </button>

        <p className="text-sm text-dark-400 mt-6">
          URL: {WEBSITE_URL}
        </p>
      </div>
    </div>
  );
};

export default BOWebsite;
