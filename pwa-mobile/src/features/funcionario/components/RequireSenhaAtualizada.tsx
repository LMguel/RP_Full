import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { FuncionarioUser } from '../../../types';

/**
 * Gate que força a troca de senha antes de qualquer outra rota do funcionário,
 * quando must_change_password vier true no login (RH gerou senha temporária,
 * seja no cadastro ou porque o funcionário esqueceu a senha). Vem ANTES do
 * gate de foto (RequireFotoCadastrada) — segurança da conta primeiro.
 */
export default function RequireSenhaAtualizada() {
  const { user } = useAuth();
  const func = user as FuncionarioUser;

  if (func?.must_change_password) {
    return <Navigate to="/funcionario/trocar-senha" replace />;
  }

  return <Outlet />;
}
