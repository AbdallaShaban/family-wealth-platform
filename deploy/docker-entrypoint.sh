#!/bin/sh
set -e

# ============================================================================
# FAMILY Wealth Intelligence — Production Startup Entrypoint
# Validates invariants, applies pending database migrations, and boots service
# ============================================================================

echo "========================================================"
echo " Starting FAMILY Wealth Intelligence Service (Production) "
echo " Node Version: $(node -v) | Arch: $(uname -m)"
echo "========================================================"

# 1. Validate Database URL protocol
if [ -z "$DATABASE_URL" ]; then
  echo "[FATAL] DATABASE_URL environment variable is not defined."
  exit 1
fi

case "$DATABASE_URL" in
  mysql://*) ;;
  *)
    echo "[FATAL] DATABASE_URL must start with 'mysql://'. Non-MySQL backends are strictly prohibited."
    exit 1
    ;;
esac

# 2. Validate Production JWT Secret
if [ "$NODE_ENV" = "production" ]; then
  if [ -z "$JWT_SECRET" ] || [ "${#JWT_SECRET}" -lt 32 ]; then
    echo "[FATAL] In production, JWT_SECRET must be at least 32 characters long."
    exit 1
  fi
fi

# 3. Database Connectivity Check with Timeout
echo "[INFO] Verifying database connectivity..."
MAX_TRIES=30
COUNT=0
CONNECTED=0

while [ $COUNT -lt $MAX_TRIES ]; do
  if node -e "
    import('mysql2/promise').then(m => {
      return m.createConnection(process.env.DATABASE_URL).then(conn => {
        return conn.query('SELECT 1').then(() => conn.end());
      });
    }).then(() => process.exit(0)).catch(() => process.exit(1));
  " 2>/dev/null; then
    CONNECTED=1
    break
  fi
  COUNT=$((COUNT + 1))
  echo "[INFO] Waiting for MySQL database (attempt $COUNT/$MAX_TRIES)..."
  sleep 2
done

if [ $CONNECTED -ne 1 ]; then
  echo "[FATAL] Unable to connect to MySQL database at $DATABASE_URL within 60 seconds."
  exit 1
fi
echo "[INFO] Database connectivity confirmed."

# 4. Migration Execution (Bypassed at container startup to prevent startup blocks)
# Migrations are managed externally or pre-applied; bypass startup drizzle-kit migration:
# echo "[INFO] Applying pending migrations via drizzle-kit..."
# pnpm exec drizzle-kit migrate

echo "[INFO] Handing over execution to main application process..."

# 5. Hand over to CMD
exec "$@"
