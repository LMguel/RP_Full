import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button } from '@mui/material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
          p={3}
        >
          <Typography variant="h4" color="error" gutterBottom>
            Oops! Algo deu errado
          </Typography>
          <Typography variant="body1" color="textSecondary" mb={2}>
            {this.state.error?.message || 'Erro inesperado na aplicação'}
          </Typography>

          {/* Optional: show stack details to help debugging */}
          {this.state.error && (
            <Box sx={{ width: '100%', maxWidth: 920, bgcolor: 'rgba(255,255,255,0.03)', p: 2, borderRadius: 1, mb: 2 }}>
              <Typography variant="caption" color="textSecondary">Detalhes do erro (clique para expandir)</Typography>
              <details style={{ color: 'white', marginTop: 8 }}>
                <summary style={{ cursor: 'pointer' }}>{this.state.error.message}</summary>
                <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{String(this.state.error.stack || '')}</pre>
              </details>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                window.location.reload();
              }}
            >
              Recarregar Página
            </Button>

            <Button
              variant="contained"
              color="warning"
              onClick={async () => {
                if ('serviceWorker' in navigator) {
                  try {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    for (const r of regs) {
                      try { await r.unregister(); } catch (e) { console.warn('Falha ao desregistrar SW', e); }
                    }
                  } catch (e) {
                    console.warn('Erro ao listar SWs', e);
                  }
                }
                // Forçar reload da rede
                window.location.reload();
              }}
            >
              Remover SW e Recarregar
            </Button>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;