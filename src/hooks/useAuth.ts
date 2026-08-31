import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import {
  startLdapLogin,
  startMfaEnrollment,
  confirmMfaEnrollment,
  verifyMfaCode,
  LdapLoginCredentials,
  MfaChallenge,
  MfaEnrollmentStart,
} from '../services/authService'
import { UserProfile } from '../types'

export function useAuth() {
  const { state, dispatch } = useApp()
  const [authError, setAuthError] = useState<string | null>(null)

  const isAuthenticated = Boolean(state.user)
  const isLoading = state.isLoading

  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: false })
  }, [dispatch])

  const applySession = useCallback((userProfile: UserProfile) => {
    sessionStorage.removeItem('audit_buffer')
    dispatch({ type: 'SET_USER', payload: userProfile })
  }, [dispatch])

  const beginLogin = useCallback(async (credentials: LdapLoginCredentials): Promise<MfaChallenge> => {
    setAuthError(null)
    try {
      return await startLdapLogin(credentials)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao autenticar.'
      setAuthError(message)
      throw error
    }
  }, [])

  const beginEnrollment = useCallback(async (mfaToken: string): Promise<MfaEnrollmentStart> => {
    setAuthError(null)
    try {
      return await startMfaEnrollment(mfaToken)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao iniciar o MFA.'
      setAuthError(message)
      throw error
    }
  }, [])

  const finishEnrollment = useCallback(async (mfaToken: string, code: string) => {
    setAuthError(null)
    try {
      return await confirmMfaEnrollment(mfaToken, code)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao confirmar o MFA.'
      setAuthError(message)
      throw error
    }
  }, [])

  const finishChallenge = useCallback(async (mfaToken: string, code: string) => {
    setAuthError(null)
    try {
      const userProfile = await verifyMfaCode(mfaToken, code)
      applySession(userProfile)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao verificar o código.'
      setAuthError(message)
      throw error
    }
  }, [applySession])

  const logout = useCallback(() => {
    dispatch({ type: 'LOGOUT' })
    sessionStorage.clear()
    setAuthError(null)
  }, [dispatch])

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    return state.user?.accessToken || null
  }, [state.user])

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
    beginLogin,
    beginEnrollment,
    finishEnrollment,
    finishChallenge,
    applySession,
    logout,
    getAccessToken,
    clearAuthError: () => setAuthError(null),
  }
}
