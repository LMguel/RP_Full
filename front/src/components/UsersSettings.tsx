import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, IconButton, Chip, Avatar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Drawer, TextField, Select, MenuItem, FormControl, InputLabel,
  FormGroup, FormControlLabel, Switch, Divider, CircularProgress,
  Alert, Tooltip,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  PersonOff as PersonOffIcon, PersonAdd as PersonAddIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { CompanyUser, UserRole, Permission, PermissionOverride } from '../types';

const ALL_PERMISSIONS: { key: Permission; label: string }[] = [
  { key: 'dashboard',         label: 'Dashboard' },
  { key: 'funcionarios',      label: 'Funcionários' },
  { key: 'registros',         label: 'Registros' },
  { key: 'correcoes',         label: 'Correções' },
  { key: 'rh_folha',          label: 'RH / Folha' },
  { key: 'configuracoes',     label: 'Configurações' },
  { key: 'exportacoes',       label: 'Exportações' },
  { key: 'ajustes',           label: 'Ajustes de ponto' },
  { key: 'excluir',           label: 'Excluir dados' },
  { key: 'criar_usuario',     label: 'Criar usuários' },
  { key: 'editar_usuario',    label: 'Editar usuários' },
  { key: 'fechar_competencia',label: 'Fechar competência' },
  { key: 'reconhecimento',    label: 'Reconhecimento facial' },
];

const ROLE_DEFAULTS: Record<UserRole, Permission[]> = {
  OWNER:   ALL_PERMISSIONS.map(p => p.key),
  ADMIN:   ['dashboard','funcionarios','registros','correcoes','rh_folha','configuracoes','exportacoes','ajustes','excluir','editar_usuario','fechar_competencia','reconhecimento'],
  RH:      ['dashboard','funcionarios','registros','correcoes','rh_folha','exportacoes','ajustes','fechar_competencia'],
  MANAGER: ['dashboard','funcionarios','registros','correcoes','ajustes'],
  VIEWER:  ['dashboard','funcionarios','registros'],
};

const ROLE_COLORS: Record<UserRole, string> = {
  OWNER:   '#f59e0b',
  ADMIN:   '#3b82f6',
  RH:      '#f472b6',
  MANAGER: '#10b981',
  VIEWER:  '#6366f1',
};

const ALLOWED_ROLES: UserRole[] = ['ADMIN', 'RH', 'MANAGER', 'VIEWER'];

function computeEffective(role: UserRole, overrides: PermissionOverride): Permission[] {
  const base = new Set<Permission>(ROLE_DEFAULTS[role] || []);
  overrides.add.forEach(p => base.add(p));
  overrides.remove.forEach(p => base.delete(p));
  return Array.from(base);
}

interface DrawerState {
  open: boolean;
  mode: 'create' | 'edit';
  target: CompanyUser | null;
}

const EMPTY_OVERRIDES: PermissionOverride = { add: [], remove: [] };

