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
import { Employee } from '../types';

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
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    employee?.foto_url || null
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Use only existing cargos from the company, sorted alphabetically
  const allCargos = [...new Set(existingCargos)].sort();

  React.useEffect(() => {
    if (employee) {
      setFormData({
        nome: employee.nome,
        cargo: employee.cargo,
      });
      setPhotoPreview(employee.foto_url);
    } else {
      setFormData({ nome: '', cargo: '' });
      setPhoto(null);
      setPhotoPreview(null);
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
    
    if (photo) {
      formDataToSend.append('foto', photo);
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
      <DialogTitle className="flex items-center justify-between">
        <Typography variant="h6" className="font-semibold">
          {employee ? 'Editar Funcionário' : 'Cadastrar Funcionário'}
        </Typography>
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
