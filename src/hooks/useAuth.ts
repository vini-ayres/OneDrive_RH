import { useCallback, useEffect } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { InteractionStatus, AuthenticationResult } from '@azure/msal-browser'
import { useApp } from '../contexts/AppContext'
import { getUserProfile, getUserGroups } from '../services/apiService'
import { getRolesFromGroups } from '../utils/rbac'
import { loginRequest, graphRequest } from '../auth/msalConfig'
import { UserProfile } from '../types'
import {
  createLocalTestUserProfile,
  isLocalTestModeEnabled,
  isLocalTestUser,
  LOCAL_TEST_ACCESS_TOKEN,
} from '../utils/localTestUser'

export function useAuth() {
  const { instance, accounts, inProgress } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const { state, dispatch } = useApp()
  const localTestModeEnabled = isLocalTestModeEnabled()
  const localTestSessionActive = isLocalTestUser(state.user)

  const isLoading = inProgress !== InteractionStatus.None
  const isAuthenticatedEffective = isAuthenticated || localTestSessionActive

  /**
   * Inicia o fluxo de login com Microsoft
   */
  const login = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      await instance.loginRedirect(loginRequest)
    } catch (error) {
      console.error('Erro no login:', error)
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [instance, dispatch])

  /**
   * Cria uma sessão local de teste sem depender do Microsoft Entra ID
   */
  const loginLocalTestUser = useCallback(() => {
    if (!localTestModeEnabled) return

    dispatch({ type: 'SET_LOADING', payload: true })
    sessionStorage.removeItem('audit_buffer')
    dispatch({ type: 'SET_USER', payload: createLocalTestUserProfile() })
  }, [dispatch, localTestModeEnabled])

  /**
   * Realiza logout
   */
  const logout = useCallback(async () => {
    try {
      dispatch({ type: 'LOGOUT' })
      // Limpar sessão
      sessionStorage.clear()

      if (localTestSessionActive || !accounts[0]) {
        return
      }
      
      await instance.logoutRedirect({
        account: accounts[0],
        postLogoutRedirectUri: window.location.origin,
      })
    } catch (error) {
      console.error('Erro no logout:', error)
    }
  }, [instance, accounts, dispatch, localTestSessionActive])

  /**
   * Obtém access token silenciosamente (com renovação automática)
   */
  const getAccessToken = useCallback(async (scopes?: string[]): Promise<string | null> => {
    if (localTestSessionActive) {
      return LOCAL_TEST_ACCESS_TOKEN
    }

    if (!accounts[0]) return null

    try {
      const result: AuthenticationResult = await instance.acquireTokenSilent({
        account: accounts[0],
        scopes: scopes || graphRequest.scopes,
      })
      return result.accessToken
    } catch {
      // Token silencioso falhou - tentar interativo
      try {
        const result = await instance.acquireTokenPopup({
          account: accounts[0],
          scopes: scopes || graphRequest.scopes,
        })
        return result.accessToken
      } catch {
        return null
      }
    }
  }, [instance, accounts, localTestSessionActive])

  /**
   * Carrega o perfil completo do usuário após autenticação
   */
  const loadUserProfile = useCallback(async () => {
    if (!accounts[0] || inProgress !== InteractionStatus.None) return

    try {
      dispatch({ type: 'SET_LOADING', payload: true })

      // Obter access token para Microsoft Graph
      const graphToken = await getAccessToken(graphRequest.scopes)
      if (!graphToken) {
        dispatch({ type: 'SET_LOADING', payload: false })
        return
      }

      // Obter token de autenticação básica para a API n8n
      const authResult = await instance.acquireTokenSilent({
        account: accounts[0],
        scopes: ['openid', 'profile', 'email', 'offline_access'],
      })

      // Buscar perfil e grupos em paralelo
      const [profileData, groups] = await Promise.all([
        getUserProfile(graphToken),
        getUserGroups(graphToken),
      ])

      if (!profileData) {
        dispatch({ type: 'SET_LOADING', payload: false })
        return
      }

      const roles = getRolesFromGroups(groups)

      const userProfile: UserProfile = {
        ...profileData,
        roles,
        groups,
        accessToken: authResult.accessToken,
        idToken: authResult.idToken || '',
        tenantId: accounts[0].tenantId,
        sessionStart: new Date(),
        lastActivity: new Date(),
      }

      dispatch({ type: 'SET_USER', payload: userProfile })
    } catch (error) {
      console.error('Erro ao carregar perfil:', error)
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [accounts, inProgress, instance, getAccessToken, dispatch])

  // Carregar perfil quando autenticado
  useEffect(() => {
    if (isAuthenticated && accounts.length > 0 && !state.user) {
      loadUserProfile()
    } else if (!isAuthenticated && inProgress === InteractionStatus.None) {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [isAuthenticated, accounts, inProgress, state.user, loadUserProfile, dispatch])

  // Verificar se sessão expirou
  useEffect(() => {
    if (!state.sessionExpiresAt) return

    const checkExpiry = setInterval(() => {
      if (state.sessionExpiresAt && new Date() >= state.sessionExpiresAt) {
        dispatch({ type: 'LOGOUT' })
        logout()
      }
    }, 60000) // Verificar a cada minuto

    return () => clearInterval(checkExpiry)
  }, [state.sessionExpiresAt, dispatch, logout])

  return {
    user: state.user,
    isAuthenticated: isAuthenticatedEffective,
    isLoading: isLoading || state.isLoading,
    login,
    loginLocalTestUser,
    logout,
    getAccessToken,
    loadUserProfile,
  }
}
