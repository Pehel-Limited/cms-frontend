#!/bin/bash

# CMS Frontend - Stop All Portals

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Stopping all CMS frontend portals...${NC}"

for port in 3000 3001 3002; do
    pids=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo -e "  ${RED}✗ Stopping port $port (PID $pids)${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null || true
    else
        echo -e "  ${GREEN}✓ Port $port already free${NC}"
    fi
done

echo ""
echo -e "${GREEN}All frontends stopped.${NC}"
