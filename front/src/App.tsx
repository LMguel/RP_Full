import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import RecordsTabsPage from './pages/RecordsTabsPage';
import EmployeeRecordsPage from './pages/EmployeeRecordsPage';
import SettingsPage from './pages/SettingsPage';
import ChatBotRHPage from './pages/ChatBotRHPage';
import HelpPage from './pages/HelpPage';
import CorrecaoPage from './pages/CorrecaoPage';
import RHDashboardPage from './pages/RHDashboardPage';
import RHFuncionariosPage from './pages/RHFuncionariosPage';
import RHCompetenciasPage from './pages/RHCompetenciasPage';
import RHPreFolhaPage from './pages/RHPreFolhaPage';
import RHFechamentosPage from './pages/RHFechamentosPage';
import RHExportacoesPage from './pages/RHExportacoesPage';
import RHSettingsPage from './pages/RHSettingsPage';
import AuditPage from './pages/AuditPage';
import PermissionGuard from './components/PermissionGuard';

// Components
import FirstAccessModal from './components/FirstAccessModal';
import ErrorBoundary from './components/ErrorBoundary';
import { CorrecoesProvider } from './contexts/CorrecoesContext';

// Create theme
const theme = createTheme({
  palette: {
    primary:    { main: '#2563eb', light: '#60a5fa', dark: '#1d4ed8' },
    secondary:  { main: '#6366f1', light: '#a5b4fc', dark: '#4f46e5' },
    success:    { main: '#10b981', light: '#34d399', dark: '#059669' },
    warning:    { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
    error:      { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
    info:       { main: '#0ea5e9', light: '#38bdf8', dark: '#0284c7' },
    background: { default: 'transparent', paper: 'rgba(255,255,255,0.09)' },
    text:       { primary: 'rgba(255,255,255,0.95)', secondary: 'rgba(255,255,255,0.58)' },
    divider:    'rgba(255,255,255,0.1)',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    fontWeightLight:   300,
    fontWeightRegular: 400,
    fontWeightMedium:  500,
    fontWeightBold:    700,
    h3: { fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 },
    h4: { fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 700, letterSpacing: '-0.005em' },
    subtitle1: { fontWeight: 500, letterSpacing: '-0.005em' },
    body2:  { fontSize: '0.875rem', lineHeight: 1.6 },
    caption:{ fontSize: '0.75rem',  lineHeight: 1.4 },
    button: { fontWeight: 600, letterSpacing: '0.01em' },
  },
  shape: { borderRadius: 12 },
  shadows: [
    'none',
    '0 1px 3px rgba(0,0,0,0.3)',
    '0 2px 8px rgba(0,0,0,0.28)',
    '0 4px 16px rgba(0,0,0,0.25)',
    '0 6px 20px rgba(0,0,0,0.22)',
    '0 8px 28px rgba(0,0,0,0.2)',
    '0 12px 36px rgba(0,0,0,0.18)',
    '0 16px 44px rgba(0,0,0,0.16)',
    '0 20px 52px rgba(0,0,0,0.15)',
    '0 24px 60px rgba(0,0,0,0.14)',
    '0 28px 68px rgba(0,0,0,0.13)',
    '0 32px 76px rgba(0,0,0,0.12)',
    '0 36px 84px rgba(0,0,0,0.11)',
    '0 40px 92px rgba(0,0,0,0.10)',
    '0 44px 100px rgba(0,0,0,0.10)',
    '0 48px 108px rgba(0,0,0,0.09)',
    '0 52px 116px rgba(0,0,0,0.09)',
    '0 56px 124px rgba(0,0,0,0.08)',
    '0 60px 132px rgba(0,0,0,0.08)',
    '0 64px 140px rgba(0,0,0,0.07)',
    '0 68px 148px rgba(0,0,0,0.07)',
    '0 72px 156px rgba(0,0,0,0.07)',
    '0 76px 164px rgba(0,0,0,0.06)',
    '0 80px 172px rgba(0,0,0,0.06)',
    '0 84px 180px rgba(0,0,0,0.06)',
  ] as any,
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { backgroundAttachment: 'fixed' } },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
            '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.22)' },
            '&.Mui-focused fieldset': { borderColor: 'rgba(37,99,235,0.7)' },
            '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(37,99,235,0.18)' },
          },
          '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)' },
          '& .MuiInputLabel-root.Mui-focused': { color: '#60a5fa' },
          '& .MuiInputBase-input': { color: 'rgba(255,255,255,0.9)' },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: 'none',
          fontWeight: 600,
          letterSpacing: '0.01em',
          padding: '8px 18px',
          fontSize: '0.875rem',
          transition: 'all 0.2s ease',
          '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 6px 20px rgba(0,0,0,0.3)' },
          '&:active': { transform: 'translateY(0)' },
        },
        contained: {
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          boxShadow: '0 2px 12px rgba(37,99,235,0.35)',
          '&:hover': { background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', boxShadow: '0 6px 24px rgba(37,99,235,0.45)' },
        },
        outlined: {
          borderColor: 'rgba(255,255,255,0.14)',
          color: 'rgba(255,255,255,0.85)',
          '&:hover': { borderColor: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)' },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 9,
          transition: 'all 0.2s ease',
          color: 'rgba(255,255,255,0.55)',
          '&:hover': { color: 'white', background: 'rgba(255,255,255,0.07)' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          background: 'rgba(255,255,255,0.09)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
          transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
          '&:hover': {
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(99,102,241,0.25)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '20px',
          '&:last-child': { paddingBottom: '20px' },
          '@media (min-width:600px)': { padding: '22px', '&:last-child': { paddingBottom: '22px' } },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          background: 'rgba(17,36,102,0.85)',
          border: '1px solid rgba(255,255,255,0.1)',
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: { borderRadius: 10, overflow: 'hidden' },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 700,
            fontSize: '0.7rem',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            padding: '10px 14px',
            background: 'rgba(0,0,0,0.15)',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background 0.15s ease',
          '&.MuiTableRow-hover:hover': { background: 'rgba(255,255,255,0.04) !important' },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          padding: '10px 14px',
          color: 'rgba(255,255,255,0.78)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.71rem',
          letterSpacing: '0.02em',
          borderRadius: 7,
          height: 24,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 500,
          fontSize: '0.85rem',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 18,
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          background: 'rgba(17,36,102,0.92)',
          border: '1px solid rgba(255,255,255,0.12)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { borderRadius: 8, fontSize: '0.74rem', fontWeight: 500 },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: 'rgba(255,255,255,0.07)' },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          color: 'rgba(255,255,255,0.9)',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.22)' },
          '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.45)' },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          '&:hover': { background: 'rgba(255,255,255,0.06)' },
          '&.Mui-selected': { background: 'rgba(37,99,235,0.18)' },
          '&.Mui-selected:hover': { background: 'rgba(37,99,235,0.25)' },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 99,
          background: 'rgba(255,255,255,0.07)',
        },
        bar: { borderRadius: 99 },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          background: 'transparent',
          boxShadow: 'none',
          '&:before': { display: 'none' },
        },
      },
    },
  },
});

