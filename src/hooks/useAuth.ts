import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { loginWithLdap, LdapLoginCredentials } from '../services/authService'
import {
  createLocalTestUserProfile,
  isLocalTestModeEnabled,
  isLocalTestUser,
  LOCAL_TEST_ACCESS_TOKEN,
} from '../utils/localTestUser'

export function useAuth() {
  const { state, dispatch } = useApp()
  const [authError, setAuthError] = useState<string | null>(null)
  const localTestModeEnabled = isLocalTestModeEnabled()
  const localTestSessionActive = isLocalTestUser(state.user)

  const isAuthenticated = Boolean(state.user)
  const isLoading = state.isLoading

  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: false })
  }, [dispatch])

  /**
   * Autentica via Active Directory (LDAP Bind) no backend
   */
  const login = useCallback(async (credentials: LdapLoginCredentials) => {
    setAuthError(null)
    dispatch({ type: 'SET_LOADING', payload: true })

    try {
      sessionStorage.removeItem('audit_buffer')
      const userProfile = await loginWithLdap(credentials)
      dispatch({ type: 'SET_USER', payload: userProfile })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao autenticar.'
      setAuthError(message)
      dispatch({ type: 'SET_LOADING', payload: false })
      throw error
    }
  }, [dispatch])

  /**
   * Cria uma sessão local de teste sem depender do Active Directory
   */
  const loginLocalTestUser = useCallback(() => {
    if (!localTestModeEnabled) return

    setAuthError(null)
    dispatch({ type: 'SET_LOADING', payload: true })
    sessionStorage.removeItem('audit_buffer')
    dispatch({ type: 'SET_USER', payload: createLocalTestUserProfile() })
  }, [dispatch, localTestModeEnabled])

  /**
   * Realiza logout
   */
  const logout = useCallback(() => {
    dispatch({ type: 'LOGOUT' })
    sessionStorage.clear()
    setAuthError(null)
  }, [dispatch])

  /**
   * Obtém o token de sessão atual
   */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (localTestSessionActive) {
      return LOCAL_TEST_ACCESS_TOKEN
    }
    return state.user?.accessToken || null
  }, [state.user, localTestSessionActive])

  // Verificar se sessão expirou
  useEffect(() => {
    if (!state.sessionExpiresAt) return

    const checkExpiry = setInterval(() => {
      if (state.sessionExpiresAt && new Date() >= state.sessionExpiresAt) {
        logout()
      }
    }, 60000)

    return () => clearInterval(checkExpiry)
  }, [state.sessionExpiresAt, logout])

  return {
    user: state.user,
    isAuthenticated,
    isLoading,
    authError,
    login,
    loginLocalTestUser,
    logout,
    getAccessToken,
    clearAuthError: () => setAuthError(null),
  }
}
