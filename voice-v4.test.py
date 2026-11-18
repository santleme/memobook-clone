"""Exercise both real synthesis modes through the running MemoBook server."""
import json
import os
import subprocess
import unittest
from urllib.request import Request, urlopen

BASE = "http://127.0.0.1:" + os.environ.get("MEMOBOOK_PORT", "4827")


class VoiceRoutes(unittest.TestCase):
    def test_portuguese_audio(self):
        info = json.load(urlopen(BASE + "/api/provider"))
        self.assertEqual(info["conversation_voice"], "eleven_v4_turbo")
        self.assertEqual(info["narration_voice"], "eleven_v4")
        self.assertTrue(info["chat_model"].startswith("gpt-"))
        for live in (False, True):
            body = {"line": "Vamos praticar uma conversa em português?", "live": live}
            req = Request(BASE + "/api/voice", json.dumps(body).encode(), {"Origin": BASE, "Content-Type": "application/json"})
            with urlopen(req, timeout=65) as response:
                self.assertEqual(response.headers["X-Speech-Model"], info["conversation_voice" if live else "narration_voice"])
                audio = response.read()
            decoded = subprocess.run(["ffmpeg","-v","error","-i","pipe:0","-f","s16le","-ar","16000","-ac","1","pipe:1"], input=audio,capture_output=True,check=True)
            self.assertGreater(len(decoded.stdout), 16000)
            if live:
                from pathlib import Path
                evidence = Path(__file__).resolve().parent / ".state/evidence"
                evidence.mkdir(parents=True, exist_ok=True)
                (evidence / "voz-eleven-v4-turbo.mp3").write_bytes(audio)


if __name__ == "__main__":
    unittest.main()
