#!/bin/sh
cd "$(dirname "$0")" || exit 1
node backend/scripts/start-universe.mjs
