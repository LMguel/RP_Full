import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import apiService from '../../../services/api';
import type { FuncionarioUser } from '../../../types';

const CACHE_KEY = '@app:temFotoCadastrada';

/**
 * Gate de primeiro acesso: garante que o funcionário tenha uma foto/face_id
 * cadastrado antes de usar qualquer rota do portal. Cacheia o resultado em
 * sessionStorage para não repetir o request a cada navegação — só reconsulta
 * uma vez por sessão de app (a página de cadastro seta a flag após sucesso).
 */
export default function RequireFotoCadastrada() {
  const { user } = useAuth();
  const func = user as FuncionarioUser;
  const [checking, setChecking] = useState(() => sessionStorage.getItem(CACHE_KEY) !== 'true');
  const [temFoto, setTemFoto] = useState(() => sessionStorage.getItem(CACHE_KEY) === 'true');

  useEffect(() => {
    if (!checking || !func?.id) return;
    let cancelled = false;
    apiService.getEmployee(func.id)
      .then(employee => {
        if (cancelled) return;
        // face_id nunca é exposto pelo backend (dado biométrico sensível) — usar o
        // sinal derivado tem_biometria_facial (backend/utils/response_utils.py).
        const has = Boolean(employee?.tem_biometria_facial);
        if (has) sessionStorage.setItem(CACHE_KEY, 'true');
        setTemFoto(has);
      })
      .catch(() => {
        // Falha ao checar: não bloqueia o funcionário preso numa tela de loading.
        // Deixa passar — o backend segue sendo a autoridade real na hora do registro.
        if (!cancelled) setTemFoto(true);
      })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [checking, func?.id]);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!temFoto) {
    return <Navigate to="/funcionario/cadastro-foto" replace />;
  }

  return <Outlet />;
}
