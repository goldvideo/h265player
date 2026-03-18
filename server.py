#!/usr/bin/env python3
"""
Simple HTTP server with proper WASM MIME type support
Run: python3 server.py
Access: http://127.0.0.1:8000
"""

import http.server
import socketserver
import os

PORT = 8000

class WasmHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Set proper MIME type for .wasm files
        if self.path.endswith('.wasm'):
            self.send_header('Content-Type', 'application/wasm')
        super().end_headers()

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with socketserver.TCPServer(("", PORT), WasmHandler) as httpd:
        print(f"Server running at http://127.0.0.1:{PORT}")
        print(f"Serving from: {os.getcwd()}")
        print("Press Ctrl+C to stop")
        httpd.serve_forever()
