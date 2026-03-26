import React from "react";
import { CircleAlert as AlertCircle } from "lucide-react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-dark-900 rounded-lg border border-red-500/30">
          <div className="w-full max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
              <h2 className="text-lg font-bold text-white">
                Erro ao carregar
              </h2>
            </div>
            {this.state.error && (
              <div className="bg-red-950/50 border border-red-500/30 rounded-lg p-4 mb-4">
                <p className="font-semibold text-red-400 mb-2 text-sm">Erro:</p>
                <p className="text-red-300 text-xs font-mono break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
            {this.state.errorInfo && (
              <div className="bg-dark-800 rounded-lg p-4 mb-4">
                <p className="font-semibold text-slate-400 mb-2 text-sm">Stack:</p>
                <pre className="text-xs text-slate-500 overflow-auto max-h-48 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              </div>
            )}
            <button
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm mr-2"
            >
              Tentar novamente
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-dark-700 text-white px-4 py-2 rounded-lg hover:bg-dark-600 transition-colors text-sm border border-dark-600"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
