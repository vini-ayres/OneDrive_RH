# RH Inteligente — Sistema Corporativo de Consulta de Documentos

## Visão Geral

Sistema web corporativo moderno e seguro para consulta e análise inteligente de documentos armazenados no **Microsoft OneDrive** e **SharePoint**, integrado com backend **n8n** via API REST.

Desenvolvido para o setor de Recursos Humanos, com:
- Autenticação corporativa via **Microsoft Entra ID (Azure AD)**
- Controle de acesso baseado em papéis (**RBAC**)
- Conformidade com **LGPD**
- Interface semelhante ao **ChatGPT Enterprise**

---

## Funcionalidades Implementadas

### ✅ Autenticação Microsoft Entra ID
- OAuth 2.0 + OpenID Connect (MSAL v3)
- Single Sign-On (SSO) corporativo
- Renovação automática de tokens
- Timeout de sessão: 30 minutos de inatividade
- Exibição de perfil: nome, email, foto, departamento, cargo

### ✅ Controle de Acesso (RBAC)
| Perfil | Permissões |
|--------|-----------|
| **Colaborador** | Documentos próprios, públicos e compartilhados |
| **Gestor** | + Documentos da equipe e relatórios |
| **RH** | + Holerites, contratos, docs admissionais/demissionais |
| **Diretoria** | Acesso total conforme permissões corporativas |

### ✅ Interface de Chat
- Consultas em linguagem natural
- Indicadores de processamento (OneDrive → Análise → Resposta)
- Exibição de fontes e documentos consultados
- Links para abrir documentos no OneDrive
- Histórico de conversas com favoritos
- Bloqueio automático de queries não autorizadas

### ✅ Dashboard Executivo
- Consultas realizadas hoje / Usuários ativos / Documentos acessados
- Consultas bloqueadas / Acessos negados / Tempo médio
- Gráficos: Consultas por dia, Top usuários, Documentos mais acessados, Eventos de segurança
- Período: 7 dias / 30 dias

### ✅ Painel de Auditoria
- Registro completo: usuário, data, hora, consulta, documento, resultado, IP
- Filtros: busca textual, resultado, período, usuário
- Paginação com 15 registros por página
- Exportação CSV em conformidade com LGPD
- Detalhes expandíveis por registro

### ✅ Segurança
- Tokens em SessionStorage (nunca localStorage)
- Sanitização XSS com DOMPurify
- Proteção CSRF com tokens gerados via Web Crypto API
- Remoção de IDs técnicos internos (file_id, drive_id, item_id)
- Verificação de URLs antes de exibir links
- Bloqueio de queries com padrões maliciosos

---

## Estrutura do Projeto

```
src/
├── auth/
│   └── msalConfig.ts          # Configuração Microsoft MSAL
├── components/
│   ├── chat/
│   │   ├── MessageBubble.tsx  # Mensagens do chat
│   │   ├── ChatInput.tsx      # Campo de entrada
│   │   └── TypingIndicator.tsx # Indicadores de processamento
│   ├── layout/
│   │   ├── Header.tsx         # Cabeçalho com perfil
│   │   ├── Sidebar.tsx        # Menu lateral
│   │   └── SessionWarning.tsx # Alerta de sessão
│   └── ui/
│       ├── Avatar.tsx         # Avatar com fallback
│       ├── Badge.tsx          # Badges de papel/status
│       └── Tooltip.tsx        # Tooltips
├── contexts/
│   └── AppContext.tsx         # Estado global da aplicação
├── hooks/
│   ├── useAuth.ts             # Hook de autenticação
│   └── useChat.ts             # Hook do chat
├── pages/
│   ├── ChatPage.tsx           # Página principal de chat
│   ├── DashboardPage.tsx      # Dashboard executivo
│   ├── AuditPage.tsx          # Painel de auditoria
│   ├── SettingsPage.tsx       # Configurações
│   ├── DocumentsPage.tsx      # Documentos recentes
│   └── LoginPage.tsx          # Tela de login
├── services/
│   └── apiService.ts          # Integração com n8n e Microsoft Graph
├── types/
│   └── index.ts               # Tipos TypeScript
└── utils/
    ├── security.ts            # Funções de segurança
    └── rbac.ts                # Lógica de controle de acesso
```

