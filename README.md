# 🍿 PersonalCinema 4K

> **Персональный домашний онлайн-кинотеатр для потокового просмотра фильмов и сериалов из торрентов в реальном времени без предварительного скачивания.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://python.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![Render](https://img.shields.io/badge/Render-Deploy-46E3B7?logo=render&logoColor=white)](https://render.com)

---

## ✨ Возможности

- **🎬 Стриминг торрентов без ожидания**: воспроизведение начинается через несколько секунд после клика — нет необходимости ждать полной загрузки файла на диск.
- **🔊 Звук в браузере (Live AAC Transcoding)**: браузеры не поддерживают форматы звука AC-3 (Dolby Digital) и DTS. Бэкенд на лету перекодирует звук в совместимый AAC стерео через FFmpeg, при этом видеоряд (`-c:v copy`) передается без пережатия и без нагрузки на процессор.
- **🎧 Выбор аудиодорожек**: если в раздаче несколько озвучек (дубляж, закадровый перевод, оригинал), дорожку можно переключить прямо в плеере.
- **🍿 Каталог фильмов**: интеграция с TMDB API — тренды недели, подборка 4K Ultra HD, топ рейтингов и удобный поиск.
- **🔍 Поиск раздач**: встроенный движок поиска по базе RuTor (350 000+ торрентов) с отображением размера и количества сидов.
- **⚡ Запуск в VLC в 1 клик**: кнопка прямого открытия фильма в локальном VLC плеере на компьютере или скачивание `.m3u` плейлиста.
- **📂 Поддержка сериалов**: автоматическое определение файлов раздачи и выбор серии через выпадающий список.

---

## 🚀 Быстрый запуск на Windows (Локально)

### Требования:
1. **Python 3.10+** (проверьте в терминале: `python --version`).
2. **FFmpeg** (желательно в системном `PATH`, например `C:\ffmpeg\bin`).
3. **TorrServer** (находится в папке `../soft/TorrServer-windows-386.exe` или рядом с проектом).

### Запуск:
Просто запустите файл **`start.bat`** двойным кликом:
```bat
start.bat
```
Скрипт автоматически запустит TorrServer, поднимет бэкенд на `http://127.0.0.1:8080` и откроет кинотеатр в вашем браузере.

---

## ☁️ Развертывание на Render.com (В облаке)

Проект полностью оптимизирован для бесплатного хостинга на [Render.com](https://render.com) через Docker.

### Пошаговая инструкция:

1. Зайдите на сайт [Render.com](https://render.com) и войдите через свой GitHub аккаунт.
2. В панели управления нажмите **New +** → **Web Service**.
3. Выберите репозиторий `4Kfilms` (или вставьте `https://github.com/Rsych09/4Kfilms.git`).
4. Настройте параметры:
   - **Name**: `personalcinema` (или любое другое имя)
   - **Region**: `Frankfurt (EU)` (рекомендуется для пользователей из Европы/СНГ)
   - **Environment / Runtime**: `Docker` (Render автоматически обнаружит `Dockerfile`)
   - **Instance Type**: `Free`
5. Нажмите **Deploy Web Service**.

> [!TIP]
> При сборке Docker-образа автоматически загрузится актуальный TorrServer для Linux и FFmpeg для транскодирования звука. После деплоя вы получите постоянную ссылку вида `https://personalcinema.onrender.com`.

---

## 🐳 Запуск через Docker

Если у вас установлен Docker, проект можно запустить одной командой:

```bash
# Сборка образа
docker build -t 4kfilms .

# Запуск контейнера
docker run -d -p 8080:8080 --name personalcinema 4kfilms
```

После этого откройте в браузере: `http://localhost:8080`.

---

## 🛠️ Стек технологий

- **Backend**: FastAPI (Python 3.12), Uvicorn, Requests.
- **Streaming & Codecs**: TorrServer MatriX, FFmpeg (AAC transcode on-the-fly).
- **Frontend**: Vanilla JavaScript (ES6+), HTML5 Video API, современный CSS (Netflix-стиль, адаптивный дизайн).
- **APIs**: The Movie Database (TMDB API), RuTor Torrent Search Indexer.

---

## ⚙️ Переменные окружения

| Переменная | По умолчанию | Описание |
|---|---|---|
| `PORT` | `8080` | Порт веб-сервера |
| `HOST` | `0.0.0.0` | Хост для привязки сервера |
| `TORRSERVER_URL` | `http://127.0.0.1:8090` | Адрес TorrServer API |
| `TORRSERVER_DIR` | `../soft` | Папка с базой данных TorrServer |

---

## 📄 Лицензия

Проект создан в образовательных и персональных ознакомительных целях.
