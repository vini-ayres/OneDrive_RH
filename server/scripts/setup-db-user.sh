#!/usr/bin/env bash
# Cria usuário e banco dedicados para a API OneDrive RH.
# Uso: bash scripts/setup-db-user.sh [senha_opcional]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"

PG_APP_USER="${PG_APP_USER:-onedrive_rh_app}"
PG_DB="${PG_DB:-onedrive_rh}"

# Detecta porta real do PostgreSQL local (neste servidor: 5433, não 5432)
detect_pg_port() {
  if [[ -n "${PG_PORT:-}" ]]; then
    echo "${PG_PORT}"
    return
  fi
  local conf
  for conf in /etc/postgresql/*/main/postgresql.conf; do
    if [[ -f "$conf" ]]; then
      local p
      p="$(grep -E '^port\s*=' "$conf" | head -1 | awk '{print $3}')"
      if [[ -n "$p" ]]; then
        echo "$p"
        return
      fi
    fi
  done
  echo "5432"
}
PG_PORT="$(detect_pg_port)"

# Senha só com hex — evita problemas em URL, sed e SQL
if [[ -n "${1:-}" ]]; then
  PG_APP_PASS="$1"
else
  PG_APP_PASS="$(openssl rand -hex 16)"
fi

# Escapa aspas simples para SQL
sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}
PG_APP_PASS_SQL="$(sql_escape "${PG_APP_PASS}")"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Execute como root: sudo bash scripts/setup-db-user.sh"
  exit 1
fi

echo "Criando usuário PostgreSQL: ${PG_APP_USER}"
echo "Banco: ${PG_DB}"
echo "Porta: ${PG_PORT}"

# Cria role se não existir
ROLE_EXISTS="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${PG_APP_USER}'")"
if [[ "${ROLE_EXISTS}" != "1" ]]; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
    "CREATE ROLE ${PG_APP_USER} LOGIN PASSWORD '${PG_APP_PASS_SQL}';"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
    "ALTER ROLE ${PG_APP_USER} WITH LOGIN PASSWORD '${PG_APP_PASS_SQL}';"
fi

# Cria banco se não existir
DB_EXISTS="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'")"
if [[ "${DB_EXISTS}" != "1" ]]; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
    "CREATE DATABASE ${PG_DB} OWNER ${PG_APP_USER};"
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
  "GRANT ALL PRIVILEGES ON DATABASE ${PG_DB} TO ${PG_APP_USER};"

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${PG_DB}" <<EOF
GRANT ALL ON SCHEMA public TO ${PG_APP_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${PG_APP_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${PG_APP_USER};
EOF

# Valida autenticação TCP antes de gravar .env
echo "Validando autenticação..."
export PGPASSWORD="${PG_APP_PASS}"
if ! psql -h 127.0.0.1 -p "${PG_PORT}" -U "${PG_APP_USER}" -d "${PG_DB}" -c "SELECT 1" >/dev/null 2>&1; then
  echo "ERRO: autenticação falhou na porta ${PG_PORT}."
  echo "Verifique pg_hba.conf (host 127.0.0.1 deve usar scram-sha-256 ou md5)."
  echo "Dica: neste servidor o PostgreSQL 16 usa porta ${PG_PORT}, não 5432."
  unset PGPASSWORD
  exit 1
fi
unset PGPASSWORD

cd "${SERVER_DIR}"
DB_PORT="${PG_PORT}" npx tsx scripts/write-db-env.ts "${PG_APP_USER}" "${PG_APP_PASS}" "${PG_DB}"

echo ""
echo "Setup concluído com sucesso."
echo "Usuário: ${PG_APP_USER}"
echo "Banco:   ${PG_DB}"
echo ""
echo "Próximo passo:"
echo "  cd ${SERVER_DIR} && npm run db:migrate"
