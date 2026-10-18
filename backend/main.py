import os
import sys
import re
import json
import time
import shutil
import subprocess
import urllib.parse
from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import requests

if getattr(sys, 'frozen', False):
    BUNDLE_DIR = sys._MEIPASS
    APP_DIR = os.path.dirname(sys.executable)
else:
    BUNDLE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    APP_DIR = BUNDLE_DIR

PROJECT_ROOT = APP_DIR
FRONTEND_DIR = os.path.join(BUNDLE_DIR, "frontend")
TORRSERVER_EXE = os.environ.get("TORRSERVER_EXE", os.path.join(PROJECT_ROOT, "..", "soft", "TorrServer-windows-386.exe"))
TORRSERVER_DIR = os.environ.get("TORRSERVER_DIR", os.path.abspath(os.path.join(PROJECT_ROOT, "..", "soft")))

JACKETT_URL     = os.environ.get("JACKETT_URL", "http://127.0.0.1:9117")
JACKETT_API_KEY = os.environ.get("JACKETT_API_KEY", "rveuo9xepecmiqzuepmy7c1kjitrnhrt")
TMDB_API_KEY    = "3fd2be6f0c70a2a598f084ddfb75487c"
TORRSERVER_URL  = os.environ.get("TORRSERVER_URL", "http://127.0.0.1:8090")

# Find VLC executable path
VLC_CANDIDATES = [
    r"C:\Program Files\VideoLAN\VLC\vlc.exe",
    r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe",
    shutil.which("vlc")
]
VLC_PATH = next((p for p in VLC_CANDIDATES if p and os.path.exists(p)), None)


