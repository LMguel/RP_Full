import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface FirstAccessModalProps {
  open: boolean;
  onClose: () => void;
}

const FirstAccessModal: React.FC<FirstAccessModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();

  const handleGoToSettings = () => {
    onClose();
    navigate('/settings');
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          overflow: 'hidden'
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <DialogTitle sx={{ 
          textAlign: 'center', 
          pb: 1,
          fontSize: '1.5rem',
          fontWeight: 'bold'
        }}>
          <Box display="flex" alignItems="center" justifyContent="center" gap={2}>
            <SettingsIcon fontSize="large" />
            Bem-vindo ao Sistema!
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ textAlign: 'center', px: 4 }}>
          <Alert 
            severity="info" 
            sx={{ 
              mb: 3, 
              backgroundColor: 'rgba(255,255,255,0.1)', 
              color: 'white',
              '& .MuiAlert-icon': {
                color: 'white'
              }
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              Primeiramente configure o sistema de acordo com as normas da sua empresa.
            </Typography>
          </Alert>
          
          <Typography variant="body2" sx={{ mb: 2, opacity: 0.9 }}>
            É necessário configurar os parâmetros básicos do sistema antes de começar a utilizá-lo:
          </Typography>
          
          <Box sx={{ textAlign: 'left', ml: 2, mb: 3 }}>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CheckCircleIcon fontSize="small" />
              Tolerância para atrasos
            </Typography>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CheckCircleIcon fontSize="small" />
              Configurações de horas extras
            </Typography>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CheckCircleIcon fontSize="small" />
              Intervalos e pausas
            </Typography>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon fontSize="small" />
              Geolocalização (opcional)
            </Typography>
          </Box>
          
          <Typography variant="body2" sx={{ opacity: 0.8, fontStyle: 'italic' }}>
            Após a configuração, você terá acesso completo ao sistema.
          </Typography>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={onClose} 
            sx={{ 
              color: 'rgba(255,255,255,0.7)',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.1)'
              }
            }}
          >
            Fechar
          </Button>
          <Button 
            onClick={handleGoToSettings}
            variant="contained"
            sx={{ 
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'white',
              fontWeight: 'bold',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.3)'
              }
            }}
          >
            Ir para Configurações
          </Button>
        </DialogActions>
      </motion.div>
    </Dialog>
  );
};

export default FirstAccessModal;