import { categories, questions } from "./studio-data.js";
import { learningSections, wireLearningSections } from "./method.js";
const app = document.querySelector("#app");
const notice = document.querySelector("#notice");
const prefix = "memobook.local.v1.";
let providerName = "Checking tutor connection…";
fetch("/api/provider").then(r => r.json()).then(({provider}) => {
  providerName = provider;
  document.querySelectorAll("[data-provider]").forEach(e => e.textContent = provider);
}).catch(() => { providerName = "Unavailable"; });
const scenarios = [
  ["Recruiter calls", "♧", "A recruiter wants a quick call with me tomorrow…"],
  ["Interviews", "♙", "I have a job interview on Thursday."],
  ["TOEFL", "♢", "I need to explain my opinion in the TOEFL speaking test."],
  ["IELTS", "▤", "I am preparing for an IELTS speaking interview."],
  [
    "Scholarships",
    "✧",
    "I want to explain why I am applying for a scholarship.",
  ],
  ["Visa", "▣", "I have a visa interview coming up."],
  ["Stand-ups", "▧", "I need to give my team a short project update."],
  ["Design critiques", "◉", "I am presenting my design to the team."],
  ["Demos", "▢", "I am demonstrating a new product to a customer."],
  [
    "Sales calls",
    "↗",
    "I want to understand what a prospective customer needs.",
  ],
  ["Customer calls", "☎", "A customer is calling about a delayed order."],
  ["Work", "▦", "I need to discuss my workload with my manager."],
  [
    "Explain & teach",
    "✎",
    "I want to explain a difficult idea to a classmate.",
  ],
  ["Negotiate & decide", "⇄", "I need to negotiate a new deadline."],
  ["Phone calls", "☏", "I have to reschedule a delivery over the phone."],
  ["Daily life", "☼", "I need to ask my neighbor for a favor."],
  [
    "Health & appointments",
    "✚",
    "I want to explain how I feel at an appointment.",
  ],
  ["Housing & services", "⌂", "I need to explain a repair to my landlord."],
  ["Travel", "✈", "I need to ask about a connection at the airport."],
  ["Social", "☻", "I want to introduce myself at a party."],
];
const steps = [
  [
    "Craft",
    "Start with a moment from your life.",
    "Describe the conversation coming up. Memo asks a follow-up and builds a Memobook around the person, the situation and your goal.",
  ],
  [
    "Speak",
    "Talk it through with Memo.",
    "Memo takes the other role. Answer out loud, listen to the reply and keep the conversation going in your own words.",
  ],
  [
    "Review",
    "Practice what you actually said.",
    "See a useful change to one of your lines. Recall the better version before you reveal it, then listen and try again.",
  ],
  [
    "Return",
    "Hear your words come back.",
    "Open the same Memobook for another session. Memo brings a phrase from your review into a new conversation.",
  ],
];
const html = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const $ = (selector) => app.querySelector(selector);
const on = (selector, event, fn) => $(selector)?.addEventListener(event, fn);
const key = (id) => prefix + id;
const load = (id) => JSON.parse(localStorage.getItem(key(id)));
const books = () =>
  Object.keys(localStorage)
    .filter((k) => k.startsWith(prefix))
    .map((k) => JSON.parse(localStorage.getItem(k)))
    .sort((a, b) => b.updated - a.updated);
const formatDate = (stamp) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(stamp);
const normalize = (value) =>
  value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .trim();
let audio;
let audioGeneration = 0;
let recording;
let pending = false;
let epoch = 0;
let craft = JSON.parse(sessionStorage.getItem("memo.craft") || "{}");

