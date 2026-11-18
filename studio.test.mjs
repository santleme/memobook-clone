import { createRequire } from "node:module";
import assert from "node:assert/strict";
const { chromium } = createRequire(
  new URL("./package.json", import.meta.url),
)("playwright");
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({
    viewport: { width: 1366, height: 820 },
  });
  page.setDefaultTimeout(45000);
  const response = await page.goto(`http://127.0.0.1:${process.env.MEMOBOOK_PORT || 4827}/app`);
  assert.equal(response.status(), 200);
  await page
    .getByRole("heading", { name: "Where do you need the words?" })
    .waitFor();
  await page.getByRole("button", { name: "Work", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Giving a concise update in a fast daily stand-up",
    })
    .click();
  assert.match(
    await page
      .getByRole("textbox", { name: "What you want to practice" })
      .inputValue(),
    /stand-up/,
  );
  await page.getByRole("button", { name: "Hide suggested Memobooks" }).click();
  await page
    .getByRole("button", { name: "Show suggested Memobooks" })
    .waitFor();
  await page.getByRole("button", { name: "Tutor chat", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Ask your Memobook tutor" })
    .fill("What is the difference between since and for?");
  await page.getByRole("button", { name: "Send message" }).click();
  const reply = page.getByRole("log").locator(".memo p");
  await reply.first().waitFor();
  assert.match(await reply.first().innerText(), /since|for/i);
  await page.reload();
  await reply.first().waitFor();
  await page.getByRole("button", { name: "Glossary", exact: true }).click();
  await page.getByText("Your glossary starts with a session.").waitFor();
  await page.getByRole("button", { name: "Open Studio metrics" }).click();
  await page.getByRole("heading", { name: "Speaking activity" }).waitFor();
  await page.getByRole("tab", { name: "General" }).click();
  await page.getByRole("radio", { name: "Dark" }).check();
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.reload();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.getByRole("button", { name: "Collapse sessions panel" }).click();
  await page.getByRole("button", { name: "Expand sessions panel" }).click();
  await page.getByRole("button", { name: /Switch language Studio/ }).click();
  await page
    .getByRole("button", { name: /American English United States/ })
    .click();
  console.log(
    "PASS Studio creation, categories, tutor inference and history, glossary, metrics, appearance, sidebar, language chooser.",
  );
} finally {
  await browser.close();
}
