#!/bin/sh
set -eu

mkdir -p /app/uploads
chown -R app:app /app/uploads

exec su-exec app:app java -XX:MaxRAMPercentage=75 -Duser.timezone=Asia/Shanghai -jar /app/app.jar
