import { type ChangeEvent, type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { createCompany, type CreateCompanyPayload } from "../../services/api";

const initialForm: CreateCompanyPayload = {
  companyName: "",
  email: "",
  password: "",
  confirmPassword: "",
  responsible: "",
  phone: "",
  status: "active",
  cnpj: "",
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
            <Label htmlFor="cnpj">CNPJ (opcional)</Label>
            <Input
              id="cnpj"
              value={form.cnpj}
              onChange={handleChange("cnpj")}
              placeholder="00.000.000/0001-00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsible">Responsável</Label>
            <Input
              id="responsible"
              value={form.responsible}
              onChange={handleChange("responsible")}
              placeholder="Nome completo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email da empresa</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={handleChange("email")}
              placeholder="contato@empresa.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={handleChange("phone")}
              placeholder="(11) 99999-0000"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={form.status}
              onChange={handleChange("status")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="active">Ativa</option>
              <option value="inactive">Inativa</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha inicial</Label>
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
