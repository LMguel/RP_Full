import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../hooks/useAuth";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading } = useAuth();
  const [formState, setFormState] = useState({ login: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/dashboard";

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [from, isAuthenticated, loading, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(formState);
      toast.success("Login realizado com sucesso.");
      navigate(from, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível realizar o login.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md border-0 bg-white shadow-2xl">
        <CardHeader className="space-y-2 border-b border-blue-100 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <CardTitle className="text-2xl font-bold">Central Administrativa</CardTitle>
          <CardDescription className="text-blue-100">Acesso restrito do sistema</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login" className="text-sm font-medium text-gray-700">Login</Label>
              <Input
                id="login"
                type="text"
                placeholder="Seu login"
                value={formState.login}
                autoComplete="username"
                onChange={(event) => setFormState((prev) => ({ ...prev, login: event.target.value }))}
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formState.password}
                autoComplete="current-password"
                onChange={(event) => setFormState((prev) => ({ ...prev, password: event.target.value }))}
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium" 
              disabled={submitting || loading}
            >
              {submitting ? "Autenticando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
