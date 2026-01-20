#!/bin/bash

# Ensure virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install documentation dependencies
echo "Installing documentation dependencies..."
pip install -r docs/requirements.txt

# Start local server
echo "Starting local documentation server..."
echo "Open http://127.0.0.1:8000 in your browser"
export PATH="$HOME/.local/bin:$PATH"
zensical serve
