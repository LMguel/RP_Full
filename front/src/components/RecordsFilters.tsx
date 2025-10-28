import React from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Grid,
  Autocomplete,
  InputAdornment,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { Employee } from '../types';

interface RecordsFiltersProps {
  // Filtros gerais
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClearFilters: () => void;
  
  // Para aba de resumo
  nome: string;
  onNomeChange: (value: string) => void;
  opcoesNomes: string[];
  onBuscarNomes: (value: string) => void;
  
  // Para aba detalhada
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  selectedEmployeeFilter?: string;
  onSelectedEmployeeFilterChange?: (value: string) => void;
  employees?: Employee[];
  
  // Controle de exibição
  tabValue: number;
  isIndividualView?: boolean;
}

const RecordsFilters: React.FC<RecordsFiltersProps> = ({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClearFilters,
  nome,
  onNomeChange,
  opcoesNomes,
  onBuscarNomes,
  searchTerm,
  onSearchTermChange,
  selectedEmployeeFilter,
  onSelectedEmployeeFilterChange,
  employees = [],
  tabValue,
  isIndividualView = false,
}) => {
  return (
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
          mb: 4
        }}
      >
        <CardContent>
          <Grid container spacing={3}>
            {/* Filtros para vista individual */}
            {isIndividualView ? (
              <>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Data Início"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => onDateFromChange(e.target.value)}
                    InputLabelProps={{ 
                      shrink: true,
                      sx: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        '&.Mui-focused': {
                          color: 'rgba(255, 255, 255, 0.9)'
                        }
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: 'white',
                        '& fieldset': {
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                        },
                        '&:hover fieldset': {
                          borderColor: 'rgba(255, 255, 255, 0.5)',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: 'rgba(255, 255, 255, 0.7)',
                        },
                        background: 'rgba(255, 255, 255, 0.05)',
                      }
                    }}
                    variant="outlined"
                  />
                </Grid>
                
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Data Fim"
                    type="date"
                    value={dateTo}
                    onChange={(e) => onDateToChange(e.target.value)}
                    InputLabelProps={{ 
                      shrink: true,
                      sx: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        '&.Mui-focused': {
                          color: 'rgba(255, 255, 255, 0.9)'
                        }
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: 'white',
                        '& fieldset': {
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                        },
                        '&:hover fieldset': {
                          borderColor: 'rgba(255, 255, 255, 0.5)',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: 'rgba(255, 255, 255, 0.7)',
                        },
                        background: 'rgba(255, 255, 255, 0.05)',
                      }
                    }}
                    variant="outlined"
                  />
                </Grid>
                
                <Grid size={{ xs: 12, md: 2 }}>
                  <IconButton
                    onClick={onClearFilters}
                    sx={{
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.8)',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      },
                      width: '100%',
                      height: '56px',
                      borderRadius: '8px'
                    }}
                  >
                    <ClearIcon />
                  </IconButton>
                </Grid>
              </>
            ) : (
              <>
                {/* Filtros para vista geral */}
                <Grid size={{ xs: 12, md: 4 }}>
                  {tabValue === 0 ? (
                    <Autocomplete
                      freeSolo
                      options={opcoesNomes}
                      value={nome}
                      onInputChange={(event, value) => {
                        onNomeChange(value || '');
                        if (value && value.length > 0) {
                          onBuscarNomes(value);
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          fullWidth
                          placeholder="Buscar por funcionário..."
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                              </InputAdornment>
                            ),
                            sx: {
                              color: 'white',
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                              },
                              '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255, 255, 255, 0.5)',
                              },
                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255, 255, 255, 0.7)',
                              },
                              '& input::placeholder': {
                                color: 'rgba(255, 255, 255, 0.6)',
                                opacity: 1,
                              },
                              background: 'rgba(255, 255, 255, 0.05)',
                            }
                          }}
                          variant="outlined"
                        />
                      )}
                      sx={{
                        '& .MuiAutocomplete-popupIndicator': {
                          color: 'rgba(255, 255, 255, 0.7)',
                        },
                        '& .MuiAutocomplete-clearIndicator': {
                          color: 'rgba(255, 255, 255, 0.7)',
                        }
                      }}
                    />
                  ) : (
                    <TextField
                      fullWidth
                      placeholder="Buscar registros..."
                      value={searchTerm || ''}
                      onChange={(e) => onSearchTermChange?.(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                          </InputAdornment>
                        ),
                        sx: {
                          color: 'white',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255, 255, 255, 0.7)',
                          },
                          '& input::placeholder': {
                            color: 'rgba(255, 255, 255, 0.6)',
                            opacity: 1,
                          },
                          background: 'rgba(255, 255, 255, 0.05)',
                        }
                      }}
                      variant="outlined"
                    />
                  )}
                </Grid>
                
                {tabValue === 1 && (
                  <Grid size={{ xs: 12, md: 3 }}>
                    <FormControl 
                      fullWidth 
                      variant="outlined"
                      sx={{
                        '& .MuiInputLabel-root': {
                          color: 'rgba(255, 255, 255, 0.7)',
                          '&.Mui-focused': {
                            color: 'rgba(255, 255, 255, 0.9)'
                          }
                        },
                        '& .MuiOutlinedInput-root': {
                          color: 'white',
                          '& fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                          },
                          '&:hover fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.7)',
                          },
                          background: 'rgba(255, 255, 255, 0.05)',
                        },
                        '& .MuiSelect-icon': {
                          color: 'rgba(255, 255, 255, 0.7)',
                        }
                      }}
                    >
                      <InputLabel>Funcionário</InputLabel>
                      <Select
                        value={selectedEmployeeFilter || ''}
                        label="Funcionário"
                        onChange={(e) => onSelectedEmployeeFilterChange?.(e.target.value)}
                      >
                        <MenuItem value="">
                          <em>Todos os funcionários</em>
                        </MenuItem>
                        {employees.map((employee) => (
                          <MenuItem key={employee.id} value={employee.id}>
                            {employee.nome}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    fullWidth
                    label="Data Início"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => onDateFromChange(e.target.value)}
                    InputLabelProps={{ 
                      shrink: true,
                      sx: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        '&.Mui-focused': {
                          color: 'rgba(255, 255, 255, 0.9)'
                        }
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: 'white',
                        '& fieldset': {
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                        },
                        '&:hover fieldset': {
                          borderColor: 'rgba(255, 255, 255, 0.5)',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: 'rgba(255, 255, 255, 0.7)',
                        },
                        background: 'rgba(255, 255, 255, 0.05)',
                      }
                    }}
                    variant="outlined"
                    inputProps={{ max: dateTo || undefined }}
                  />
                </Grid>
                
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    fullWidth
                    label="Data Fim"
                    type="date"
                    value={dateTo}
                    onChange={(e) => onDateToChange(e.target.value)}
                    InputLabelProps={{ 
                      shrink: true,
                      sx: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        '&.Mui-focused': {
                          color: 'rgba(255, 255, 255, 0.9)'
                        }
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: 'white',
                        '& fieldset': {
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                        },
                        '&:hover fieldset': {
                          borderColor: 'rgba(255, 255, 255, 0.5)',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: 'rgba(255, 255, 255, 0.7)',
                        },
                        background: 'rgba(255, 255, 255, 0.05)',
                      }
                    }}
                    variant="outlined"
                    inputProps={{ min: dateFrom || undefined }}
                  />
                </Grid>
                
                <Grid size={{ xs: 12, md: 1 }}>
                  <IconButton
                    onClick={onClearFilters}
                    sx={{
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.8)',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      },
                      width: '100%',
                      height: '56px',
                      borderRadius: '8px'
                    }}
                  >
                    <ClearIcon />
                  </IconButton>
                </Grid>
              </>
            )}
          </Grid>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default RecordsFilters;