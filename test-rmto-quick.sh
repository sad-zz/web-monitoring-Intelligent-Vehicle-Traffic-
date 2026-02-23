#!/bin/bash

# RMTO Quick Test Script
# This script can be run from anywhere and will find the correct directory

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  RMTO Quick Test Utility${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Find the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"

echo -e "${YELLOW}Project directory:${NC} $SCRIPT_DIR"
echo -e "${YELLOW}Server directory:${NC} $SERVER_DIR"
echo ""

# Check if server directory exists
if [ ! -d "$SERVER_DIR" ]; then
    echo -e "${RED}Error: server/ directory not found!${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Check if test-rmto.js exists
if [ ! -f "$SERVER_DIR/test-rmto.js" ]; then
    echo -e "${RED}Error: test-rmto.js not found in server/ directory!${NC}"
    exit 1
fi

# Check if .env.example exists
if [ ! -f "$SERVER_DIR/.env.example" ]; then
    echo -e "${YELLOW}Warning: .env.example not found${NC}"
fi

# Check if .env exists, if not, help create it
if [ ! -f "$SERVER_DIR/.env" ]; then
    echo -e "${YELLOW}Notice: .env file not found${NC}"
    echo ""
    read -p "Do you want to create .env file now? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f "$SERVER_DIR/.env.example" ]; then
            cp "$SERVER_DIR/.env.example" "$SERVER_DIR/.env"
            echo -e "${GREEN}Created .env file from .env.example${NC}"
        else
            # Create a basic .env file
            cat > "$SERVER_DIR/.env" << 'EOF'
# RMTO (OTF) SOAP Web Service
RMTO_WSDL=http://otf.rmto.ir/Companies/Companies.asmx?WSDL
RMTO_ENDPOINT=http://otf.rmto.ir/Companies/Companies.asmx
RMTO_COMPANY_CODE=58
RMTO_USERNAME=NOGSH
RMTO_PASSWORD=CHANGE_ME_HERE

# Data send interval (minutes)
SEND_INTERVAL_MINUTES=15
EOF
            echo -e "${GREEN}Created new .env file${NC}"
        fi
        
        echo ""
        echo -e "${YELLOW}Please edit $SERVER_DIR/.env and set your RMTO credentials:${NC}"
        echo "  - RMTO_USERNAME"
        echo "  - RMTO_PASSWORD"
        echo ""
        read -p "Press Enter to continue or Ctrl+C to exit and edit .env first..."
    else
        echo ""
        echo -e "${RED}Cannot proceed without .env file${NC}"
        echo -e "Please create ${YELLOW}$SERVER_DIR/.env${NC} with your RMTO credentials"
        echo ""
        echo "Example:"
        echo "  cd $SERVER_DIR"
        echo "  cp .env.example .env"
        echo "  nano .env"
        exit 1
    fi
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed!${NC}"
    echo "Please install Node.js first: https://nodejs.org/"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "$SERVER_DIR/node_modules" ]; then
    echo -e "${YELLOW}Notice: node_modules not found${NC}"
    echo "Installing dependencies..."
    cd "$SERVER_DIR"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install dependencies${NC}"
        exit 1
    fi
    echo -e "${GREEN}Dependencies installed successfully${NC}"
    echo ""
fi

# Run the test
echo -e "${GREEN}Running RMTO connection test...${NC}"
echo ""
cd "$SERVER_DIR"
node test-rmto.js

# Capture exit code
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Test completed successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  Test failed with errors${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo "1. Check your credentials in: $SERVER_DIR/.env"
    echo "2. Verify internet connection to otf.rmto.ir"
    echo "3. Review the error messages above"
    echo "4. See documentation: $SCRIPT_DIR/server/RMTO_GUIDE.md"
fi

exit $EXIT_CODE
