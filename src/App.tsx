import React from 'react'
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
  const { state, dispatch } = useApp()
  const { isLoading, isAuthenticated } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield size={32} className="text-white" />
          </div>
          <Loader2 size={24} className="animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-[var(--text-secondary)] font-medium">
            Carregando...
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            RH Inteligente
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