async function save(book) {
  await navigator.locks.request(key(book.id), () => {
    const current = load(book.id);
    if ((current?.revision || 0) !== (book.revision || 0))
      throw Error("This book changed in another tab. Reload to continue.");
    book.revision = (book.revision || 0) + 1;
    book.updated = Date.now();
    localStorage.setItem(key(book.id), JSON.stringify(book));
  });
}
async function api(path, data, audioInput = false, signal) {
  const response = await fetch("/api/" + path, {
    method: "POST",
    signal,
    headers: { "Content-Type": audioInput ? data.type : "application/json" },
    body: audioInput ? data : JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw Error(error.error || "Memo could not finish. Please try again.");
  }
  return path === "voice" ? response.blob() : response.json();
}
function stopAudio() {
  audioGeneration++;
  if (audio) {
    audio.pause();
    URL.revokeObjectURL(audio.src);
    audio = undefined;
  }
}
async function play(line, voice = pref("voice", "Samantha")) {
  stopAudio();
  const ticket = audioGeneration;
  try {
    const blob = await api("voice", { line, voice });
    if (ticket !== audioGeneration) return;
    audio = new Audio(URL.createObjectURL(blob));
    audio.onended = stopAudio;
    await audio.play();
  } catch (e) {
    if (ticket === audioGeneration)
      notice.textContent = "Use Listen to replay the line.";
  }
}
async function job(status, action) {
  if (pending) return;
  const view = epoch;
  pending = true;
  notice.textContent = status;
  app.setAttribute("aria-busy", "true");
  app.querySelectorAll("button:not(:disabled)").forEach((b) => {
    b.disabled = true;
    b.dataset.busy = "1";
  });
  try {
    await action(() => view === epoch);
    if (view === epoch) notice.textContent = "";
  } catch (e) {
    if (view === epoch) notice.textContent = e.message;
  } finally {
    pending = false;
    app.removeAttribute("aria-busy");
    app.querySelectorAll("[data-busy]").forEach((b) => {
      b.disabled = false;
      delete b.dataset.busy;
    });
  }
}
function page(content, narrow = true) {
  app.innerHTML =
    '<div class="page' + (narrow ? " narrow" : "") + '">' + content + "</div>";
}
function go(path) {
  if (location.hash === "#" + path) render();
  else location.hash = path;
}
function bookHref(book) {
  return "#book/" + book.id;
}
function back(book) {
  return (
    '<a class="crumb" href="' +
    (book ? bookHref(book) : "#library") +
    '">← ' +
    (book ? html(book.title) : "My Memobooks") +
    "</a>"
  );
}
function methodStep(i) {
  $("#method-copy").innerHTML =
    "<h3>" + steps[i][1] + "</h3><p>" + steps[i][2] + "</p>";
  app
    .querySelectorAll(".tabs button")
    .forEach((button, j) =>
      button.setAttribute("aria-selected", String(i === j)),
    );
}
function home() {
  app.innerHTML = `<section class="hero"><h1>Practice the conversation<br>before it happens.</h1>
    <p class="hero-copy">Your interview is Thursday. Your stand-up is every morning. Shape a Memobook around each one, talk it through in 🇺🇸 English with <img class="inline-memo" src="/book.svg" alt=""> Memo, and get better from what you actually said.</p>
    <div class="composer"><form id="compose" class="compose-field"><input id="situation" aria-label="Situation" maxlength="1800" autocomplete="off" placeholder="${scenarios[0][2]}"><button class="send" aria-label="Start crafting" disabled>⌃</button></form>
    <div class="chips">${scenarios.map(([name, symbol], i) => `<button type="button" class="chip ${i === 0 ? "active" : ""}" aria-label="${html(name)}" title="${html(name)}"><span class="symbol">${symbol}</span><span class="chip-text">${html(name)}</span></button>`).join("")}</div></div></section>
    <div class="ribbon" aria-hidden="true">Speak it. Fix it. Hear it again. Make it yours.　 Speak it. Fix it. Hear it again. Make it yours.</div>
    <section class="method" id="method"><h2>The method behind every Memobook.</h2><div class="tabs" role="tablist">${steps.map((s) => '<button role="tab">' + s[0] + "</button>").join("")}</div><div id="method-copy" role="tabpanel"></div></section>${learningSections()}`;
  app
    .querySelectorAll(".tabs button")
    .forEach((b, i) => (b.onclick = () => methodStep(i)));
  methodStep(0);
  wireLearningSections(app, (name) =>
    Array.from(app.querySelectorAll(".chip"))
      .find((b) => b.getAttribute("aria-label") === name)
      ?.click(),
  );
  on(
    "#situation",
    "input",
    () => ($(".send").disabled = !$("#situation").value.trim()),
  );
  app.querySelectorAll(".chip").forEach(
    (b, i) =>
      (b.onclick = () => {
        $(".chip.active")?.classList.remove("active");
        b.classList.add("active");
        $("#situation").value = scenarios[i][2];
        $(".send").disabled = false;
        $("#situation").focus();
      }),
  );
  bindCraftForm("#situation");
}
let craftRequest;
function rememberCraft() {
  sessionStorage.setItem("memo.craft", JSON.stringify(craft));
}
function bindCraftForm(field) {
  on("#compose", "submit", (e) => {
    e.preventDefault();
    const situation = $(field).value.trim();
    if (!situation) return;
    craft = {
      id: crypto.randomUUID(),
      situation,
      answer: "",
      history: [],
      detail: "",
    };
    rememberCraft();
    go("craft");
  });
}
async function prepareDraft(kind) {
  if (craftRequest) return;
  const request = new AbortController(),
    view = epoch,
    draft = craft;
  craftRequest = request;
  const answer = (draft.answer || "").trim();
  drawDraft();
  try {
    const payload = { situation: draft.situation };
    if (kind === "book") {
      payload.detail = answer;
      if (draft.preview) payload.previous = draft.preview;
    }
    const result = await api(kind, payload, false, request.signal);
    if (epoch !== view || request.signal.aborted) return;
    if (kind === "craft") draft.question = result.question;
    else {
      draft.history.push({
        memo: draft.preview?.goal || draft.question,
        answer,
      });
      draft.detail = draft.preview ? result.goal : answer;
      draft.preview = result;
      draft.answer = "";
    }
    rememberCraft();
  } catch (error) {
    if (epoch === view && !request.signal.aborted)
      notice.textContent = error.message;
  } finally {
    if (craftRequest === request) craftRequest = undefined;
    if (epoch === view) drawDraft();
  }
}
function crafting() {
  if (!craft.situation) return go("studio");
  craft.history ||= [];
  craft.id ||= crypto.randomUUID();
  craft.answer ??= craft.detail || "";
  drawDraft();
  if (!craft.question && !craft.preview) void prepareDraft("craft");
}
function drawDraft() {
  const proposal = craft.preview,
    busy = Boolean(craftRequest);
  const messages = [
    craft.situation,
    ...craft.history.flatMap((turn) => [turn.memo, turn.answer]),
  ];
  app.innerHTML = `<h1 class="document-title">Create a Memobook</h1><section class="creation craft-dialog" aria-label="Where do you need the words?">
  ${mascot}<h2>Where do you need the words?</h2><div class="craft-history">${messages
    .filter(Boolean)
    .map((m) => "<p>" + html(m) + "</p>")
    .join("")}</div>
  ${proposal || craft.question ? "<h3>" + html(proposal?.goal || craft.question) + "</h3>" : ""}
  ${proposal ? `<section class="draft-card" aria-label="${html(proposal.title)}"><small>Your Memobook is ready</small><h2>${html(proposal.title)}</h2><p>${html(proposal.goal)}</p><button id="create-book" class="primary" ${busy ? "disabled" : ""}>Create Memobook</button><p class="hint">Or keep talking below to change it.</p></section>` : ""}
  ${busy ? '<p role="status">Memo is thinking…</p>' : ""}
  <form class="compose-field" id="draft-form"><textarea id="answer" maxlength="1800" rows="1" aria-label="Your answer" placeholder="${proposal ? "Tell Memo what to change…" : "Reply to Memo…"}" ${busy ? "disabled" : ""}>${html(craft.answer || "")}</textarea><button type="button" id="record" class="mic" aria-label="Speak your answer" ${busy ? "disabled" : ""}>${icon("Mic")}</button>
  ${busy ? '<button type="button" class="send" id="stop-craft" aria-label="Stop response">■</button>' : '<button class="send" id="send" aria-label="Send answer" ' + (!craft.answer?.trim() ? "disabled" : "") + ">↑</button>"}</form>
  ${!busy && !craft.question && !proposal ? '<button id="retry-craft" class="secondary">Retry question</button>' : ""}</section>`;
  on("#stop-craft", "click", () => craftRequest?.abort());
  on("#retry-craft", "click", () => prepareDraft("craft"));
  on("#record", "click", () => microphone());
  on("#answer", "input", () => {
    craft.answer = $("#answer").value;
    rememberCraft();
    $("#send").disabled = !craft.answer.trim();
  });
  on("#answer", "keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!busy && craft.answer.trim()) $("#draft-form").requestSubmit();
    }
  });
  on("#draft-form", "submit", (e) => {
    e.preventDefault();
    if (!busy && craft.answer?.trim()) void prepareDraft("book");
  });
  on("#create-book", "click", () =>
    job("Creating your Memobook…", async (active) => {
      const book = {
        ...proposal,
        id: craft.id,
        situation: craft.situation,
        detail: craft.detail,
        sessions: [],
      };
      if (!load(book.id)) await save(book);
      if (!active()) return;
      sessionStorage.removeItem("memo.craft");
      sessionStorage.removeItem("memo.studio.prompt");
      craft = {};
      go("book/" + book.id);
    }),
  );
}
function level(book) {
  return book.sessions.filter((s) => s.review).at(-1)?.review.level;
}
function library() {
  const list = books();
  page(
    `<h1>My Memobooks</h1><p class="intro">Your situations, saved in this browser.</p><div class="actions"><a class="primary" href="#home">Craft a Memobook</a></div>
    <div class="books">${list
      .map(
        (
          b,
        ) => `<article class="book-card"><div class="meta"><span class="tag">${level(b) || "First practice"}</span><span>${b.sessions.filter((s) => s.review).length} reviewed</span></div>
    <h3>${html(b.title)}</h3><p>${html(b.goal)}</p><a class="card-link" href="${bookHref(b)}" aria-label="Open Memobook: ${html(b.title)}">Open Memobook →</a></article>`,
      )
      .join("")}</div>
    ${list.length ? "" : '<div class="panel"><h3>Your first conversation</h3><p>Choose a moment you want to rehearse and tell Memo about it.</p></div>'}`,
    false,
  );
}
function context(book, turns, returnPhrase = "") {
  return {
    about: pref("about", ""),
    situation: book.situation,
    detail: book.detail,
    goal: book.goal,
    role: book.role,
    level: level(book) || "",
    turns,
    returnPhrase,
  };
}
function vocabulary(book) {
  const phrases = new Map();
  for (const session of book.sessions) {
    for (const turn of session.turns) {
      const line = " " + normalize(turn.line) + " ";
      for (const [key, word] of phrases) {
        if (line.includes(" " + key + " ")) {
          if (turn.speaker === "Learner") word.used++;
          else word.heard++;
        }
      }
    }
    for (const card of session.review?.cards || []) {
      const key = normalize(card.phrase);
      if (!phrases.has(key))
        phrases.set(key, { phrase: card.phrase, used: 0, heard: 0 });
    }
  }
  return Array.from(phrases.values());
}
function returnPhrase(book) {
  const words = vocabulary(book);
  words.sort((a, b) => a.used - b.used || a.heard - b.heard);
  return words[0]?.phrase || "";
}
function phraseShelf(book) {
  const words = vocabulary(book);
  if (!words.length) return "";
  return (
    '<h2 class="section-title">Your words</h2><div class="word-shelf">' +
    words
      .map(
        (word) =>
          `<div class="word"><strong>${html(word.phrase)}</strong><div class="meta"><span>Memo used it ${word.heard}×</span><span>You used it ${word.used}×</span></div></div>`,
      )
      .join("") +
    "</div>"
  );
}
let sessionTimer, startLiveFor;
const voicePresets = {
  Kore: "Samantha",
  Aoede: "Flo (English (US))",
  Achird: "Eddy (English (US))",
  Achernar: "Shelley (English (US))",
  Gacrux: "Reed (English (US))",
  Sulafat: "Sandy (English (US))",
  Puck: "Rocko (English (US))",
  Charon: "Fred",
};
const voiceLabel = (voice) =>
  Object.keys(voicePresets).find((k) => voicePresets[k] === voice) || "Kore";
