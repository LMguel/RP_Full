import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, CircularProgress, Typography } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, isFirstAccess } = useAuth();
  const location = useLocation();

  console.log('ProtectedRoute render:', {
    isAuthenticated,
    isLoading, 
    isFirstAccess,
    pathname: location.pathname
  });

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          width: '100vw',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          gap: 3,
        }}
      >
        <CircularProgress 
          size={50} 
          sx={{ 
            color: 'white',
            '& .MuiCircularProgress-circle': {
              strokeLinecap: 'round',
            }
          }} 
        />
        <Typography 
          variant="h6" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.9)',
            fontWeight: 400,
            letterSpacing: '0.5px'
          }}
        >
          Verificando autenticação...
        </Typography>
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.7)',
            textAlign: 'center',
            maxWidth: 300
          }}
        >
          Aguarde enquanto validamos suas credenciais
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se for primeiro acesso e não estiver na página de configurações, redirecionar
  if (isFirstAccess && location.pathname !== '/settings') {
    console.log('Redirecting to settings due to first access');
    return <Navigate to="/settings" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;