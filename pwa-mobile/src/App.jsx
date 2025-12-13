import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import HomePage from './pages/HomePage';
import FuncionarioLoginPage from './pages/FuncionarioLoginPage';
import EmpresaLoginPage from './pages/EmpresaLoginPage';
import FuncionarioDashboardPage from './pages/FuncionarioDashboardPage';
import RegistroPontoPage from './pages/RegistroPontoPage';
import KioskRegistroPage from './pages/KioskRegistroPage';
import PermissionsTestPage from './pages/PermissionsTestPage';
import PWATestPage from './pages/PWATestPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login/funcionario" element={<FuncionarioLoginPage />} />
          <Route path="/login/empresa" element={<EmpresaLoginPage />} />
          
          {/* Rotas Protegidas - Funcionário */}
          <Route 
            path="/funcionario/dashboard" 
            element={
              <ProtectedRoute userType="funcionario">
                <FuncionarioDashboardPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/funcionario/registrar-ponto" 
            element={
              <ProtectedRoute userType="funcionario">
                <RegistroPontoPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Rota Kiosk - Registro Facial */}
          <Route 
            path="/empresa/kiosk" 
            element={
              <ProtectedRoute userType="empresa">
                <KioskRegistroPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Páginas de Teste */}
          <Route path="/test-permissions" element={<PermissionsTestPage />} />
          <Route path="/pwa-test" element={<PWATestPage />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
