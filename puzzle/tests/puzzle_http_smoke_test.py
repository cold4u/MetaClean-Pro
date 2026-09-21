"""
HTTP & DOM verification smoke test for Cyber Circuit puzzle game
"""
import http.server
import os
import socketserver
import threading
import urllib.request

PORT = 0
DIRECTORY = "/home/shubhamkumarpatel9911/.gemini/antigravity/scratch/puzzle"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    def log_message(self, format, *args):
        pass

def run():
    server = socketserver.TCPServer(("", PORT), Handler, bind_and_activate=False)
    server.allow_reuse_address = True
    server.server_bind()
    server.server_activate()
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"Server started on port {server.server_address[1]}")

    endpoints = [
        ("/", "text/html"),
        ("/index.html", "text/html"),
        ("/style.css", "text/css"),
        ("/js/levels.js", "text/javascript"),
        ("/js/audio.js", "text/javascript"),
        ("/js/puzzle.js", "text/javascript"),
    ]

    for ep, exp_mime in endpoints:
        url = f"http://localhost:{server.server_address[1]}{ep}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200, f"Failed on {ep}: status {resp.status}"
            ctype = resp.headers.get_content_type()
            assert ctype == exp_mime, f"MIME mismatch on {ep}: got {ctype}, expected {exp_mime}"
            print(f"  ✓ {ep} -> 200 OK ({ctype})")

    # Verify DOM elements contract
    with open(os.path.join(DIRECTORY, "index.html")) as f:
        html = f.read()

    dom_ids = [
        "circuitBoard", "levelTitle", "levelTier", "moveCounter",
        "fillPercent", "fillBar", "levelStarsHeader", "btnLevelSelect",
        "btnUndo", "btnReset", "btnHint", "btnSound", "winModal",
        "winTitle", "winStarsDisplay", "winStats", "btnNextLevel",
        "btnReplayLevel", "levelModal", "levelGrid", "btnCloseLevels"
    ]

    for did in dom_ids:
        assert f'id="{did}"' in html, f"Missing required DOM element #{did}"
        print(f"  ✓ DOM element #{did} verified")

    server.shutdown()
    print("\n✅ All HTTP and DOM assertions passed successfully!")

if __name__ == "__main__":
    run()
