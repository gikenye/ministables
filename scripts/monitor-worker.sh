#!/bin/bash

# Worker Monitoring Script
# Run this to get a comprehensive view of the worker status

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

clear

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Disbursement Worker - Live Monitor        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Check if PM2 is running
if ! pm2 list | grep -q "disbursement-worker"; then
    echo -e "${YELLOW}⚠️  Worker is not running!${NC}"
    echo ""
    echo "Start the worker with:"
    echo "  npm run worker:deploy"
    exit 1
fi

# Worker Status
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📊 PM2 Worker Status${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
pm2 status disbursement-worker
echo ""

# Queue Status
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📋 Queue Status${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
node scripts/queue-cli.js status
echo ""

# Recent Jobs
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📝 Recent Jobs (Last 5)${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
node scripts/queue-cli.js list | head -n 50
echo ""

# Worker Health via API
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🏥 Worker Health Check (API)${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if command -v curl &> /dev/null; then
    curl -s http://localhost:3000/api/disbursement/worker/health | python3 -m json.tool 2>/dev/null || echo "Next.js server not running"
else
    echo "curl not available"
fi
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📝 Commands:${NC}"
echo -e "  ${GREEN}pnpm run worker:logs${NC}      - View live logs"
echo -e "  ${GREEN}pnpm run worker:restart${NC}   - Restart worker"
echo -e "  ${GREEN}pnpm run queue:status${NC}     - Check queue"
echo -e "  ${GREEN}pm2 monit${NC}                 - Real-time monitoring"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
