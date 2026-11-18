import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(
  new URL("./package.json", import.meta.url),
);
const { chromium } = require("playwright");
const dir = mkdtempSync(join(tmpdir(), "memo-test-"));
const base = `http://127.0.0.1:${process.env.MEMOBOOK_PORT || 4827}`;
let browser, page;
try {
  const wav = join(dir, "learner.wav");
  execFileSync("say", [
    "-v",
    "Samantha",
    "-o",
    join(dir, "learner.aiff"),
    "I am a developer. I work on payments for small shops.",
  ]);
  execFileSync("ffmpeg", [
    "-loglevel",
    "error",
    "-i",
    join(dir, "learner.aiff"),
    "-af",
    "apad=pad_dur=2",
    "-ac",
    "1",
    "-ar",
    "44100",
    wav,
  ]);
  browser = await chromium.launch({
    channel: "chrome",
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--use-file-for-fake-audio-capture=" + wav,
    ],
  });
  page = await browser.newPage({
    permissions: ["microphone"],
    reducedMotion: "reduce",
  });
  page.setDefaultTimeout(90000);
  let spokenReplies = 0;
  await page.exposeFunction("heardMemo", () => {
    spokenReplies++;
  });
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor(...args) {
        super(...args);
        this.addEventListener(
          "playing",
          () => {
            window.memoPlayed = true;
            window.heardMemo();
          },
          { once: true },
        );
      }
    };
  });
  await page.goto(base + "/app");
  await page
    .getByLabel("What you want to practice")
    .fill("I have an interview for a payments engineering role on Thursday.");
  await page.getByRole("button", { name: "Start crafting" }).click();
  await page
    .getByRole("textbox", { name: "Your answer", exact: true })
    .fill("I want to describe the apps I build to a recruiter.");
  await page
    .getByRole("button", { name: "Send answer" })
    .click({ timeout: 3000 });
  await page.getByText("Your Memobook is ready").waitFor();
  await page
    .getByRole("textbox", { name: "Your answer", exact: true })
    .fill(
      "Focus on explaining the payment project to the engineering manager.",
    );
  await page.getByRole("button", { name: "Send answer" }).click();
  await page.getByRole("button", { name: "Create Memobook" }).click();
  await page.getByRole("heading", { name: "Ready when you are." }).waitFor();
  await page.getByRole("button", { name: /· 10 min/ }).click();
  await page
    .getByRole("combobox", { name: "Voice" })
    .selectOption({ label: "Puck" });
  await page.getByRole("button", { name: "15", exact: true }).click();
  await page.getByRole("button", { name: /Puck · 15 min/ }).click();
  await page.getByRole("button", { name: "Captions", exact: true }).click();
  if (process.env.MEMO_EVIDENCE_DIR)
    await page.screenshot({
      path: join(process.env.MEMO_EVIDENCE_DIR, "ready-book.png"),
    });
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("button", { name: "Stop live voice" }).click();
  await page.getByRole("button", { name: "Listen to Memo" }).click();
  await page.waitForFunction(() => window.memoPlayed === true);
  await page.getByRole("button", { name: "Record answer" }).click();
  await page.getByRole("button", { name: "Stop recording" }).waitFor();
  await page.waitForTimeout(7000);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page.waitForFunction(
    () =>
      /developer|payments|shops/i.test(
        document.querySelector("#answer")?.value || "",
      ),
    undefined,
    { timeout: 90000 },
  );
  await page.getByRole("button", { name: "Send answer" }).click();
  await page.locator(".turn.memo").nth(1).waitFor();
  await page
    .getByLabel("Your message")
    .fill("I am responsible of the payment apps since five years.");
  await page.getByRole("button", { name: "Send answer" }).click();
  await page.locator(".turn.memo").nth(2).waitFor();
  await page.getByRole("button", { name: "Review session" }).click();
  await page.getByRole("heading", { name: "Your session review" }).waitFor();
  if (process.env.MEMO_EVIDENCE_DIR) {
    await page.screenshot({
      path: join(process.env.MEMO_EVIDENCE_DIR, "session-review.png"),
      fullPage: true,
    });
  }
  assert.match(
    await page.locator("#original").innerText(),
    /developer|payments|shops|responsible/i,
  );
  await page.getByRole("button", { name: "Reveal phrase" }).first().click();
  const repair = await page.locator("#better").innerText();
  await page.getByLabel("From memory").first().fill(repair);
  await page.getByRole("button", { name: "Check answer" }).first().click();
  await page.getByText("You recalled it.").waitFor();
  await page.reload();
  await page.getByText("You recalled it.").waitFor();
  await page.getByRole("link", { name: "My Memobooks" }).click();
  await page
    .getByRole("link", { name: /Open Memobook/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("button", { name: "Stop live voice" }).click();
  const opening = await page.locator(".turn.memo").innerText();
  const stored = await page.evaluate(
    () =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith("memobook.local."))
        .map((k) => JSON.parse(localStorage.getItem(k)))[0],
  );
  const previous = stored.sessions[0];
  assert.equal(previous.endsAt - previous.at, 15 * 60000);
  assert.equal(previous.voice, "Rocko (English (US))");
  assert.equal(previous.captions, true);
  const reused = stored.sessions[1].phrase;
  assert.ok(previous.review.cards.some((card) => card.phrase === reused));
  assert.ok(opening.toLowerCase().includes(reused.toLowerCase()));
  assert.ok(spokenReplies > 0, "Browser played real generated speech");
  await page.reload();
  assert.equal(await page.locator(".turn.memo").innerText(), opening);
  await page
    .getByLabel("Your message")
    .fill("In my last role, I used the expression " + reused + " every day.");
  await page.getByRole("button", { name: "Send answer" }).click();
  await page.locator(".turn.memo").nth(1).waitFor();
  await page.locator("a.crumb").click();
  await page.getByText("You used it 1×", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Glossary", exact: true }).click();
  await page.getByLabel("Search glossary").fill(reused);
  await page
    .getByRole("heading", { name: reused, exact: true })
    .first()
    .waitFor();
  await page.getByRole("button", { name: "Open Studio metrics" }).click();
  const sessions = page
    .getByRole("tabpanel")
    .locator("dl.stats > div")
    .filter({ has: page.locator("dt", { hasText: "Speaking sessions" }) });
  assert.equal(await sessions.locator("dd").innerText(), "1");
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.getByRole("link", { name: "My Memobooks" }).click();
  await page
    .getByRole("link", { name: /Open Memobook/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Resume conversation" }).click();
  const count = await page.locator(".turn.learner").count();
  await page
    .getByRole("button", { name: "Start live voice" })
    .click({ timeout: 4000 });
  await page.locator(".turn.learner").nth(count).waitFor();
  await page.getByRole("button", { name: "Stop live voice" }).click();
  await page.getByRole("button", { name: "Start live voice" }).waitFor();
  console.log(
    JSON.stringify({
      liveVoice: true,
      voice: true,
      review: true,
      recall: true,
      persisted: true,
      repair,
      reused,
      spokenReplies,
      nextOpening: opening,
    }),
  );
} catch (error) {
  console.error(
    await page
      ?.locator("body")
      .innerText({ timeout: 2000 })
      .catch(() => "(no page)"),
  );
  throw error;
} finally {
  await browser?.close();
  rmSync(dir, { recursive: true, force: true });
}
