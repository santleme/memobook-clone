"""Azure inference routes. Only server-side credentials leave the loopback process."""
import json
import re
import time
import sqlite3
from pathlib import Path
from urllib.parse import quote
from urllib import error, request

VOICE_NAMES = {
    "Samantha": "coral", "Fred": "onyx", "Flo (English (US))": "shimmer",
    "Eddy (English (US))": "echo", "Sandy (English (US))": "nova",
    "Reed (English (US))": "sage", "Rocko (English (US))": "ash",
    "Shelley (English (US))": "alloy",
}


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def reserve_call(state, limit):
    """Count outbound calls across threads and restarts, without storing user content."""
    connection = sqlite3.connect(state / "usage.sqlite", timeout=5)
    try:
        with connection:
            connection.execute("CREATE TABLE IF NOT EXISTS usage(day TEXT PRIMARY KEY, calls INTEGER NOT NULL)")
            changed = connection.execute(
                "INSERT INTO usage VALUES(date('now'), 1) ON CONFLICT(day) DO UPDATE "
                "SET calls = calls + 1 WHERE calls < ?", (limit,),
            ).rowcount
            if not changed:
                raise DailyLimit("The daily inference request limit has been reached.")
    finally:
        connection.close()


class DailyLimit(RuntimeError):
    pass


def post(state: Path, config, service, path, payload):
    endpoint = config[service + "_endpoint"].rstrip("/")
    if service not in {"chat", "voice"} or not re.fullmatch(r"https://[a-z0-9][a-z0-9-]*\.openai\.azure\.com", endpoint):
        raise ValueError("Expected an Azure OpenAI resource endpoint.")
    key = (state / ("azure-" + service + ".key")).read_text().strip()
    req = request.Request(endpoint + path, json.dumps(payload).encode(), {
        "api-key": key, "Content-Type": "application/json",
    })
    transport = request.build_opener(NoRedirect())
    for attempt in range(3):
        reserve_call(state, config.get("daily_request_limit", 600))
        try:
            with transport.open(req, timeout=65) as response:
                return response.read()
        except error.HTTPError as exc:
            if exc.code != 429 or attempt == 2:
                raise
            delay = exc.headers.get("Retry-After", "2")
            if not delay.isdigit() or int(delay) > 30:
                raise
            time.sleep(max(1, int(delay)))


def chat(state, config, messages, kind, schema):
    deployment = quote(config["chat_model"], safe="")
    path = f"/openai/deployments/{deployment}/chat/completions?api-version=2024-10-21"
    payload = {
        "messages": messages, "max_completion_tokens": 3200, "reasoning_effort": "low",
        "response_format": {"type": "json_schema", "json_schema": {
            "name": kind, "strict": True, "schema": schema,
        }},
    }
    raw = post(state, config, "chat", path, payload)
    choices = json.loads(raw).get("choices", [])
    if not choices or choices[0].get("finish_reason") != "stop":
        raise RuntimeError("Azure returned no complete reply")
    content = choices[0].get("message", {}).get("content")
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("Azure returned an empty reply")
    return content


def speech(state, config, line, voice):
    return post(state, config, "voice", "/openai/v1/audio/speech", {
        "model": config["voice_model"], "input": line, "voice": VOICE_NAMES[voice],
        "instructions": "Speak naturally in the language of the text. For Portuguese, use a Brazilian accent.",
        "response_format": "mp3",
    })


ELEVEN_VOICES = {
    "Samantha": "EXAVITQu4vr4xnSDxMaL", "Fred": "JBFqnCBsd6RMkjVDRZzb",
    "Flo (English (US))": "FGY2WhTYpPnrIDTdsKH5", "Eddy (English (US))": "IKne3meq5aSn9XLyUdCD",
    "Sandy (English (US))": "Xb7hH8MSUJpSbSDYk0k2", "Reed (English (US))": "CwhRBWXzGAHq8TQ4Fs17",
    "Rocko (English (US))": "N2lVS1w4EtoT3dr4eOWO", "Shelley (English (US))": "XrExE9yKIg1WjnnlVkGX",
}


def eleven_speech(state, config, line, voice, model):
    reserve_call(state, config.get("daily_request_limit", 600))
    url = "https://api.elevenlabs.io/v1/text-to-speech/" + ELEVEN_VOICES[voice]
    req = request.Request(url, json.dumps({"text": line, "model_id": model}).encode(), {
        "xi-api-key": (state / "elevenlabs.key").read_text().strip(),
        "Content-Type": "application/json", "Accept": "audio/mpeg",
    })
    with request.build_opener(NoRedirect()).open(req, timeout=60) as response:
        if response.headers.get_content_type() != "audio/mpeg":
            raise RuntimeError("The speech provider returned an unexpected format")
        return response.read(8 << 20)
