FROM python:3.12-slim

# Установка системных зависимостей: ffmpeg для перекодирования звука, curl для загрузки TorrServer
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Загрузка актуального релиза TorrServer для Linux amd64
RUN curl -L https://github.com/YouROK/TorrServer/releases/latest/download/TorrServer-linux-amd64 -o /usr/local/bin/torrserver \
    && chmod +x /usr/local/bin/torrserver

WORKDIR /app

# Установка Python-пакетов
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Копирование исходного кода проекта
COPY . .

# Делаем скрипт запуска исполняемым
RUN chmod +x entrypoint.sh

ENV HOST=0.0.0.0
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
