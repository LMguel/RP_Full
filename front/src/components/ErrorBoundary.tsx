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

  public componentDidCatch(error: Error) {
    // Logar apenas a mensagem, nunca o stack completo em produção
    console.error('[ErrorBoundary] Erro capturado:', error?.message ?? 'desconhecido');
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
          <Typography variant="body1" color="textSecondary" mb={3}>
            Ocorreu um problema inesperado. Nossa equipe foi notificada.
          </Typography>

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