def download_torrserver(dest_path: str) -> bool:
    """Автоматически скачивает официальный 64-битный TorrServer если он отсутствует на компьютере."""
    url = (
        "https://github.com/YouROK/TorrServer/releases/latest/download/TorrServer-windows-amd64.exe"
        if os.name == 'nt'
        else "https://github.com/YouROK/TorrServer/releases/latest/download/TorrServer-linux-amd64"
    )
    print(f"[TorrServer] Загрузка TorrServer с {url}...")
    try:
        os.makedirs(os.path.dirname(os.path.abspath(dest_path)), exist_ok=True)
        r = requests.get(url, stream=True, timeout=40)
        if r.status_code == 200:
            with open(dest_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        f.write(chunk)
            if os.name != 'nt':
                os.chmod(dest_path, 0o755)
            print(f"[TorrServer] Успешно загружен в {dest_path}")
            return True
    except Exception as e:
        print(f"[TorrServer] Ошибка загрузки: {e}")
    return False


def get_torrserver_executable() -> Optional[str]:
    """Находит бинарный файл TorrServer на Windows или Linux (предпочитая 64-битную версию)."""
    if os.name == 'nt':
        candidates = [
            os.path.join(APP_DIR, "TorrServer-windows-amd64.exe"),
            os.path.join(PROJECT_ROOT, "TorrServer-windows-amd64.exe"),
            os.path.join(PROJECT_ROOT, "..", "soft", "TorrServer-windows-amd64.exe"),
            os.path.join(PROJECT_ROOT, "soft", "TorrServer-windows-amd64.exe"),
            shutil.which("TorrServer-windows-amd64.exe"),
            os.path.abspath(TORRSERVER_EXE),
            os.path.join(APP_DIR, "TorrServer-windows-386.exe"),
            os.path.join(PROJECT_ROOT, "TorrServer-windows-386.exe"),
            os.path.join(PROJECT_ROOT, "soft", "TorrServer-windows-386.exe"),
            shutil.which("TorrServer-windows-386.exe"),
            shutil.which("torrserver.exe"),
            shutil.which("torrserver")
        ]
    else:
        candidates = [
            shutil.which("torrserver"),
            shutil.which("TorrServer-linux-amd64"),
            "/usr/local/bin/torrserver",
            "/usr/bin/torrserver",
            os.path.join(PROJECT_ROOT, "torrserver"),
            os.path.join(PROJECT_ROOT, "TorrServer-linux-amd64")
        ]
    for c in candidates:
        if c and os.path.exists(c):
            return c

    # Если бинарник не найден на компьютере — скачиваем 64-битный
    auto_dest = (
        os.path.join(APP_DIR, "TorrServer-windows-amd64.exe")
        if os.name == 'nt'
        else os.path.join(APP_DIR, "torrserver")
    )
    if download_torrserver(auto_dest):
        return auto_dest

    return None


def ensure_torrserver_running():
    """Проверяет запущен ли TorrServer, и при необходимости запускает его."""
    try:
        r = requests.get(f"{TORRSERVER_URL}/echo", timeout=1.5)
        if r.status_code == 200:
            print(f"[TorrServer] Уже запущен: {r.text.strip()}")
            enable_torrserver_rutor()
            return True
    except Exception:
        pass

    exe_path = get_torrserver_executable()
    if exe_path:
        data_dir = TORRSERVER_DIR if os.path.exists(TORRSERVER_DIR) else (
            os.path.join(PROJECT_ROOT, "torrserver_data") if os.name == 'nt' else "/tmp/torrserver"
        )
        os.makedirs(data_dir, exist_ok=True)
        log_path = os.path.join(data_dir, "torrserver.log")
        print(f"[TorrServer] Запуск процесса {exe_path} (папка: {data_dir})...")
        try:
            flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            subprocess.Popen(
                [exe_path, "-d", data_dir, "-l", log_path, "-p", "8090"],
                cwd=data_dir,
                creationflags=flags
            )
            # Ждем запуска
            for _ in range(12):
                time.sleep(0.5)
                try:
                    r = requests.get(f"{TORRSERVER_URL}/echo", timeout=1)
                    if r.status_code == 200:
                        print(f"[TorrServer] Успешно запущен: {r.text.strip()}")
                        enable_torrserver_rutor()
                        return True
                except Exception:
                    pass
        except Exception as e:
            print(f"[TorrServer] Ошибка автозапуска: {e}")
    else:
        print("[TorrServer] Бинарник не найден локально (будет использован внешний TorrServer по TORRSERVER_URL).")
    return False


def enable_torrserver_rutor():
    """Включает поиск RuTor в настройках TorrServer, если он выключен."""
    try:
        r = requests.post(f"{TORRSERVER_URL}/settings", json={"action": "get"}, timeout=2)
        if r.status_code == 200:
            sets = r.json()
            if not sets.get("EnableRutorSearch"):
                sets["EnableRutorSearch"] = True
                requests.post(f"{TORRSERVER_URL}/settings", json={"action": "set", "sets": sets}, timeout=2)
                print("[TorrServer] Включен встроенный поиск RuTor.")
    except Exception as e:
        print(f"[TorrServer] Ошибка настройки RuTor: {e}")


def open_browser_delayed():
    if os.name != 'nt':
        return
    time.sleep(1.2)
    port = int(os.environ.get("PORT", 8080))
    app_url = f"http://127.0.0.1:{port}"

    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        shutil.which("msedge")
    ]
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        shutil.which("chrome")
    ]
    browser_exe = next((p for p in edge_paths + chrome_paths if p and os.path.exists(p)), None)
    if browser_exe:
        try:
            subprocess.Popen([browser_exe, f"--app={app_url}"])
            return
        except Exception:
            pass

    try:
        import webbrowser
        webbrowser.open(app_url)
    except Exception as e:
        print(f"[Browser] Ошибка открытия окна: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # При старте приложения проверяем TorrServer
    ensure_torrserver_running()
    # Автоматически открываем веб-интерфейс в браузере (на локальной машине)
    import threading
    threading.Thread(target=open_browser_delayed, daemon=True).start()
    yield


app = FastAPI(title="Personal Cinema API", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def parse_size_to_gb(val: Any) -> float:
    """Нормализует размер торрента в гигабайты (float)."""
    if isinstance(val, (int, float)):
        return round(val / (1024 ** 3), 2)
    if isinstance(val, str):
        s = val.strip().upper()
        m = re.match(r'^([\d.,]+)\s*([KMGT]?B?)$', s)
        if m:
            num = float(m.group(1).replace(',', '.'))
            unit = m.group(2)
            if 'TB' in unit:
                return round(num * 1024, 2)
            elif 'GB' in unit:
                return round(num, 2)
            elif 'MB' in unit:
                return round(num / 1024, 2)
            elif 'KB' in unit:
                return round(num / (1024 * 1024), 2)
            elif 'B' in unit:
                return round(num / (1024 ** 3), 2)
            return round(num, 2)
    return 0.0


def query_torrserver_rutor(search_string: str) -> List[Dict[str, Any]]:
    """Ищет торренты через встроенный движок поиска RuTor в TorrServer."""
    try:
        url = f"{TORRSERVER_URL}/search"
        r = requests.get(url, params={"query": search_string}, timeout=8)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        print(f"[TORRSERVER-SEARCH] Ошибка: {e}")
    return []


def query_jackett(search_string: str) -> List[Dict[str, Any]]:
    """Опрашивает Jackett, если он запущен."""
    url = f"{JACKETT_URL}/api/v2.0/indexers/all/results"
    params = {"apikey": JACKETT_API_KEY, "Query": search_string}
    try:
        r = requests.get(url, params=params, timeout=5)
        if r.status_code == 200:
            return r.json().get("Results", [])
    except Exception:
        pass
    return []


def query_rutor_direct(search_string: str) -> List[Dict[str, Any]]:
    """Прямой поиск по зеркалу rutor.info в качестве резервного канала."""
    url = f"http://rutor.info/search/0/0/0/0/{urllib.parse.quote(search_string)}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    try:
        r = requests.get(url, headers=headers, timeout=6)
        if r.status_code != 200:
            return []
        items = re.findall(r'<tr class="[g|w]">(.*?)</tr>', r.text, re.DOTALL)
        results = []
        for item in items:
            mag_m = re.search(r'href="(magnet:\?xt=urn:btih:[^"]+)"', item)
            if not mag_m:
                continue
            magnet = mag_m.group(1)
            title_m = re.findall(r'<a href="/torrent/\d+/[^"]+">([^<]+)</a>', item)
            title = title_m[-1] if title_m else ""
            tds = re.findall(r'<td[^>]*>(.*?)</td>', item, re.DOTALL)
            size_str = tds[-2] if len(tds) >= 2 else "0"
            size_str = re.sub(r'<[^>]+>', '', size_str).strip()
            seed_m = re.search(r'<span class="green">(?:<span[^>]*>)?(\d+)', item)
            seeders = int(seed_m.group(1)) if seed_m else 0
            results.append({
                "Title": title,
                "Size": size_str,
                "Seed": seeders,
                "Magnet": magnet
            })
        return results
    except Exception:
        return []


@app.get("/status")
def get_system_status():
    """Проверка доступности всех подсистем"""
    torr_ok = False
    torr_version = ""
    try:
        r = requests.get(f"{TORRSERVER_URL}/echo", timeout=1.5)
        if r.status_code == 200:
            torr_ok = True
            torr_version = r.text.strip()
    except Exception:
        pass

    jackett_ok = False
    try:
        r = requests.get(f"{JACKETT_URL}/api/v2.0/indexers/all/results?apikey={JACKETT_API_KEY}", timeout=1.5)
        if r.status_code in [200, 400]:
            jackett_ok = True
    except Exception:
        pass

    return {
        "torrserver": {"running": torr_ok, "version": torr_version},
        "jackett": {"running": jackett_ok},
        "vlc": {"installed": VLC_PATH is not None, "path": VLC_PATH}
    }


@app.get("/search")
def search_movie_torrents(title: str = Query(...)):
    print(f"\n[SEARCH] Запрос: '{title}'")
    en_title = None

    # TMDB: поиск оригинального английского названия
    try:
        res = requests.get(
            "https://api.themoviedb.org/3/search/movie",
            params={"api_key": TMDB_API_KEY, "query": title, "language": "ru"},
            timeout=5,
        )
        if res.status_code == 200:
            results = res.json().get("results", [])
            if results:
                en_title = results[0].get("original_title")
    except Exception as e:
        print(f"[TMDB] Ошибка: {e}")

    # 1. Поиск в TorrServer (встроенный RuTor)
    raw = query_torrserver_rutor(title)

    # 2. Если мало результатов и есть английское название — ищем и по нему
    if len(raw) < 5 and en_title and en_title.lower() != title.lower():
        en_raw = query_torrserver_rutor(en_title)
        raw.extend(en_raw)

    # 3. Если TorrServer ничего не вернул — пробуем резервный поиск в rutor.info
    if len(raw) == 0:
        raw = query_rutor_direct(title)
        if len(raw) < 3 and en_title and en_title.lower() != title.lower():
            raw.extend(query_rutor_direct(en_title))

    # 4. Проверяем Jackett если доступен
    jackett_raw = query_jackett(title)
    if jackett_raw:
        raw.extend(jackett_raw)

    parsed = []
    seen = set()

    for item in raw:
        # Извлекаем magnet ссылку
        link = item.get("Magnet") or item.get("MagnetUri") or item.get("Link") or ""
        if not link:
            continue

        # Извлекаем хэш для дедупликации
        h_m = re.search(r'xt=urn:btih:([a-zA-Z0-9]+)', link)
        unique_key = h_m.group(1).lower() if h_m else link
        if unique_key in seen:
            continue

        # Извлекаем количество сидов
        seeders = item.get("Seed")
        if seeders is None:
            seeders = item.get("Seeders") or item.get("seeders") or 0

        # Нормализуем размер
        size_gb = parse_size_to_gb(item.get("Size", 0))
        if size_gb <= 0:
            continue

        # Формируем чистую magnet-ссылку
        magnet = urllib.parse.unquote(link) if ("%3A" in link or "%3a" in link) else link
        title_str = item.get("Title") or item.get("title") or ""

        parsed.append({
            "title": title_str,
            "size": size_gb,
            "seeders": seeders,
            "magnet": magnet
        })
        seen.add(unique_key)

    result = sorted(parsed, key=lambda x: x["seeders"], reverse=True)[:35]
    print(f"[SEARCH] Найдено раздач: {len(result)}")
    return result


@app.get("/torrent-info")
def torrent_info(magnet: str = Query(...)):
    """
    Добавляет торрент в TorrServer (MatriX API: POST /torrents)
    и возвращает информацию о раздаче и список файлов.
    """
    pure_magnet = urllib.parse.unquote(magnet)

    # Извлекаем хэш торрента из магнита
    h_m = re.search(r'xt=urn:btih:([a-zA-Z0-9]+)', pure_magnet)
    torr_hash = h_m.group(1).lower() if h_m else None

    try:
        # Добавляем торрент в TorrServer
        add_res = requests.post(
            f"{TORRSERVER_URL}/torrents",
            json={"action": "add", "link": pure_magnet, "save_to_db": False},
            timeout=5,
        )
        if add_res.status_code == 200:
            add_data = add_res.json()
            if not torr_hash:
                torr_hash = add_data.get("hash")

        if not torr_hash:
            return {"file_stats": []}

        # Опрашиваем TorrServer с небольшой паузой для получения метаданных (file_stats)
        for _ in range(4):
            get_res = requests.post(
                f"{TORRSERVER_URL}/torrents",
                json={"action": "get", "hash": torr_hash},
                timeout=4,
            )
            if get_res.status_code == 200:
                torr_data = get_res.json()
                files = torr_data.get("file_stats", [])
                if files:
                    return torr_data
            time.sleep(0.7)

    except Exception as e:
        print(f"[TORRENT-INFO] Ошибка: {e}")

    return {"hash": torr_hash, "file_stats": []}


@app.get("/open-vlc")
def open_in_vlc(url: str = Query(...)):
    """
    Запускает поток в установленном на компьютере VLC плеере напрямую.
    """
    if not VLC_PATH or not os.path.exists(VLC_PATH):
        return {"success": False, "message": "VLC плеер не найден в системе"}

    stream_url = urllib.parse.unquote(url)
    try:
        # Запускаем VLC с переданным URL стрима
        subprocess.Popen([VLC_PATH, stream_url])
        return {"success": True, "message": "Запущено в VLC"}
    except Exception as e:
        return {"success": False, "message": f"Ошибка запуска VLC: {e}"}


@app.get("/stream-proxy")
def stream_proxy(request: Request, magnet: str = Query(...), index: int = 1):
    """
    Проксирует стрим TorrServer через бэкенд с полной поддержкой HTTP Range (перемотка)
    и CORS-заголовков.
    """
    pure_magnet = urllib.parse.unquote(magnet)
    source_url = (
        f"{TORRSERVER_URL}/stream/"
        f"?link={urllib.parse.quote(pure_magnet)}&index={index}&play"
    )

    # Пробрасываем Range-заголовок браузера
    req_headers = {}
    range_header = request.headers.get("range")
    if range_header:
        req_headers["Range"] = range_header

    try:
        r = requests.get(source_url, stream=True, timeout=20, headers=req_headers)
    except Exception as e:
        return Response(content=f"TorrServer stream error: {e}", status_code=502)

    resp_headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
    }
    for h in ["Content-Range", "Content-Length", "Content-Type", "Last-Modified", "Etag"]:
        if h in r.headers:
            resp_headers[h] = r.headers[h]

    def generate():
        try:
            for chunk in r.iter_content(chunk_size=65536):
                if chunk:
                    yield chunk
        finally:
            r.close()

    return StreamingResponse(
        generate(),
        status_code=r.status_code,
        media_type=r.headers.get("Content-Type", "video/mp4"),
        headers=resp_headers,
    )


# Find FFmpeg and FFprobe binaries
FFMPEG_BIN = next((p for p in [shutil.which("ffmpeg"), os.path.join(APP_DIR, "ffmpeg.exe"), r"C:\ffmpeg\bin\ffmpeg.exe", r"C:\ffmpeg\ffmpeg.exe"] if p and os.path.exists(p)), "ffmpeg")
FFPROBE_BIN = next((p for p in [shutil.which("ffprobe"), os.path.join(APP_DIR, "ffprobe.exe"), r"C:\ffmpeg\bin\ffprobe.exe", r"C:\ffmpeg\ffprobe.exe"] if p and os.path.exists(p)), "ffprobe")


@app.get("/audio-tracks")
def get_audio_tracks(magnet: str = Query(...), index: int = 1):
    """Возвращает список звуковых дорожек торрента и полную длительность для плеера."""
    pure_magnet = urllib.parse.unquote(magnet)
    source_url = f"{TORRSERVER_URL}/stream/?link={urllib.parse.quote(pure_magnet)}&index={index}&play"

    cmd = [
        FFPROBE_BIN,
        "-v", "error",
        "-show_entries", "stream=index,codec_name,codec_type,channels,duration:stream_tags=language,title:format=duration",
        "-of", "json",
        source_url
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=8)
        if proc.returncode == 0:
            data = json.loads(proc.stdout)
            audio_streams = []
            audio_idx = 0
            for s in data.get("streams", []):
                if s.get("codec_type") == "audio":
                    tags = s.get("tags", {})
                    lang = tags.get("language", "")
                    title = tags.get("title", "")
                    codec = s.get("codec_name", "")
                    label_parts = []
                    if title:
                        label_parts.append(title)
                    if lang:
                        label_parts.append(f"[{lang.upper()}]")
                    if codec:
                        label_parts.append(f"({codec})")
                    label = " ".join(label_parts) if label_parts else f"Аудио #{audio_idx + 1}"
                    audio_streams.append({
                        "id": audio_idx,
                        "stream_index": s.get("index"),
                        "codec": codec,
                        "title": label,
                        "lang": lang
                    })
                    audio_idx += 1

            # Извлекаем полную длительность фильма в секундах
            duration = 0.0
            fmt_dur = data.get("format", {}).get("duration")
            if fmt_dur:
                try:
                    duration = float(fmt_dur)
                except Exception:
                    pass
            if duration <= 0:
                for s in data.get("streams", []):
                    s_dur = s.get("duration")
                    if s_dur:
                        try:
                            d = float(s_dur)
                            if d > duration:
                                duration = d
                        except Exception:
                            pass

            return {"tracks": audio_streams, "duration": round(duration, 2)}
    except Exception as e:
        print(f"[AUDIO-TRACKS] Ошибка: {e}")
    return {"tracks": [], "duration": 0}


@app.get("/stream-live")
def stream_live(
    magnet: str = Query(...),
    index: int = 1,
    audio_track: int = 0,
    ss: float = 0.0
):
    """
    Транскодирует несовместимый звук (AC3/EAC3/DTS) в AAC на лету через ffmpeg.
    Видео поток копируется без пережатия (-c:v copy) с нулевой нагрузкой на CPU.
    Поддерживает перемотку на любой таймкод через параметр ss (в секундах).
    """
    pure_magnet = urllib.parse.unquote(magnet)
    source_url = f"{TORRSERVER_URL}/stream/?link={urllib.parse.quote(pure_magnet)}&index={index}&play"

    cmd = [FFMPEG_BIN, "-nostdin", "-loglevel", "warning"]

    if ss > 0:
        cmd.extend(["-ss", str(ss)])

    cmd.extend([
        "-reconnect", "1",
        "-reconnect_at_eof", "1",
        "-reconnect_streamed", "1",
        "-i", source_url,
        "-map", "0:v:0",
        "-map", f"0:a:{audio_track}?",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ac", "2",
        "-avoid_negative_ts", "make_zero",
        "-strict", "unofficial",
        "-f", "mp4",
        "-movflags", "frag_keyframe+empty_moov+default_base_moof",
        "pipe:1"
    ])

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=10**6)

    def generate():
        try:
            while True:
                chunk = proc.stdout.read(65536)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                proc.terminate()
                proc.wait(timeout=1)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass

    return StreamingResponse(
        generate(),
        media_type="video/mp4",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }
    )


# Подключаем раздачу статических файлов фронтенда
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
    os.chdir(current_dir)
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 8080))
    print(f"[PersonalCinema 4K] Сервер запускается на http://{host}:{port}")
    uvicorn.run(app, host=host, port=port)