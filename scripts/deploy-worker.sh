#!/bin/bash

# Production Deployment Script for Disbursement Worker
# This script sets up and starts the worker with PM2

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Disbursement Worker - Production Deployment  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 not found. Installing PM2...${NC}"
    pnpm add -g pm2
    echo -e "${GREEN}✅ PM2 installed${NC}"
else
    echo -e "${GREEN}✅ PM2 is already installed${NC}"
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo -e "${YELLOW}Please create a .env file with required variables${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment file found${NC}"

# Load and validate environment variables
source .env

# Validate required environment variables
MISSING_VARS=()

if [ -z "$SETTLEMENT_SECRET" ]; then
    MISSING_VARS+=("SETTLEMENT_SECRET")
fi

if [ -z "$MONGODB_URI" ]; then
    MISSING_VARS+=("MONGODB_URI")
fi

if [ -z "$PRETIUM_BASE_URI" ]; then
    MISSING_VARS+=("PRETIUM_BASE_URI")
fi

if [ -z "$PRETIUM_API_KEY" ]; then
    MISSING_VARS+=("PRETIUM_API_KEY")
fi

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo -e "${RED}   - $var${NC}"
    done
    exit 1
fi

echo -e "${GREEN}✅ All required environment variables are set${NC}"

# Create logs directory if it doesn't exist
mkdir -p logs
echo -e "${GREEN}✅ Logs directory ready${NC}"

# Check if worker is already running
if pm2 list | grep -q "disbursement-worker"; then
    echo -e "${YELLOW}⚠️  Worker is already running. Restarting...${NC}"
    pm2 restart disbursement-worker
else
    echo -e "${BLUE}🚀 Starting worker for the first time...${NC}"
    pm2 start ecosystem.config.json
fi

# Save PM2 process list
pm2 save

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${BLUE}📊 Worker Status:${NC}"
pm2 status

echo ""
echo -e "${BLUE}📝 Useful Commands:${NC}"
echo -e "  ${GREEN}pm2 status${NC}                     - Check worker status"
echo -e "  ${GREEN}pm2 logs disbursement-worker${NC}   - View live logs"
echo -e "  ${GREEN}pm2 restart disbursement-worker${NC} - Restart worker"
echo -e "  ${GREEN}pm2 stop disbursement-worker${NC}    - Stop worker"
echo -e "  ${GREEN}pm2 monit${NC}                      - Monitor in real-time"
echo -e "  ${GREEN}pnpm run queue:status${NC}          - Check queue status"
echo ""
echo -e "${BLUE}🔧 Setup auto-start on reboot:${NC}"
echo -e "  ${GREEN}pm2 startup${NC}                    - Get startup command"
echo -e "  Run the command it gives you"
echo -e "  ${GREEN}pm2 save${NC}                       - Save process list"
echo ""
echo -e "${GREEN}🎉 Worker is now running in production mode!${NC}"
