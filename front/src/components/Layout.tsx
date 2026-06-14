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
  Tooltip,
  useTheme,
  useMediaQuery,
  Badge,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  AccessTime as AccessTimeIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  SmartToy as SmartToyIcon,
  HelpOutline as HelpIcon,
  KeyboardArrowDown as ArrowDownIcon,
  BuildCircle as BuildCircleIcon,
  WorkspacePremium as RHIcon,
  HistoryEdu as HistoryEduIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCorrecoesCtx } from '../contexts/CorrecoesContext';
import { apiService } from '../services/api';
import { toast } from 'react-hot-toast';
import { Permission } from '../types';

const logoUrl = new URL('../image/logo.png', import.meta.url).href;

const DRAWER_WIDTH = 256;
const DRAWER_COLLAPSED = 68;

interface RouteConfig {
  text: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  permission?: Permission;
}

const mainRoutes: RouteConfig[] = [
  { text: 'Dashboard',    icon: <DashboardIcon  sx={{ fontSize: 19 }} />, path: '/dashboard',  color: '#10b981', permission: 'dashboard' },
  { text: 'Funcionários', icon: <PeopleIcon      sx={{ fontSize: 19 }} />, path: '/employees',  color: '#3b82f6', permission: 'funcionarios' },
  { text: 'Registros',    icon: <AccessTimeIcon  sx={{ fontSize: 19 }} />, path: '/records',    color: '#8b5cf6', permission: 'registros' },
  { text: 'Correções',    icon: <BuildCircleIcon sx={{ fontSize: 19 }} />, path: '/correcoes',  color: '#f59e0b', permission: 'correcoes' },
  { text: 'RH / Folha',   icon: <RHIcon          sx={{ fontSize: 19 }} />, path: '/rh',         color: '#f472b6', permission: 'rh_folha' },
];

const toolRoutes: RouteConfig[] = [
  { text: 'Assistente RH', icon: <SmartToyIcon    sx={{ fontSize: 19 }} />, path: '/chatbot-rh', color: '#06b6d4' },
  { text: 'Ajuda',          icon: <HelpIcon         sx={{ fontSize: 19 }} />, path: '/help',       color: '#6366f1' },
  { text: 'Auditoria',      icon: <HistoryEduIcon   sx={{ fontSize: 19 }} />, path: '/auditoria',  color: '#a78bfa', permission: 'configuracoes' },
  { text: 'Configurações',  icon: <SettingsIcon     sx={{ fontSize: 19 }} />, path: '/settings',   color: '#f59e0b', permission: 'configuracoes' },
];

const allRoutes = [...mainRoutes, ...toolRoutes];

const getActiveRoute = (pathname: string): RouteConfig | undefined =>
  allRoutes.find(r =>
    r.path === pathname ||
    (r.path === '/records' && pathname.startsWith('/records')) ||
    (r.path === '/rh'      && pathname.startsWith('/rh'))
  );

