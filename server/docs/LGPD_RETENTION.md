# Política de retenção LGPD — audit_logs

## Princípios

- A tabela `audit_logs` é **append-only** na camada de aplicação: inserts via API interna e registro de acesso a documentos; não há endpoints de UPDATE/DELETE expostos.
- Em produção, revogue permissões de UPDATE/DELETE no papel do banco usado pela API:

```sql
REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
GRANT SELECT, INSERT ON audit_logs TO app_user;
```

## Retenção

- Padrão: **730 dias** (2 anos), configurável via `AUDIT_RETENTION_DAYS`.
- Job agendado: `npm run retention:run` (executar via cron diário).

Exemplo cron:

```cron
0 3 * * * cd /path/to/server && npm run retention:run >> /var/log/onedrive-rh-retention.log 2>&1
```

## Dados armazenados

| Campo | Finalidade | Sensibilidade |
|-------|-----------|---------------|
| userId, userName, userEmail | Identificação do titular | Pessoal |
| query | Texto da consulta | Pode conter dados sensíveis — revisar periodicamente |
| documentAccessed, documentPath | Rastreabilidade de acesso | Metadado |
| ipAddress, userAgent | Segurança | Pessoal |
| metadata (JSONB) | Contexto técnico | Evitar PII desnecessária |

## Exportação

- Exportação CSV permanece no frontend ([`AuditPage.tsx`](../src/pages/AuditPage.tsx)), consumindo a API de dados.
- Apenas perfis com `canViewAuditLog` (RH, diretoria, admin) acessam `/api/audit`.

## Purge

- O job `retention.ts` remove registros com `created_at <= now() - AUDIT_RETENTION_DAYS`.
- Conversas e mensagens **não** são purgadas automaticamente na fase 1; definir política separada se necessário.

## Backup

- Recomenda-se backup diário do PostgreSQL com criptografia em repouso, conforme política corporativa de LGPD.