const expired = (session) =>
  Boolean(session.endsAt && session.endsAt <= Date.now());
function details(book, newSession = false) {
  const completed = book.sessions.filter((s) => s.review);
  const open =
    !newSession && book.sessions.findLast((s) => !s.review && !expired(s));
  const optionsKey = "memo.setup." + book.id;
  const options = JSON.parse(sessionStorage.getItem(optionsKey) || "{}");
  options.voice ||= open?.voice || pref("voice", "Samantha");
  options.minutes ||= open?.endsAt ? (open.endsAt - open.at) / 60000 : 10;
  options.captions ??= open?.captions ?? false;
  const label = () =>
    voiceLabel(options.voice) + " · " + options.minutes + " min";
  app.innerHTML = `<h1 class="document-title">${html(book.title)}</h1>
  <section class="book-ready" aria-label="Ready when you are."><div class="ready-center"><img class="ready-memo" src="/book.svg" alt="Memo"><h2>Ready when you are.</h2><p>Memo will join as ${html(/^(a|an|the|your) /i.test(book.role) ? book.role : "the " + book.role[0].toLowerCase() + book.role.slice(1))}.</p>
  <div class="ready-controls"><section class="ready-options" id="ready-options" hidden><label>Voice <select aria-label="Voice">${Object.entries(
    voicePresets,
  )
    .map(
      ([name, voice]) =>
        `<option value="${html(voice)}" ${options.voice === voice ? "selected" : ""}>${name}</option>`,
    )
    .join("")}</select></label>
  <div role="group" aria-label="Session length"><span>Length</span>${[10, 15, 20, 25, 30].map((n) => `<button data-length="${n}" aria-pressed="${n === options.minutes}">${n}</button>`).join("")}</div></section>
  <button id="setup" aria-expanded="false">${icon("SlidersHorizontal")} <span>${label()}</span></button><button id="cc" aria-label="Captions" aria-pressed="${options.captions}"><svg class="studio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="4"/><path d="M10 10a3 3 0 1 0 0 4m9-4a3 3 0 1 0 0 4"/></svg> Captions</button><button id="start">${icon("Mic")} ${open ? "Resume conversation" : "Start session"}</button></div></div></section>
  <section class="book-notes"><details class="history"><summary>About this Memobook</summary><p>${html(book.goal)}</p><p>${html(book.situation)}</p><button class="quiet" id="remove">Delete Memobook</button></details>
  ${phraseShelf(book)}${completed.length ? '<h2 class="section-title">Session history</h2>' : ""}
  ${completed
    .toReversed()
    .map(
      (s) =>
        `<article class="history"><a href="#review/${book.id}/${s.id}">${html(formatDate(s.at))} · ${s.review.level} · View review →</a><p>${html(s.review.strength)}</p></article>`,
    )
    .join("")}</section>`;
  const storeOptions = () => {
    sessionStorage.setItem(optionsKey, JSON.stringify(options));
    $("#setup span").textContent = label();
  };
  on("#setup", "click", () => {
    const panel = $("#ready-options");
    panel.hidden = !panel.hidden;
    $("#setup").setAttribute("aria-expanded", !panel.hidden);
  });
  on("select", "change", () => {
    options.voice = $("select").value;
    storeOptions();
  });
  app.querySelectorAll("[data-length]").forEach(
    (b) =>
      (b.onclick = () => {
        options.minutes = Number(b.dataset.length);
        storeOptions();
        app
          .querySelectorAll("[data-length]")
          .forEach((x) => x.setAttribute("aria-pressed", x === b));
      }),
  );
  on("#cc", "click", () => {
    options.captions = !options.captions;
    $("#cc").setAttribute("aria-pressed", options.captions);
    storeOptions();
  });
  on("#remove", "click", () => {
    if (
      !confirm(
        "Delete this Memobook, its transcripts and its practice history from this browser?",
      )
    )
      return;
    job("Deleting Memobook…", async () => {
      await navigator.locks.request(key(book.id), () => {
        for (const session of load(book.id)?.sessions || [])
          sessionStorage.removeItem("memo.draft." + session.id);
        localStorage.removeItem(key(book.id));
        localStorage.removeItem("memo.studio.tutor." + book.id);
        sessionStorage.removeItem(optionsKey);
      });
      go("library");
    });
  });
  on("#start", "click", () => {
    if (open)
      return job("Resuming…", async (active) => {
        open.voice = options.voice;
        open.captions = options.captions;
        open.endsAt = open.at + options.minutes * 60000;
        await save(book);
        if (active()) go("talk/" + book.id + "/" + open.id);
      });
    job("Memo is getting into character…", async (active) => {
      const phrase = returnPhrase(book);
      const { line } = await api("turn", context(book, [], phrase));
      if (!active()) return;
      const at = Date.now();
      const session = {
        id: crypto.randomUUID(),
        at,
        endsAt: at + options.minutes * 60000,
        voice: options.voice,
        captions: options.captions,
        turns: [{ speaker: "Memo", line }],
        phrase,
        draft: "",
      };
      book.sessions.push(session);
      await save(book);
      startLiveFor = session.id;
      go("talk/" + book.id + "/" + session.id);
    });
  });
}
function turnsHtml(turns) {
  return turns
    .map(
      (
        t,
        i,
      ) => `<div class="turn ${t.speaker === "Memo" ? "memo" : "learner"}"><div class="speaker">${t.speaker === "Memo" ? '<img src="/book.svg" alt="">Memo' : "You"}
    ${t.speaker === "Memo" ? '<button type="button" class="voice" data-line="' + i + '" aria-label="Listen to Memo">▷ Listen</button>' : ""}</div><p>${html(t.line)}</p></div>`,
    )
    .join("");
}
function attachVoice(turns, voice) {
  app
    .querySelectorAll("[data-line]")
    .forEach(
      (b) =>
        (b.onclick = () => play(turns[Number(b.dataset.line)].line, voice)),
    );
}
function cancelRecording() {
  if (!recording) return;
  recording.cancelled = true;
  clearTimeout(recording.timer);
  if (recording.media.state !== "inactive") recording.media.stop();
  recording.stream.getTracks().forEach((track) => track.stop());
  recording = undefined;
}
async function microphone(session) {
  const isCraft = !session;
  const idleLabel = $("#record").getAttribute("aria-label");
  if (recording) {
    recording.media.stop();
    return;
  }
  const view = epoch;
  stopAudio();
  const button = $("#record");
  button.disabled = true;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (view !== epoch) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/mp4"].find((type) =>
      MediaRecorder.isTypeSupported(type),
    );
    if (!mime)
      throw Error(
        "This browser cannot record this format. Type your answer or open Chrome.",
      );
    const media = new MediaRecorder(stream, { mimeType: mime });
    const current = { media, stream, parts: [], started: performance.now() };
    recording = current;
    button.disabled = false;
    button.textContent = "Stop recording";
    $("#send").disabled = true;
    if ($("#live")) $("#live").disabled = true;
    if ($("#review")) $("#review").disabled = true;
    media.ondataavailable = (e) => {
      if (e.data.size) current.parts.push(e.data);
    };
    media.onstop = () => {
      const recordedMs = performance.now() - current.started;
      clearTimeout(current.timer);
      stream.getTracks().forEach((t) => t.stop());
      if (recording === current) recording = undefined;
      if (view !== epoch || current.cancelled) return;
      if (isCraft) button.innerHTML = icon("Mic");
      else button.textContent = "Record answer";
      if (isCraft) button.setAttribute("aria-label", idleLabel);
      $("#send").disabled = false;
      if ($("#live")) $("#live").disabled = false;
      if ($("#review")) $("#review").disabled = session.turns.length < 3;
      job("Transcribing your answer…", async (active) => {
        const { text } = await api(
          "listen",
          new Blob(current.parts, { type: mime }),
          true,
        );
        if (!active()) return;
        if (session)
          session.practiceMs = (session.practiceMs || 0) + recordedMs;
        $("#answer").value = [$("#answer").value.trim(), text]
          .filter(Boolean)
          .join(" ")
          .slice(0, 1800);
        $("#answer").dispatchEvent(new Event("input"));
      });
    };
    if (isCraft) button.setAttribute("aria-label", "Stop recording");
    media.start();
    current.timer = setTimeout(() => {
      if (media.state === "recording") media.stop();
    }, 90000);
  } catch (e) {
    stream?.getTracks().forEach((t) => t.stop());
    if (view === epoch) {
      button.disabled = false;
      notice.textContent =
        e.name === "NotAllowedError"
          ? "Allow microphone access or type your answer."
          : e.message;
    }
  }
}
let liveController;
function endLiveVoice() {
  liveController?.abort();
  liveController = undefined;
}
async function listenUntilPause(stream, meter, signal) {
  signal.throwIfAborted();
  const type = ["audio/webm;codecs=opus", "audio/mp4"].find((x) =>
    MediaRecorder.isTypeSupported(x),
  );
  if (!type) throw Error("Voice recording is unavailable in this browser.");
  const recorder = new MediaRecorder(stream, { mimeType: type });
  const samples = new Float32Array(meter.fftSize),
    chunks = [];
  return new Promise((resolve, reject) => {
    let voiced = 0,
      lastVoice = 0,
      failure;
    const start = performance.now();
    const stop = () => {
      if (recorder.state !== "inactive") recorder.stop();
    };
    const timer = setInterval(() => {
      meter.getFloatTimeDomainData(samples);
      const now = performance.now();
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      if (Math.sqrt(sum / samples.length) > 0.014) {
        voiced++;
        lastVoice = now;
      }
      if (voiced >= 3 && now - lastVoice > 1050) stop();
      else if (now - start > 60000 || (!voiced && now - start > 30000)) {
        if (voiced < 3)
          failure = Error("No speech detected. Start live voice to try again.");
        stop();
      }
    }, 80);
    const clean = () => {
      clearInterval(timer);
      signal.removeEventListener("abort", stop);
    };
    signal.addEventListener("abort", stop, { once: true });
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onerror = () => {
      clean();
      reject(Error("The microphone stopped recording."));
    };
    recorder.onstop = () => {
      clean();
      if (signal.aborted) reject(signal.reason);
      else if (failure) reject(failure);
      else
        resolve({
          blob: new Blob(chunks, { type }),
          duration: performance.now() - start,
        });
    };
    recorder.start();
  });
}
async function speakLive(line, signal, voice = pref("voice", "Samantha")) {
  const blob = await api("voice", { line, voice, live: true }, false, signal);
  signal.throwIfAborted();
  const src = URL.createObjectURL(blob),
    player = new Audio(src);
  try {
    await new Promise((resolve, reject) => {
      const stopped = () => {
        player.pause();
        reject(signal.reason);
      };
      signal.addEventListener("abort", stopped, { once: true });
      const clean = () => signal.removeEventListener("abort", stopped);
      player.onended = () => {
        clean();
        resolve();
      };
      player.onerror = () => {
        clean();
        reject(Error("Memo could not play the reply."));
      };
      player.play().catch((e) => {
        clean();
        reject(e);
      });
    });
  } finally {
    URL.revokeObjectURL(src);
  }
}
async function liveVoice(book, session) {
  if (liveController) {
    endLiveVoice();
    return;
  }
  const controller = new AbortController(),
    signal = controller.signal,
    view = epoch;
  liveController = controller;
  stopAudio();
  talk(book, session);
  let stream, ctx;
  let message = "";
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    signal.throwIfAborted();
    signal.addEventListener(
      "abort",
      () => stream.getTracks().forEach((t) => t.stop()),
      { once: true },
    );
    ctx = new AudioContext();
    await ctx.resume();
    const meter = ctx.createAnalyser();
    ctx.createMediaStreamSource(stream).connect(meter);
    while (session.turns.length < 41 && !expired(session)) {
      signal.throwIfAborted();
      stream.getAudioTracks().forEach((t) => (t.enabled = false));
      notice.textContent = "Memo is speaking…";
      await speakLive(session.turns.at(-1).line, signal, session.voice);
      signal.throwIfAborted();
      stream.getAudioTracks().forEach((t) => (t.enabled = true));
      notice.textContent = "Listening… Pause when you finish your answer.";
      const { blob, duration } = await listenUntilPause(stream, meter, signal);
      stream.getAudioTracks().forEach((t) => (t.enabled = false));
      notice.textContent = "Memo is preparing a reply…";
      const { text } = await api("listen", blob, true);
      signal.throwIfAborted();
      const turns = [...session.turns, { speaker: "Learner", line: text }];
      const reply = await api("turn", context(book, turns));
      signal.throwIfAborted();
      session.turns = [...turns, { speaker: "Memo", line: reply.line }];
      session.practiceMs = (session.practiceMs || 0) + duration;
      await save(book);
      signal.throwIfAborted();
      talk(book, session);
    }
  } catch (e) {
    if (!signal.aborted)
      message =
        e.name === "NotAllowedError"
          ? "Allow microphone access to use live voice."
          : e.message;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
    if (ctx) await ctx.close();
    if (liveController === controller) liveController = undefined;
    if (view === epoch && !liveController) {
      const saved = load(book.id);
      if (saved) {
        talk(
          saved,
          saved.sessions.find((s) => s.id === session.id),
        );
      } else {
        go("library");
      }
      notice.textContent = message;
    }
  }
}