const AppRoutes: React.FC = () => {
  const { isAuthenticated, isFirstAccess, markConfigurationComplete } = useAuth();
  const [showFirstAccessModal, setShowFirstAccessModal] = React.useState(false);

  React.useEffect(() => {
    if (isAuthenticated && isFirstAccess) {
      setShowFirstAccessModal(true);
    }
  }, [isAuthenticated, isFirstAccess]);

  const handleCloseFirstAccessModal = () => {
    setShowFirstAccessModal(false);
  };

  return (
    <>
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/login" 
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
        } 
      />

      
      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <Navigate to="/dashboard" replace />
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <ErrorBoundary>
                <DashboardPage />
              </ErrorBoundary>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees"
        element={
          <ProtectedRoute>
            <Layout>
              <EmployeesPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/records"
        element={
          <ProtectedRoute>
            <Layout>
              <RecordsTabsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/records/employee/:employeeId/:employeeName"
        element={
          <ProtectedRoute>
            <Layout>
              <EmployeeRecordsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Layout>
              <SettingsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/chatbot-rh"
        element={
          <ProtectedRoute>
            <Layout>
              <ChatBotRHPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/help"
        element={
          <ProtectedRoute>
            <Layout>
              <HelpPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/correcoes"
        element={
          <ProtectedRoute>
            <Layout>
              <CorrecaoPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* RH / Folha */}
      <Route path="/rh" element={<ProtectedRoute><Layout><RHDashboardPage /></Layout></ProtectedRoute>} />
      <Route path="/rh/funcionarios" element={<ProtectedRoute><Layout><RHFuncionariosPage /></Layout></ProtectedRoute>} />
      <Route path="/rh/competencias" element={<ProtectedRoute><Layout><RHCompetenciasPage /></Layout></ProtectedRoute>} />
      <Route path="/rh/pre-folha" element={<ProtectedRoute><Layout><RHPreFolhaPage /></Layout></ProtectedRoute>} />
      <Route path="/rh/fechamentos" element={<ProtectedRoute><Layout><RHFechamentosPage /></Layout></ProtectedRoute>} />
      <Route path="/rh/exportacoes" element={<ProtectedRoute><Layout><RHExportacoesPage /></Layout></ProtectedRoute>} />
      <Route path="/rh/configuracoes" element={<ProtectedRoute><Layout><RHSettingsPage /></Layout></ProtectedRoute>} />

      {/* Auditoria */}
      <Route path="/auditoria" element={
        <ProtectedRoute>
          <Layout>
            <PermissionGuard permission="configuracoes">
              <AuditPage />
            </PermissionGuard>
          </Layout>
        </ProtectedRoute>
      } />

      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    
    {/* First Access Modal */}
    <FirstAccessModal 
      open={showFirstAccessModal}
      onClose={handleCloseFirstAccessModal}
    />
    </>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <CorrecoesProvider>
        <Router>
          <div className="App">
            <AppRoutes />
            
            {/* Toast Notifications */}
            <Toaster
              position="top-right"
              containerStyle={{
                top: 20,
                right: 20,
                left: 260, // Margem para não ficar atrás do sidebar
                zIndex: 9999,
              }}
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                  maxWidth: '400px',
                  zIndex: 9999,
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#fff',
                  },
                  style: {
                    background: 'rgba(16, 185, 129, 0.9)',
                    color: '#fff',
                    maxWidth: '400px',
                    zIndex: 9999,
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                  style: {
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: '#fff',
                    maxWidth: '400px',
                    zIndex: 9999,
                  },
                },
              }}
            />
          </div>
        </Router>
        </CorrecoesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
