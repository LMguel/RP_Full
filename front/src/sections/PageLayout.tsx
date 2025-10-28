import React from 'react';
import { Box, Container } from '@mui/material';

const PageLayout: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'auto',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><pattern id='grain' width='100' height='100' patternUnits='userSpaceOnUse'><circle cx='25' cy='25' r='1' fill='white' opacity='0.06'/><circle cx='75' cy='75' r='0.5' fill='white' opacity='0.04'/><circle cx='50' cy='10' r='0.8' fill='white' opacity='0.03'/></pattern></defs><rect width='100%25' height='100%25' fill='url(%23grain)'/></svg>")`,
          pointerEvents: 'none',
        }
      }}
    >
      <Container 
        maxWidth="xl" 
        sx={{ 
          position: 'relative', 
          zIndex: 1, 
          py: 4,
          px: { xs: 2, sm: 3, md: 4 },
          width: '100%',
          maxWidth: '100%',
          margin: '0 auto'
        }}
      >
        {children}
      </Container>
    </Box>
  );
};

export default PageLayout;
