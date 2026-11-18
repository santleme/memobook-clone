import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const { chromium } = createRequire(new URL("./package.json", import.meta.url))("playwright");
const tmp = mkdtempSync(join(tmpdir(), "memo-pt-"));
const wav = join(tmp, "microphone.wav");
let browser;
try {
  execFileSync("say", ["-v", "Luciana", "-o", join(tmp, "input.aiff"),
    "A reunião de amanhã começa às nove. Preciso dos dados do painel até o meio-dia."]);
  execFileSync("ffmpeg", ["-loglevel", "error", "-i", join(tmp, "input.aiff"),
    "-af", "apad=pad_dur=3", "-ar", "44100", "-ac", "1", wav]);
  browser = await chromium.launch({channel: "chrome", args: ["--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream", "--use-file-for-fake-audio-capture=" + wav]});
  const page = await browser.newPage({permissions: ["microphone"]});
  page.setDefaultTimeout(90000);
  await page.goto(`http://127.0.0.1:${process.env.MEMOBOOK_PORT || 4827}/app`);
  await page.getByRole("button", {name: "Speak instead"}).click();
  const stop = page.getByRole("button", {name: "Stop recording"});
  await stop.waitFor();
  // Capture the full utterance including the final deadline before stopping the recorder.
  await page.waitForTimeout(6900);
  await stop.click();
  await page.waitForFunction(() => document.querySelector("#answer").value.includes("painel"));
  const text = await page.getByRole("textbox", {name: "What you want to practice"}).inputValue();
  for (const word of [/reunião/i,/amanhã/i,/dados/i,/painel/i,/meio.dia/i]) assert.match(text, word);
  await page.getByRole("button", {name: /Start crafting/}).click();
  await page.getByRole("textbox", {name: "Your answer", exact: true}).waitFor();
  const question = page.locator(".craft-dialog h3");
  await question.waitFor();
  const followup = await question.innerText();
  assert.match(followup, /você|qual|como|quem|que|precisa|dados|painel|reunião/i);
  assert.match(followup, /\?/);
  console.log(JSON.stringify({transcript:text,followup}));
} finally {
  await browser?.close();
  rmSync(tmp, {recursive:true,force:true});
}
