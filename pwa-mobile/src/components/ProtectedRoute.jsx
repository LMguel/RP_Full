import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, userType }) {
  const { signed, userType: currentUserType, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!signed) {
    return <Navigate to="/" replace />;
  }

  // Redirecionar empresa sempre para kiosk após qualquer login
  if (signed && currentUserType === 'empresa') {
    const currentPath = window.location.pathname;
    if (currentPath !== '/empresa/kiosk') {
      return <Navigate to="/empresa/kiosk" replace />;
    }
  }

  if (userType && currentUserType !== userType) {
    const redirectPath = currentUserType === 'funcionario' 
      ? '/funcionario/dashboard' 
      : '/empresa/kiosk';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
}
