#!/bin/bash
# ============================================================
#  חשבונית׳ו — Heshbonito Local Launcher
#  Starts PostgreSQL, backend, frontend, and opens the browser.
#  Press Ctrl+C to stop everything.
# ============================================================

set -e

# --- Config -------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
BACKEND_PORT=3000
FRONTEND_PORT=5173
PG_BIN="/opt/homebrew/opt/postgresql@17/bin"
# ------------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null && echo -e "  ${RED}Backend stopped${NC}"
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null && echo -e "  ${RED}Frontend stopped${NC}"
    wait 2>/dev/null
    echo -e "${GREEN}Done. Bye!${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════╗"
echo "  ║        חשבונית׳ו                 ║"
echo "  ║        Heshbonito                ║"
echo "  ╚══════════════════════════════════╝"
echo -e "${NC}"

# --- 1. Check PostgreSQL ------------------------------------
echo -e "${CYAN}[1/4]${NC} Checking PostgreSQL..."
if "$PG_BIN/pg_isready" -q 2>/dev/null; then
    echo -e "  ${GREEN}PostgreSQL is running${NC}"
else
    echo -e "  ${YELLOW}Starting PostgreSQL...${NC}"
    brew services start postgresql@17
    sleep 2
    if "$PG_BIN/pg_isready" -q 2>/dev/null; then
        echo -e "  ${GREEN}PostgreSQL started${NC}"
    else
        echo -e "  ${RED}Failed to start PostgreSQL. Is it installed?${NC}"
        exit 1
    fi
fi

# --- 2. Install deps if needed -----------------------------
echo -e "${CYAN}[2/4]${NC} Checking dependencies..."
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    echo -e "  ${YELLOW}Installing backend dependencies...${NC}"
    (cd "$BACKEND_DIR" && npm install)
else
    echo -e "  ${GREEN}Backend deps OK${NC}"
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "  ${YELLOW}Installing frontend dependencies...${NC}"
    (cd "$FRONTEND_DIR" && npm install)
else
    echo -e "  ${GREEN}Frontend deps OK${NC}"
fi

# --- 3. Run Prisma migrate ----------------------------------
echo -e "${CYAN}[3/4]${NC} Running database migrations..."
(cd "$BACKEND_DIR" && npx prisma migrate deploy 2>&1 | tail -1)
(cd "$BACKEND_DIR" && npx prisma generate 2>&1 | tail -1)
echo -e "  ${GREEN}Database ready${NC}"

# --- 4. Start servers ---------------------------------------
echo -e "${CYAN}[4/4]${NC} Starting servers..."

# Backend
(cd "$BACKEND_DIR" && npm run start:dev) &
BACKEND_PID=$!
echo -e "  ${GREEN}Backend starting (PID $BACKEND_PID)...${NC}"

# Frontend
(cd "$FRONTEND_DIR" && npm run dev) &
FRONTEND_PID=$!
echo -e "  ${GREEN}Frontend starting (PID $FRONTEND_PID)...${NC}"

# --- Wait for servers to be ready ---------------------------
echo -e "\n${YELLOW}Waiting for servers...${NC}"
for i in $(seq 1 30); do
    if curl -s -o /dev/null "http://localhost:$BACKEND_PORT" 2>/dev/null; then
        break
    fi
    sleep 1
done

sleep 2  # Give frontend a moment too

# --- Open browser -------------------------------------------
echo -e "\n${BOLD}${GREEN}============================================${NC}"
echo -e "${BOLD}${GREEN}  חשבונית׳ו is ready!${NC}"
echo -e "${BOLD}${GREEN}  http://localhost:${FRONTEND_PORT}${NC}"
echo -e "${BOLD}${GREEN}============================================${NC}"
echo -e "${YELLOW}  Press Ctrl+C to stop${NC}\n"

open "http://localhost:$FRONTEND_PORT"

# --- Keep running until Ctrl+C -----------------------------
wait
