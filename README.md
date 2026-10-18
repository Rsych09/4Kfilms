# 🍿 PersonalCinema 4K

> **Персональный домашний онлайн-кинотеатр для потокового просмотра фильмов и сериалов из торрентов в реальном времени без предварительного скачивания.**

[![GitHub Release](https://img.shields.io/github/v/release/Rsych09/4Kfilms?logo=github&color=blue)](https://github.com/Rsych09/4Kfilms/releases)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://python.org)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows&logoColor=white)](https://microsoft.com/windows)

---

## 🖥️ Запуск как программа для Windows (.EXE)

Самый удобный способ пользоваться PersonalCinema 4K — запускать как обычную настольную программу:

1. Перейдите во вкладку **[Releases](https://github.com/Rsych09/4Kfilms/releases)** репозитория.
2. Скачайте архив **`PersonalCinema4K-Windows.zip`** (или напрямую `PersonalCinema4K.exe`).
3. Запустите **`PersonalCinema4K.exe`**.

> [!TIP]
> **Автономность**: программа сама поднимет локальный сервер, при необходимости найдет или загрузит движок `TorrServer`, и откроет кинотеатр в нативном окне приложения без лишних адресных панелей браузера.

---

## ✨ Возможности

- **🎬 Стриминг торрентов без ожидания**: воспроизведение начинается через несколько секунд после клика — нет необходимости ждать полной загрузки файла на диск.
- **🔊 Звук в браузере (Live AAC Transcoding)**: браузеры не поддерживают форматы звука AC-3 (Dolby Digital) и DTS. Бэкенд на лету перекодирует звук в совместимый AAC стерео через FFmpeg, при этом видеоряд (`-c:v copy`) передается без пережатия и без нагрузки на процессор.
- **🎧 Выбор звуковых дорожек**: если в раздаче несколько озвучек (дубляж, закадровый перевод, оригинал), дорожку можно переключить прямо в плеере.
- **🍿 Каталог фильмов**: интеграция с TMDB API — тренды недели, подборка 4K Ultra HD, топ рейтингов и удобный поиск.
- **🔍 Поиск раздач**: встроенный движок поиска по базе RuTor (350 000+ торрентов) с отображением размера и количества сидов.
- **⚡ Запуск в VLC в 1 клик**: кнопка прямого открытия фильма в локальном VLC плеере на компьютере или скачивание `.m3u` плейлиста.
- **📂 Поддержка сериалов**: автоматическое определение файлов раздачи и выбор серии через выпадающий список.

---

## 🚀 Запуск из исходного кода (start.bat)

Если вы запускаете проект из исходников:
1. Убедитесь, что установлен **Python 3.10+**.
2. Установлен **FFmpeg** (в системном `PATH`, например `C:\ffmpeg\bin`).
3. Запустите файл **`start.bat`** двойным кликом:
   ```bat
   start.bat
   ```

---

## 🔨 Сборка собственного EXE файла

Вы можете в любой момент скомпилировать автономный `.exe` самостоятельно:

```bat
build.bat
```
Или командой:
```bash
python build_exe.py
```
Скомпилированный файл появится в папке **`dist/PersonalCinema4K.exe`**.

---

## 🛠️ Стек технологий

- **Desktop & Backend**: FastAPI (Python 3.12), Uvicorn, Requests, PyInstaller.
- **Streaming & Codecs**: TorrServer MatriX, FFmpeg (живой транскодинг AAC).
- **Frontend**: Vanilla JavaScript (ES6+), HTML5 Video API, современный CSS (Netflix-стиль, адаптивный дизайн).
- **APIs**: The Movie Database (TMDB API), RuTor Torrent Search Indexer.

---

## 📄 Лицензия

Проект создан в образовательных и персональных ознакомительных целях.
