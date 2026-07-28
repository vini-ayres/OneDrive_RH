import { UserProfile } from '../types'

export const LOCAL_TEST_ACCESS_TOKEN = 'local-test-token'
export const LOCAL_TEST_USER_ID = 'local-test-user'
export const LOCAL_TEST_USER_EMAIL = 'teste.local@empresa.local'
export const LOCAL_TEST_USER_NAME = 'Usuário de Teste Local'

export function isLocalTestModeEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_ENABLE_LOCAL_TEST_USER === 'true'
}

export function isLocalTestUser(user: UserProfile | null | undefined): boolean {
  return Boolean(user && user.accessToken === LOCAL_TEST_ACCESS_TOKEN)
}

export function createLocalTestUserProfile(): UserProfile {
  const now = new Date()

  return {
    id: LOCAL_TEST_USER_ID,
    username: 'teste.local',
    displayName: LOCAL_TEST_USER_NAME,
    email: LOCAL_TEST_USER_EMAIL,
    jobTitle: 'Analista de Testes',
    department: 'Tecnologia',
    officeLocation: 'Ambiente Local',
    mobilePhone: '',
    photoUrl: undefined,
    roles: ['admin'],
    groups: ['RH-Sistema-Admin-Local'],
    accessToken: LOCAL_TEST_ACCESS_TOKEN,
    sessionStart: now,
    lastActivity: now,
  }
}