function talk(book, session) {
  if (session.review) return go("review/" + book.id + "/" + session.id);
  const draftKey = "memo.draft." + session.id;
  const limit = session.turns.length >= 41 || expired(session);
  clearTimeout(sessionTimer);
  if (session.endsAt && !limit)
    sessionTimer = setTimeout(render, Math.max(1, session.endsAt - Date.now()));
  page(`${back(book)}<h2>${html(book.title)}</h2><p class="hint">In conversation with ${html(book.role)}</p>
    <div class="actions">${limit ? "" : '<button class="secondary" id="live">' + (liveController ? "Stop live voice" : "Start live voice") + "</button>"}</div>
    <div class="conversation" ${liveController && session.captions === false ? "hidden" : ""}>${turnsHtml(session.turns)}</div>
    ${
      limit
        ? "<p>This session is ready for review.</p>"
        : `<form id="message"><label class="form-label" for="answer">Your message</label><textarea maxlength="1800" id="answer" rows="2" placeholder="Speak or write in English…">${html(sessionStorage.getItem(draftKey) || "")}</textarea>
    <div class="actions"><button class="secondary" type="button" id="record">Record answer</button><button class="primary" id="send">Send answer</button></div></form>`
    }
    <div class="actions"><button id="review" class="quiet" ${session.turns.length < 3 ? "disabled" : ""}>Review session</button></div>`);
  attachVoice(session.turns, session.voice);
  on("#live", "click", () => liveVoice(book, session));
  if (liveController)
    app
      .querySelectorAll("#message button,#answer,#review,[data-line]")
      .forEach((e) => (e.disabled = true));
  on("#record", "click", () => microphone(session));
  on("#answer", "input", () =>
    sessionStorage.setItem(draftKey, $("#answer").value),
  );
  on("#message", "submit", (e) => {
    e.preventDefault();
    const line = $("#answer").value.trim();
    if (!line || recording) return;
    stopAudio();
    job("Memo is listening…", async (active) => {
      const turns = [...session.turns, { speaker: "Learner", line }];
      const reply = await api("turn", context(book, turns));
      if (!active()) return;
      session.turns = [...turns, { speaker: "Memo", line: reply.line }];
      await save(book);
      sessionStorage.removeItem(draftKey);
      talk(book, session);
      $("#answer")?.focus();
      void play(reply.line, session.voice);
    });
  });
  on("#review", "click", () =>
    job("Reviewing your own words…", async (active) => {
      stopAudio();
      const report = await api("review", context(book, session.turns));
      if (!active()) return;
      session.review = report;
      await save(book);
      sessionStorage.removeItem(draftKey);
      go("review/" + book.id + "/" + session.id);
    }),
  );
}
function review(book, session) {
  if (!session.review) return go("talk/" + book.id + "/" + session.id);
  const { strength, level, cards } = session.review;
  const lines = session.turns.filter((t) => t.speaker === "Learner");
  page(`${back(book)}<h1>Your session review</h1><p class="intro">${html(book.title)} · Estimated ${level}</p>
    <div class="panel"><p class="label">What worked</p><p>${html(strength)}</p></div>
    ${cards
      .map(
        (
          card,
          i,
        ) => `<article class="review-card recall"><p class="label">You said</p><p class="quote" ${i === 0 ? 'id="original"' : ""}>${html(lines[card.turn].line)}</p><p class="intro">${html(card.reason)}</p>
      <form data-card="${i}"><label class="form-label" for="repair-${i}">From memory</label><input class="input" id="repair-${i}" maxlength="1800" autocomplete="off" placeholder="Try the whole phrase…">
      <div class="actions"><button class="primary">Check answer</button><button type="button" class="secondary reveal">Reveal phrase</button></div></form>
      <div class="target" hidden><p class="label">A natural way to say it</p><p class="quote" ${i === 0 ? 'id="better"' : ""}>${html(card.better)}</p><button class="voice listen">▷ Listen to phrase</button></div>
      <p class="result ${card.recalled ? "success" : ""}" aria-live="polite">${card.recalled ? "You recalled it." : ""}</p></article>`,
      )
      .join("")}
    <details class="history"><summary>Conversation transcript</summary><div class="conversation">${turnsHtml(session.turns)}</div></details>
    <div class="actions"><a class="primary" href="${bookHref(book)}">Return to Memobook</a></div>`);
  attachVoice(session.turns, session.voice);
  app.querySelectorAll("[data-card]").forEach((form) => {
    const card = cards[Number(form.dataset.card)];
    const article = form.closest("article");
    const reveal = article.querySelector(".reveal");
    const target = article.querySelector(".target");
    reveal.onclick = () => {
      target.hidden = !target.hidden;
      reveal.textContent = target.hidden ? "Reveal phrase" : "Hide phrase";
    };
    article.querySelector(".listen").onclick = () => play(card.better);
    form.onsubmit = (e) => {
      e.preventDefault();
      const result = article.querySelector(".result");
      const answer = form.querySelector("input").value;
      if (normalize(answer) !== normalize(card.better)) {
        result.textContent = "Try again. Reveal the phrase if you need a hint.";
        return;
      }
      job("Saving practice…", async () => {
        card.recalled = true;
        await save(book);
        result.classList.add("success");
        result.textContent = "You recalled it.";
        target.hidden = true;
        reveal.textContent = "Reveal phrase";
      });
    };
  });
}
const sidebar = document.querySelector("#sidebar");
const dialog = document.querySelector("#studio-dialog");
const pref = (name, fallback) =>
  localStorage.getItem("memo.studio." + name) ?? fallback;
