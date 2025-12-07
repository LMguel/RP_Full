import { type ChangeEvent, type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { createCompany, type CreateCompanyPayload } from "../../services/api";

const initialForm: CreateCompanyPayload = {
  userId: "",
  companyName: "",
  email: "",
  password: "",
  confirmPassword: "",
  expectedEmployees: 0,
};

export function CompanyCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<CreateCompanyPayload>(initialForm);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(field: keyof CreateCompanyPayload) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createCompany(form);
      toast.success("Empresa cadastrada com sucesso.");
      setForm(initialForm);
      navigate("/companies", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao cadastrar empresa.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-none bg-white shadow-sm">
      <CardHeader>
        <CardTitle>Cadastrar nova empresa</CardTitle>
        <CardDescription>
          Informe os dados necessários para liberar o acesso da empresa ao ecossistema RP.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="userId">ID do Usuário (user_id)</Label>
            <Input
              id="userId"
              value={form.userId}
              onChange={handleChange("userId")}
              placeholder="Ex: admin, gerente"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={handleChange("email")}
              placeholder="contato@empresa.com"
              required
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="companyName">Nome da empresa</Label>
            <Input
              id="companyName"
              value={form.companyName}
              onChange={handleChange("companyName")}
              placeholder="Ex: RP Tecnologia"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expectedEmployees">Número de Funcionários</Label>
            <Input
              id="expectedEmployees"
              type="number"
              value={form.expectedEmployees || 0}
              onChange={handleChange("expectedEmployees")}
              placeholder="Ex: 20"
              min="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={handleChange("password")}
              placeholder="Senha provisória"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange("confirmPassword")}
              placeholder="Repita a senha"
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-end gap-3 border-t bg-muted/30">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Salvando..." : "Cadastrar"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
