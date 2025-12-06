import { useEffect, useState } from "react";
import { Plus, Eye, Pause, Play, Trash, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { fetchCompanies, type CompanySummary } from "../../services/api";

interface Filters {
  companyName: string;
  month: string;
}

export function CompaniesPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    companyName: "",
    month: "",
  });
  const [showEmployeesModal, setShowEmployeesModal] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  useEffect(() => {
    async function loadCompanies() {
      try {
        const response = await fetchCompanies();
        setCompanies(response);
      } catch (error) {
        toast.error("Falha ao buscar empresas cadastradas.");
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadCompanies();
  }, []);

  // Filter companies based on name and payment status
  const filteredCompanies = companies.filter((company) => {
    const nameMatch = company.companyName
      .toLowerCase()
      .includes(filters.companyName.toLowerCase());
    
    if (!filters.month) return nameMatch;
    
    const isPaidInMonth = company.payments?.[filters.month] === true;
    return nameMatch && isPaidInMonth;
  });

  // Get payment status for current month
  const getCurrentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  };

  const getPaymentStatus = (company: CompanySummary) => {
    if (!filters.month) {
      const currentMonth = getCurrentMonthKey();
      return company.payments?.[currentMonth] === true ? "Pagou" : "Não Pagou";
    }
    return company.payments?.[filters.month] === true ? "Pagou" : "Não Pagou";
  };

  const getPaymentBadgeColor = (company: CompanySummary) => {
    const isPaid = filters.month 
      ? company.payments?.[filters.month] === true
      : company.payments?.[getCurrentMonthKey()] === true;
    return isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "suspended":
        return "bg-yellow-100 text-yellow-800";
      case "inactive":
        return "bg-gray-100 text-gray-800";
      case "deleted":
        return "bg-red-100 text-red-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Ativa";
      case "suspended":
        return "Suspensa";
      case "inactive":
        return "Inativa";
      case "deleted":
        return "Deletada";
      default:
        return status;
    }
  };

  const handleSuspend = async (company: CompanySummary) => {
    toast.info(`Suspender empresa ${company.companyName} - em desenvolvimento`);
    // TODO: Implement suspend API call
  };

  const handleResume = async (company: CompanySummary) => {
    toast.info(`Reativar empresa ${company.companyName} - em desenvolvimento`);
    // TODO: Implement resume API call
  };

  const handleDelete = async (company: CompanySummary) => {
    if (confirm(`Tem certeza que deseja deletar ${company.companyName}?`)) {
      toast.info(`Deletar empresa ${company.companyName} - em desenvolvimento`);
      // TODO: Implement delete API call
    }
  };

  const handleViewEmployees = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setShowEmployeesModal(true);
  };

  const selectedCompany = companies.find((c) => c.companyId === selectedCompanyId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Empresas</h1>
          <p className="mt-2 text-gray-600">Gestão das empresas vinculadas ao ecossistema RP</p>
        </div>
        <Button onClick={() => navigate("/companies/create")} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> Cadastrar Empresa
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-0 bg-white shadow-md">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg pb-4">
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar por Nome da Empresa
              </label>
              <input
                type="text"
                placeholder="Ex: Acme Corp..."
                value={filters.companyName}
                onChange={(e) =>
                  setFilters({ ...filters, companyName: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtrar por Mês (Status de Pagamento)
              </label>
              <input
                type="month"
                value={filters.month}
                onChange={(e) =>
                  setFilters({ ...filters, month: e.target.value ? e.target.value.replace("-", "-") : "" })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({ companyName: "", month: "" })}
              className="text-blue-600"
            >
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Companies Table */}
      <Card className="border-0 bg-white shadow-md">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
          <CardTitle>
            Lista de Empresas ({filteredCompanies.length} de {companies.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-blue-200">
                <TableHead className="text-blue-900 font-bold">ID</TableHead>
                <TableHead className="text-blue-900 font-bold">Nome</TableHead>
                <TableHead className="text-blue-900 font-bold">Email</TableHead>
                <TableHead className="text-blue-900 font-bold">Status</TableHead>
                <TableHead className="text-blue-900 font-bold">Pagamento</TableHead>
                <TableHead className="text-blue-900 font-bold text-center">Funcionários</TableHead>
                <TableHead className="text-blue-900 font-bold">Data Criação</TableHead>
                <TableHead className="text-right text-blue-900 font-bold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-gray-500">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-gray-500">
                    {companies.length === 0
                      ? "Nenhuma empresa cadastrada no momento."
                      : "Nenhuma empresa encontrada com os filtros selecionados."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow
                    key={company.companyId}
                    className="border-b border-gray-200 hover:bg-blue-50 transition-colors"
                  >
                    <TableCell className="font-mono text-xs text-gray-600">
                      {company.companyId.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="font-semibold text-gray-900">
                      {company.companyName}
                    </TableCell>
                    <TableCell className="text-gray-700">{company.email}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(company.status)}>
                        {getStatusLabel(company.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPaymentBadgeColor(company)}>
                        {getPaymentStatus(company)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => handleViewEmployees(company.companyId)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors font-medium text-sm"
                      >
                        <Users className="h-4 w-4" />
                        {company.activeEmployees}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(company.dateCreated).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/companies/${company.companyId}`)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {company.status === "active" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSuspend(company)}
                            className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                            title="Suspender empresa"
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        ) : company.status === "suspended" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResume(company)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Reativar empresa"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(company)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Deletar empresa"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Employees Modal */}
      {showEmployeesModal && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4 border-0 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Funcionários Ativos</CardTitle>
                  <p className="text-sm text-blue-100 mt-1">
                    {selectedCompany.companyName}
                  </p>
                </div>
                <button
                  onClick={() => setShowEmployeesModal(false)}
                  className="text-white hover:bg-blue-800 rounded-full p-2"
                >
                  ✕
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {selectedCompany.activeEmployees > 0 ? (
                  <div className="text-gray-600">
                    <p className="font-semibold text-lg mb-3">
                      Total: {selectedCompany.activeEmployees} funcionários ativos
                    </p>
                    {/* TODO: Fetch and display employee list here */}
                    <p className="text-sm text-gray-500">
                      Lista de funcionários será carregada em breve...
                    </p>
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">
                    Nenhum funcionário ativo cadastrado
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowEmployeesModal(false)}
                  className="text-gray-700"
                >
                  Fechar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