interface LayoutProps { children: React.ReactNode }

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen]         = useState(false);
  const [drawerCollapsed, setDrawerCollapsed] = useState(false);
  const [anchorEl, setAnchorEl]             = useState<null | HTMLElement>(null);
  const [rhEnabled, setRhEnabled]           = useState<boolean>(true);
  const theme   = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout, hasPermission, userName } = useAuth();

  useEffect(() => {
    apiService.getCompanyFeatures().then(f => setRhEnabled(f.rh_enabled)).catch(() => {});
  }, []);

  const visibleMainRoutes = mainRoutes.filter(r => !r.permission || hasPermission(r.permission));
  const visibleToolRoutes = toolRoutes.filter(r => !r.permission || hasPermission(r.permission));

  const currentWidth = drawerCollapsed ? DRAWER_COLLAPSED : DRAWER_WIDTH;
  const activeRoute  = getActiveRoute(location.pathname);
  const { totalPendencias } = useCorrecoesCtx();

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  useEffect(() => {
    const deep = 'linear-gradient(160deg, #060d1f 0%, #0a1535 45%, #0e2060 100%)';
    document.body.style.background = deep;
    document.documentElement.style.background = deep;
    return () => {
      document.body.style.background = '';
      document.documentElement.style.background = '';
    };
  }, []);

  const NavItem: React.FC<{ route: RouteConfig; badge?: number }> = ({ route, badge }) => {
    const isActive = route.path === location.pathname ||
      (route.path === '/records' && location.pathname.startsWith('/records')) ||
      (route.path === '/rh'      && location.pathname.startsWith('/rh'));
    const showBadge = badge !== undefined && badge > 0;

    return (
      <ListItem disablePadding sx={{ mb: 0.25 }}>
        <Tooltip title={drawerCollapsed ? route.text : ''} placement="right">
          <ListItemButton
            onClick={() => handleNavigation(route.path)}
            sx={{
              borderRadius: '10px',
              justifyContent: drawerCollapsed ? 'center' : 'flex-start',
              px: drawerCollapsed ? 0 : 1.25,
              py: 0.9,
              minHeight: 40,
              position: 'relative',
              color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
              background: isActive
                ? `linear-gradient(90deg, ${route.color}22 0%, ${route.color}06 100%)`
                : 'transparent',
              border: isActive ? `1px solid ${route.color}28` : '1px solid transparent',
              transition: 'all 0.18s ease',
              '&:hover': {
                color: 'rgba(255,255,255,0.85)',
                background: isActive
                  ? `linear-gradient(90deg, ${route.color}28 0%, ${route.color}08 100%)`
                  : 'rgba(255,255,255,0.04)',
                border: isActive ? `1px solid ${route.color}35` : '1px solid rgba(255,255,255,0.06)',
              },
              ...(isActive && {
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: '20%',
                  bottom: '20%',
                  width: '3px',
                  borderRadius: '0 3px 3px 0',
                  background: route.color,
                  boxShadow: `0 0 8px ${route.color}80`,
                },
              }),
            }}
          >
            <ListItemIcon sx={{
              color: isActive ? route.color : 'rgba(255,255,255,0.38)',
              minWidth: drawerCollapsed ? 0 : 34,
              justifyContent: 'center',
              transition: 'color 0.18s',
            }}>
              {showBadge && drawerCollapsed ? (
                <Badge
                  badgeContent={badge}
                  max={99}
                  sx={{
                    '& .MuiBadge-badge': {
                      background: route.color,
                      color: 'white',
                      fontSize: 9,
                      minWidth: 16,
                      height: 16,
                      padding: '0 3px',
                    },
                  }}
                >
                  {route.icon}
                </Badge>
              ) : route.icon}
            </ListItemIcon>
            {!drawerCollapsed && (
              <ListItemText
                primary={route.text}
                sx={{
                  '& .MuiListItemText-primary': {
                    fontWeight: isActive ? 600 : 400,
                    fontSize: '13.5px',
                    letterSpacing: '0.005em',
                    color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
                    transition: 'color 0.18s',
                  },
                }}
              />
            )}
            {/* Badge numérico quando expandido */}
            {!drawerCollapsed && showBadge && (
              <Box sx={{
                ml: 0.5,
                px: 0.75,
                py: 0.1,
                borderRadius: '6px',
                bgcolor: `${route.color}22`,
                border: `1px solid ${route.color}40`,
                minWidth: 20,
                textAlign: 'center',
              }}>
                <Typography sx={{ fontSize: 10, fontWeight: 800, color: route.color, lineHeight: 1.6 }}>
                  {badge > 99 ? '99+' : badge}
                </Typography>
              </Box>
            )}
          </ListItemButton>
        </Tooltip>
      </ListItem>
    );
  };

  const LockedNavItem: React.FC<{ route: RouteConfig }> = ({ route }) => (
    <ListItem disablePadding sx={{ mb: 0.25 }}>
      <Tooltip title={drawerCollapsed ? `${route.text} — Plano Plus` : 'RH/Folha disponível apenas no plano Plus. Entre em contato para solicitar upgrade.'} placement="right">
        <ListItemButton
          onClick={() => toast('RH / Folha disponível apenas no plano Plus. Entre em contato para solicitar upgrade.')}
          sx={{
            borderRadius: '10px',
            justifyContent: drawerCollapsed ? 'center' : 'flex-start',
            px: drawerCollapsed ? 0 : 1.25,
            py: 0.9,
            minHeight: 40,
            color: 'rgba(255,255,255,0.28)',
            cursor: 'not-allowed',
            '&:hover': { background: 'rgba(255,255,255,0.03)' },
          }}
        >
          <ListItemIcon sx={{ color: 'rgba(255,255,255,0.22)', minWidth: drawerCollapsed ? 0 : 34, justifyContent: 'center' }}>
            {route.icon}
          </ListItemIcon>
          {!drawerCollapsed && (
            <>
              <ListItemText
                primary={route.text}
                sx={{ '& .MuiListItemText-primary': { fontSize: '13.5px', color: 'rgba(255,255,255,0.28)' } }}
              />
              <LockIcon sx={{ fontSize: 13, color: 'rgba(255,255,255,0.22)', ml: 0.5 }} />
            </>
          )}
        </ListItemButton>
      </Tooltip>
    </ListItem>
  );

  const SectionLabel: React.FC<{ label: string }> = ({ label }) =>
    drawerCollapsed ? (
      <Box sx={{ my: 1, mx: 'auto', width: 28, height: 1, bgcolor: 'rgba(255,255,255,0.07)' }} />
    ) : (
      <Typography sx={{
        fontSize: 9.5,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.22)',
        textTransform: 'uppercase',
        letterSpacing: '0.11em',
        px: 1.5,
        mb: 0.75,
        mt: 0.25,
      }}>
        {label}
      </Typography>
    );

  const drawer = (
    <Box sx={{
      height: '100%',
      background: 'rgba(10,22,66,0.55)',
      backdropFilter: 'blur(36px)',
      WebkitBackdropFilter: 'blur(36px)',
      borderRight: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Logo / Brand ── */}
      <Box sx={{
        px: drawerCollapsed ? 1.5 : 2,
        pt: 2.5,
        pb: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        justifyContent: drawerCollapsed ? 'center' : 'flex-start',
      }}>
        <Box sx={{
          width: 36, height: 36, minWidth: 36,
          background: 'white',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)',
          flexShrink: 0,
          transition: 'transform 0.2s',
          '&:hover': { transform: 'scale(1.05)' },
        }}>
          <img src={logoUrl} alt="RP" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </Box>

        {!drawerCollapsed && (
          <Box>
            <Typography sx={{
              fontWeight: 800,
              color: 'white',
              fontSize: '14px',
              letterSpacing: '0.03em',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
            }}>
              REGISTRA.PONTO
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '10.5px', letterSpacing: '0.02em' }}>
              Controle de Ponto
            </Typography>
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', mx: drawerCollapsed ? 1 : 2, mb: 1.5 }} />

      {/* ── Nav ── */}
      <Box sx={{ flex: 1, overflow: 'auto', px: drawerCollapsed ? 1 : 1.5 }}>
        <SectionLabel label="Gestão" />
        <List disablePadding sx={{ mb: 1.5 }}>
          {visibleMainRoutes.map(r => (
            r.path === '/rh' && !rhEnabled
              ? <LockedNavItem key={r.path} route={r} />
              : <NavItem
                  key={r.path}
                  route={r}
                  badge={r.path === '/correcoes' && totalPendencias > 0 ? totalPendencias : undefined}
                />
          ))}
        </List>

        <SectionLabel label="Ferramentas" />
        <List disablePadding>
          {visibleToolRoutes.map(r => <NavItem key={r.path} route={r} />)}
        </List>
      </Box>

      {/* ── User info ── */}
      {!drawerCollapsed && user && (
        <Box sx={{
          mx: 1.5,
          mb: 1.5,
          p: 1.25,
          borderRadius: '10px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
        }}>
          <Avatar sx={{
            width: 30, height: 30,
            background: 'linear-gradient(135deg, #2563eb, #6366f1)',
            fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>
            {user.empresa_nome?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>
              {user.empresa_nome}
            </Typography>
            <Typography noWrap sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)' }}>
              {user.usuario_id}
            </Typography>
          </Box>
        </Box>
      )}

      {/* ── Collapse ── */}
      <Box sx={{ px: drawerCollapsed ? 1 : 1.5, pb: 2 }}>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', mb: 1.25 }} />
        <Tooltip title={drawerCollapsed ? 'Expandir menu' : ''} placement="right">
          <ListItemButton
            onClick={() => setDrawerCollapsed(!drawerCollapsed)}
            sx={{
              borderRadius: '10px',
              justifyContent: drawerCollapsed ? 'center' : 'flex-start',
              px: drawerCollapsed ? 0 : 1.25,
              py: 0.9,
              minHeight: 38,
              color: 'rgba(255,255,255,0.28)',
              border: '1px solid transparent',
              '&:hover': {
                color: 'rgba(255,255,255,0.6)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              },
              transition: 'all 0.18s',
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: drawerCollapsed ? 0 : 34, justifyContent: 'center' }}>
              {drawerCollapsed
                ? <ChevronRightIcon sx={{ fontSize: 17 }} />
                : <ChevronLeftIcon  sx={{ fontSize: 17 }} />}
            </ListItemIcon>
            {!drawerCollapsed && (
              <ListItemText primary="Recolher" sx={{ '& .MuiListItemText-primary': { fontSize: '12.5px', fontWeight: 400, color: 'inherit' } }} />
            )}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{
      display: 'flex',
      minHeight: '100vh',
      background: 'linear-gradient(155deg, #112466 0%, #1a3a8a 45%, #1e40af 100%)',
    }}>
      {/* ── AppBar ── */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${currentWidth}px)` },
          ml: { md: `${currentWidth}px` },
          transition: 'width 0.28s ease, margin-left 0.28s ease',
          background: 'rgba(15,32,90,0.75)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 54, sm: 56 }, px: { xs: 2, md: 3 } }}>
          {/* Mobile hamburger */}
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Abrir menu"
            sx={{ mr: 1.5, display: { md: 'none' }, color: 'rgba(255,255,255,0.6)', borderRadius: '9px', '&:hover': { color: 'white', background: 'rgba(255,255,255,0.07)' } }}
          >
            <MenuIcon sx={{ fontSize: 22 }} />
          </IconButton>

          {/* Page title with colored dot */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1 }}>
            {activeRoute && (
              <Box sx={{
                width: 8, height: 8, borderRadius: '50%',
                background: activeRoute.color,
                boxShadow: `0 0 8px ${activeRoute.color}`,
                flexShrink: 0,
              }} />
            )}
            <Typography sx={{
              fontWeight: 600,
              color: 'rgba(255,255,255,0.88)',
              fontSize: '14.5px',
              letterSpacing: '0.005em',
            }}>
              {activeRoute?.text ?? 'Painel'}
            </Typography>
          </Box>

          {/* Right: company + user */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            {user && (
              <Box sx={{
                display: { xs: 'none', sm: 'flex' },
                flexDirection: 'column',
                alignItems: 'flex-end',
                px: 1.25,
                py: 0.4,
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                  {userName || user.usuario_id}
                </Typography>
                <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                  {user.empresa_nome}
                </Typography>
              </Box>
            )}

            <IconButton
              onClick={e => setAnchorEl(e.currentTarget)}
              aria-label="Menu do usuário"
              sx={{
                p: 0.5,
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                gap: 0.5,
                '&:hover': { background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' },
                transition: 'all 0.2s',
              }}
            >
              <Avatar sx={{
                width: 28, height: 28,
                background: 'linear-gradient(135deg, #2563eb, #6366f1)',
                fontSize: '11px', fontWeight: 700,
              }}>
                {user?.empresa_nome?.charAt(0)?.toUpperCase() || 'U'}
              </Avatar>
              <ArrowDownIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', mr: 0.25 }} />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* ── Drawer ── */}
      <Box
        component="nav"
        sx={{ width: { md: currentWidth }, flexShrink: { md: 0 }, transition: 'width 0.28s ease' }}
      >
        {/* Mobile */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              background: 'linear-gradient(155deg, #112466 0%, #1a3a8a 100%)',
              borderRight: 'none',
            },
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: currentWidth,
              background: 'transparent',
              borderRight: 'none',
              transition: 'width 0.28s ease',
              overflowX: 'hidden',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* ── Main content ── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${currentWidth}px)` },
          mt: { xs: '54px', sm: '56px' },
          transition: 'width 0.28s ease',
          minHeight: 'calc(100vh - 56px)',
          position: 'relative',
        }}
      >
        <Container
          maxWidth="xl"
          sx={{
            position: 'relative',
            zIndex: 1,
            py: { xs: 3, md: 4 },
            px: { xs: 2, sm: 3, md: 4 },
            minHeight: 'calc(100vh - 56px)',
          }}
        >
          <AnimatePresence mode="sync">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </Container>
      </Box>

      {/* ── Profile menu ── */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        onClick={() => setAnchorEl(null)}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            background: 'rgba(15,30,85,0.97)',
            backdropFilter: 'blur(28px)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            mt: 1,
            minWidth: 180,
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0, right: 16,
              width: 8, height: 8,
              bgcolor: 'rgba(8,16,42,0.96)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderBottom: 'none',
              borderRight: 'none',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {user && (
          <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
              {userName || user.usuario_id}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              {user.empresa_nome}
            </Typography>
          </Box>
        )}
        <MenuItem
          onClick={() => { logout(); navigate('/login'); }}
          sx={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: '0.875rem',
            gap: 1.5,
            px: 2,
            py: 1,
            '&:hover': { background: 'rgba(239,68,68,0.12)', color: '#f87171' },
          }}
        >
          <LogoutIcon sx={{ fontSize: 17 }} />
          Sair
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Layout;
