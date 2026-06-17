#!/usr/bin/env python3
"""NVG PoC — HTTPS server with HTTP-based remote control.

Phone opens   https://<ip>:8443/        → runs tests, POSTs updates
Admin opens   https://<ip>:8443/admin   → polls for updates, sends commands
Student opens https://<ip>:8443/student → read-only live view of the session
No WebSocket needed — everything on one port!
"""
import json, ssl, os, pathlib, datetime, threading
from http.server import HTTPServer, SimpleHTTPRequestHandler

APP_DIR = pathlib.Path(__file__).parent
CERT = APP_DIR / "cert.pem"
KEY = APP_DIR / "key.pem"

# Shared state (thread-safe via GIL for simple reads/writes)
state = {
    "phone_connected": False,
    "phone_last_seen": None,
    "running": False,
    "stage": "",
    "progress": 0,
    "logs": [],
    "results": None,
    "last_update": None,
    "pending_cmd": None,  # 'start' or 'stop' — phone polls this
    "pending_stages": "",  # comma-separated stage numbers
    "default_lang": "ru",
    "pattern": None,
    "stage_results": {}
}

SECTION_TITLES = {
    "1_neural_networks": {
        "ru": "Нейронные сети и Трансформеры",
        "en": "Neural Networks & Transformers"
    },
    "2_wave_physics": {
        "ru": "Волновая физика и Основания",
        "en": "Wave Physics & Foundations"
    },
    "3_quantum": {
        "ru": "Квантовые вентили и Вычисления",
        "en": "Quantum Gates & Computing"
    },
    "4_algorithms": {
        "ru": "Математические алгоритмы",
        "en": "Mathematical Algorithms & Applications"
    }
}

