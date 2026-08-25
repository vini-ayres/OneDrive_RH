# API de Dados — OneDrive RH

API Hono + Drizzle ORM + PostgreSQL para persistência de conversas, auditoria, dashboard e documentos recentes.

## Pré-requisitos

- Node.js 20+
- PostgreSQL 14+

## Configuração

```bash
cd server
cp .env.example .env
# Edite DATABASE_URL e N8N_INTERNAL_API_KEY
npm install
npm run db:migrate
npm run dev
```

A API escuta em `http://localhost:8787`.

## Endpoints

| Rota | Auth | Descrição |
|------|------|-----------|
| `GET /health` | — | Health check |
| `GET /api/history` | Bearer | Lista conversas |
| `GET /api/conversations/:id/messages` | Bearer | Mensagens da conversa |
| `GET /api/audit` | Bearer + RBAC | Logs de auditoria |
| `GET /api/dashboard/stats` | Bearer + RBAC | KPIs |
| `GET /api/dashboard/charts` | Bearer + RBAC | Gráficos |
| `GET /api/documents/recent` | Bearer | Documentos recentes |
| `POST /internal/events/chat-completed` | X-API-Key | Persistência n8n |

## Integração n8n

Veja [docs/n8n-workflow-integration.md](../docs/n8n-workflow-integration.md).

## Retenção LGPD

Veja [docs/LGPD_RETENTION.md](docs/LGPD_RETENTION.md) e execute `npm run retention:run` via cron.
