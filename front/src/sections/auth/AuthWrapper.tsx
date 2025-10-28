import { Box } from '@mui/material';
import React from 'react';

// Component for wrapping authentication pages (login, register) with consistent styling
const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: { xs: 2, sm: 3, md: 4 }
      }}
    >
      <Box
        sx={{
          maxWidth: 480,
          width: '100%',
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: { xs: 2, sm: 3, md: 4 },
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)'
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default AuthWrapper;