lock = threading.Lock()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIR), **kwargs)

    def do_GET(self):
      try:
        from urllib.parse import urlparse
        parsed = urlparse(self.path)
        path = parsed.path
        if path == '/' or path == '/index.html':
            self._serve_file(APP_DIR / 'index.html')
        elif path == '/admin' or path == '/admin/':
            self._serve_file(APP_DIR / 'admin.html')
        elif path == '/student' or path == '/student/':
            self._serve_file(APP_DIR / 'student.html')
        elif path.startswith('/stages/') and path.endswith('.js'):
            self._serve_js_module(APP_DIR / path.lstrip('/'))
        elif path.startswith('/stages/') and path.endswith('.json'):
            self._serve_file(APP_DIR / path.lstrip('/'))
        elif path == '/api/stages':
            stages_dir = APP_DIR / "stages"
            sections = []
            import re
            
            # Dynamically discover all directories under stages/ excluding hidden ones
            if stages_dir.exists():
                category_dirs = sorted([
                    d.name for d in stages_dir.iterdir()
                    if d.is_dir() and not d.name.startswith('.') and not d.name.startswith('__')
                ])
            else:
                category_dirs = []

            for cat in category_dirs:
                cat_path = stages_dir / cat
                cat_stages = []
                
                # Try to load section titles from info.json inside the section folder
                info_file = cat_path / "info.json"
                section_title = None
                if info_file.exists():
                    try:
                        section_title = json.loads(info_file.read_text(encoding="utf-8"))
                    except:
                        pass
                
                if not section_title:
                    section_title = SECTION_TITLES.get(cat, {"ru": cat, "en": cat})

                js_files = sorted(cat_path.glob("stage*.js"), key=lambda p: int(re.search(r"\d+", p.name).group() or 0))
                for js_file in js_files:
                    m = re.search(r"stage(\d+)_(.+)\.js", js_file.name)
                    if not m:
                        continue
                    s_id = int(m.group(1))
                    s_token = m.group(2)
                    json_file = cat_path / f"stage{s_id}_{s_token}.json"
                    trans = {"ru": {"name": f"Stage {s_id}", "description": ""}, "en": {"name": f"Stage {s_id}", "description": ""}}
                    if json_file.exists():
                        try:
                            trans = json.loads(json_file.read_text(encoding="utf-8"))
                        except:
                            pass
                    cat_stages.append({
                        "id": s_id,
                        "token": s_token,
                        "name": {
                            "ru": trans.get("ru", {}).get("name", f"Этап {s_id}"),
                            "en": trans.get("en", {}).get("name", f"Stage {s_id}")
                        },
                        "description": {
                            "ru": trans.get("ru", {}).get("description", ""),
                            "en": trans.get("en", {}).get("description", "")
                        },
                        "description_all": {
                            "ru": trans.get("ru", {}).get("description_all", ""),
                            "en": trans.get("en", {}).get("description_all", "")
                        },
                        "mirrorless": trans.get("mirrorless", False),
                        "js_path": f"/stages/{cat}/{js_file.name}"
                    })
                sections.append({
                    "id": cat,
                    "name": section_title,
                    "stages": cat_stages
                })
            self._json_response({"sections": sections})
        elif path == '/api/set_lang':
            from urllib.parse import urlparse, parse_qs
            qs = parse_qs(urlparse(self.path).query)
            lang = qs.get('lang', ['ru'])[0]
            with lock:
                state["default_lang"] = lang
            self._json_response({"ok": True, "lang": lang})
            print(f"🌐 Default language set to: {lang.upper()}")
        elif self.path == '/api/state':
            self._json_response(state)
        elif self.path.startswith('/api/start'):
            from urllib.parse import urlparse, parse_qs
            qs = parse_qs(urlparse(self.path).query)
            stages = qs.get('stages', [''])[0]  # "1,2,3,..." or ""
            with lock:
                state["logs"] = []
                state["results"] = None
                state["stage_results"] = {}
                state["stage"] = ""
                state["progress"] = 0
                state["pending_cmd"] = "start"
                state["pending_stages"] = stages  # pass to phone
                state["running"] = True
                state["last_update"] = None
            self._json_response({"ok": True, "cmd": "start", "stages": stages})
            print(f"🟢 Admin → START (stages: {stages[:50] if stages else 'all'})")
        elif self.path == '/api/stop':
            with lock:
                state["pending_cmd"] = "stop"
                state["running"] = False
            self._json_response({"ok": True, "cmd": "stop"})
            print("🔴 Admin → STOP")
        elif self.path == '/api/phone/poll':
            # Phone polls for commands
            with lock:
                cmd = state["pending_cmd"]
                stages = state.get("pending_stages", "")
                state["pending_cmd"] = None
                state["pending_stages"] = ""
                state["phone_connected"] = True
                state["phone_last_seen"] = datetime.datetime.now().isoformat()
            self._json_response({"cmd": cmd, "stages": stages, "default_lang": state.get("default_lang", "ru")})
        elif self.path == '/api/history':
            # List all saved result files
            results_dir = APP_DIR.parent / "logs"
            results_dir.mkdir(parents=True, exist_ok=True)
            files = sorted(results_dir.glob("nvg_poc_v3_*.json"), reverse=True)
            history = []
            for f in files[:20]:  # last 20
                try:
                    data = json.loads(f.read_text())
                    # Count passes
                    passes = 0
                    total = 0
                    for i in range(1, 62):
                        key = f"stage{i}"
                        if key in data:
                            total += 1
                            # Simple pass check
                            passes += 1  # counted by admin
                    history.append({
                        "file": f.name,
                        "time": f.stem.replace("nvg_poc_v3_", ""),
                        "stages": total,
                        "size": f.stat().st_size
                    })
                except:
                    history.append({"file": f.name, "error": True})
            self._json_response({"history": history})
        elif self.path.startswith('/api/download/'):
            # Download a specific result JSON file
            fname = self.path.replace('/api/download/', '')
            # Security: only allow nvg_poc_v3_*.json files
            if not fname.startswith('nvg_poc_v3_') or '..' in fname:
                self.send_error(403)
                return
            fpath = APP_DIR.parent / "logs" / fname
            if fpath.exists():
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Disposition', f'attachment; filename="{fname}"')
                data = fpath.read_bytes()
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            else:
                self.send_error(404)
        else:
            super().do_GET()
      except (BrokenPipeError, ConnectionResetError, OSError) as e:
          pass  # client disconnected, ignore

    def do_POST(self):
      try:
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length) if length else b'{}'
        try:
            data = json.loads(body)
        except:
            data = {}

        if self.path == '/api/phone/log':
            entry = {
                "t": datetime.datetime.now().isoformat(),
                "msg": data.get("msg", ""),
                "cls": data.get("cls", "")
            }
            with lock:
                state["logs"].append(entry)
                if len(state["logs"]) > 500:
                    state["logs"] = state["logs"][-300:]
                state["phone_connected"] = True
                state["phone_last_seen"] = datetime.datetime.now().isoformat()
            self._json_response({"ok": True})

        elif self.path == '/api/phone/stage':
            with lock:
                state["stage"] = data.get("stage", "")
                state["progress"] = data.get("progress", 0)
                state["running"] = True
                state["phone_connected"] = True
                state["phone_last_seen"] = datetime.datetime.now().isoformat()
            self._json_response({"ok": True})

        elif self.path == '/api/phone/stage_result':
            with lock:
                sr = {
                    "stageId": data.get("stageId"),
                    "serialNum": data.get("serialNum"),
                    "name": data.get("name"),
                    "passed": data.get("passed", False),
                    "metric": data.get("metric", ""),
                    "chart": data.get("chart"),
                    "data": data.get("data", {})
                }
                state["stage_results"][data.get("stageKey", "")] = sr
                state["phone_connected"] = True
                state["phone_last_seen"] = datetime.datetime.now().isoformat()
            self._json_response({"ok": True})

        elif self.path == '/api/phone/pattern':
            with lock:
                state["pattern"] = data.get("pattern", None)
                state["phone_connected"] = True
                state["phone_last_seen"] = datetime.datetime.now().isoformat()
            self._json_response({"ok": True})

        elif self.path == '/api/phone/results':
            with lock:
                state["results"] = data.get("data", data)
                state["running"] = False
                state["stage"] = "Завершено"
                state["progress"] = 100
                state["last_update"] = datetime.datetime.now().isoformat()
                state["phone_connected"] = True
            # Save to file
            ts = datetime.datetime.now().strftime("%Y-%m-%dT%H_%M_%S")
            log_dir = APP_DIR.parent / "logs"
            log_dir.mkdir(parents=True, exist_ok=True)
            fname = log_dir / f"nvg_poc_v3_{ts}.json"
            with open(fname, 'w') as f:
                json.dump(state["results"], f, indent=2)
            print(f"💾 Results saved: {fname}")
            self._json_response({"ok": True, "file": str(fname)})

        else:
            self.send_error(404)
      except (BrokenPipeError, ConnectionResetError, OSError) as e:
          pass  # client disconnected, ignore

    def _json_response(self, data):
        body = json.dumps(data, default=str).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def _serve_file(self, path):
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.end_headers()
        self.wfile.write(path.read_bytes())

    def _serve_js_module(self, path):
        if path.exists():
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.end_headers()
            self.wfile.write(path.read_bytes())
        else:
            self.send_error(404)

    def log_message(self, fmt, *args):
        # Only log non-poll requests
        msg = str(args[0]) if args else ''
        if '/api/phone/poll' not in msg and '/api/state' not in msg:
            super().log_message(fmt, *args)


def generate_cert():
    if CERT.exists() and KEY.exists():
        return
    import subprocess
    subprocess.run([
        "openssl", "req", "-x509", "-newkey", "rsa:2048",
        "-keyout", str(KEY), "-out", str(CERT),
        "-days", "365", "-nodes",
        "-subj", "/CN=NVG-PoC"
    ], check=True, capture_output=True)
    print("🔐 Self-signed certificate generated")


if __name__ == "__main__":
    generate_cert()

    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except:
        ip = "localhost"
    finally:
        s.close()

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(str(CERT), str(KEY))

    HTTPServer.allow_reuse_address = True
    server = HTTPServer(("0.0.0.0", 8443), Handler)
    server.socket = ctx.wrap_socket(server.socket, server_side=True)

    print(f"\n{'='*50}")
    print(f"  NVG Optical Computer — Server")
    print(f"{'='*50}")
    print(f"\n📱 Телефон: https://{ip}:8443/")
    print(f"🖥️  Админка: https://{ip}:8443/admin")
    print(f"🎓 Студент: https://{ip}:8443/student")
    print(f"\nВсё на одном порту 8443 — без WebSocket!")
    print(f"{'='*50}\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
