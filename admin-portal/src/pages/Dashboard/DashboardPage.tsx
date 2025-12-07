import { useEffect, useState } from "react";
import { Building2, Clock, Users, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { fetchDashboardStats, fetchCompanies, type DashboardStats } from "../../services/api";

type SummaryCard = {
  key: keyof DashboardStats;
  title: string;
  icon: LucideIcon;
};

const summaryCards: SummaryCard[] = [
  {
    key: "totalCompanies",
    title: "Empresas cadastradas",
    icon: Building2,
  },
  {
    key: "totalEmployees",
    title: "Funcionários registrados",
    icon: Users,
  },
  {
    key: "totalTimeEntries",
    title: "Registros de ponto",
    icon: Clock,
  },
];

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    async function loadData() {
      try {
        const dashStats = await fetchDashboardStats();
        const companiesList = await fetchCompanies();
        setStats(dashStats);
        setCompanies(companiesList);
      } catch (error) {
        toast.error("Não foi possível carregar os dados do dashboard.");
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Calculate paid/unpaid companies for selected month
  const getPaymentStats = () => {
    const paid = companies.filter((company) => company.payments?.[selectedMonth] === true).length;
    const unpaid = companies.length - paid;
    return { paid, unpaid };
  };

  const paymentStats = getPaymentStats();

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Administrativo</h1>
        <p className="mt-2 text-gray-600">Visualize e gerencie as informações do sistema</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map(({ key, title, icon: Icon }) => {
          const value = stats ? stats[key] : null;
          return (
            <Card key={key} className="border-0 bg-gradient-to-br from-blue-50 to-white shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {title}
                </CardTitle>
                <Icon className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-900">
                  {loading ? "--" : value?.toLocaleString("pt-BR") ?? "0"}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6">
        <Card className="border-0 bg-white shadow-md">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Status de Pagamento</CardTitle>
                <CardDescription className="text-blue-100">Distribuição de empresas pagas vs não pagas</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-blue-100">Mês:</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-2 bg-blue-500 border border-blue-400 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-white"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg">
                <div className="text-gray-400">Carregando dados...</div>
              </div>
            ) : (paymentStats.paid + paymentStats.unpaid) > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Pagas", value: paymentStats.paid, fill: "#22c55e" },
                      { name: "Não Pagas", value: paymentStats.unpaid, fill: "#ef4444" },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }: { name?: string; value: number }) => `${name ?? "N/A"}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#22c55e" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip formatter={(value: number | string) => `${value} empresas`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg">
                <div className="text-gray-400">Sem dados disponíveis para este período</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
