import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SocketProvider } from './contexts/SocketContext';
import { DialogProvider } from './contexts/DialogContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ChangePasswordRequiredPage from './pages/ChangePasswordRequiredPage';
import OperationalDashboard from './pages/dashboard/OperationalDashboard';
import ExecutiveDashboard from './pages/dashboard/ExecutiveDashboard';
import ReconciliationWorkspace from './pages/reconciliation/ReconciliationWorkspace';
import ExcelImportPage from './pages/reconciliation/ExcelImportPage';
import EcritureImportPage from './pages/reconciliation/EcritureImportPage';
import EcrituresPage from './pages/reconciliation/EcrituresPage';
import RelevesPage from './pages/reconciliation/RelevesPage';
import PdfWizardPage from './pages/reconciliation/PdfWizardPage';
import JobMonitorPage from './pages/jobs/JobMonitorPage';
import PeriodsSettingsPage from './pages/settings/PeriodsSettingsPage';
import ThemesSettingsPage from './pages/settings/ThemesSettingsPage';
import BankTemplatesPage from './pages/settings/BankTemplatesPage';
import ApplicationSettingsPage from './pages/settings/ApplicationSettingsPage';
import AuditTrailPage from './pages/admin/AuditTrailPage';
import HierarchyPage from './pages/admin/HierarchyPage';
import ProfilePage from './pages/ProfilePage';
import HelpPage from './pages/HelpPage';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Chargement...</div>
      </div>
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Bloque l'accès à toute l'application (quelle que soit la route demandée)
  // tant que le mot de passe initial n'a pas été changé.
  if (user?.mustChangePassword) return <ChangePasswordRequiredPage />;
  return <>{children}</>;
};

function App() {
  return (
    <ThemeProvider>
      <DialogProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/" element={
              <PrivateRoute>
                <SocketProvider>
                  <AppLayout />
                </SocketProvider>
              </PrivateRoute>
            }>
              <Route index element={<Navigate to="/dashboard/operational" replace />} />
              {/* Dashboards */}
              <Route path="dashboard/operational" element={<OperationalDashboard />} />
              <Route path="dashboard/executive" element={<ExecutiveDashboard />} />
              <Route path="dashboard/audit" element={<AuditTrailPage />} />
              {/* Rapprochement */}
              <Route path="reconciliation/workspace" element={<ReconciliationWorkspace />} />
              <Route path="reconciliation/excel-import" element={<ExcelImportPage />} />
              <Route path="reconciliation/ecritures-import" element={<EcritureImportPage />} />
              <Route path="reconciliation/ecritures" element={<EcrituresPage />} />
              <Route path="reconciliation/releves" element={<RelevesPage />} />
              <Route path="reconciliation/pdf-wizard" element={<PdfWizardPage />} />
              {/* Jobs */}
              <Route path="jobs/monitor" element={<JobMonitorPage />} />
              {/* Settings */}
              <Route path="settings/periods" element={<PeriodsSettingsPage />} />
              <Route path="settings/themes" element={<ThemesSettingsPage />} />
              <Route path="settings/bank-templates" element={<BankTemplatesPage />} />
              <Route path="settings/application" element={<ApplicationSettingsPage />} />
              {/* Admin */}
              <Route path="admin/hierarchy" element={<HierarchyPage />} />
              <Route path="admin/audit-trail" element={<AuditTrailPage />} />
              {/* Other */}
              <Route path="profile" element={<ProfilePage />} />
              <Route path="help" element={<HelpPage />} />
              <Route path="help/admin" element={<HelpPage isAdmin />} />
              <Route path="*" element={<Navigate to="/dashboard/operational" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </DialogProvider>
    </ThemeProvider>
  );
}

export default App;