---

## Configuração

### 1. Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

```env
# Microsoft Entra ID (OBRIGATÓRIO)
VITE_AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# URLs de redirecionamento
VITE_REDIRECT_URI=https://seu-dominio.com
VITE_POST_LOGOUT_URI=https://seu-dominio.com

# Backend n8n
VITE_N8N_BASE_URL=https://seu-n8n.empresa.com/webhook

# Webhook específico do chat
VITE_N8N_CHAT_WEBHOOK_URL=https://seu-n8n.empresa.com/webhook/one-drive-tst

# Login local de teste
VITE_ENABLE_LOCAL_TEST_USER=true
```

Se `VITE_N8N_CHAT_WEBHOOK_URL` estiver definido, o chat usa esse endpoint diretamente. Se você já apontar `VITE_N8N_BASE_URL` para um webhook completo como `/webhook/one-drive-tst`, o front também aceita isso.

Se `VITE_ENABLE_LOCAL_TEST_USER=true`, a tela de login mostra um botão adicional para entrar com um usuário local de teste, sem depender do Microsoft Entra ID ou do backend n8n.

### 2. Azure AD — Registro da Aplicação

1. Acesse **Azure Portal → Entra ID → App Registrations**
2. Registre uma nova aplicação
3. Tipo de conta: "Accounts in this organizational directory only"
4. Redirect URI: `https://seu-dominio.com` (tipo SPA)
5. Em **API Permissions**, adicione:
   - `User.Read`
   - `GroupMember.Read.All`
   - `openid`, `profile`, `email`, `offline_access`
6. Copie **Application (client) ID** e **Directory (tenant) ID** para o `.env`

### 3. Mapeamento de Grupos Azure AD

Edite `src/types/index.ts` e configure `ROLE_GROUP_MAP` com os nomes/IDs reais dos seus grupos:

```typescript
export const ROLE_GROUP_MAP: Record<string, UserRole> = {
  'Nome-Do-Grupo-Diretoria': 'diretoria',
  'Nome-Do-Grupo-RH': 'rh',
  'Nome-Do-Grupo-Gestores': 'gestor',
  'Nome-Do-Grupo-Colaboradores': 'colaborador',
}
```

### 4. Backend n8n

Configure os webhooks no n8n para os endpoints:
- `POST /chat` — Consulta ao OneDrive/SharePoint via IA
- `POST /search` — Busca de documentos
- `GET /history` — Histórico de conversas
- `GET /audit` — Logs de auditoria
- `GET /dashboard/stats` — Estatísticas
- `GET /dashboard/charts` — Dados dos gráficos

---

## Tecnologias Utilizadas

| Categoria | Tecnologia |
|-----------|-----------|
| Frontend | React 18 + TypeScript |
| Estilização | TailwindCSS v3 |
| Autenticação | @azure/msal-browser + @azure/msal-react |
| Estado | React Context API + useReducer |
| Server State | @tanstack/react-query |
| Gráficos | Recharts |
| Ícones | Lucide React |
| Segurança XSS | DOMPurify |
| Exportação | xlsx |
| Build | Vite 6 |

---

## Implantação

```bash
# Build de produção
npm run build

# Os arquivos gerados em /dist/ podem ser servidos por:
# - Cloudflare Pages
# - Azure Static Web Apps
# - Nginx
# - Qualquer CDN/servidor estático
```

---

## Conformidade e Segurança

- ✅ **LGPD**: Auditoria completa, sem logs de dados sensíveis
- ✅ **OWASP**: Proteção XSS, CSRF, injeção
- ✅ **WCAG 2.1**: aria-labels, foco gerenciado, contraste adequado
- ✅ **Zero Trust**: Verificação de permissões em cada consulta
- ✅ **Tokens seguros**: SessionStorage, nunca localStorage
