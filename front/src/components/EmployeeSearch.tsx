import React from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Typography,
  InputAdornment,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { Employee } from '../types';

interface EmployeeSearchProps {
  employeeSearchTerm: string;
  onEmployeeSearchChange: (value: string) => void;
  showEmployeeSuggestions: boolean;
  filteredEmployees: Employee[];
  onEmployeeSelect: (employee: Employee) => void;
  onClearSearch: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

const EmployeeSearch: React.FC<EmployeeSearchProps> = ({
  employeeSearchTerm,
  onEmployeeSearchChange,
  showEmployeeSuggestions,
  filteredEmployees,
  onEmployeeSelect,
  onClearSearch,
  onFocus,
  onBlur,
}) => {
  // Componente de sugestões de funcionários
  const EmployeeSuggestions = () => (
    <AnimatePresence>
      {showEmployeeSuggestions && filteredEmployees.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <Paper
            sx={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 1000,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              maxHeight: '300px',
              overflowY: 'auto',
              mt: 1,
            }}
          >
            <List disablePadding>
              {filteredEmployees.map((employee, index) => (
                <ListItem key={employee.id} disablePadding>
                  <ListItemButton
                    onClick={() => onEmployeeSelect(employee)}
                    sx={{
                      padding: '12px 16px',
                      borderBottom: index < filteredEmployees.length - 1 ? '1px solid rgba(0, 0, 0, 0.1)' : 'none',
                      '&:hover': {
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      }
                    }}
                  >
                    <PersonIcon sx={{ color: '#64748b', mr: 2 }} />
                    <ListItemText
                      primary={employee.nome}
                      primaryTypographyProps={{
                        color: '#1f2937',
                        fontWeight: 500,
                        fontSize: '14px'
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Paper>
        </motion.div>
      )}
    </AnimatePresence>
  );

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
          mb: 3
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <HistoryIcon sx={{ color: 'rgba(255, 255, 255, 0.7)', mr: 2 }} />
            <Typography 
              variant="h6" 
              sx={{ 
                color: 'white',
                fontWeight: 500,
                fontSize: '16px'
              }}
            >
              Buscar Histórico Individual
            </Typography>
          </Box>
          
          <Box sx={{ position: 'relative' }}>
            <TextField
              fullWidth
              placeholder="Digite o nome do funcionário para ver seu histórico..."
              value={employeeSearchTerm}
              onChange={(e) => onEmployeeSearchChange(e.target.value)}
              onBlur={onBlur}
              onFocus={onFocus}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                  </InputAdornment>
                ),
                endAdornment: employeeSearchTerm && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={onClearSearch}
                      sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                    >
                      <CloseIcon />
                    </IconButton>
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
                    borderColor: 'rgba(59, 130, 246, 0.8)',
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
            <EmployeeSuggestions />
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default EmployeeSearch;