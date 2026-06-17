import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { LoginPage } from "../pages/Login/LoginPage";
import { DashboardPage } from "../pages/Dashboard/DashboardPage";
import { CompaniesPage } from "../pages/Companies/CompaniesPage";
import { CompanyDetailsPage } from "../pages/CompanyDetails/CompanyDetailsPage";
import { CompanyCreatePage } from "../pages/CompanyCreate/CompanyCreatePage";
import { ClientsPage } from "../pages/Clients/ClientsPage";
import { AwsCostsPage } from "../pages/AwsCosts/AwsCostsPage";
import { KioskLogsPage } from "../pages/KioskLogs/KioskLogsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/companies" element={<CompaniesPage />} />
          <Route path="/companies/create" element={<CompanyCreatePage />} />
          <Route path="/companies/:companyId" element={<CompanyDetailsPage />} />
          <Route path="/kiosk-logs" element={<KioskLogsPage />} />
          <Route path="/aws-costs" element={<AwsCostsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
