import os
import sys
import shutil
import subprocess

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
MAIN_PY = os.path.join(PROJECT_ROOT, "backend", "main.py")

print("=== Building PersonalCinema4K.exe with PyInstaller ===")

# Build arguments
cmd = [
    sys.executable, "-m", "PyInstaller",
    "--noconfirm",
    "--onefile",
    "--name", "PersonalCinema4K",
    "--add-data", f"{FRONTEND_DIR};frontend",
    "--hidden-import", "uvicorn.logging",
    "--hidden-import", "uvicorn.loops",
    "--hidden-import", "uvicorn.loops.auto",
    "--hidden-import", "uvicorn.protocols",
    "--hidden-import", "uvicorn.protocols.http",
    "--hidden-import", "uvicorn.protocols.http.auto",
    "--hidden-import", "uvicorn.protocols.websockets",
    "--hidden-import", "uvicorn.protocols.websockets.auto",
    "--hidden-import", "qrcode",
    "--hidden-import", "PIL",
]

icon_path = os.path.join(PROJECT_ROOT, "icon.ico")
if os.path.exists(icon_path):
    cmd.extend(["--icon", icon_path])

cmd.append(MAIN_PY)

print("Running command:", " ".join(cmd))
res = subprocess.run(cmd, cwd=PROJECT_ROOT)
if res.returncode == 0:
    print("\n[OK] Build completed successfully! Output: dist/PersonalCinema4K.exe")
    # Copy TorrServer next to dist for complete standalone bundle
    dist_dir = os.path.join(PROJECT_ROOT, "dist")
    soft_candidates = [
        os.path.join(PROJECT_ROOT, "..", "soft", "TorrServer-windows-amd64.exe"),
        os.path.join(PROJECT_ROOT, "..", "soft", "TorrServer-windows-386.exe")
    ]
    for ts in soft_candidates:
        if os.path.exists(ts) and os.path.exists(dist_dir):
            dest_ts = os.path.join(dist_dir, os.path.basename(ts))
            shutil.copy2(ts, dest_ts)
            print(f"[OK] Bundled TorrServer into: {dest_ts}")
else:
    print(f"\n[ERROR] Build failed with exit code {res.returncode}")
