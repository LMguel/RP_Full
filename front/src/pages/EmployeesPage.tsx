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
      // Tentar diferentes formas de extrair a lista de funcionários
      let employeesList = [];
      if (response.funcionarios) {
        employeesList = response.funcionarios;
      } else if (response.data && response.data.funcionarios) {
        employeesList = response.data.funcionarios;
      } else if (Array.isArray(response)) {
        employeesList = response;
      } else if (Array.isArray(response.data)) {
        employeesList = response.data;
      }
      // Não filtrar, exibir todos para mostrar status
      console.log('[EmployeesPage] Funcionários carregados:', employeesList);
      setEmployees(employeesList);
    } catch (err: any) {
      console.error('Error loading employees:', err);
      setError('Erro ao carregar funcionários');
      if (employees.length === 0) {
        toast.error('Erro ao carregar funcionários');
      }
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
      // Gerar ID customizado: primeiro nome + _ + 4 dígitos aleatórios
      const nome = formData.get('nome')?.toString() || '';
      const firstName = nome.split(' ')[0]?.toLowerCase() || 'user';
      const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 dígitos
      const customId = `${firstName}_${randomNum}`;
      formData.set('id', customId);

      const response = await apiService.createEmployee(formData);
      if (response && response.success) {
        toast.success('Funcionário cadastrado com sucesso!');
        setFormOpen(false);
        // Adiciona o novo funcionário à lista local imediatamente
        const newEmployee: Employee = {
          id: response.id,
          nome: response.nome,
          cargo: response.cargo,
          foto_url: response.foto_url || '',
          data_cadastro: response.data_cadastro || '',
          horario_entrada: response.horario_entrada || '',
          horario_saida: response.horario_saida || '',
          ativo: response.status !== false,
          face_id: response.face_id || '',
          empresa_nome: response.empresa_nome || '',
          empresa_id: response.empresa_id || response.company_id || '',
        };
        setEmployees((prev) => [...prev, newEmployee]);
        setFilteredEmployees((prev) => [...prev, newEmployee]);
      } else {
        toast.success('Funcionário cadastrado com sucesso!');
        setFormOpen(false);
        loadEmployees();
      }
    } catch (err: any) {
      console.error('Error creating employee:', err);
      if (err.response?.status === 200 || err.response?.status === 201) {
        toast.success('Funcionário cadastrado com sucesso!');
        setFormOpen(false);
        loadEmployees();
      } else {
        toast.error(err.response?.data?.message || 'Erro ao cadastrar funcionário');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEmployee = async (formData: FormData) => {
    if (!editingEmployee) return;

    try {
      setSubmitting(true);
      const response = await apiService.updateEmployee(editingEmployee.id, formData);
      
      // Verificar se a resposta indica sucesso
      if (response && (response.success || response.status === 'success' || response.message)) {
        toast.success('Funcionário atualizado com sucesso!');
        setFormOpen(false);
        setEditingEmployee(null);
        loadEmployees();
      } else {
        // Se não há indicação clara de sucesso, ainda assim considerar como sucesso se não houver erro
        toast.success('Funcionário atualizado com sucesso!');
        setFormOpen(false);
        setEditingEmployee(null);
        loadEmployees();
      }
    } catch (err: any) {
      console.error('Error updating employee:', err);
      
      // Verificar se é realmente um erro ou se foi atualizado com sucesso
      if (err.response?.status === 200 || err.response?.status === 201) {
        toast.success('Funcionário atualizado com sucesso!');
        setFormOpen(false);
        setEditingEmployee(null);
        loadEmployees();
      } else {
        toast.error(err.response?.data?.message || 'Erro ao atualizar funcionário');
      }
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
      // Forçar timezone local para evitar problemas de UTC
      const [year, month, day] = dateString.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('pt-BR');
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
      <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <PersonIcon className="w-8 h-8" />
              Funcionários
            </h1>
            <p className="text-white/70 mt-1">
              Gerencie os funcionários da sua empresa
            </p>
          </motion.div>
          
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all font-semibold shadow-lg"
          >
            <AddIcon />
            Cadastrar Funcionário
          </button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-white px-4 py-3 rounded-lg backdrop-blur mb-6">
            {error}
          </div>
        )}

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 mb-6">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
              <input
                type="text"
                placeholder="Buscar por nome ou cargo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
              />
            </div>
          </div>
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
                      Horário Entrada
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                      Horário Saída
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                      Data de Cadastro
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                      Status
                    </TableCell>
                    <TableCell align="center" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                      Ações
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((employee) => {
                      // Log para depuração: mostra se todos os dados esperados estão presentes
                      console.log('[EmployeesPage] Renderizando funcionário:', {
                        id: employee.id,
                        nome: employee.nome,
                        foto_url: employee.foto_url,
                        cargo: employee.cargo,
                        horario_entrada: employee.horario_entrada,
                        horario_saida: employee.horario_saida,
                        data_cadastro: employee.data_cadastro,
                        ativo: employee.ativo,
                        login: employee.login,
                        empresa_nome: employee.empresa_nome,
                        face_id: employee.face_id
                      });
                      return (
                        <TableRow key={employee.id} hover>
                        <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar
                              src={employee.foto_url || undefined}
                              alt={employee.nome}
                              imgProps={{
                                onError: (e: any) => { e.target.style.display = 'none'; }
                              }}
                              sx={{ 
                                width: 50, 
                                height: 50,
                                border: '2px solid rgba(59, 130, 246, 0.3)',
                                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
                                background: employee.foto_url ? 'transparent' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                fontSize: '20px'
                              }}
                            >
                              {!employee.foto_url && employee.nome?.charAt(0)?.toUpperCase()}
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
                            label={employee.cargo || '-'}
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
                            {employee.horario_entrada || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                          <Typography variant="body2">
                            {employee.horario_saida || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                          <Typography variant="body2">
                            {employee.data_cadastro ? formatDate(employee.data_cadastro) : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ color: employee.ativo === false ? 'red' : 'green', fontWeight: 600 }}>
                          {employee.ativo === false ? 'Desativado' : 'Ativado'}
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
                      );
                    })
                    )
                   : (
                    <TableRow>
                      <TableCell 
                        colSpan={6} 
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
        <DialogTitle sx={{ fontWeight: 600 }}>
          Confirmar Exclusão
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
      </div>
    </PageLayout>
  );
};

export default EmployeesPage;
