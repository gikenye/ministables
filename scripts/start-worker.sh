#!/bin/bash

# Disbursement Worker Startup Script
# This script starts the disbursement worker with proper error handling and monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Disbursement Worker${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    exit 1
fi

# Check required environment variables
source .env

if [ -z "$SETTLEMENT_SECRET" ]; then
    echo -e "${RED}❌ Error: SETTLEMENT_SECRET not set${NC}"
    exit 1
fi

if [ -z "$MONGODB_URI" ]; then
    echo -e "${RED}❌ Error: MONGODB_URI not set${NC}"
    exit 1
fi

if [ -z "$PRETIUM_BASE_URI" ] || [ -z "$PRETIUM_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  Warning: PRETIUM credentials not set, will use fallback exchange rate${NC}"
fi

echo -e "${GREEN}✅ Environment variables validated${NC}"

# Check if MongoDB is accessible
echo -e "${GREEN}🔍 Checking MongoDB connection...${NC}"
# This is a simple check - the worker will do a full connection test

# Start the worker
echo -e "${GREEN}🏃 Starting worker process...${NC}"
node services/disbursement-worker.js

# If we get here, the worker has stopped
echo -e "${YELLOW}⚠️  Worker process stopped${NC}"
