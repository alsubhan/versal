#!/bin/bash

# Versal API Server and Log Monitor Startup Script
# This script starts both the API server and the web-based log monitor

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_PORT=8000
MONITOR_PORT=5000
LOG_FILE="logs/server.log"

echo -e "${BLUE}🚀 Versal API Server & Log Monitor${NC}"
echo "=================================="

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${RED}❌ Virtual environment not found. Please run: python3 -m venv venv${NC}"
    exit 1
fi

# Activate virtual environment
echo -e "${YELLOW}📦 Activating virtual environment...${NC}"
source venv/bin/activate

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if log file exists, create if not
if [ ! -f "$LOG_FILE" ]; then
    echo -e "${YELLOW}📝 Creating log file: $LOG_FILE${NC}"
    touch "$LOG_FILE"
fi

# Function to cleanup background processes
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down...${NC}"
    if [ ! -z "$API_PID" ]; then
        kill $API_PID 2>/dev/null || true
    fi
    if [ ! -z "$MONITOR_PID" ]; then
        kill $MONITOR_PID 2>/dev/null || true
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start the API server in background
echo -e "${GREEN}🔧 Starting API server on port $API_PORT...${NC}"
export DEBUG=true
uvicorn main:app --reload --port $API_PORT 2>&1 | tee "$LOG_FILE" &
API_PID=$!

# Wait a moment for the server to start
sleep 2

# Check if API server started successfully
if ! kill -0 $API_PID 2>/dev/null; then
    echo -e "${RED}❌ Failed to start API server${NC}"
    exit 1
fi

echo -e "${GREEN}✅ API server started (PID: $API_PID)${NC}"

# Start the log monitor in background
echo -e "${GREEN}🔍 Starting log monitor on port $MONITOR_PORT...${NC}"
python3 log_monitor.py --port $MONITOR_PORT --log-file "$LOG_FILE" &
MONITOR_PID=$!

# Wait a moment for the monitor to start
sleep 2

# Check if monitor started successfully
if ! kill -0 $MONITOR_PID 2>/dev/null; then
    echo -e "${RED}❌ Failed to start log monitor${NC}"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}✅ Log monitor started (PID: $MONITOR_PID)${NC}"

echo ""
echo -e "${BLUE}🎉 Both services are running!${NC}"
echo "=================================="
echo -e "${GREEN}🌐 API Server:${NC} http://localhost:$API_PORT"
echo -e "${GREEN}🔍 Log Monitor:${NC} http://localhost:$MONITOR_PORT"
echo -e "${GREEN}📁 Log File:${NC} $LOG_FILE"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "• Open http://localhost:$MONITOR_PORT in your browser to view logs"
echo "• The log monitor will auto-start monitoring when you open it"
echo "• Press Ctrl+C to stop both services"
echo "• Logs are being written to: $LOG_FILE"
echo ""

# Wait for user to stop
echo -e "${YELLOW}⏳ Press Ctrl+C to stop all services...${NC}"
wait 