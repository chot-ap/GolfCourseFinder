#!/usr/bin/env python3
"""
GolfCourseFinder - Local Server & Rakuten GORA API Proxy
標準ライブラリのみで動作するローカルWebサーバー兼CORSプロキシ
"""

import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import os
import sys

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

DEFAULT_PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class GolfCourseHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        
        # 楽天GORA API プロキシエンドポイント
        if parsed_url.path == '/api/plan-search':
            self.proxy_rakuten_api('https://app.rakuten.co.jp/services/api/Gora/GoraPlanSearch/20170623', parsed_url.query)
            return
        elif parsed_url.path == '/api/course-detail':
            self.proxy_rakuten_api('https://app.rakuten.co.jp/services/api/Gora/GoraGolfCourseDetail/20170623', parsed_url.query)
            return
        elif parsed_url.path == '/api/health':
            self.send_json_response(200, {"status": "ok", "app": "GolfCourseFinder"})
            return

        # 静的ファイルの配信
        super().do_GET()

    def proxy_rakuten_api(self, target_base_url, query_string):
        target_url = f"{target_base_url}?{query_string}"
        try:
            req = urllib.request.Request(
                target_url,
                headers={'User-Agent': 'GolfCourseFinder/1.0'}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                content = response.read()
                self.send_response(response.status)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content)
        except urllib.error.HTTPError as e:
            err_content = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(err_content)
        except Exception as e:
            self.send_json_response(500, {"error": str(e)})

    def send_json_response(self, status_code, data):
        content = json.dumps(data).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, format, *args):
        # コンソールログを簡潔に出力
        sys.stderr.write(f"[{self.log_date_time_string()}] {args[0]} {args[1]} {args[2]}\n")

def run_server(port=DEFAULT_PORT):
    for p in [port, 8080, 3000, 5000, 8888]:
        try:
            with http.server.ThreadingHTTPServer(("", p), GolfCourseHandler) as httpd:
                print(f"==================================================")
                print(f"[GolfCourseFinder] サーバーが起動しました")
                print(f"[GolfCourseFinder] URL: http://localhost:{p}")
                print(f"==================================================")
                httpd.serve_forever()
                break
        except OSError:
            continue

if __name__ == '__main__':
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run_server(port)
