import { type ChangeEvent, type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { createCompany, type CreateCompanyPayload } from "../../services/api";

type ExtendedCreateCompanyPayload = CreateCompanyPayload & { phone?: string };

const initialForm: ExtendedCreateCompanyPayload = {
  userId: "",
  companyName: "",
  email: "",
  password: "",
  confirmPassword: "",
  expectedEmployees: 0,
  phone: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-white/38">
        {label}
      </label>
      {children}
    </div>
  );
}

export function CompanyCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ExtendedCreateCompanyPayload>(initialForm);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(field: keyof ExtendedCreateCompanyPayload) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createCompany({ ...form });
      toast.success("Empresa cadastrada com sucesso.");
      setForm(initialForm);
      navigate("/companies", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao cadastrar empresa.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">

      {/* header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.05] transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      </div>

      <div>
        <h1 className="text-[28px] font-bold text-white leading-none tracking-tight">Cadastrar Empresa</h1>
        <p className="mt-1 text-[13px] text-white/38">
          Informe os dados para liberar o acesso da empresa ao ecossistema RP.
        </p>
      </div>

      {/* form card */}
      <div
        className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: "rgba(255,255,255,0.025)" }}
      >
        <div className="px-5 py-3.5 border-b border-white/[0.06]">
          <p className="text-[13px] font-semibold text-white/65">Dados da Empresa</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 grid gap-5 md:grid-cols-2">

            <Field label="ID do Usuário (user_id)">
              <input
                className="input-glass"
                value={form.userId}
                onChange={handleChange("userId")}
                placeholder="Ex: admin, gerente"
                required
                autoComplete="off"
              />
            </Field>

            <Field label="Email">
              <input
                className="input-glass"
                type="email"
                value={form.email}
                onChange={handleChange("email")}
                placeholder="contato@empresa.com"
                required
                autoComplete="off"
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Nome da Empresa">
                <input
                  className="input-glass"
                  value={form.companyName}
                  onChange={handleChange("companyName")}
                  placeholder="Ex: RP Tecnologia"
                  required
                  autoComplete="off"
                />
              </Field>
            </div>

            <Field label="Número de Funcionários">
              <input
                className="input-glass"
                type="number"
                value={form.expectedEmployees || 0}
                onChange={handleChange("expectedEmployees")}
                placeholder="Ex: 20"
                min="0"
              />
            </Field>

            <Field label="Telefone">
              <input
                className="input-glass"
                type="tel"
                value={form.phone || ""}
                onChange={handleChange("phone")}
                placeholder="(99) 99999-9999"
                maxLength={20}
              />
            </Field>

            <Field label="Senha">
              <input
                className="input-glass"
                type="password"
                value={form.password}
                onChange={handleChange("password")}
                placeholder="Senha provisória"
                required
                autoComplete="new-password"
              />
            </Field>

            <Field label="Confirmar Senha">
              <input
                className="input-glass"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange("confirmPassword")}
                placeholder="Repita a senha"
                required
                autoComplete="new-password"
              />
            </Field>

          </div>

          {/* footer */}
          <div
            className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-end gap-3"
            style={{ background: "rgba(255,255,255,0.01)" }}
          >
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-white/45 hover:text-white/70 hover:bg-white/[0.05] transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{ background: "linear-gradient(90deg,#1d4ed8,#3b82f6)" }}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : "Cadastrar Empresa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
