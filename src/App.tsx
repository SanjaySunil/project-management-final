import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "@/hooks/use-auth"
import { OrganizationProvider } from "@/hooks/use-organization"
import { ThemeProvider } from "next-themes"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import LoginPage from "@/pages/login"
import OverviewPage from "@/pages/overview"
import ClientsPage from "@/pages/clients"
import ClientOverviewPage from "@/pages/client-overview"
import ClientProjectsPage from "@/pages/client-projects"
import ProjectsPage from "@/pages/projects"
import ProposalsPage from "@/pages/proposals"
import ProposalOverviewPage from "@/pages/proposal-overview"
import AssignedTasksPage from "@/pages/tasks-assigned"
import CredentialsPage from "@/pages/credentials"
import TeamPage from "@/pages/team"
import AuditLogsPage from "@/pages/audit-logs"
import ChatPage from "@/pages/chat"
import AccountPage from "@/pages/account"
import OrganizationPage from "@/pages/organization"
import NotificationsPage from "@/pages/notifications"
import { Toaster } from "@/components/ui/sonner"
import ReloadPrompt from "@/components/reload-prompt"

export function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <Router>
        <AuthProvider>
          <OrganizationProvider>
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
              <Route index element={<Navigate to="/dashboard/overview" replace />} />
              <Route path="overview" element={<OverviewPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="chat/dms" element={<ChatPage />} />
              <Route path="chat/dms/:channelId" element={<ChatPage />} />
              <Route path="chat/:channelId" element={<ChatPage />} />
              <Route path="clients" element={<ClientsPage />} />
              <Route path="clients/:clientId/overview" element={<ClientOverviewPage />} />
              <Route path="clients/:clientId/projects" element={<ClientProjectsPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:projectId/proposals" element={<ProposalsPage />} />
              <Route path="projects/:projectId/proposals/:proposalId" element={<ProposalOverviewPage />} />
              <Route path="projects/:projectId/chat" element={<ChatPage />} />
              <Route path="projects/:projectId/chat/:channelId" element={<ChatPage />} />
              <Route path="tasks/assigned" element={<AssignedTasksPage />} />
              <Route path="credentials" element={<CredentialsPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
              <Route path="account" element={<AccountPage />} />
              <Route path="organization" element={<OrganizationPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard/overview" replace />} />
          </Routes>
          <Toaster />
          <ReloadPrompt />
        </OrganizationProvider>
      </AuthProvider>
    </Router>
    </ThemeProvider>
  )
}


export default App
