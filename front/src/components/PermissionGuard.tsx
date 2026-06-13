import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Permission } from '../types';

interface Props {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

const PermissionGuard: React.FC<Props> = ({ permission, children, fallback }) => {
  const { hasPermission, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasPermission(permission)) {
    return fallback ? <>{fallback}</> : <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default PermissionGuard;