const setPref = (name, value) =>
  localStorage.setItem("memo.studio." + name, value);
const studioRoutes = {
  studio: "New Memobook",
  tutor: "Tutor chat",
  glossary: "Glossary",
};
const symbols = [
  "BriefcaseBusiness",
  "House",
  "Users",
  "Plane",
  "CircleAlert",
  "Phone",
  "Presentation",
  "MessageCircleQuestion",
  "Handshake",
  "BookText",
  "ContactRound",
  "Cross",
  "Building2",
  "Heart",
  "FileText",
  "TriangleAlert",
  "HandHeart",
];
const icon = (name) =>
  '<svg class="studio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="/icons.svg#' +
  name +
  '"></use></svg>';
const mascot =
  '<span class="studio-mascot"><img src="/book.svg" alt="English practice book"><small aria-hidden="true">🇺🇸</small></span>';
function setShell(route, id) {
  const active = !["home", "method"].includes(route);
  document.body.classList.toggle("inside-studio", active);
  document.documentElement.dataset.theme = active
    ? pref("theme", "light")
    : "light";
  sidebar.hidden = !active;
  if (!active) return;
  const mobile = matchMedia("(max-width:740px)").matches;
  const panelPref = mobile ? "mobile-sidebar" : "sidebar";
  const collapsed = pref(panelPref, mobile ? "closed" : "open") === "closed";
  document.body.classList.toggle("compact-sidebar", collapsed);
  const list = books();
  sidebar.innerHTML = `<div class="side-top"><a class="brand" href="#studio" aria-label="Memobook"><img src="/book.svg" alt=""><span>Memobook</span></a><button class="icon-btn" id="collapse" aria-label="${collapsed ? "Expand" : "Collapse"} sessions panel">${icon("PanelLeft")}</button></div>
    <div class="side-links">${Object.entries(studioRoutes)
      .map(
        ([target, name], i) =>
          `<button data-target="${target}" aria-label="${name}" aria-pressed="${route === target}"><i>${icon(["BookPlus", "MessagesSquare", "BookOpen"][i])}</i><span>${name}</span></button>`,
      )
      .join("")}${collapsed ? '<button id="show-sessions" aria-label="Sessions">' + icon("BookOpen") + '<span>Sessions</span></button>' : ""}</div>
    <div class="side-line"><a href="#library" aria-label="My Memobooks">Memobooks</a><button class="icon-btn" aria-label="Open Studio metrics" id="metrics">${icon("ChartNoAxesCombined")}</button></div>
    <nav class="side-books" aria-label="American English memobooks">${list
      .map((book) => {
        const setting = sessionStorage.getItem("memo.tree." + book.id);
        const expanded = setting === null ? id === book.id : setting === "open";
        return `<div class="side-book-row"><button data-tree="${book.id}" aria-expanded="${expanded}" aria-label="${expanded ? "Collapse" : "Expand"} ${html(book.title)} sessions">${icon("BookOpen")}</button><a href="${bookHref(book)}" class="${id === book.id ? "selected" : ""}"><span>${html(book.title)}</span></a></div><div class="side-session-links" ${expanded ? "" : "hidden"}><a href="#new-session/${book.id}" aria-label="Start a new session">⊕　Start a new session</a>${book.sessions
          .toReversed()
          .map(
            (session) =>
              `<a href="#${session.review ? "review" : "talk"}/${book.id}/${session.id}">${html(formatDate(session.at))}</a>`,
          )
          .join("")}</div>`;
      })
      .join("")}</nav>
    <div class="side-foot"><button id="lang" aria-label="Switch language Studio. Current: American English"><i>🇺🇸</i><span>American English</span>⌄</button><button class="icon-btn" id="settings" aria-label="Settings">${icon("SlidersHorizontal")}</button></div>`;
  sidebar.querySelectorAll("[data-target]").forEach(
    (b) =>
      (b.onclick = () => {
        if (mobile) setPref(panelPref, "closed");
        go(["tutor", "glossary"].includes(b.dataset.target) && id ? b.dataset.target + "/" + id : b.dataset.target);
      }),
  );
  sidebar.querySelectorAll("[data-tree]").forEach(
    (button) =>
      (button.onclick = () => {
        const expanded = button.getAttribute("aria-expanded") === "true";
        sessionStorage.setItem(
          "memo.tree." + button.dataset.tree,
          expanded ? "closed" : "open",
        );
        setShell(route, id);
      }),
  );
  sidebar.querySelector("#collapse").onclick = () => {
    setPref(panelPref, collapsed ? "open" : "closed");
    setShell(route, id);
  };
  const sessionsButton = sidebar.querySelector("#show-sessions");
  if (sessionsButton) sessionsButton.onclick = sidebar.querySelector("#collapse").onclick;
  sidebar.querySelector("#metrics").onclick = () => settings("Metrics");
  sidebar.querySelector("#settings").onclick = () => settings("General");
  sidebar.querySelector("#lang").onclick = () => {
    dialog.innerHTML =
      '<h2>Switch Studio</h2><p>Choose a language</p><button class="dialog-option" aria-label="American English United States. Current Studio">🇺🇸　American English <small>United States. Current Studio　✓</small></button>';
    dialog.querySelector("button").onclick = () => dialog.close();
    if (!dialog.open) dialog.showModal();
  };
}
function studio() {
  const draft = sessionStorage.getItem("memo.studio.prompt") || "";
  const choices = Object.keys(categories);
  const open = pref("suggestions", "open") === "open";
  const gaps = books()
    .map((b) => ({
      b,
      card: b.sessions
        .filter((s) => s.review)
        .at(-1)
        ?.review.cards.find((c) => !c.recalled),
    }))
    .filter((x) => x.card)
    .slice(0, 3);
  const latest = books()
    .flatMap((b) => b.sessions.map((s) => s.at))
    .sort((a, b) => b - a)[0];
  app.innerHTML = `<h1 class="document-title">Create a Memobook</h1><section class="creation">
    ${mascot}<h2>Where do you need the words?</h2><form id="compose" class="compose-field"><textarea rows="1" id="answer" maxlength="1800" aria-label="What you want to practice" placeholder="Tell Memo what is happening, who is there, and what feels difficult…">${html(draft)}</textarea>
    <button type="button" class="mic" id="record" aria-label="Speak instead">${icon("Mic")}</button><button id="send" class="send" aria-label="Start crafting a memobook" ${!draft.trim() ? "disabled" : ""}>${icon("ChevronUp")}</button></form>
    <div class="studio-categories" role="group" aria-label="Conversation categories">${choices.map((c, i) => `<button aria-label="${html(c)}" title="${html(c)}" aria-pressed="false"><i>${icon(symbols[i])}</i><span>${html(c)}</span></button>`).join("")}</div>
    <div class="scenario-list"></div></section>
    <section class="suggestions"><div><h3>Suggested for you</h3><button class="icon-btn" aria-label="${open ? "Hide" : "Show"} suggested Memobooks" aria-expanded="${open}">${open ? "⌃" : "⌄"}</button></div>
    <div class="suggestion-content" ${open ? "" : "hidden"}>${gaps.length ? gaps.map(({ b, card }) => `<a href="${bookHref(b)}">${html(b.title)} · Practice “${html(card.phrase)}” →</a>`).join("") : "No reliable gap to suggest yet. Memo will keep listening across reviewed sessions."}</div></section>
    ${latest && Date.now() - latest > 3 * 86400000 && pref("reminders", "on") === "on" ? '<a class="practice-reminder" href="#library">Ready for another speaking session? Open your Memobooks.</a>' : ""}`;
  const field = $("#answer");
  field.oninput = () => {
    sessionStorage.setItem("memo.studio.prompt", field.value);
    $("#send").disabled = !field.value.trim();
  };
  field.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (field.value.trim()) $("#compose").requestSubmit();
    }
  };
  on("#record", "click", () => microphone());
  bindCraftForm("#answer");
  app.querySelectorAll(".studio-categories button").forEach(
    (b) =>
      (b.onclick = () => {
        const chosen = b.getAttribute("aria-pressed") !== "true";
        app
          .querySelectorAll(".studio-categories button")
          .forEach((c) =>
            c.setAttribute("aria-pressed", String(c === b && chosen)),
          );
        const list = chosen ? categories[b.getAttribute("aria-label")] : [];
        $(".scenario-list").innerHTML = list
          .map((s) => "<button>" + html(s) + "</button>")
          .join("");
        app.querySelectorAll(".scenario-list button").forEach(
          (c) =>
            (c.onclick = () => {
              field.value = c.textContent;
              field.dispatchEvent(new Event("input"));
              field.focus();
            }),
        );
      }),
  );
  const toggle = $(".suggestions button");
  toggle.onclick = () => {
    const content = $(".suggestion-content");
    content.hidden = !content.hidden;
    const show = !content.hidden;
    setPref("suggestions", show ? "open" : "closed");
    toggle.textContent = show ? "⌃" : "⌄";
    toggle.setAttribute("aria-expanded", show);
    toggle.setAttribute(
      "aria-label",
      (show ? "Hide" : "Show") + " suggested Memobooks",
    );
  };
}
function tutorMarkup(answer) {
  const inline = (value) => html(value).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return answer.split(/\n\s*\n/).map((part) => {
    if (/^#{1,4} /.test(part)) return "<h3>" + inline(part.replace(/^#{1,4} /, "")) + "</h3>";
    if (part.startsWith(">")) return "<blockquote>" + inline(part.replace(/^> ?/gm, "")) + "</blockquote>";
    return "<p>" + inline(part) + "</p>";
  }).join("");
}
const bookQuestions = {
  Patterns: ["Which mistakes keep returning across my sessions?", "Show me the grammar patterns I still struggle with.", "Which vocabulary choices have sounded unnatural more than once?", "Is there a pronunciation pattern I should prioritize?"],
  Progress: ["How has my English improved?", "Which phrases am I using more confidently?"],
  Practice: ["What should I practise next?", "Help me prepare for a difficult follow-up question."],
};
function tutorChat() {
  const book = load(location.hash.split("/")[1] || "") || undefined;
  const storage = book ? "tutor." + book.id : "tutor";
  const groups = book ? bookQuestions : questions;
  const history = JSON.parse(pref(storage, "[]"));
  const chatRevision = pref("clearedChats", "");
  const resetStamp = localStorage.getItem("memo.reset");
  app.innerHTML = `<h1 class="document-title">${html(book?.title || "Memobook")}</h1><section class="tutor-view ${history.length ? "has-history" : ""}" aria-label="${html(book?.title || "Memobook")} tutor chat"><div role="log">
    ${history.length ? '<div class="conversation">' + history.map((line, i) => `<div class="turn ${i % 2 ? "memo" : "learner"}"><div class="speaker">${i % 2 ? "Memo" : "You"}</div>${i % 2 ? tutorMarkup(line) : "<p>" + html(line) + "</p>"}</div>`).join("") + "</div>" : '<button class="wave" aria-label="Wave to Memo">' + mascot + "</button><h2>What do you want to understand?</h2>"}</div>
    <form class="compose-field" id="chat-form"><textarea rows="2" id="question" maxlength="1800" aria-label="Ask your Memobook tutor" placeholder="${book ? "Ask about your sessions, mistakes, or progress…" : "Ask how Memobook works, or for a Memobook to craft…"}"></textarea>${book ? '<select id="chat-session" aria-label="Choose a session as context"><option value="">My sessions</option>' + book.sessions.map(s => '<option value="'+html(s.id)+'">'+html(formatDate(s.at))+'</option>').join('') + '</select>' : ""}<button class="send" aria-label="Send message" disabled>↑</button></form>
    <div class="tutor-types">${Object.keys(groups)
      .map((name) => "<button>" + name + "</button>")
      .join("")}</div><div class="scenario-list"></div></section>`;
  const field = $("#question");
  field.onkeydown = event => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      $("#chat-form").requestSubmit();
    }
  };
  const transcript = $(".tutor-view .conversation");
  if (transcript) transcript.scrollTop = transcript.scrollHeight;
  field.oninput = () => ($(".send").disabled = !field.value.trim());
  function select(group) {
    app
      .querySelectorAll(".tutor-types button")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.textContent === group)),
      );
    $(".scenario-list").innerHTML = groups[group]
      .map((q) => "<button>" + html(q) + "</button>")
      .join("");
    app.querySelectorAll(".scenario-list button").forEach(
      (b) =>
        (b.onclick = () => {
          field.value = b.textContent;
          field.dispatchEvent(new Event("input"));
          $("#chat-form").requestSubmit();
        }),
    );
  }
  app
    .querySelectorAll(".tutor-types button")
    .forEach((b) => (b.onclick = () => select(b.textContent)));
  select(Object.keys(groups)[0]);
  on(".wave", "click", () => {
    void play("Hi! What do you want to understand?");
  });
  on("#chat-form", "submit", (e) => {
    e.preventDefault();
    const line = field.value.trim();
    if (!line) return;
    job("Memo is thinking…", async (active) => {
      const next = [...history, line];
      const selected = book?.sessions.find(s => s.id === $("#chat-session")?.value);
      const context = book ? [book.title, book.goal, book.role, ...(selected?.turns || []).map(t => t.speaker + ": " + t.line)].join("\n").slice(0,6000) : "";
      const { answer } = await api("chat", { turns: next.slice(-15), context });
      if (!active()) return;
      await navigator.locks.request("memo.studio.tutor", () => {
        if ((book && !load(book.id)) || chatRevision !== pref("clearedChats", "") ||
            resetStamp !== localStorage.getItem("memo.reset") || JSON.stringify(history) !== pref(storage, "[]"))
          throw Error(
            "This conversation changed in another tab. Reload to continue.",
          );
        setPref(storage, JSON.stringify([...next, answer].slice(-100)));
      });
      tutorChat();
      $("#question").focus();
    });
  });
}
function glossary() {
  const book = load(location.hash.split("/")[1] || "");
  const entries = books().flatMap((book) =>
    book.sessions.flatMap((session) =>
      (session.review?.cards || []).map((card) => ({ card, book })),
    ),
  );
  const unique = new Map(
    entries.map((entry) => [normalize(entry.card.phrase), entry]),
  );
  app.innerHTML = `<h1 class="document-title">${html(book?.title || "Memobook")}</h1><section class="glossary" aria-label="Glossary"><h2>Glossary</h2><p>Words and expressions from your sessions.</p>
    ${unique.size ? '<label class="form-label" for="find-word">Search glossary</label><input class="input" id="find-word" autocomplete="off"><div id="found"></div>' : '<div class="glossary-empty">' + icon("BookText") + '<h3>Your glossary starts with a session.</h3><p>Useful words, idioms, and expressions from practice collect here.</p></div>'}</section>`;
  if (!unique.size) return;
  const show = () => {
    const results = [...unique.values()].filter(({ card }) =>
      normalize(card.phrase).includes(normalize($("#find-word").value)),
    );
    $("#found").innerHTML =
      results
        .map(
          ({ card, book }, i) =>
            `<article class="history"><h3>${html(card.phrase)}</h3><p>${html(card.better)}</p><a class="crumb" href="${bookHref(book)}">${html(book.title)}</a> <button class="voice" data-listen="${i}">▷ Listen</button></article>`,
        )
        .join("") || "<p>No matching expressions.</p>";
    app
      .querySelectorAll("[data-listen]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            play(results[Number(b.dataset.listen)].card.better)),
      );
  };
  $("#find-word").oninput = show;
  show();
}
function progress(list) {
  const sessions = list
    .flatMap((b) => b.sessions)
    .filter((s) => s.review)
    .sort((a, b) => a.at - b.at);
  const dayNumber = (time) => {
    const d = new Date(time);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
  };
  const days = new Map();
  for (const s of sessions) {
    const key = dayNumber(s.at);
    days.set(key, (days.get(key) || 0) + 1);
  }
  let longest = 0,
    run = 0,
    last;
  for (const day of days.keys()) {
    run = day === last + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    last = day;
  }
  const today = dayNumber(Date.now());
  const level = sessions.at(-1)?.review.level || "—";
  const minutes = Math.round(
    sessions.reduce((a, s) => a + (s.practiceMs || 0), 0) / 60000,
  );
  const cards = sessions.flatMap((s) => s.review.cards);
  return {
    sessions,
    minutes,
    level,
    days,
    today,
    longest,
    current: last >= today - 1 ? run : 0,
    mastered: cards.filter((c) => c.recalled).length,
    open: cards.filter((c) => !c.recalled).length,
  };
}
const settingsTabs = [
  "General",
  "Voice",
  "Notifications",
  "Metrics",
  "Plan",
  "Usage",
  "About you",
  "Data & privacy",
  "Account",
];
const voices = Object.values(voicePresets);
function settings(tab) {
  const list = books(),
    stats = progress(list);
  const defs = (items) =>
    '<dl class="stats">' +
    items
      .map(([n, v]) => `<div><dt>${html(n)}</dt><dd${n === "Tutor and speech" ? " data-provider" : ""}>${html(v)}</dd></div>`)
      .join("") +
    "</dl>";
  const radios = (label, items, current) =>
    `<fieldset><legend>${label}</legend>${items.map(([name, value]) => `<label><input type="radio" name="${label}" value="${html(value)}" ${current === value ? "checked" : ""}>${html(name)}</label>`).join("")}</fieldset>`;
  const sections = {
    General:
      radios(
        "Appearance",
        [
          ["Light", "light"],
          ["Dark", "dark"],
        ],
        pref("theme", "light"),
      ) +
      "<h4>Language</h4><p>American English</p><p>Levels update from assessed speaking sessions.</p>",
    Voice:
      "<p>Your tutor’s voice for American English sessions.</p>" +
      radios(
        "Tutor voices",
        voices.map((v) => [voiceLabel(v), v]),
        pref("voice", "Samantha"),
      ) +
      '<button class="secondary" id="preview-voice">▷ Listen to voice</button>',
    Notifications:
      "<p>Lesson ready · Appears when session analysis finishes.</p>" +
      radios(
        "Practice reminders",
        [
          ["On", "on"],
          ["Off", "off"],
        ],
        pref("reminders", "on"),
      ) +
      "<p>Show a reminder in this Studio when you return after a few days.</p>",
    Metrics:
      "<p>Progress from saved American English sessions.</p><h4>American English</h4>" +
      defs([
        ["Speaking sessions", stats.sessions.length],
        ["Practice time", stats.minutes + " min"],
        ["Current level", stats.level],
        ["Current streak", stats.current + " days"],
        ["Longest streak", stats.longest + " days"],
      ]) +
      '<h3>Speaking activity</h3><p>Last 52 weeks</p><div class="heatmap" aria-label="Speaking activity over 52 weeks">' +
      Array.from({ length: 364 }, (_, i) => {
        const count = stats.days.get(stats.today - 363 + i) || 0;
        return (
          '<i class="' +
          (count ? "used" : "") +
          '" title="' +
          count +
          ' sessions"></i>'
        );
      }).join("") +
      "</div><h3>Learning insights</h3>" +
      defs([
        ["Lessons mastered", stats.mastered],
        ["Patterns still open", stats.open],
        ["Active Memobooks", list.length],
        [
          "Level journey",
          stats.level === "—"
            ? "Measured after your next session"
            : stats.level,
        ],
      ]) +
      "<h3>Most practised Memobooks</h3>" +
      list
        .toSorted((a, b) => b.sessions.length - a.sessions.length)
        .slice(0, 4)
        .map((b) => "<p>" + html(b.title) + "</p>")
        .join(""),
    Plan:
      "<p>Your current access to Memobook.</p>" +
      defs([
        ["Memobook plan", "Personal Studio"],
        ["Tutor and speech", providerName],
        ["Access", "Crafting and speaking included"],
      ]),
    Usage:
      "<p>Your saved activity in this Studio.</p>" +
      defs([
        ["Speaking sessions", stats.sessions.length],
        ["Minutes practised", stats.minutes],
        ["Tutor and speech", providerName],
      ]),
    "About you":
      '<p>Memo uses this optional context across the speaking sessions in this Studio. Clear the field and save to remove it.</p><label class="form-label" for="about">About you</label><textarea id="about" rows="3" maxlength="1800">' +
      html(pref("about", "")) +
      '</textarea><button class="primary" id="save-about">Save</button>',
    "Data & privacy":
      defs([
        ["Session transcripts", "Saved in this browser"],
        ["Microphone recordings", "Transcribed on this Mac and discarded"],
        ["Connected Azure tutor", "When configured, Azure processes submitted text and selected practice context."],
        ["ElevenLabs speech", "When connected, ElevenLabs receives only the text selected for speech playback."],
        ["Tutor chat", "Latest 50 exchanges in this browser"],
        ["About you", "Included in tutor requests when you add practice context"],
        ["Deletion", "Clears saved data in this browser. Connected providers, including Azure and ElevenLabs, may retain previously submitted content under their respective retention policies."],
        ["Studio preferences and practice time", "Saved in this browser"],
        ["Unsent drafts", "Saved in the current tab"],
      ]) +
      '<p>Open a Memobook to delete its transcript and practice history.</p><button class="secondary" id="clear-tutor">Clear tutor chat history</button> <button class="quiet" id="reset-studio">Delete all Studio data</button>',
    Account: defs([
      ["Current profile", "This browser"],
      ["Language Studio", "American English"],
    ]),
  };
  dialog.innerHTML = `<div class="settings-head"><h2>Settings</h2><button class="icon-btn" aria-label="Close settings">×</button></div><div class="settings-grid"><div role="tablist" aria-label="Settings sections">${settingsTabs.map((name) => `<button role="tab" aria-selected="${tab === name}">${name}</button>`).join("")}</div><section role="tabpanel"><h3>${tab}</h3>${sections[tab]}</section></div>`;
  dialog.querySelector(".settings-head button").onclick = () => dialog.close();
  dialog
    .querySelectorAll("[role=tab]")
    .forEach((b) => (b.onclick = () => settings(b.textContent)));
  dialog.querySelectorAll("input[type=radio]").forEach(
    (r) =>
      (r.onchange = () => {
        const name = {
          General: "theme",
          Voice: "voice",
          Notifications: "reminders",
        }[tab];
        setPref(name, r.value);
        if (name === "theme") document.documentElement.dataset.theme = r.value;
      }),
  );
  const preview = dialog.querySelector("#preview-voice");
  if (preview)
    preview.onclick = () =>
      play("Hello, I'm Memo. Let's practice a conversation.");
  const clearTutor = dialog.querySelector("#clear-tutor");
  if (clearTutor)
    clearTutor.onclick = async () => {
      if (!confirm("Clear the tutor chat from this browser?")) return;
      await navigator.locks.request("memo.studio.tutor", () => {
        for (const k of Object.keys(localStorage)) {
          if (k === "memo.studio.tutor" || k.startsWith("memo.studio.tutor.")) localStorage.removeItem(k);
        }
        setPref("clearedChats", crypto.randomUUID());
      });
      dialog.close();
      if (location.hash.split("/")[0] === "#tutor") tutorChat();
    };
  const reset = dialog.querySelector("#reset-studio");
  if (reset)
    reset.onclick = async () => {
      if (
        !confirm(
          "Delete every Memobook, transcript, tutor chat, draft and Studio preference in this browser?",
        )
      )
        return;
      for (const book of books())
        await navigator.locks.request(key(book.id), () =>
          localStorage.removeItem(key(book.id)),
        );
      await navigator.locks.request("memo.studio.tutor", () => {
        for (const name of Object.keys(localStorage).filter((k) =>
          k.startsWith("memo.studio."),
        ))
          localStorage.removeItem(name);
      });
      const stamp = crypto.randomUUID();
      localStorage.setItem("memo.reset", stamp);
      clearStudioDrafts(stamp);
      dialog.close();
      go("studio");
    };
  const about = dialog.querySelector("#save-about");
  if (about)
    about.onclick = () => {
      setPref("about", dialog.querySelector("#about").value.trim());
      dialog.close();
    };
  if (!dialog.open) dialog.showModal();
}

