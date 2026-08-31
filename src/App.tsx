import React, { useEffect } from 'react'
import { AppProvider, useApp } from './contexts/AppContext'
import { LoginPage } from './pages/LoginPage'
import { ChatPage } from './pages/ChatPage'
import { DashboardPage } from './pages/DashboardPage'
import { AuditPage } from './pages/AuditPage'
import { SettingsPage } from './pages/SettingsPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { UsersPage } from './pages/UsersPage'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { SessionWarning } from './components/layout/SessionWarning'
import { useAuth } from './hooks/useAuth'
import { useConversationHydration } from './hooks/useConversationHydration'
import { Loader2 } from 'lucide-react'
import { Logo } from './components/ui/Logo'
import { useQueryClient } from '@tanstack/react-query'

function useResetQueryCacheOnUserChange(userId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (userId) return
    queryClient.clear()
  }, [userId, queryClient])
}

function AppContent() {
  const { state, dispatch } = useApp()
  const { isLoading, isAuthenticated } = useAuth()
  useConversationHydration()
  useResetQueryCacheOnUserChange(state.user?.id)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="flex justify-center mb-4 drop-shadow-lg">
            <Logo size={64} />
          </div>
          <Loader2 size={24} className="animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-[var(--text-secondary)] font-medium">
            Carregando...
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            DocRH
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !state.user) {
    return <LoginPage />
  }

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
      case 'users':
        return <UsersPage />
      default:
        return <ChatPage />
    }
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      <Header />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className={`sidebar-overlay fixed inset-0 z-30 bg-black/40 lg:hidden ${
            state.sidebarOpen ? 'sidebar-overlay--visible' : 'sidebar-overlay--hidden'
          }`}
          onClick={() => dispatch({ type: 'SET_SIDEBAR', payload: false })}
          aria-hidden={!state.sidebarOpen}
        />

        <Sidebar />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div
            key={state.activeView}
            className="flex-1 flex flex-col min-h-0 animate-page-enter"
          >
            {renderPage()}
          </div>
        </main>
      </div>

      <SessionWarning />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
