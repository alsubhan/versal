#!/usr/bin/env bash
# deployment wrapper for aifin.tolor.com
REMOTE_HOST="subhan@aifin.tolor.com" \
REMOTE_PORT="1022" \
REMOTE_DIR="/home/subhan/Documents/versal" \
bash scripts/deploy-ssh.sh "$@"
