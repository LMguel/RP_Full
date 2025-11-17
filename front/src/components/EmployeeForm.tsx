import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  IconButton,
  Avatar,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  PhotoCamera as PhotoCameraIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { Employee, HorarioPreset } from '../types';
import { config } from '../config';

interface EmployeeFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  employee?: Employee | null;
  loading?: boolean;
  existingCargos?: string[];
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({
  open,
  onClose,
  onSubmit,
  employee,
  loading = false,
  existingCargos = [],
}) => {
  const [formData, setFormData] = useState({
    nome: employee?.nome || '',
    cargo: employee?.cargo || '',
    email: employee?.email || '',
    senha: '',
    confirmarSenha: '',
    horario_entrada: employee?.horario_entrada || '',
    horario_saida: employee?.horario_saida || '',
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    employee?.foto_url || null
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [horariosPreset, setHorariosPreset] = useState<any[]>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [nomeHorario, setNomeHorario] = useState('');

  // Use only existing cargos from the company, sorted alphabetically
  const allCargos = [...new Set(existingCargos)].sort();

  // Carregar horários preset ao abrir o modal
  React.useEffect(() => {
    const carregarHorarios = async () => {
      if (open) {
        setLoadingHorarios(true);
        try {
          const token = localStorage.getItem('token') || sessionStorage.getItem('token');
          const response = await fetch(`${config.API_URL}/horarios`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setHorariosPreset(data);
          }
        } catch (error) {
          console.error('Erro ao carregar horários:', error);
        } finally {
          setLoadingHorarios(false);
        }
      }
    };
    carregarHorarios();
  }, [open]);

  React.useEffect(() => {
    if (employee) {
      setFormData({
        nome: employee.nome,
        cargo: employee.cargo,
        email: employee.email || '',
        senha: '',
        confirmarSenha: '',
        horario_entrada: employee.horario_entrada || '',
        horario_saida: employee.horario_saida || '',
      });
      setPhotoPreview(employee.foto_url);
    } else {
      setFormData({ 
        nome: '', 
        cargo: '', 
        email: '', 
        senha: '',
        confirmarSenha: '',
        horario_entrada: '', 
        horario_saida: '' 
      });
      setPhoto(null);
      setPhotoPreview(null);
      setNomeHorario('');
    }
    setErrors({});
  }, [employee, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleCargoChange = (event: any, newValue: string | null) => {
    setFormData(prev => ({
      ...prev,
      cargo: newValue || '',
    }));
    
    if (errors.cargo) {
      setErrors(prev => ({
        ...prev,
        cargo: '',
      }));
    }
  };

  const handleHorarioPresetChange = (event: any, newValue: HorarioPreset | string | null) => {
    if (newValue && typeof newValue === 'object') {
      // Selecionou um preset existente
      setFormData(prev => ({
        ...prev,
        horario_entrada: newValue.horario_entrada,
        horario_saida: newValue.horario_saida,
      }));
      setNomeHorario(newValue.nome);
    } else if (typeof newValue === 'string') {
      // Digitou um novo nome
      setNomeHorario(newValue);
    } else {
      setNomeHorario('');
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (!formData.cargo.trim()) {
      newErrors.cargo = 'Cargo é obrigatório';
    }

    // Email é obrigatório se senha for fornecida
    if (formData.senha && formData.senha.trim()) {
      if (!formData.email || !formData.email.trim()) {
        newErrors.email = 'Email é obrigatório quando senha é definida';
      }
    }

    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'Email inválido';
      }
    }

    // Validar senha
    if (formData.senha && formData.senha.trim()) {
      if (formData.senha.length < 6) {
        newErrors.senha = 'Senha deve ter no mínimo 6 caracteres';
      }
      if (formData.senha !== formData.confirmarSenha) {
        newErrors.confirmarSenha = 'As senhas não coincidem';
      }
    }

    if (!employee && !photo) {
      newErrors.photo = 'Foto é obrigatória para novos funcionários';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const formDataToSend = new FormData();
    formDataToSend.append('nome', formData.nome);
    formDataToSend.append('cargo', formData.cargo);
    
    if (formData.email && formData.email.trim()) {
      formDataToSend.append('email', formData.email.trim());
    }
    
    if (formData.senha && formData.senha.trim()) {
      formDataToSend.append('senha', formData.senha);
    }
    
    if (photo) {
      formDataToSend.append('foto', photo);
    }
    
    // Adicionar horários se preenchidos
    if (formData.horario_entrada) {
      formDataToSend.append('horario_entrada', formData.horario_entrada);
    }
    if (formData.horario_saida) {
      formDataToSend.append('horario_saida', formData.horario_saida);
    }
    if (nomeHorario) {
      formDataToSend.append('nome_horario', nomeHorario);
    }

    await onSubmit(formDataToSend);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle className="flex items-center justify-between font-semibold">
        <Box component="span">
          {employee ? 'Editar Funcionário' : 'Cadastrar Funcionário'}
        </Box>
        <IconButton onClick={onClose} disabled={loading}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent className="space-y-4">
          {/* Photo Section */}
          <Box className="flex flex-col items-center space-y-4">
            <Avatar
              src={photoPreview || undefined}
              sx={{ width: 120, height: 120 }}
              className="border-4 border-gray-200"
            >
              {!photoPreview && <PersonIcon sx={{ fontSize: 60 }} />}
            </Avatar>
            
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="photo-upload"
              type="file"
              onChange={handlePhotoChange}
              disabled={loading}
            />
            <label htmlFor="photo-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<PhotoCameraIcon />}
                disabled={loading}
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                {photo ? 'Alterar Foto' : 'Adicionar Foto'}
              </Button>
            </label>
            
            {errors.photo && (
              <Typography variant="caption" color="error">
                {errors.photo}
              </Typography>
            )}
          </Box>

          {/* Form Fields */}
          <TextField
            fullWidth
            label="Nome Completo"
            name="nome"
            value={formData.nome}
            onChange={handleChange}
            error={!!errors.nome}
            helperText={errors.nome}
            disabled={loading}
            variant="outlined"
          />

          <TextField
            fullWidth
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            error={!!errors.email}
            helperText={errors.email || 'Email para login no app mobile (obrigatório se definir senha)'}
            disabled={loading}
            variant="outlined"
          />

          {/* Campos de Senha */}
          <Box className="space-y-3">
            <Typography variant="subtitle2" className="font-semibold text-gray-700">
              Acesso ao App Mobile (Opcional)
            </Typography>
            
            <TextField
              fullWidth
              label={employee ? 'Nova Senha (deixe em branco para não alterar)' : 'Senha'}
              name="senha"
              type="password"
              value={formData.senha}
              onChange={handleChange}
              error={!!errors.senha}
              helperText={
                errors.senha || 
                (employee 
                  ? 'Preencha apenas se quiser redefinir a senha. Mínimo 6 caracteres.'
                  : 'Mínimo 6 caracteres. Deixe em branco para não dar acesso ao app.')
              }
              disabled={loading}
              variant="outlined"
              autoComplete="new-password"
              placeholder={employee ? 'Digite apenas se quiser alterar' : ''}
            />

            {formData.senha && (
              <TextField
                fullWidth
                label="Confirmar Senha"
                name="confirmarSenha"
                type="password"
                value={formData.confirmarSenha}
                onChange={handleChange}
                error={!!errors.confirmarSenha}
                helperText={errors.confirmarSenha}
                disabled={loading}
                variant="outlined"
                autoComplete="new-password"
              />
            )}
          </Box>

          <Autocomplete
            freeSolo
            options={allCargos}
            value={formData.cargo}
            onChange={handleCargoChange}
            onInputChange={(event, newInputValue) => {
              setFormData(prev => ({
                ...prev,
                cargo: newInputValue,
              }));
            }}
            disabled={loading}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Cargo"
                error={!!errors.cargo}
                helperText={errors.cargo || (allCargos.length > 0 ? "Selecione um cargo existente ou digite um novo" : "Digite o cargo do funcionário")}
                variant="outlined"
                fullWidth
              />
            )}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Typography variant="body2">
                  {option}
                </Typography>
              </Box>
            )}
          />

          {/* Horários Section */}
          <Box className="space-y-3">
            <Typography variant="subtitle2" className="font-semibold text-gray-700">
              Horários de Trabalho (Opcional)
            </Typography>
            
            <Autocomplete
              freeSolo
              options={horariosPreset}
              getOptionLabel={(option) => 
                typeof option === 'string' ? option : option.nome
              }
              value={nomeHorario}
              onChange={handleHorarioPresetChange}
              onInputChange={(event, newInputValue) => {
                setNomeHorario(newInputValue);
              }}
              disabled={loading || loadingHorarios}
              renderInput={(params) => {
                // normalize and cast props to any to avoid MUI/TypeScript incompatibility with ref types
                const normalizedInputProps = { ...(params.inputProps as any) };
                const normalizedInputPropsTop = {
                  ...(params.InputProps as any),
                  endAdornment: (
                    <>
                      {loadingHorarios ? <CircularProgress color="inherit" size={20} /> : null}
                      {(params.InputProps as any)?.endAdornment}
                    </>
                  ),
                } as any;

                return (
                  <TextField
                    {...(params as any)}
                    label="Escolher Horários"
                    helperText="Selecione um horário salvo ou digite um novo nome"
                    variant="outlined"
                    fullWidth
                    InputProps={normalizedInputPropsTop}
                    inputProps={normalizedInputProps}
                  />
                );
              }}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box>
                    <Typography variant="body2" className="font-medium">
                      {option.nome}
                    </Typography>
                    <Typography variant="caption" className="text-gray-500">
                      {option.horario_entrada} - {option.horario_saida}
                    </Typography>
                  </Box>
                </Box>
              )}
            />

            <Box className="grid grid-cols-2 gap-3">
              <TextField
                fullWidth
                label="Horário de Entrada"
                name="horario_entrada"
                type="time"
                value={formData.horario_entrada}
                onChange={handleChange}
                disabled={loading}
                variant="outlined"
                InputLabelProps={{
                  shrink: true,
                }}
              />
              
              <TextField
                fullWidth
                label="Horário de Saída"
                name="horario_saida"
                type="time"
                value={formData.horario_saida}
                onChange={handleChange}
                disabled={loading}
                variant="outlined"
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Box>
          </Box>
        </DialogContent>

        <DialogActions className="p-6">
          <Button
            onClick={onClose}
            disabled={loading}
            className="text-gray-600"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {loading ? 'Salvando...' : employee ? 'Atualizar' : 'Cadastrar'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default EmployeeForm;
