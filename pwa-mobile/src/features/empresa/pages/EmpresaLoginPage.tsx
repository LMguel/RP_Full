import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../auth/AuthContext';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';

const SAVED_USUARIO_KEY = '@empresa:saved_usuario';
const SAVED_SENHA_KEY   = '@empresa:saved_senha';

function saveCredentials(usuario: string, senha: string) {
  localStorage.setItem(SAVED_USUARIO_KEY, usuario);
  localStorage.setItem(SAVED_SENHA_KEY, btoa(unescape(encodeURIComponent(senha))));
}

function loadCredentials(): { usuario: string; senha: string } | null {
  const usuario  = localStorage.getItem(SAVED_USUARIO_KEY);
  const senhab64 = localStorage.getItem(SAVED_SENHA_KEY);
  if (!usuario || !senhab64) return null;
  try {
    const senha = decodeURIComponent(escape(atob(senhab64)));
    return { usuario, senha };
  } catch {
    return null;
  }
}

function clearCredentials() {
  localStorage.removeItem(SAVED_USUARIO_KEY);
  localStorage.removeItem(SAVED_SENHA_KEY);
}

export default function EmpresaLoginPage() {
  const navigate       = useNavigate();
  const location       = useLocation();
  const { signInEmpresa } = useAuth();

  const [usuario,    setUsuario]    = useState('');
  const [senha,      setSenha]      = useState('');
  const [showSenha,  setShowSenha]  = useState(false);
  const [lembrar,    setLembrar]    = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [autoLogin,  setAutoLogin]  = useState(false);

  // Ref estável para não incluir signInEmpresa/navigate como deps do effect de mount
  const signInRef  = useRef(signInEmpresa);
  signInRef.current = signInEmpresa;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // Se há credenciais salvas, disparar auto-login (este é o tablet de kiosk).
  // Exceção: quando o admin clicou em "Sair" — pré-preenche mas não auto-loga,
  // permitindo que ele reveja/altere as credenciais antes de reabrir a câmera.
  useEffect(() => {
    const saved = loadCredentials();
    if (!saved) return;

    setUsuario(saved.usuario);
    setSenha(saved.senha);
    setLembrar(true);

    if ((location.state as any)?.fromLogout) return; // logout manual → só pré-preenche

    setAutoLogin(true);

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        await signInRef.current(saved.usuario, saved.senha);
        saveCredentials(saved.usuario, saved.senha);
        localStorage.setItem('@kiosk:active', 'true');
        navigateRef.current('/kiosk');
      } catch (err: any) {
        setAutoLogin(false);
        setError(err?.response?.data?.error || 'Não foi possível conectar. Verifique as credenciais.');
      } finally {
        setLoading(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!usuario.trim()) { setError('Digite o usuário.'); return; }
    if (!senha)          { setError('Digite a senha.');   return; }

    setLoading(true);
    try {
      await signInEmpresa(usuario.trim(), senha);
      if (lembrar) {
        saveCredentials(usuario.trim(), senha);
        localStorage.setItem('@kiosk:active', 'true');
        navigate('/kiosk');
      } else {
        clearCredentials();
        navigate('/empresa');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Usuário ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  };

  // ── Tela de auto-login (credenciais salvas sendo usadas) ──────────────────────
  if (autoLogin && !error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col items-center gap-7 text-center"
        >
          {/* Ícone de câmera pulsando */}
          <motion.div
            animate={{ opacity: [0.6, 1, 0.6], scale: [0.97, 1, 0.97] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
            className="w-28 h-28 bg-emerald-500/20 rounded-3xl flex items-center justify-center border border-emerald-500/30 shadow-2xl shadow-emerald-500/10"
          >
            <svg className="w-14 h-14 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </motion.div>

          <div>
            <p className="text-white text-2xl font-black">Abrindo câmera…</p>
            <p className="text-slate-400 text-sm mt-1.5">Conectando automaticamente</p>
          </div>

          <button
            onClick={() => { setAutoLogin(false); setLoading(false); }}
            className="text-slate-600 text-sm hover:text-slate-400 transition-colors mt-2 px-4 py-2"
          >
            Cancelar
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Formulário de login ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="flex items-center px-5 pt-10 pb-2">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-200 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex-1 flex flex-col justify-center px-6 pb-10 max-w-sm mx-auto w-full"
      >
        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-600/30">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-50">Acesso Empresa</h1>
          <p className="text-slate-400 text-sm mt-1">Gestão de ponto e funcionários</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Usuário"
            type="text"
            placeholder="seu.usuario@empresa.com"
            value={usuario}
            onChange={e => setUsuario(e.target.value)}
            autoComplete="username"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />
          <Input
            label="Senha"
            type={showSenha ? 'text' : 'password'}
            placeholder="••••••••"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            autoComplete="current-password"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
            rightIcon={
              <button type="button" onClick={() => setShowSenha(s => !s)} className="text-slate-400 hover:text-slate-200">
                {showSenha
                  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                }
              </button>
            }
          />

          {/* Lembrar credenciais */}
          <button
            type="button"
            onClick={() => setLembrar(v => !v)}
            className="flex items-center gap-3 w-full py-1 group"
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${lembrar ? 'bg-blue-600 border-blue-500' : 'bg-transparent border-slate-600 group-hover:border-slate-400'}`}>
              {lembrar && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div className="text-left">
              <span className="text-slate-300 text-sm font-medium group-hover:text-slate-200 transition-colors block">
                Usar este tablet como ponto de câmera
              </span>
              <span className="text-slate-500 text-xs">
                Abre a câmera automaticamente ao iniciar
              </span>
            </div>
          </button>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-rose-500/15 border border-rose-500/30 rounded-xl px-4 py-3">
              <p className="text-rose-400 text-sm">{error}</p>
            </motion.div>
          )}

          <Button type="submit" fullWidth loading={loading} size="lg" className="mt-2">
            {lembrar ? 'Entrar e abrir câmera' : 'Entrar'}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/funcionario/login')}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            Acessar como funcionário →
          </button>
        </div>
      </motion.div>
    </div>
  );
}
