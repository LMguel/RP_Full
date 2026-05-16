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
import RecordsPage from './pages/RecordsPage';
import RecordsPageDetails from './pages/RecordsPageDetails';
import EmployeeRecordsPage from './pages/EmployeeRecordsPage';
import DailyRecordsPage from './pages/DailyRecordsPage';
import SettingsPage from './pages/SettingsPage';
import ChatBotRHPage from './pages/ChatBotRHPage';

// Components
import FirstAccessModal from './components/FirstAccessModal';
import ErrorBoundary from './components/ErrorBoundary';

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main:  '#2563eb',
      light: '#60a5fa',
      dark:  '#1d4ed8',
    },
    secondary: {
      main:  '#7c3aed',
      light: '#a78bfa',
      dark:  '#5b21b6',
    },
    success: {
      main:  '#10b981',
      light: '#34d399',
      dark:  '#059669',
    },
    warning: {
      main:  '#f59e0b',
      light: '#fbbf24',
      dark:  '#d97706',
    },
    error: {
      main:  '#ef4444',
      light: '#f87171',
      dark:  '#dc2626',
    },
    info: {
      main:  '#0ea5e9',
      light: '#38bdf8',
      dark:  '#0284c7',
    },
    background: {
      default: 'transparent',
      paper:   'rgba(255,255,255,0.07)',
    },
    text: {
      primary:   'rgba(255,255,255,0.93)',
      secondary: 'rgba(255,255,255,0.6)',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    fontWeightLight:   300,
    fontWeightRegular: 400,
    fontWeightMedium:  500,
    fontWeightBold:    700,
    h4: { fontWeight: 700, letterSpacing: '-0.01em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
    body2: { fontSize: '0.875rem', lineHeight: 1.6 },
    caption: { fontSize: '0.75rem', lineHeight: 1.4 },
    button: { fontWeight: 600, letterSpacing: '0.02em' },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    'none',
    '0 1px 3px rgba(0,0,0,0.2)',
    '0 2px 6px rgba(0,0,0,0.18)',
    '0 4px 12px rgba(0,0,0,0.15)',
    '0 6px 18px rgba(0,0,0,0.14)',
    '0 8px 24px rgba(0,0,0,0.13)',
    '0 10px 30px rgba(0,0,0,0.12)',
    '0 12px 36px rgba(0,0,0,0.12)',
    '0 14px 40px rgba(0,0,0,0.11)',
    '0 16px 48px rgba(0,0,0,0.11)',
    '0 18px 54px rgba(0,0,0,0.10)',
    '0 20px 60px rgba(0,0,0,0.10)',
    '0 22px 66px rgba(0,0,0,0.10)',
    '0 24px 72px rgba(0,0,0,0.09)',
    '0 26px 78px rgba(0,0,0,0.09)',
    '0 28px 84px rgba(0,0,0,0.09)',
    '0 30px 90px rgba(0,0,0,0.08)',
    '0 32px 96px rgba(0,0,0,0.08)',
    '0 34px 102px rgba(0,0,0,0.08)',
    '0 36px 108px rgba(0,0,0,0.07)',
    '0 38px 114px rgba(0,0,0,0.07)',
    '0 40px 120px rgba(0,0,0,0.07)',
    '0 42px 126px rgba(0,0,0,0.06)',
    '0 44px 132px rgba(0,0,0,0.06)',
    '0 46px 138px rgba(0,0,0,0.06)',
  ] as any,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundAttachment: 'fixed',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            transition: 'box-shadow 0.2s ease',
            '&.Mui-focused': {
              boxShadow: '0 0 0 3px rgba(37,99,235,0.25)',
            },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: 'none',
          fontWeight: 600,
          letterSpacing: '0.02em',
          padding: '8px 20px',
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        contained: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: 'all 0.2s ease',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.11)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          transition: 'all 0.25s ease',
          '&:hover': {
            border: '1px solid rgba(255,255,255,0.18)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
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
          '@media (min-width:600px)': { padding: '24px', '&:last-child': { paddingBottom: '24px' } },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          overflow: 'hidden',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 700,
            fontSize: '0.72rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            borderBottom: '1px solid rgba(255,255,255,0.12)',
            padding: '10px 12px',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background 0.15s ease',
          '&.MuiTableRow-hover:hover': {
            background: 'rgba(255,255,255,0.055) !important',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '10px 12px',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.72rem',
          letterSpacing: '0.03em',
          borderRadius: 6,
          height: 26,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 500,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 8,
          fontSize: '0.74rem',
          fontWeight: 500,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255,255,255,0.1)',
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
              <RecordsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/records/detailed"
        element={
          <ProtectedRoute>
            <Layout>
              <RecordsPageDetails />
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
        path="/records/daily"
        element={
          <ProtectedRoute>
            <Layout>
              <DailyRecordsPage />
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
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
