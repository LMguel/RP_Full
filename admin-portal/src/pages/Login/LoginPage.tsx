import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Shield, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading } = useAuth();
  const [formState, setFormState] = useState({ login: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/dashboard";

  useEffect(() => {
    if (!loading && isAuthenticated) navigate(from, { replace: true });
  }, [from, isAuthenticated, loading, navigate]);

  useEffect(() => {
    const savedLogin = localStorage.getItem("login") ?? "";
    const savedPassword = localStorage.getItem("password") ?? "";
    if (savedLogin || savedPassword) {
      setFormState({ login: savedLogin, password: savedPassword });
      setRememberMe(true);
    }
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(formState);
      if (rememberMe) {
        localStorage.setItem("login", formState.login);
        localStorage.setItem("password", formState.password);
      } else {
        localStorage.removeItem("login");
        localStorage.removeItem("password");
      }
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível realizar o login.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: "linear-gradient(158deg,#050c1a 0%,#081020 35%,#0a1530 65%,#071220 100%)" }}
    >
      {/* Glow effect */}
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle,#1d4ed8 0%,transparent 70%)", filter: "blur(60px)" }}
      />

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div
          className="rounded-2xl border p-8"
          style={{
            background: "rgba(255,255,255,0.04)",
            borderColor: "rgba(255,255,255,0.09)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            boxShadow: "0 32px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Brand */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg"
              style={{ background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", boxShadow: "0 8px 24px rgba(59,130,246,0.35)" }}
            >
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-[18px] font-bold text-white tracking-tight">RP Control</h1>
              <p className="text-[12.5px] text-white/38 mt-0.5">Central Administrativa</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Login */}
            <div className="space-y-1.5">
              <label className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-white/38">
                Login
              </label>
              <input
                type="text"
                value={formState.login}
                autoComplete="username"
                placeholder="Seu login de administrador"
                onChange={(e) => setFormState((p) => ({ ...p, login: e.target.value }))}
                className="input-glass"
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-white/38">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formState.password}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  onChange={(e) => setFormState((p) => ({ ...p, password: e.target.value }))}
                  className="input-glass pr-10"
                  required
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-white/30 hover:text-white/65 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={() => setRememberMe((v) => !v)}
                  className="sr-only"
                />
                <div
                  className="h-4 w-4 rounded border flex items-center justify-center transition-all"
                  style={{
                    background: rememberMe ? "#3b82f6" : "rgba(255,255,255,0.04)",
                    borderColor: rememberMe ? "#3b82f6" : "rgba(255,255,255,0.15)",
                  }}
                >
                  {rememberMe && (
                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-[12.5px] text-white/40 group-hover:text-white/60 transition-colors select-none">
                Salvar credenciais
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 mt-2"
              style={{ background: "linear-gradient(90deg,#1d4ed8,#3b82f6)", boxShadow: "0 4px 16px rgba(59,130,246,0.28)" }}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Autenticando...
                </>
              ) : "Entrar"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[11px] text-white/18">
          RegistraPonto © {new Date().getFullYear()} · Acesso restrito
        </p>
      </div>
    </div>
  );
}
