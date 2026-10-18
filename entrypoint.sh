#!/bin/sh
set -e

echo "Starting TorrServer..."
torrserver -d /tmp/torrserver -p 8090 -l /tmp/torrserver/torrserver.log &

# Wait for TorrServer to be ready
for i in $(seq 1 15); do
    if curl -s http://127.0.0.1:8090/echo > /dev/null; then
        echo "TorrServer is ready!"
        break
    fi
    sleep 0.5
done

# Enable RuTor search in TorrServer
curl -s -X POST http://127.0.0.1:8090/settings \
     -H "Content-Type: application/json" \
     -d '{"action":"set","sets":{"EnableRutorSearch":true}}' || true

echo "Starting PersonalCinema backend on port ${PORT:-8080}..."
exec python backend/main.py
