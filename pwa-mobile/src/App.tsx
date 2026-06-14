import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { useFullscreen } from './hooks/useFullscreen';
import KioskErrorBoundary from './components/KioskErrorBoundary';
import SwUpdateToast from './components/SwUpdateToast';

// ─── Eager imports (críticos, necessários imediatamente) ──────────────────────
import HomePage from './pages/HomePage';
import FuncionarioLoginPage from './features/funcionario/pages/FuncionarioLoginPage';
import EmpresaLoginPage from './features/empresa/pages/EmpresaLoginPage';
import KioskPage from './features/kiosk/KioskPage';

// ─── Lazy imports (carregados sob demanda) ────────────────────────────────────
const FuncionarioDashboardPage = React.lazy(() => import('./features/funcionario/pages/FuncionarioDashboardPage'));
const EspelhoPontoPage         = React.lazy(() => import('./features/funcionario/pages/EspelhoPontoPage'));
const FuncionarioConfigPage    = React.lazy(() => import('./features/funcionario/pages/FuncionarioConfigPage'));
const EmpresaDashboardPage     = React.lazy(() => import('./features/empresa/pages/EmpresaDashboardPage'));
const FuncionariosPage         = React.lazy(() => import('./features/empresa/pages/FuncionariosPage'));
const FuncionarioFormPage      = React.lazy(() => import('./features/empresa/pages/FuncionarioFormPage'));
const RegistrosEmpresaPage     = React.lazy(() => import('./features/empresa/pages/RegistrosEmpresaPage'));
const ConfiguracoesEmpresaPage = React.lazy(() => import('./features/empresa/pages/ConfiguracoesEmpresaPage'));

// ─── Loading fallback minimalista ─────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <svg className="animate-spin w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

// ─── Route guards ─────────────────────────────────────────────────────────────

function RequireAuth({ children, requiredType }: { children: React.ReactNode; requiredType?: 'funcionario' | 'empresa' }) {
  const { signed, userType, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!signed) return <Navigate to="/" replace />;
  if (requiredType && userType !== requiredType) {
    return <Navigate to={userType === 'empresa' ? '/empresa' : '/funcionario'} replace />;
  }
  return <>{children}</>;
}

function RedirectIfSigned({ children }: { children: React.ReactNode }) {
  const { signed, userType, loading } = useAuth();
  if (loading) return null;
  if (signed) return <Navigate to={userType === 'empresa' ? '/empresa' : '/funcionario'} replace />;
  return <>{children}</>;
}

/**
 * Redireciona empresa para /kiosk sempre que o flag @kiosk:active estiver ativo no localStorage.
 * Lê o localStorage diretamente (não depende do estado de contexto) para reagir também a
 * navegações que ocorrem após o mount inicial — ex.: erros de JS que causam navigate('/empresa').
 * Aplicado a TODAS as rotas de empresa via EmpresaLayout (layout route).
 */
function KioskAutoReturn({ children }: { children: React.ReactNode }) {
  const { signed, userType, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !signed || userType !== 'empresa') return;
    if (localStorage.getItem('@kiosk:active') === 'true') {
      navigate('/kiosk', { replace: true });
    }
  }, [loading, signed, userType, navigate]);

  return <>{children}</>;
}

/** Layout route que injeta o KioskAutoReturn em todas as sub-rotas da empresa. */
function EmpresaLayout() {
  return (
    <RequireAuth requiredType="empresa">
      <KioskAutoReturn>
        <Outlet />
      </KioskAutoReturn>
    </RequireAuth>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

function AppRoutes() {
  useFullscreen();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<RedirectIfSigned><HomePage /></RedirectIfSigned>} />
        <Route path="/funcionario/login" element={<RedirectIfSigned><FuncionarioLoginPage /></RedirectIfSigned>} />
        <Route path="/empresa/login" element={<RedirectIfSigned><EmpresaLoginPage /></RedirectIfSigned>} />

        {/* Funcionário portal */}
        <Route path="/funcionario" element={<RequireAuth requiredType="funcionario"><FuncionarioDashboardPage /></RequireAuth>} />
        <Route path="/funcionario/espelho" element={<RequireAuth requiredType="funcionario"><EspelhoPontoPage /></RequireAuth>} />
        <Route path="/funcionario/configuracoes" element={<RequireAuth requiredType="funcionario"><FuncionarioConfigPage /></RequireAuth>} />

        {/* Empresa portal — KioskAutoReturn em todas as rotas via layout route */}
        <Route element={<EmpresaLayout />}>
          <Route path="/empresa" element={<EmpresaDashboardPage />} />
          <Route path="/empresa/funcionarios" element={<FuncionariosPage />} />
          <Route path="/empresa/funcionarios/novo" element={<FuncionarioFormPage />} />
          <Route path="/empresa/funcionarios/:id" element={<FuncionarioFormPage />} />
          <Route path="/empresa/registros" element={<RegistrosEmpresaPage />} />
          <Route path="/empresa/configuracoes" element={<ConfiguracoesEmpresaPage />} />
        </Route>

        {/* Kiosk — envolto em ErrorBoundary para recovery sem stacktrace */}
        <Route path="/kiosk" element={
          <RequireAuth requiredType="empresa">
            <KioskErrorBoundary>
              <KioskPage />
            </KioskErrorBoundary>
          </RequireAuth>
        } />

        {/* Legacy redirects */}
        <Route path="/login/funcionario" element={<Navigate to="/funcionario/login" replace />} />
        <Route path="/login/empresa" element={<Navigate to="/empresa/login" replace />} />
        <Route path="/empresa/kiosk" element={<Navigate to="/kiosk" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        {/* Toast de atualização do SW — discreto, não bloqueia o kiosk */}
        <SwUpdateToast />
      </BrowserRouter>
    </AuthProvider>
  );
}
