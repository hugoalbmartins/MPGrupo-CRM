import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const BOWebsite = () => {
  const iframeRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  const WEBSITE_URL = "https://www.mpgrupo.pt/login";
  const LOGIN_CREDENTIALS = {
    username: "hugo.martins@mpgrupo.pt",
    password: "admin123"
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setLoading(false);

      if (!autoLoginAttempted) {
        setAutoLoginAttempted(true);
        attemptAutoLogin();
      }
    };

    const handleError = () => {
      setLoading(false);
      setError("Não foi possível carregar o website. Verifique a conexão ou permissões.");
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, [autoLoginAttempted]);

  const attemptAutoLogin = () => {
    try {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;

      try {
        const iframeDocument = iframe.contentWindow.document;

        const usernameField = iframeDocument.querySelector('input[type="email"], input[type="text"], input[name*="user"], input[name*="email"]');
        const passwordField = iframeDocument.querySelector('input[type="password"]');
        const loginButton = iframeDocument.querySelector('button[type="submit"], input[type="submit"], button');

        if (usernameField && passwordField) {
          usernameField.value = LOGIN_CREDENTIALS.username;
          passwordField.value = LOGIN_CREDENTIALS.password;

          usernameField.dispatchEvent(new Event('input', { bubbles: true }));
          passwordField.dispatchEvent(new Event('input', { bubbles: true }));
          usernameField.dispatchEvent(new Event('change', { bubbles: true }));
          passwordField.dispatchEvent(new Event('change', { bubbles: true }));

          setTimeout(() => {
            if (loginButton) {
              loginButton.click();
            }
          }, 100);
        }
      } catch (crossOriginError) {
        console.log("Auto-login bloqueado por política de segurança (CORS/Same-Origin Policy)");
      }
    } catch (err) {
      console.error("Erro ao tentar login automático:", err);
    }
  };

  const openInNewTab = () => {
    window.open(WEBSITE_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">BO Website</h1>
          <p className="font-medium mt-1 text-gray-600">Backoffice do Website MP Grupo</p>
        </div>
        <button
          onClick={openInNewTab}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Abrir em Nova Aba
        </button>
      </div>

      {error && (
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex-1 relative bg-gray-50">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
              <p className="text-gray-600">Carregando backoffice do website...</p>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={WEBSITE_URL}
          className="w-full h-full border-0"
          title="BO Website MP Grupo"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
          allow="fullscreen"
        />
      </div>

      <div className="p-3 bg-gray-100 border-t border-gray-200">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <AlertCircle className="w-4 h-4" />
          <span>
            Se o login automático não funcionar devido a políticas de segurança, use as credenciais:
            <strong className="ml-1">{LOGIN_CREDENTIALS.username}</strong> /
            <strong className="ml-1">{LOGIN_CREDENTIALS.password}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};

export default BOWebsite;
