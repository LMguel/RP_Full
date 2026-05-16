import React, { useEffect, useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  Container,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  AccessTime as AccessTimeIcon,
  Settings as SettingsIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Business as BusinessIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  SmartToy as SmartToyIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const logoUrl = new URL('../image/logo.png', import.meta.url).href;

const drawerWidth = 280;
const collapsedDrawerWidth = 72;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerCollapsed, setDrawerCollapsed] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const currentDrawerWidth = drawerCollapsed ? collapsedDrawerWidth : drawerWidth;

  const handleDrawerCollapse = () => {
    setDrawerCollapsed(!drawerCollapsed);
  };

  // Abrir submenu automaticamente se estiver em página de registros
  const [recordsSubmenuOpen, setRecordsSubmenuOpen] = useState(
    location.pathname.startsWith('/records')
  );

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Funcionários', icon: <PeopleIcon />, path: '/employees' },
    { 
      text: 'Registros', 
      icon: <AccessTimeIcon />, 
      path: '/records',
      submenu: [
        { text: 'Espelho de Ponto', path: '/records' },
        { text: 'Registros Diários', path: '/records/daily' },
        { text: 'Registros Gerais', path: '/records/detailed' },
      ]
    },
    { text: 'Configurações', icon: <SettingsIcon />, path: '/settings' },
    { text: 'Assistente RH', icon: <SmartToyIcon />, path: '/chatbot-rh' },
  ];

  // Atualizar submenu quando a rota mudar
  React.useEffect(() => {
    if (location.pathname.startsWith('/records')) {
      setRecordsSubmenuOpen(true);
    }
  }, [location.pathname]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleProfileMenuClose();
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const drawer = (
    <Box
      sx={{
        height: '100%',
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.09)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ p: drawerCollapsed ? 1.5 : '24px 20px', flex: 1 }}>
        {/* Logo + nome */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3.5, justifyContent: drawerCollapsed ? 'center' : 'flex-start' }}>
          <Box
            sx={{
              width: drawerCollapsed ? 38 : 44,
              height: drawerCollapsed ? 38 : 44,
              minWidth: drawerCollapsed ? 38 : 44,
              backgroundColor: 'white',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
            }}
          >
            <img src={logoUrl} alt="RP Logo" style={{ width: '200%', height: '200%', objectFit: 'contain' }} />
          </Box>
          {!drawerCollapsed && (
            <Box>
              <Typography
                variant="body1"
                sx={{ fontWeight: 700, color: 'white', fontSize: '15px', letterSpacing: '0.02em', whiteSpace: 'nowrap', lineHeight: 1.2 }}
              >
                REGISTRA.PONTO
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>
                Controle de Ponto
              </Typography>
            </Box>
          )}
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.09)', mb: 2.5 }} />

        <List disablePadding>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isRecordsSection = location.pathname.startsWith('/records');
            const hasSubmenu = item.submenu && item.submenu.length > 0;
            const highlighted = isActive || (hasSubmenu && isRecordsSection);

            return (
              <React.Fragment key={item.text}>
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => {
                      if (hasSubmenu && item.text === 'Registros') {
                        if (drawerCollapsed) { setDrawerCollapsed(false); setRecordsSubmenuOpen(true); }
                        else { setRecordsSubmenuOpen(!recordsSubmenuOpen); }
                      } else {
                        handleNavigation(item.path);
                      }
                    }}
                    sx={{
                      borderRadius: '9px',
                      mx: 0,
                      justifyContent: drawerCollapsed ? 'center' : 'flex-start',
                      px: drawerCollapsed ? 1.5 : 1.5,
                      py: 1.1,
                      color: highlighted ? 'white' : 'rgba(255,255,255,0.65)',
                      background: highlighted
                        ? 'rgba(255,255,255,0.12)'
                        : 'transparent',
                      borderLeft: highlighted ? '3px solid rgba(255,255,255,0.75)' : '3px solid transparent',
                      '&:hover': {
                        background: 'rgba(255,255,255,0.08)',
                        color: 'white',
                        borderLeft: highlighted ? '3px solid rgba(255,255,255,0.75)' : '3px solid rgba(255,255,255,0.3)',
                      },
                      transition: 'all 0.18s ease',
                    }}
                    title={drawerCollapsed ? item.text : undefined}
                  >
                    <ListItemIcon
                      sx={{
                        color: highlighted ? 'white' : 'rgba(255,255,255,0.6)',
                        minWidth: drawerCollapsed ? 0 : 36,
                        justifyContent: 'center',
                        '& svg': { fontSize: '20px' },
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {!drawerCollapsed && (
                      <ListItemText
                        primary={item.text}
                        sx={{
                          '& .MuiListItemText-primary': {
                            fontWeight: highlighted ? 600 : 400,
                            fontSize: '13.5px',
                            letterSpacing: '0.01em',
                          }
                        }}
                      />
                    )}
                  </ListItemButton>
                </ListItem>

                {/* Submenu de Registros */}
                {hasSubmenu && item.text === 'Registros' && recordsSubmenuOpen && !drawerCollapsed && (
                  <Box sx={{ pl: 2.5, mb: 0.5 }}>
                    {item.submenu.map((subItem) => {
                      const isSubActive = location.pathname === subItem.path;
                      return (
                        <ListItemButton
                          key={subItem.path}
                          onClick={() => handleNavigation(subItem.path)}
                          sx={{
                            borderRadius: '7px',
                            py: 0.7,
                            px: 1.5,
                            mb: 0.25,
                            color: isSubActive ? 'white' : 'rgba(255,255,255,0.55)',
                            background: isSubActive ? 'rgba(255,255,255,0.09)' : 'transparent',
                            borderLeft: isSubActive ? '2px solid rgba(255,255,255,0.6)' : '2px solid transparent',
                            '&:hover': {
                              background: 'rgba(255,255,255,0.06)',
                              color: 'rgba(255,255,255,0.9)',
                            },
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Typography variant="caption" sx={{ fontSize: '12.5px', fontWeight: isSubActive ? 600 : 400 }}>
                            {subItem.text}
                          </Typography>
                        </ListItemButton>
                      );
                    })}
                  </Box>
                )}
              </React.Fragment>
            );
          })}
        </List>
      </Box>

      {/* Botão colapsar */}
      <Box sx={{ p: 1.5, borderTop: '1px solid rgba(255,255,255,0.09)' }}>
        <ListItemButton
          onClick={handleDrawerCollapse}
          sx={{
            borderRadius: '9px',
            justifyContent: drawerCollapsed ? 'center' : 'flex-start',
            px: 1.5,
            py: 0.9,
            color: 'rgba(255,255,255,0.5)',
            '&:hover': { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.85)' },
            transition: 'all 0.18s ease',
          }}
          title={drawerCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <ListItemIcon sx={{ color: 'inherit', minWidth: drawerCollapsed ? 0 : 36, justifyContent: 'center', '& svg': { fontSize: '18px' } }}>
            {drawerCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </ListItemIcon>
          {!drawerCollapsed && (
            <ListItemText primary="Recolher" sx={{ '& .MuiListItemText-primary': { fontSize: '12.5px', fontWeight: 400 } }} />
          )}
        </ListItemButton>
      </Box>
    </Box>
  );

  // Aplicar estilo ao body para garantir que nao apareca fundo branco
  useEffect(() => {
    document.body.style.background = 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.documentElement.style.background = 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)';
    
    return () => {
      // Limpar estilos quando o componente for desmontado
      document.body.style.background = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.documentElement.style.background = '';
    };
  }, []);


  return (
    <Box 
      sx={{ 
        display: 'flex', 
        minHeight: '100vh',
        height: 'auto', 
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)',
        position: 'relative'
      }}
    >
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${currentDrawerWidth}px)` },
          ml: { md: `${currentDrawerWidth}px` },
          transition: 'width 0.3s ease, margin-left 0.3s ease',
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.09)',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 60 }, px: { xs: 2, md: 3 } }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 1.5, display: { md: 'none' }, color: 'white', borderRadius: '8px' }}
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant="body1"
            noWrap
            component="div"
            sx={{ flexGrow: 1, color: 'white', fontWeight: 600, fontSize: '15px', letterSpacing: '0.01em' }}
          >
            {menuItems.find(item => item.path === location.pathname || (item.path === '/records' && location.pathname.startsWith('/records')))?.text || 'Dashboard'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'white', fontSize: '13px', lineHeight: 1.3 }}>
                {user?.empresa_nome}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px' }}>
                {user?.usuario_id}
              </Typography>
            </Box>

            <IconButton
              onClick={handleProfileMenuOpen}
              sx={{
                p: 0.5,
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.15)',
                '&:hover': { background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.3)' },
                transition: 'all 0.2s ease',
              }}
            >
              <Avatar sx={{ width: 30, height: 30, background: 'rgba(255,255,255,0.18)', fontSize: '14px' }}>
                <AccountCircleIcon sx={{ color: 'white', fontSize: '18px' }} />
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: currentDrawerWidth }, flexShrink: { md: 0 }, transition: 'width 0.3s ease' }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)',
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: currentDrawerWidth,
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)',
              transition: 'width 0.3s ease',
              overflowX: 'hidden',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 0,
          width: { md: `calc(100% - ${currentDrawerWidth}px)` },
          mt: 8,
          transition: 'width 0.3s ease',
        }}
      >
        <Box
          sx={{
            minHeight: '100vh',
            width: '100%',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)',
            position: 'relative',
            overflow: 'auto',
          }}
        >
          <Container 
            maxWidth="lg" 
            sx={{ 
              position: 'relative', 
              zIndex: 1, 
              py: 4, 
              px: { xs: 2, md: 6 },
              minHeight: 'calc(100vh - 64px)'
            }}
          >
            <AnimatePresence mode="sync">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </Container>
        </Box>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        onClick={handleProfileMenuClose}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            mt: 1.5,
            '& .MuiAvatar-root': {
              width: 32,
              height: 32,
              ml: -0.5,
              mr: 1,
            },
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'rgba(255, 255, 255, 0.95)',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem 
          onClick={() => navigate('/profile')}
          sx={{ color: '#374151', '&:hover': { background: 'rgba(0, 0, 0, 0.04)' } }}
        >
          <ListItemIcon>
            <AccountCircleIcon fontSize="small" sx={{ color: '#6b7280' }} />
          </ListItemIcon>
          Perfil
        </MenuItem>
        <MenuItem 
          onClick={handleLogout}
          sx={{ color: '#374151', '&:hover': { background: 'rgba(0, 0, 0, 0.04)' } }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" sx={{ color: '#6b7280' }} />
          </ListItemIcon>
          Sair
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Layout;