#!/bin/bash

# Start the HTTP server with proper WASM MIME type support
echo "Starting HTTP server on http://127.0.0.1:8000"
echo "Press Ctrl+C to stop"

cd "$(dirname "$0")"
python3 server.py
