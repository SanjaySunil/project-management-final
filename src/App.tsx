import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "@/hooks/use-auth"
import { OrganizationProvider } from "@/hooks/use-organization"
import { ThemeProvider } from "next-themes"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import LoginPage from "@/pages/login"
import ClientsPage from "@/pages/clients"
import ClientOverviewPage from "@/pages/client-overview"
import ClientProjectsPage from "@/pages/client-projects"
import ProjectsPage from "@/pages/projects"
import ProposalsPage from "@/pages/proposals"
import ProjectOverviewPage from "@/pages/project-overview"
import PhaseOverviewPage from "@/pages/phase-overview"
import TasksPage from "@/pages/tasks"
import AssignedTasksPage from "@/pages/tasks-assigned"
import CredentialsPage from "@/pages/credentials"
import TeamPage from "@/pages/team"
import AuditLogsPage from "@/pages/audit-logs"
import PinLogsPage from "@/pages/pin-logs"
import ChatPage from "@/pages/chat"
import AccountPage from "@/pages/account"
import OrganizationPage from "@/pages/organization"
import NotificationsPage from "@/pages/notifications"
import FinancesPage from "@/pages/finances"
import TicketsPage from "@/pages/tickets"
import { Toaster } from "@/components/ui/sonner"
import ReloadPrompt from "@/components/reload-prompt"
import { PWAInstallModal } from "@/components/pwa-install-modal"
import { useAuth } from "@/hooks/use-auth"
import { useOrganization } from "@/hooks/use-organization"

function AppRoutes() {
  const { loading: authLoading, role } = useAuth()
  const { loading: orgLoading } = useOrganization()

  if (authLoading || orgLoading) {
    return null
  }

  const isClient = role === "client"
  const defaultDashboardPath = isClient ? "/dashboard/proposals" : "/dashboard/projects"

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route 
          index 
          element={
            <Navigate to={defaultDashboardPath} replace />
          } 
        />
        <Route path="chat" element={<ChatPage />} />
        <Route path="chat/dms" element={<ChatPage />} />
        <Route path="chat/dms/:channelId" element={<ChatPage />} />
        <Route path="chat/:channelId" element={<ChatPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:clientId/overview" element={<ClientOverviewPage />} />
        <Route path="clients/:clientId/projects" element={<ClientProjectsPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="proposals" element={<ProposalsPage />} />
        <Route path="projects/:projectId" element={<Navigate to="phases" replace />} />
        <Route path="projects/:projectId/overview" element={<Navigate to="../phases" replace />} />
        <Route path="projects/:projectId/documents" element={<ProjectOverviewPage />} />
        <Route path="projects/:projectId/phases" element={<ProjectOverviewPage />} />
        <Route path="projects/:projectId/phases/:phaseId" element={<PhaseOverviewPage />} />
        <Route path="projects/:projectId/chat" element={<ChatPage />} />
        <Route path="projects/:projectId/chat/:channelId" element={<ChatPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="tasks/assigned" element={<AssignedTasksPage />} />
        <Route path="credentials" element={<CredentialsPage />} />
        <Route path="finances" element={<FinancesPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="pin-logs" element={<PinLogsPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      <Route 
        path="/" 
        element={
          <Navigate to={defaultDashboardPath} replace />
        } 
      />
    </Routes>
  )
}

export function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <Router>
        <AuthProvider>
          <OrganizationProvider>
            <AppRoutes />
            <Toaster />
            <ReloadPrompt />
            <PWAInstallModal />
          </OrganizationProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  )
}


export default App
