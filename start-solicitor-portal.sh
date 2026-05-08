#!/bin/bash

# CMS Frontend - Start Solicitor Portal
# Starts the solicitor-portal Next.js app on port 3002

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  CMS - Starting Solicitor Portal Frontend     ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check BFF Solicitor is up
check_port() {
    lsof -ti:$1 > /dev/null 2>&1
}

if ! check_port 8089; then
    echo -e "${RED}✗ BFF Solicitor (port 8089) is not running.${NC}"
    echo -e "${YELLOW}  Start backend first:${NC}"
    echo -e "  cd cms-backend && ./start-solicitor-services.sh"
    echo ""
    read -p "Start frontend anyway? (y/N): " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
fi

echo -e "${YELLOW}Installing dependencies if needed...${NC}"
npm install --silent 2>/dev/null || true
echo ""

echo -e "${YELLOW}Starting Solicitor Portal on http://localhost:3002 ...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop.${NC}"
echo ""

npm run dev:solicitor
