import React, { useState, useEffect } from 'react';
import PageLayout from '../sections/PageLayout';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  VpnKey as VpnKeyIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Employee } from '../types';
import EmployeeForm from '../components/EmployeeForm';
import ResetPasswordModal from '../components/ResetPasswordModal';

const EmployeesPage: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [employeeToResetPassword, setEmployeeToResetPassword] = useState<Employee | null>(null);

  // Extract unique cargos from existing employees
  const existingCargos = [...new Set(employees.map(emp => emp.cargo))].filter(Boolean);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    filterEmployees();
  }, [employees, searchTerm]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getEmployees();
      const employeesList = response.funcionarios || [];
      setEmployees(employeesList);
    } catch (err: any) {
      console.error('Error loading employees:', err);
      setError('Erro ao carregar funcionários');
      toast.error('Erro ao carregar funcionários');
    } finally {
      setLoading(false);
    }
  };

  const filterEmployees = () => {
    if (!searchTerm.trim()) {
      setFilteredEmployees(employees);
      return;
    }

    const filtered = employees.filter(employee =>
      employee.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.cargo.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredEmployees(filtered);
  };

  const handleCreateEmployee = async (formData: FormData) => {
    try {
      setSubmitting(true);
      await apiService.createEmployee(formData);
      toast.success('Funcionário cadastrado com sucesso!');
      setFormOpen(false);
      loadEmployees();
    } catch (err: any) {
      console.error('Error creating employee:', err);
      toast.error('Erro ao cadastrar funcionário');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEmployee = async (formData: FormData) => {
    if (!editingEmployee) return;

    try {
      setSubmitting(true);
      await apiService.updateEmployee(editingEmployee.id, formData);
      toast.success('Funcionário atualizado com sucesso!');
      setFormOpen(false);
      setEditingEmployee(null);
      loadEmployees();
    } catch (err: any) {
      console.error('Error updating employee:', err);
      toast.error('Erro ao atualizar funcionário');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;

    try {
      setSubmitting(true);
      await apiService.deleteEmployee(employeeToDelete.id);
      toast.error('Funcionário excluído com sucesso!');
      setDeleteDialogOpen(false);
      setEmployeeToDelete(null);
      loadEmployees();
    } catch (err: any) {
      console.error('Error deleting employee:', err);
      toast.error('Erro ao excluir funcionário');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, employee: Employee) => {
    setMenuAnchor(event.currentTarget);
    setSelectedEmployee(employee);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedEmployee(null);
  };

  const handleEdit = () => {
    setEditingEmployee(selectedEmployee);
    setFormOpen(true);
    handleMenuClose();
  };

  const handleDelete = () => {
    setEmployeeToDelete(selectedEmployee);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleResetPassword = () => {
    setEmployeeToResetPassword(selectedEmployee);
    setResetPasswordOpen(true);
    handleMenuClose();
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('pt-BR');
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress sx={{ color: 'white' }} />
        </Box>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { sm: 'center' },
        justifyContent: 'space-between',
        gap: 2,
        mb: 4
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Box>
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 600, 
                color: 'white', 
                mb: 1,
                fontSize: '28px'
              }}
            >
              Funcionários
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '16px'
              }}
            >
              Gerencie os funcionários da sua empresa
            </Typography>
          </Box>
        </motion.div>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setFormOpen(true)}
          sx={{
            background: '#3b82f6',
            '&:hover': {
              background: '#2563eb',
            },
            fontWeight: 600,
            textTransform: 'none',
            mt: { xs: 2, sm: 0 }
          }}
        >
          Cadastrar Funcionário
        </Button>
      </Box>

      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 4,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {error}
        </Alert>
      )}

      {/* Search */}
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
            <TextField
              fullWidth
              placeholder="Buscar por nome ou cargo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
          </CardContent>
        </Card>
      </motion.div>

      {/* Employees Table */}
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
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600, 
                mb: 3,
                color: 'white',
                fontSize: '18px'
              }}
            >
              Lista de Funcionários ({filteredEmployees.length})
            </Typography>
            
            <TableContainer 
              component={Paper} 
              variant="outlined"
              sx={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                      Funcionário
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                      Cargo
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                      Data de Cadastro
                    </TableCell>
                    <TableCell align="center" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                      Ações
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((employee) => (
                      <TableRow key={employee.id} hover>
                        <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar
                              src={employee.foto_url}
                              alt={employee.nome}
                              sx={{ width: 40, height: 40 }}
                            >
                              <PersonIcon />
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>
                                {employee.nome}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                ID: {employee.id}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                          <Chip
                            label={employee.cargo}
                            size="small"
                            sx={{ 
                              background: 'rgba(59, 130, 246, 0.2)',
                              color: '#3b82f6',
                              border: '1px solid rgba(59, 130, 246, 0.3)'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                          <Typography variant="body2">
                            {formatDate(employee.data_cadastro)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            onClick={(e) => handleMenuOpen(e, employee)}
                            size="small"
                            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell 
                        colSpan={4} 
                        align="center"
                        sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
                      >
                        <Box sx={{ py: 8 }}>
                          <PersonIcon sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '4rem', mb: 2 }} />
                          <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 1 }}>
                            {searchTerm ? 'Nenhum funcionário encontrado' : 'Nenhum funcionário cadastrado'}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                            {searchTerm 
                              ? 'Tente ajustar os termos de busca'
                              : 'Comece cadastrando seu primeiro funcionário'
                            }
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Employee Form Dialog */}
      <EmployeeForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingEmployee(null);
        }}
        onSubmit={editingEmployee ? handleUpdateEmployee : handleCreateEmployee}
        employee={editingEmployee}
        loading={submitting}
        existingCargos={existingCargos}
      />

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { 
            borderRadius: 2,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }
        }}
      >
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Editar</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleResetPassword} sx={{ color: '#f59e0b' }}>
          <ListItemIcon>
            <VpnKeyIcon fontSize="small" sx={{ color: '#f59e0b' }} />
          </ListItemIcon>
          <ListItemText>Redefinir Senha</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: '#ef4444' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: '#ef4444' }} />
          </ListItemIcon>
          <ListItemText>Excluir</ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: { 
            borderRadius: 2,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }
        }}
      >
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Confirmar Exclusão
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja excluir o funcionário{' '}
            <strong>{employeeToDelete?.nome}</strong>?
          </Typography>
          <Typography variant="body2" sx={{ color: '#ef4444', mt: 2 }}>
            Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={submitting}
            sx={{ color: '#6b7280' }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDeleteEmployee}
            color="error"
            variant="contained"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
          >
            {submitting ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Modal */}
      <ResetPasswordModal
        open={resetPasswordOpen}
        onClose={() => {
          setResetPasswordOpen(false);
          setEmployeeToResetPassword(null);
        }}
        userId={employeeToResetPassword?.id}
      />
    </PageLayout>
  );
};

export default EmployeesPage;