const UsersSettings: React.FC = () => {
  const { user: me, hasPermission } = useAuth();
  const myId = me?.usuario_id || '';
  const canCreate = hasPermission('criar_usuario');
  const canEdit   = hasPermission('editar_usuario');

  const [users, setUsers]     = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer]   = useState<DrawerState>({ open: false, mode: 'create', target: null });
  const [saving, setSaving]   = useState(false);

  // Form state
  const [formName, setFormName]       = useState('');
  const [formUserId, setFormUserId]   = useState('');
  const [formSenha, setFormSenha]     = useState('');
  const [formEmail, setFormEmail]     = useState('');
  const [formRole, setFormRole]       = useState<UserRole>('VIEWER');
  const [formPerms, setFormPerms]     = useState<PermissionOverride>(EMPTY_OVERRIDES);
  const [effectivePerms, setEffectivePerms] = useState<Permission[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { users: list } = await apiService.getUsers();
      setUsers(list);
    } catch {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    setEffectivePerms(computeEffective(formRole, formPerms));
  }, [formRole, formPerms]);

  const openCreate = () => {
    setFormName(''); setFormUserId(''); setFormSenha('');
    setFormEmail(''); setFormRole('VIEWER');
    setFormPerms(EMPTY_OVERRIDES);
    setDrawer({ open: true, mode: 'create', target: null });
  };

  const openEdit = (u: CompanyUser) => {
    setFormName(u.name || '');
    setFormUserId(u.user_id);
    setFormSenha('');
    setFormEmail(u.email || '');
    setFormRole(u.role as UserRole);
    setFormPerms(u.permissions || EMPTY_OVERRIDES);
    setDrawer({ open: true, mode: 'edit', target: u });
  };

  const togglePermission = (perm: Permission, checked: boolean) => {
    const role = formRole;
    const roleHas = ROLE_DEFAULTS[role]?.includes(perm) ?? false;
    setFormPerms(prev => {
      let add    = [...prev.add];
      let remove = [...prev.remove];
      if (checked) {
        remove = remove.filter(p => p !== perm);
        if (!roleHas) add = [...add.filter(p => p !== perm), perm];
      } else {
        add = add.filter(p => p !== perm);
        if (roleHas) remove = [...remove.filter(p => p !== perm), perm];
      }
      return { add, remove };
    });
  };

  const handleSave = async () => {
    if (!formName.trim() || !formUserId.trim()) {
      toast.error('Nome e ID de login são obrigatórios');
      return;
    }
    if (drawer.mode === 'create' && formSenha.length < 6) {
      toast.error('Senha deve ter ao menos 6 caracteres');
      return;
    }
    setSaving(true);
    try {
      if (drawer.mode === 'create') {
        await apiService.createUser({
          name: formName, user_id: formUserId, senha: formSenha,
          role: formRole, email: formEmail, permissions: formPerms,
        });
        toast.success('Usuário criado com sucesso');
      } else {
        const patch: Record<string, unknown> = {
          name: formName, email: formEmail,
          role: formRole, permissions: formPerms,
        };
        await apiService.updateUser(formUserId, patch);
        toast.success('Usuário atualizado com sucesso');
      }
      setDrawer(d => ({ ...d, open: false }));
      await reload();
    } catch {
      // error toasted by interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u: CompanyUser) => {
    try {
      const { active } = await apiService.toggleUserActive(u.user_id);
      toast.success(`Usuário ${active ? 'ativado' : 'desativado'}`);
      await reload();
    } catch {
      // toasted by interceptor
    }
  };

  const handleDelete = async (u: CompanyUser) => {
    if (!window.confirm(`Excluir usuário "${u.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await apiService.deleteUser(u.user_id);
      toast.success('Usuário excluído');
      await reload();
    } catch {
      // toasted by interceptor
    }
  };

  return (
    <Card sx={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>Usuários da Empresa</Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mt: 0.5 }}>
              Gerencie quem tem acesso ao painel
            </Typography>
          </Box>
          {canCreate && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} size="small">
              Adicionar
            </Button>
          )}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Usuário</TableCell>
                  <TableCell>ID de login</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Último login</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map(u => {
                  const isMe = u.user_id === myId;
                  const isOwner = u.role === 'OWNER';
                  return (
                    <TableRow key={u.user_id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: ROLE_COLORS[u.role as UserRole] }}>
                            {(u.name || u.user_id).charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
                            {u.name || u.user_id}
                            {isMe && <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'rgba(255,255,255,0.4)' }}>(você)</Typography>}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                          {u.user_id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={u.role}
                          size="small"
                          sx={{ bgcolor: `${ROLE_COLORS[u.role as UserRole]}22`, color: ROLE_COLORS[u.role as UserRole], fontWeight: 700, fontSize: '0.65rem' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={u.active !== false ? 'Ativo' : 'Inativo'}
                          size="small"
                          sx={{ bgcolor: u.active !== false ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: u.active !== false ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '0.65rem' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>
                          {u.last_login ? new Date(u.last_login).toLocaleString('pt-BR') : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          {canEdit && !isMe && (
                            <Tooltip title="Editar">
                              <IconButton size="small" onClick={() => openEdit(u)}>
                                <EditIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canEdit && !isMe && !isOwner && (
                            <Tooltip title={u.active !== false ? 'Desativar' : 'Ativar'}>
                              <IconButton size="small" onClick={() => handleToggleActive(u)}>
                                {u.active !== false
                                  ? <PersonOffIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                                  : <PersonAddIcon sx={{ fontSize: 16, color: '#10b981' }} />}
                              </IconButton>
                            </Tooltip>
                          )}
                          {canCreate && !isMe && !isOwner && (
                            <Tooltip title="Excluir">
                              <IconButton size="small" onClick={() => handleDelete(u)}>
                                <DeleteIcon sx={{ fontSize: 16, color: '#ef4444' }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>

      {/* Drawer de criação/edição */}
      <Drawer
        anchor="right"
        open={drawer.open}
        onClose={() => setDrawer(d => ({ ...d, open: false }))}
        PaperProps={{ sx: { width: 420, background: 'rgba(17,30,80,0.97)', backdropFilter: 'blur(24px)', borderLeft: '1px solid rgba(255,255,255,0.1)', p: 3 } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
            {drawer.mode === 'create' ? 'Novo Usuário' : 'Editar Usuário'}
          </Typography>
          <IconButton onClick={() => setDrawer(d => ({ ...d, open: false }))} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Nome completo" value={formName} onChange={e => setFormName(e.target.value)} size="small" fullWidth required />
          <TextField
            label="ID de login"
            value={formUserId}
            onChange={e => setFormUserId(e.target.value)}
            size="small" fullWidth required
            disabled={drawer.mode === 'edit'}
            helperText={drawer.mode === 'edit' ? 'O ID de login não pode ser alterado' : 'Mínimo 3 caracteres'}
            FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.4)' } }}
          />
          {drawer.mode === 'create' && (
            <TextField label="Senha" type="password" value={formSenha} onChange={e => setFormSenha(e.target.value)} size="small" fullWidth required helperText="Mínimo 6 caracteres" FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.4)' } }} />
          )}
          <TextField label="E-mail (opcional)" value={formEmail} onChange={e => setFormEmail(e.target.value)} size="small" fullWidth />

          <FormControl size="small" fullWidth>
            <InputLabel>Role</InputLabel>
            <Select value={formRole} label="Role" onChange={e => { setFormRole(e.target.value as UserRole); setFormPerms(EMPTY_OVERRIDES); }}>
              {ALLOWED_ROLES.map(r => (
                <MenuItem key={r} value={r}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ROLE_COLORS[r] }} />
                    {r}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Permissões
          </Typography>
          <Alert severity="info" sx={{ py: 0.5, fontSize: '0.78rem', bgcolor: 'rgba(14,165,233,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(14,165,233,0.2)', '& .MuiAlert-icon': { color: '#38bdf8' } }}>
            Marcados = ativos para este usuário. Cinza = padrão do role.
          </Alert>
          <FormGroup>
            {ALL_PERMISSIONS.map(({ key, label }) => {
              const checked = effectivePerms.includes(key);
              const fromRole = ROLE_DEFAULTS[formRole]?.includes(key) ?? false;
              return (
                <FormControlLabel
                  key={key}
                  control={
                    <Switch
                      checked={checked}
                      onChange={e => togglePermission(key, e.target.checked)}
                      size="small"
                      sx={{ '& .MuiSwitch-thumb': { bgcolor: checked ? ROLE_COLORS[formRole] : undefined } }}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ color: checked ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>
                        {label}
                      </Typography>
                      {!fromRole && checked && <Chip label="customizado" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(167,139,250,0.2)', color: '#a78bfa' }} />}
                    </Box>
                  }
                />
              );
            })}
          </FormGroup>

          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button variant="outlined" fullWidth onClick={() => setDrawer(d => ({ ...d, open: false }))}>
              Cancelar
            </Button>
            <Button variant="contained" fullWidth onClick={handleSave} disabled={saving}>
              {saving ? <CircularProgress size={16} /> : 'Salvar'}
            </Button>
          </Box>
        </Box>
      </Drawer>
    </Card>
  );
};

export default UsersSettings;
