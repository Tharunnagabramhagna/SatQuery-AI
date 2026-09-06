import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { DashboardPage } from '../pages/DashboardPage';
import { AnalysisPage } from '../pages/AnalysisPage';
import { HistoryPage } from '../pages/HistoryPage';
import { DatasetsPage } from '../pages/DatasetsPage';
import { DocumentationPage } from '../pages/DocumentationPage';
import { SettingsPage } from '../pages/SettingsPage';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

export function AppRouter() {
  return (
    <AppShell>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/datasets" element={<DatasetsPage />} />
          <Route path="/documentation" element={<DocumentationPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </ErrorBoundary>
    </AppShell>
  );
}
