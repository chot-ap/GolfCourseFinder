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
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', write_through=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace', write_through=True)

DEFAULT_PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class GolfCourseHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        
        # 楽天GORA API プロキシエンドポイント (2026年 OpenAPI 仕様)
        if parsed_url.path == '/api/plan-search':
            self.proxy_rakuten_api('https://openapi.rakuten.co.jp/engine/api/Gora/GoraPlanSearch/20170623', parsed_url.query)
            return
        elif parsed_url.path == '/api/course-detail':
            self.proxy_rakuten_api('https://openapi.rakuten.co.jp/engine/api/Gora/GoraGolfCourseDetail/20170623', parsed_url.query)
            return
        elif parsed_url.path == '/api/health':
            self.send_json_response(200, {"status": "ok", "app": "GolfCourseFinder"})
            return

        # 静的ファイルの配信
        super().do_GET()

    def proxy_rakuten_api(self, target_base_url, query_string):
        parsed_params = urllib.parse.parse_qs(query_string)

        # クライアントから指定されたカスタムReferer（またはデフォルト）
        custom_referer = parsed_params.get('customReferer', [None])[0] or self.headers.get('X-Rakuten-App-Url')
        if not custom_referer or 'localhost' in custom_referer:
            # 楽天管理画面でlocalhostが登録できないため、登録されたURLまたは公開ドメイン形式にフォールバック
            custom_referer = custom_referer or 'https://example.com/'

        # 楽天API宛のリクエストURLから内部パラメータ（customReferer）を除外
        rakuten_params = {k: v for k, v in parsed_params.items() if k != 'customReferer'}
        clean_query = urllib.parse.urlencode(rakuten_params, doseq=True)
        target_url = f"{target_base_url}?{clean_query}"

        print("\n" + "="*60)
        print(f"📡 [API Proxy] 楽天GORA OpenAPIリクエスト転送")
        print(f"   エンドポイント: {target_base_url}")
        print(f"   送信Referer: {custom_referer}")
        print(f"   クエリパラメータ:")
        for k, v in rakuten_params.items():
            val_display = v[0] if len(v) == 1 else str(v)
            if (k in ['applicationId', 'accessKey']) and len(val_display) > 8:
                val_display = val_display[:4] + '...' + val_display[-4:]
            print(f"     • {k}: {val_display}")
        print("="*60 + "\n", flush=True)

        req_headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 GolfCourseFinder/1.0',
            'Referer': custom_referer,
            'Origin': custom_referer.rstrip('/')
        }

        try:
            req = urllib.request.Request(
                target_url,
                headers=req_headers
            )
            with urllib.request.urlopen(req, timeout=12) as response:
                content = response.read()
                print(f"✅ [API Proxy] レスポンス成功 (Status: {response.status}, Size: {len(content)} bytes)\n", flush=True)
                self.send_response(response.status)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content)
        except urllib.error.HTTPError as e:
            err_content = e.read()
            print(f"❌ [API Proxy] 楽天OpenAPIエラー (Status: {e.code}): {err_content.decode('utf-8', errors='ignore')}\n", flush=True)
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(err_content)
        except Exception as e:
            print(f"❌ [API Proxy] 通信エラー: {str(e)}\n", flush=True)
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
