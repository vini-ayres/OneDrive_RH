# Setup PostgreSQL — usuário dedicado OneDrive RH

## Por que `postgres` falha via TCP?

No seu servidor, o `pg_hba.conf` está assim:

- **`local`** (socket Unix): autenticação **`peer`** — só funciona entrando como usuário OS `postgres` (`sudo -u postgres psql`)
- **`host 127.0.0.1`**: autenticação **`scram-sha-256`** — exige senha definida corretamente com `ALTER USER`

Se a senha do `postgres` foi alterada de forma inconsistente, conexões TCP com `postgresql://postgres:...@localhost` falham.

**Solução:** usuário dedicado `onedrive_rh_app` só para esta aplicação.

## Passo a passo (como root)

No terminal onde você já está como `root`:

```bash
cd /home/service_rh/OneDrive_RH/server
bash scripts/setup-db-user.sh
```

Ou defina a senha manualmente (somente letras/números recomendado):

```bash
bash scripts/setup-db-user.sh 'MinhaSenhaForte2026'
```

O script agora **valida a conexão TCP antes de gravar o `.env`**. Se falhar, nada é salvo.

Credenciais são gravadas como `DB_USER`, `DB_PASSWORD` e `DATABASE_URL` (com encoding correto).

## Depois do setup

```bash
cd /home/service_rh/OneDrive_RH/server
npm run db:migrate
npm run dev
```

## Testar conexão

Substitua `****` pela senha definida:

```bash
psql "postgresql://onedrive_rh_app:****@localhost:5432/onedrive_rh" -c "SELECT current_user, current_database();"
```

## Porta correta

Neste servidor o PostgreSQL 16 escuta na porta **5433** (`postgresql.conf`), não 5432.
A porta 5432 pode ser outro serviço (ex.: Docker). O script detecta a porta automaticamente.

```bash
sudo -u postgres psql -c "ALTER ROLE onedrive_rh_app WITH PASSWORD 'nova_senha';"
```

Atualize também `DATABASE_URL` em `server/.env`.
