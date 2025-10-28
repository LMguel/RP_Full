import React, { useState } from 'react';
import PageLayout from '../sections/PageLayout';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Divider,
  Switch,
  FormControlLabel,
  Avatar,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Person as PersonIcon,
  Business as BusinessIcon,
  Security as SecurityIcon,
  Palette as PaletteIcon,
  PhotoCamera as PhotoCameraIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  // User Profile
  const [profileData, setProfileData] = useState({
    usuario_id: user?.usuario_id || '',
    email: user?.email || '',
  });

  // Company Settings
  const [companyData, setCompanyData] = useState({
    empresa_nome: user?.empresa_nome || '',
    cnpj: '',
    endereco: '',
    telefone: '',
  });

  // Security Settings
  const [securityData, setSecurityData] = useState({
    senha_atual: '',
    nova_senha: '',
    confirmar_senha: '',
  });

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCompanyData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSecurityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSecurityData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      // API call to update profile
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCompany = async () => {
    try {
      setLoading(true);
      // API call to update company
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      toast.success('Dados da empresa atualizados com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar dados da empresa');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (securityData.nova_senha !== securityData.confirmar_senha) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (securityData.nova_senha.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      setLoading(true);
      // API call to change password
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      toast.success('Senha alterada com sucesso!');
      setSecurityData({
        senha_atual: '',
        nova_senha: '',
        confirmar_senha: '',
      });
    } catch (error) {
      toast.error('Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  // Estilo para campos de texto
  const textFieldStyles = {
    '& .MuiOutlinedInput-root': {
      color: 'rgba(255, 255, 255, 0.9)',
      '& fieldset': {
        borderColor: 'rgba(255, 255, 255, 0.3)',
      },
      '&:hover fieldset': {
        borderColor: 'rgba(255, 255, 255, 0.5)',
      },
      '&.Mui-focused fieldset': {
        borderColor: 'rgba(255, 255, 255, 0.7)',
      },
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    '& .MuiInputLabel-root': {
      color: 'rgba(255, 255, 255, 0.7)',
    },
    '& .MuiFormHelperText-root': {
      color: 'rgba(255, 255, 255, 0.6)',
    },
  };

  return (
    <PageLayout>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ mb: 4 }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 600, 
              color: 'white', 
              mb: 1,
              fontSize: '28px'
            }}
          >
            Configurações
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '16px'
            }}
          >
            Gerencie suas configurações pessoais e da empresa
          </Typography>
        </Box>
      </motion.div>

      <Grid container spacing={3}>
        {/* Profile Settings */}
        <Grid size={{ xs: 12, md: 6 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card 
              sx={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <PersonIcon sx={{ color: '#3b82f6', fontSize: '24px' }} />
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 600,
                      color: 'white',
                      fontSize: '18px'
                    }}
                  >
                    Perfil do Usuário
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                  <Avatar
                    sx={{ 
                      width: 80, 
                      height: 80, 
                      mb: 2,
                      border: '4px solid rgba(255, 255, 255, 0.2)'
                    }}
                  >
                    <PersonIcon sx={{ fontSize: 40, color: 'rgba(255, 255, 255, 0.8)' }} />
                  </Avatar>
                  <input
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="profile-photo-upload"
                    type="file"
                  />
                  <label htmlFor="profile-photo-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<PhotoCameraIcon />}
                      size="small"
                      sx={{
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        color: 'rgba(255, 255, 255, 0.8)',
                        '&:hover': {
                          borderColor: 'rgba(255, 255, 255, 0.5)',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        }
                      }}
                    >
                      Alterar Foto
                    </Button>
                  </label>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <TextField
                    fullWidth
                    label="ID do Usuário"
                    name="usuario_id"
                    value={profileData.usuario_id}
                    onChange={handleProfileChange}
                    variant="outlined"
                    disabled
                    helperText="O ID do usuário não pode ser alterado"
                    sx={textFieldStyles}
                  />

                  <TextField
                    fullWidth
                    label="Email"
                    name="email"
                    type="email"
                    value={profileData.email}
                    onChange={handleProfileChange}
                    variant="outlined"
                    sx={textFieldStyles}
                  />
                </Box>

                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleSaveProfile}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                    sx={{
                      background: '#3b82f6',
                      '&:hover': {
                        background: '#2563eb',
                      },
                      py: 1.5,
                      borderRadius: '8px',
                      fontWeight: 600,
                      textTransform: 'none',
                    }}
                  >
                    {loading ? 'Salvando...' : 'Salvar Perfil'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Company Settings */}
        <Grid size={{ xs: 12, md: 6 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card 
              sx={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <BusinessIcon sx={{ color: '#10b981', fontSize: '24px' }} />
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 600,
                      color: 'white',
                      fontSize: '18px'
                    }}
                  >
                    Dados da Empresa
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <TextField
                    fullWidth
                    label="Nome da Empresa"
                    name="empresa_nome"
                    value={companyData.empresa_nome}
                    onChange={handleCompanyChange}
                    variant="outlined"
                    sx={textFieldStyles}
                  />

                  <TextField
                    fullWidth
                    label="CNPJ"
                    name="cnpj"
                    value={companyData.cnpj}
                    onChange={handleCompanyChange}
                    variant="outlined"
                    placeholder="00.000.000/0000-00"
                    sx={textFieldStyles}
                  />

                  <TextField
                    fullWidth
                    label="Endereço"
                    name="endereco"
                    value={companyData.endereco}
                    onChange={handleCompanyChange}
                    variant="outlined"
                    multiline
                    rows={2}
                    sx={textFieldStyles}
                  />

                  <TextField
                    fullWidth
                    label="Telefone"
                    name="telefone"
                    value={companyData.telefone}
                    onChange={handleCompanyChange}
                    variant="outlined"
                    placeholder="(00) 00000-0000"
                    sx={textFieldStyles}
                  />
                </Box>

                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleSaveCompany}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                    sx={{
                      background: '#10b981',
                      '&:hover': {
                        background: '#059669',
                      },
                      py: 1.5,
                      borderRadius: '8px',
                      fontWeight: 600,
                      textTransform: 'none',
                    }}
                  >
                    {loading ? 'Salvando...' : 'Salvar Empresa'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Security Settings */}
        <Grid size={{ xs: 12, md: 6 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card 
              sx={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <SecurityIcon sx={{ color: '#ef4444', fontSize: '24px' }} />
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 600,
                      color: 'white',
                      fontSize: '18px'
                    }}
                  >
                    Segurança
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <TextField
                    fullWidth
                    label="Senha Atual"
                    name="senha_atual"
                    type="password"
                    value={securityData.senha_atual}
                    onChange={handleSecurityChange}
                    variant="outlined"
                    sx={textFieldStyles}
                  />

                  <TextField
                    fullWidth
                    label="Nova Senha"
                    name="nova_senha"
                    type="password"
                    value={securityData.nova_senha}
                    onChange={handleSecurityChange}
                    variant="outlined"
                    sx={textFieldStyles}
                  />

                  <TextField
                    fullWidth
                    label="Confirmar Nova Senha"
                    name="confirmar_senha"
                    type="password"
                    value={securityData.confirmar_senha}
                    onChange={handleSecurityChange}
                    variant="outlined"
                    sx={textFieldStyles}
                  />
                </Box>

                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleChangePassword}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SecurityIcon />}
                    sx={{
                      background: '#ef4444',
                      '&:hover': {
                        background: '#dc2626',
                      },
                      py: 1.5,
                      borderRadius: '8px',
                      fontWeight: 600,
                      textTransform: 'none',
                    }}
                  >
                    {loading ? 'Alterando...' : 'Alterar Senha'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Appearance Settings */}
        <Grid size={{ xs: 12, md: 6 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card 
              sx={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <PaletteIcon sx={{ color: '#8b5cf6', fontSize: '24px' }} />
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 600,
                      color: 'white',
                      fontSize: '18px'
                    }}
                  >
                    Aparência
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={darkMode}
                        onChange={(e) => setDarkMode(e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                        Modo Escuro
                      </Typography>
                    }
                  />

                  <Alert 
                    severity="info" 
                    sx={{
                      mt: 2,
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: 'rgba(255, 255, 255, 0.8)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      '& .MuiAlert-icon': {
                        color: '#3b82f6',
                      }
                    }}
                  >
                    <Typography variant="body2">
                      O modo escuro será implementado em uma versão futura.
                    </Typography>
                  </Alert>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Danger Zone */}
        <Grid size={{ xs: 12 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card 
              sx={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 600,
                      color: '#ef4444',
                      fontSize: '18px'
                    }}
                  >
                    Zona de Perigo
                  </Typography>
                </Box>

                <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', mb: 3 }} />

                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { sm: 'center' },
                  justifyContent: 'space-between',
                  gap: 2
                }}>
                  <Box>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        fontWeight: 500,
                        color: 'white',
                        mb: 0.5
                      }}
                    >
                      Sair da Conta
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: 'rgba(255, 255, 255, 0.6)'
                      }}
                    >
                      Faça logout da sua conta atual
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleLogout}
                    sx={{
                      borderColor: '#ef4444',
                      color: '#ef4444',
                      '&:hover': {
                        borderColor: '#dc2626',
                        backgroundColor: 'rgba(239, 68, 68, 0.05)',
                      }
                    }}
                  >
                    Sair
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>
    </PageLayout>
  );
};

export default SettingsPage;
