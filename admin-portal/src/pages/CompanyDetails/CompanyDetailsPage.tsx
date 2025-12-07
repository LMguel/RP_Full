import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Mail, Calendar, Users, Eye, EyeOff } from "lucide-react";

import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  fetchCompanyDetails,
  fetchCompanyEmployees,
  updateCompanyPaymentStatus,
  type CompanySummary,
  type CompanyEmployee,
} from "../../services/api";

export interface CompanyDetail extends CompanySummary {
  senhaHash?: string; // Password hash from backend
}

interface PaymentMonth {
  monthYear: string;
  label: string;
  isPaid: boolean;
}

export function CompanyDetailsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<CompanySummary | null>(null);
  const [employees, setEmployees] = useState<CompanyEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [creationMonth, setCreationMonth] = useState<string>("");
  const [selectedCenterMonth, setSelectedCenterMonth] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!companyId) {
      navigate("/companies", { replace: true });
      return;
    }

    async function loadDetails() {
      try {
        if (!companyId) return;
        const [companyData, employeesData] = await Promise.all([
          fetchCompanyDetails(companyId),
          fetchCompanyEmployees(companyId),
        ]);

        setCompany(companyData);
        setEmployees(employeesData);

        // Store creation month
        const createdDate = new Date(companyData.dateCreated);
        const creationMonthStr = createdDate.toISOString().slice(0, 7);
        setCreationMonth(creationMonthStr);
        
        // Initialize selected center month to current month
        const now = new Date();
        const currentMonthStr = now.toISOString().slice(0, 7);
        setSelectedCenterMonth(currentMonthStr);
      } catch (error) {
        toast.error("Não foi possível carregar os dados da empresa.");
        console.error(error);
        navigate("/companies", { replace: true });
      } finally {
        setLoading(false);
      }
    }

    loadDetails();
  }, [companyId, navigate]);

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: "Ativa",
      inactive: "Inativa",
      suspended: "Suspensa",
      deleted: "Deletada",
    };
    return labels[status] || status;
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "suspended":
        return "bg-yellow-100 text-yellow-800";
      case "inactive":
      case "deleted":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handlePaymentToggle = async (monthYear: string, currentState: boolean) => {
    if (!company) return;
    
    try {
      await updateCompanyPaymentStatus(companyId!, monthYear, !currentState);
      
      // Update local state
      if (company.payments) {
        const newPayments = { ...company.payments };
        newPayments[monthYear] = !currentState;
        setCompany({ ...company, payments: newPayments });
      }
      
      toast.success(`Pagamento de ${monthYear} ${!currentState ? "marcado" : "desmarcado"}`);
    } catch (error) {
      toast.error("Erro ao atualizar status de pagamento");
      console.error(error);
    }
  };

  const getMonthStatus = (monthYear: string) => {
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    
    if (monthYear < currentMonth) {
      return "past";
    } else if (monthYear === currentMonth) {
      return "current";
    } else {
      return "future";
    }
  };

  const getMonthRowStyle = (monthYear: string) => {
    const status = getMonthStatus(monthYear);
    switch (status) {
      case "past":
        return "bg-gray-50";
      case "current":
        return "bg-blue-50";
      case "future":
        return "bg-green-50";
      default:
        return "";
    }
  };

  const getMonthStatusLabel = (monthYear: string) => {
    const status = getMonthStatus(monthYear);
    switch (status) {
      case "past":
        return "(Passado)";
      case "current":
        return "(Atual)";
      case "future":
        return "(Futuro)";
      default:
        return "";
    }
  };

  const generatePaymentMonthsForView = () => {
    if (!company || !selectedCenterMonth) return [];

    const [year, month] = selectedCenterMonth.split("-").map(Number);
    const centerDate = new Date(year, month - 1, 1);
    
    // Start 4 months before the selected month
    const startDate = new Date(centerDate.getFullYear(), centerDate.getMonth() - 4, 1);
    const months: PaymentMonth[] = [];

    // Show 9 months: 4 before + center month + 4 after
    for (let i = 0; i < 9; i++) {
      const currentDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      const monthYear = currentDate.toISOString().slice(0, 7);
      const label = currentDate.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });
      const isPaid = company.payments && company.payments[monthYear] === true;

      months.push({
        monthYear,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        isPaid,
      });
    }

    return months;
  };

  const displayedPaymentMonths = generatePaymentMonthsForView();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-40 rounded bg-gray-200" />
          <div className="h-32 rounded bg-gray-100" />
          <div className="h-64 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="mb-4 text-gray-600">Empresa não encontrada</p>
        <Button onClick={() => navigate("/companies")} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Empresas
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate("/companies")}
          className="text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      {/* Company Info Card */}
      <Card className="border-0 bg-gradient-to-r from-blue-50 to-white shadow-md">
        <CardHeader className="border-b-2 border-blue-100">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-3xl font-bold text-gray-900">
                {company.companyName}
              </CardTitle>
              <CardDescription className="mt-2 text-gray-600">
                Detalhes da empresa e documentos
              </CardDescription>
            </div>
            <Badge className={getStatusBadgeColor(company.status)}>
              {getStatusLabel(company.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 pt-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 border-l-4 border-blue-600 pl-4">
            <p className="text-xs font-bold uppercase text-blue-600">ID da Empresa</p>
            <p className="font-mono text-sm font-semibold text-gray-900 break-all">
              {company.companyId}
            </p>
          </div>
          <div className="space-y-2 border-l-4 border-blue-500 pl-4">
            <p className="text-xs font-bold uppercase text-blue-600">Email</p>
            <p className="flex items-center text-sm text-gray-700">
              <Mail className="mr-2 h-4 w-4" />
              {company.email}
            </p>
          </div>
          <div className="space-y-2 border-l-4 border-blue-400 pl-4">
            <p className="text-xs font-bold uppercase text-blue-600">Data de Criação</p>
            <p className="flex items-center text-sm text-gray-700">
              <Calendar className="mr-2 h-4 w-4" />
              {company.dateCreated}
            </p>
          </div>
          <div className="space-y-2 border-l-4 border-blue-300 pl-4">
            <p className="text-xs font-bold uppercase text-blue-600">ID do Usuário</p>
            <p className="font-mono text-sm font-semibold text-gray-900 break-all">
              {company.userId}
            </p>
          </div>
          <div className="space-y-2 border-l-4 border-blue-200 pl-4">
            <p className="text-xs font-bold uppercase text-blue-600">Funcionários</p>
            <p className="flex items-center text-sm text-gray-700">
              <Users className="mr-2 h-4 w-4" />
              {company.activeEmployees}/{company.expectedEmployees || 0}
            </p>
          </div>
          <div className="space-y-2 border-l-4 border-blue-100 pl-4">
            <p className="text-xs font-bold uppercase text-blue-600">Senha</p>
            <div className="flex items-center gap-2">
              <input
                type={showPassword ? "text" : "password"}
                value={company.senha || ""}
                readOnly
                className="flex-1 px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm text-gray-900 font-mono"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card className="border-0 bg-white shadow-md">
        <CardHeader className="rounded-t-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Histórico de Pagamentos</CardTitle>
              <CardDescription className="text-blue-100">
                4 meses anteriores, mês selecionado e 4 meses seguintes
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-blue-100">Centralizar em:</label>
              <input
                type="month"
                value={selectedCenterMonth}
                onChange={(e) => setSelectedCenterMonth(e.target.value)}
                min={creationMonth}
                className="px-3 py-2 bg-blue-500 border border-blue-400 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-blue-200">
                <TableHead className="font-bold text-blue-900">Mês</TableHead>
                <TableHead className="font-bold text-blue-900">Status</TableHead>
                <TableHead className="font-bold text-blue-900">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedPaymentMonths.map((month) => (
                <TableRow
                  key={month.monthYear}
                  className={`border-b border-gray-200 hover:bg-blue-50 transition-colors ${getMonthRowStyle(month.monthYear)}`}
                >
                  <TableCell className="font-medium text-gray-900">
                    {month.label} <span className="text-xs text-gray-500 ml-2">{getMonthStatusLabel(month.monthYear)}</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        month.isPaid
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }
                    >
                      {month.isPaid ? "Pagou" : "Não Pagou"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={month.isPaid}
                        onChange={() => handlePaymentToggle(month.monthYear, month.isPaid)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-lg">$</span>
                    </label>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Active Employees */}
      <Card className="border-0 bg-white shadow-md">
        <CardHeader className="rounded-t-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <CardTitle>Funcionários Ativos</CardTitle>
          <CardDescription className="text-blue-100">
            {employees.length} funcionários cadastrados na empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-blue-200">
                <TableHead className="font-bold text-blue-900">Nome</TableHead>
                <TableHead className="font-bold text-blue-900">Cargo</TableHead>
                <TableHead className="font-bold text-blue-900">Email</TableHead>
                <TableHead className="font-bold text-blue-900">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-gray-500">
                    Nenhum funcionário ativo nesta empresa.
                  </TableCell>
                </TableRow>
              ) : (
                employees.slice(0, 10).map((employee) => (
                  <TableRow
                    key={employee.id}
                    className="border-b border-gray-200 hover:bg-blue-50 transition-colors"
                  >
                    <TableCell className="font-semibold text-gray-900">
                      {employee.nome}
                    </TableCell>
                    <TableCell className="text-gray-700">{employee.cargo}</TableCell>
                    <TableCell className="text-gray-600 text-sm">{employee.email}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          employee.ativo
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }
                      >
                        {employee.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

