import React, { useEffect } from 'react'
import { useMsal } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import { AppProvider, useApp } from './contexts/AppContext'
import { LoginPage } from './pages/LoginPage'
import { ChatPage } from './pages/ChatPage'
import { DashboardPage } from './pages/DashboardPage'
import { AuditPage } from './pages/AuditPage'
import { SettingsPage } from './pages/SettingsPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { SessionWarning } from './components/layout/SessionWarning'
import { useAuth } from './hooks/useAuth'
import { Loader2, Shield } from 'lucide-react'

function AppContent() {
  const { state } = useApp()
  const { isLoading, isAuthenticated } = useAuth()
  const { inProgress } = useMsal()

  const isMsalBusy = inProgress !== InteractionStatus.None

  // Loading state
  if (isLoading || isMsalBusy) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield size={32} className="text-white" />
          </div>
          <Loader2 size={24} className="animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-[var(--text-secondary)] font-medium">
            {isMsalBusy ? 'Autenticando com Microsoft...' : 'Carregando...'}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            RH Inteligente
          </p>
        </div>
      </div>
    )
  }

  // Not authenticated - show login
  if (!isAuthenticated || !state.user) {
    return <LoginPage />
  }

  // Main app layout
  const renderPage = () => {
    switch (state.activeView) {
      case 'chat':
        return <ChatPage />
      case 'dashboard':
        return <DashboardPage />
      case 'audit':
        return <AuditPage />
      case 'settings':
        return <SettingsPage />
      case 'documents':
        return <DocumentsPage />
      default:
        return <ChatPage />
    }
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      {/* Header */}
      <Header />

      {/* Main layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        {state.sidebarOpen && (
          <>
            {/* Mobile overlay */}
            <div
              className="fixed inset-0 z-30 bg-black/40 lg:hidden"
              onClick={() => {}}
            />
            <Sidebar />
          </>
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {renderPage()}
        </main>
      </div>

      {/* Session warning */}
      <SessionWarning />
    </div>
  )
}

// HOC para lidar com o redirect após login
function AuthHandler({ children }: { children: React.ReactNode }) {
  const { instance } = useMsal()

  useEffect(() => {
    // Processar resposta do redirect de autenticação
    instance.handleRedirectPromise()
      .then(result => {
        if (result) {
          // Login bem-sucedido via redirect
          instance.setActiveAccount(result.account)
        }
      })
      .catch(error => {
        console.error('Erro ao processar redirect de autenticação:', error)
      })
  }, [instance])

  return <>{children}</>
}

export default function App() {
  return (
    <AppProvider>
      <AuthHandler>
        <AppContent />
      </AuthHandler>
    </AppProvider>
  )
}
