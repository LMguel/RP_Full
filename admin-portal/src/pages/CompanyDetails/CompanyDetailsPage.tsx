import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Mail, Calendar, User } from "lucide-react";

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
  fetchCompanyRecords,
  type CompanySummary,
  type CompanyEmployee,
  type CompanyRecord,
} from "../../services/api";

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
  const [records, setRecords] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentMonths, setPaymentMonths] = useState<PaymentMonth[]>([]);

  useEffect(() => {
    if (!companyId) {
      navigate("/companies", { replace: true });
      return;
    }

    async function loadDetails() {
      try {
        if (!companyId) return;
        const [companyData, employeesData, recordsData] = await Promise.all([
          fetchCompanyDetails(companyId),
          fetchCompanyEmployees(companyId),
          fetchCompanyRecords(companyId),
        ]);

        setCompany(companyData);
        setEmployees(employeesData);
        setRecords(recordsData);

        // Generate 12-month payment history
        const months: PaymentMonth[] = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthYear = date.toISOString().slice(0, 7); // YYYY-MM format
          const label = date.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          });
          const isPaid = companyData.payments && companyData.payments[monthYear] === true;

          months.push({
            monthYear,
            label: label.charAt(0).toUpperCase() + label.slice(1),
            isPaid,
          });
        }
        setPaymentMonths(months);
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

  const handlePaymentToggle = (monthYear: string) => {
    toast.info(`Atualizar pagamento para ${monthYear} - função em desenvolvimento`);
  };

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
            <p className="font-mono text-sm font-semibold text-gray-900">
              {company.companyId.substring(0, 12)}...
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
            <p className="flex items-center text-sm text-gray-700">
              <User className="mr-2 h-4 w-4" />
              {company.userId.substring(0, 12)}...
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card className="border-0 bg-white shadow-md">
        <CardHeader className="rounded-t-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <CardTitle>Histórico de Pagamentos</CardTitle>
          <CardDescription className="text-blue-100">
            Últimos 12 meses de pagamento
          </CardDescription>
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
              {paymentMonths.map((month) => (
                <TableRow
                  key={month.monthYear}
                  className="border-b border-gray-200 hover:bg-blue-50 transition-colors"
                >
                  <TableCell className="font-medium text-gray-900">
                    {month.label}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        month.isPaid
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {month.isPaid ? "Pagou" : "Não Pagou"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePaymentToggle(month.monthYear)}
                      className="text-blue-600 hover:bg-blue-50"
                    >
                      Marcar como {month.isPaid ? "não pago" : "pago"}
                    </Button>
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

      {/* Recent Records */}
      <Card className="border-0 bg-white shadow-md">
        <CardHeader className="rounded-t-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <CardTitle>Registros Recentes</CardTitle>
          <CardDescription className="text-blue-100">
            Últimos registros de ponto sincronizados
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-blue-200">
                <TableHead className="font-bold text-blue-900">Funcionário</TableHead>
                <TableHead className="font-bold text-blue-900">Tipo</TableHead>
                <TableHead className="font-bold text-blue-900">Data/Hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-gray-500">
                    Nenhum registro de ponto encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                records.slice(0, 10).map((record) => (
                  <TableRow
                    key={record.registro_id}
                    className="border-b border-gray-200 hover:bg-blue-50 transition-colors"
                  >
                    <TableCell className="font-semibold text-gray-900">
                      {record.funcionario_id}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          record.tipo === "entrada"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }
                      >
                        {record.tipo === "entrada" ? "Entrada" : "Saída"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm">
                      {new Date(record.data_hora).toLocaleString("pt-BR")}
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

