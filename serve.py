# -*- coding: utf-8 -*-
"""
DI Marketing AI - Local Development Server
di-marketing-ai.html を http://localhost:5678 で配信する。

Usage:
    python serve.py
    -> Open http://localhost:5678/di-marketing-ai.html in browser
"""
import http.server
import socketserver
import os
import sys
import io

# Windows cp932 環境でも日本語を出力できるよう UTF-8 に強制
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PORT = 5678
DIR  = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def log_message(self, format, *args):
        print(f"  {args[0]} {args[1]}")

os.chdir(DIR)

print()
print("  ================================================")
print("  DI Marketing AI - Local Server")
print(f"  http://localhost:{PORT}/di-marketing-ai.html")
print("  Ctrl+C to stop")
print("  ================================================")
print()

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
        sys.exit(0)
