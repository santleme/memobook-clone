#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
umask 077
state=.state
mkdir -p "$state/models"
chmod 700 "$state"
fetch() {
  local name=$1 url=$2 hash=$3
  if [[ ! -f "$state/models/$name" ]]; then
    local part
    part=$(mktemp "$state/models/download.XXXXXX")
    curl --proto "=https" --proto-redir "=https" --fail --location --retry 2 "$url" --output "$part" || { rm -f "$part"; return 1; }
    if [[ "$(shasum -a 256 "$part" | cut -d' ' -f1)" != "$hash" ]]; then
      rm -f "$part"
      echo "Model checksum mismatch for $name" >&2
      return 1
    fi
    mv "$part" "$state/models/$name"
  elif [[ "$(shasum -a 256 "$state/models/$name" | cut -d' ' -f1)" != "$hash" ]]; then
    echo "Model checksum mismatch for $name" >&2
    return 1
  fi
}
tools=(whisper-cli ffmpeg python3)
if [[ ! -f "$state/azure.json" ]]; then tools+=(llama-server say); fi
for tool in "${tools[@]}"; do command -v "$tool" >/dev/null || { echo "Missing $tool" >&2; exit 1; }; done
if [[ ! -f "$state/azure.json" ]]; then
  fetch qwen7.gguf https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf 65b8fcd92af6b4fefa935c625d1ac27ea29dcb6ee14589c55a8f115ceaaa1423
fi
fetch whisper-turbo.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin 394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2
exec python3 server.py
