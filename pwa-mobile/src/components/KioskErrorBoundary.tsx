import React from 'react';

interface Props { children: React.ReactNode }
interface State { hasError: boolean; errorId: string }

export class KioskErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorId: '' };
  }

  static getDerivedStateFromError(): State {
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`;
    return { hasError: true, errorId };
  }

  componentDidCatch(error: Error) {
    const msg = error?.message ?? 'desconhecido';
    console.error('[KioskErrorBoundary] Erro capturado:', msg);
  }

  handleRecover = () => {
    this.setState({ hasError: false, errorId: '' });
    localStorage.setItem('@kiosk:active', 'true');
    window.location.replace('/kiosk');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-100 mb-2">Tela indisponível</h1>
          <p className="text-slate-400 text-base mb-1 max-w-xs">
            Ocorreu um erro inesperado no sistema de registro.
          </p>
          <p className="text-slate-500 text-sm mb-6 max-w-xs">
            Se o problema persistir após reabrir, entre em contato com o
            <span className="text-slate-300 font-semibold"> administrador do sistema</span>.
          </p>
          {this.state.errorId && (
            <p className="text-slate-600 text-xs mb-6 font-mono">
              Código: {this.state.errorId}
            </p>
          )}
          <button
            onClick={this.handleRecover}
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xl font-bold px-10 py-5 rounded-3xl transition-all shadow-2xl"
          >
            Reabrir modo de registro
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default KioskErrorBoundary;