function render() {
  app.scrollTop = 0;
  craftRequest?.abort();
  craftRequest = undefined;
  clearTimeout(sessionTimer);
  epoch++;
  endLiveVoice();
  stopAudio();
  cancelRecording();
  notice.textContent = "";
  const [route, id, sid] = (
    location.hash.slice(1) ||
    (location.pathname.startsWith("/app/books/")
      ? "book/" + location.pathname.split("/").at(-1)
      : location.pathname === "/app"
        ? "studio"
        : "home")
  ).split("/");
  setShell(route, id);
  if (!route || route === "home" || route === "method") {
    home();
    if (route === "method") $("#method").scrollIntoView();
    else scrollTo(0, 0);
    return;
  }
  scrollTo(0, 0);
  if (route === "studio") return studio();
  if (route === "tutor") return tutorChat();
  if (route === "glossary") return glossary();
  if (route === "library") return library();
  if (route === "craft") return crafting();
  const book = id && load(id);
  if (!book) return library();
  if (route === "new-session") return details(book, true);
  if (route === "book") {
    history.replaceState({}, "", "/app/books/" + book.id);
    return details(book);
  }
  const session = book.sessions.find((s) => s.id === sid);
  if (!session) return details(book);
  if (route === "talk") {
    talk(book, session);
    if (startLiveFor === session.id) {
      startLiveFor = undefined;
      void liveVoice(book, session);
    }
    return;
  }
  if (route === "review") return review(book, session);
  details(book);
}
function clearStudioDrafts(stamp) {
  for (const name of Object.keys(sessionStorage).filter((k) =>
    k.startsWith("memo."),
  ))
    sessionStorage.removeItem(name);
  craft = {};
  sessionStorage.setItem("memo.reset", stamp);
}
if (
  localStorage.getItem("memo.reset") &&
  localStorage.getItem("memo.reset") !== sessionStorage.getItem("memo.reset")
)
  clearStudioDrafts(localStorage.getItem("memo.reset"));
window.addEventListener("storage", (e) => {
  if (e.key === "memo.reset" && e.newValue) {
    clearStudioDrafts(e.newValue);
    if (dialog.open) dialog.close();
    go("studio");
  }
});
window.addEventListener("hashchange", render);
window.addEventListener("pagehide", () => {
  endLiveVoice();
  stopAudio();
  cancelRecording();
});
render();
