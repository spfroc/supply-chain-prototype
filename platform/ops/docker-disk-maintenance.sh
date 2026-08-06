#!/bin/sh
set -eu

# Only remove rebuildable Docker artifacts. Never prune volumes: they contain
# databases and uploaded business files.
docker builder prune --all --force --filter "until=24h"
docker image prune --all --force --filter "until=72h"

usage_percent="$(df -P / | awk 'NR==2 {gsub(/%/, "", $5); print $5}')"
if [ "$usage_percent" -ge 90 ]; then
  logger -p daemon.warning -t supply-chain-disk "root filesystem usage remains at ${usage_percent}% after Docker cache cleanup"
else
  logger -p daemon.info -t supply-chain-disk "Docker cache cleanup complete; root filesystem usage is ${usage_percent}%"
fi
