#!/usr/bin/env python3
"""Static server for the synthetic preview. Python standard library only; binds to localhost."""
import http.server
import os
import sys

PORT = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8765))
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".html": "text/html; charset=utf-8",
        ".svg": "image/svg+xml",
        ".json": "application/json",
        ".png": "image/png",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError as exc:
        sys.exit(f"Cannot listen on 127.0.0.1:{PORT} ({exc}). Pick another port: ./start.sh 8766")
    print(f"Synthetic preview: http://127.0.0.1:{PORT}/   (Ctrl+C to stop)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
