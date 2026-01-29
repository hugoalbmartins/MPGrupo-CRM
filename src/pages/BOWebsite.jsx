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
    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center max-w-2xl px-8">
        <div className="mb-8 inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100">
          <Globe className="w-10 h-10 text-blue-600" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Backoffice do Website MP Grupo
        </h1>

        <p className="text-lg text-gray-600 mb-8">
          Por questões de segurança, o website abre numa nova aba do navegador.
        </p>

        <button
          onClick={openWebsite}
          className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-medium rounded-lg transition-colors shadow-lg hover:shadow-xl"
        >
          <ExternalLink className="w-5 h-5" />
          Abrir Backoffice do Website
        </button>

        <p className="text-sm text-gray-500 mt-6">
          URL: {WEBSITE_URL}
        </p>
      </div>
    </div>
  );
};

export default BOWebsite;
