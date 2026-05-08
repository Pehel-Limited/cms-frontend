#!/bin/bash

# CMS Frontend - Start All Portals
# Starts all three Next.js apps in parallel:
#   bank-ops       → http://localhost:3000  (BFF-Admin 8081)
#   cust-portal    → http://localhost:3001  (BFF-Customer 8087)
#   solicitor-portal → http://localhost:3002 (BFF-Solicitor 8089)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}     CMS - Starting All Frontend Portals       ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

check_port() {
    lsof -ti:$1 > /dev/null 2>&1
}

# Backend dependency checks
echo -e "${CYAN}Checking backend services...${NC}"
MISSING_BACKENDS=()

if ! check_port 8081; then MISSING_BACKENDS+=("BFF-Admin (8081) — required by bank-ops"); fi
if ! check_port 8082; then MISSING_BACKENDS+=("Identity Service (8082) — required by all portals"); fi
if ! check_port 8087; then MISSING_BACKENDS+=("BFF-Customer (8087) — required by cust-portal"); fi
if ! check_port 8089; then MISSING_BACKENDS+=("BFF-Solicitor (8089) — required by solicitor-portal"); fi

if [ ${#MISSING_BACKENDS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠ Some backend services are not running:${NC}"
    for svc in "${MISSING_BACKENDS[@]}"; do
        echo -e "  ${RED}✗ $svc${NC}"
    done
    echo ""
    echo -e "${YELLOW}Start backend first:${NC}  cd cms-backend && ./start-all-services.sh"
    echo ""
    read -p "Start frontends anyway? (y/N): " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
    echo ""
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies if needed...${NC}"
npm install --silent 2>/dev/null || true
echo ""

# Kill anything already on those ports
for port in 3000 3001 3002; do
    if check_port $port; then
        echo -e "${YELLOW}Stopping existing process on port $port...${NC}"
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
done

LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

echo -e "${GREEN}Starting all portals...${NC}"
echo ""

# Start bank-ops (port 3000)
echo -e "  ${GREEN}▶ Bank/Credit Portal${NC}   → http://localhost:3000"
npm run dev:bank > "$LOG_DIR/bank-ops.log" 2>&1 &
BANK_PID=$!

# Start cust-portal (port 3001)
echo -e "  ${GREEN}▶ Customer Portal${NC}      → http://localhost:3001"
npm run dev:cust > "$LOG_DIR/cust-portal.log" 2>&1 &
CUST_PID=$!

# Start solicitor-portal (port 3002)
echo -e "  ${GREEN}▶ Solicitor Portal${NC}     → http://localhost:3002"
npm run dev:solicitor > "$LOG_DIR/solicitor-portal.log" 2>&1 &
SOL_PID=$!

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  All portals starting in background           ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "  PIDs: bank-ops=$BANK_PID  cust-portal=$CUST_PID  solicitor-portal=$SOL_PID"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo -e "  tail -f $LOG_DIR/bank-ops.log"
echo -e "  tail -f $LOG_DIR/cust-portal.log"
echo -e "  tail -f $LOG_DIR/solicitor-portal.log"
echo ""
echo -e "${YELLOW}To stop all frontends:${NC}  ./stop-all-frontends.sh"
echo ""

# Wait a few seconds and show startup status
echo -e "${CYAN}Waiting for portals to start (up to 30s)...${NC}"
for i in $(seq 1 6); do
    sleep 5
    READY=()
    NOT_READY=()
    check_port 3000 && READY+=("bank-ops :3000") || NOT_READY+=("bank-ops :3000")
    check_port 3001 && READY+=("cust-portal :3001") || NOT_READY+=("cust-portal :3001")
    check_port 3002 && READY+=("solicitor-portal :3002") || NOT_READY+=("solicitor-portal :3002")

    if [ ${#NOT_READY[@]} -eq 0 ]; then
        break
    fi
done

echo ""
echo -e "${GREEN}Ready:${NC}"
check_port 3000 && echo -e "  ${GREEN}✓ Bank/Credit Portal${NC}   http://localhost:3000" || echo -e "  ${RED}✗ Bank/Credit Portal${NC}   (still starting — check logs/bank-ops.log)"
check_port 3001 && echo -e "  ${GREEN}✓ Customer Portal${NC}      http://localhost:3001" || echo -e "  ${RED}✗ Customer Portal${NC}      (still starting — check logs/cust-portal.log)"
check_port 3002 && echo -e "  ${GREEN}✓ Solicitor Portal${NC}     http://localhost:3002" || echo -e "  ${RED}✗ Solicitor Portal${NC}     (still starting — check logs/solicitor-portal.log)"
echo ""
