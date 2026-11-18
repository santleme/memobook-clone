const paths = {
  "Job interview": [
    "Introduce yourself",
    "Describe your last job",
    "Explain why you fit the role",
    "Handle follow-up questions",
    "Tell a story with real results",
    "Negotiate the offer",
  ],
  "Design critique": [
    "Name the design",
    "Describe what changed",
    "Explain a design decision",
    "Respond to a critique",
    "Defend a trade-off",
    "Bring competing viewpoints together",
  ],
  "IELTS speaking": [
    "Introduce your topic",
    "Describe an experience",
    "Compare two views",
    "Support your opinion",
    "Explore a hypothetical",
    "Qualify a complex argument",
  ],
};
const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
const samples = [
  ["Job interview", "B1", "Interviews"],
  ["Design critique", "C1", "Design critiques"],
  ["IELTS speaking", "A2", "IELTS"],
  ["Doctor appointment", "A1", "Health & appointments"],
  ["Product demo", "B2", "Demos"],
  ["Team stand-up", "B1", "Stand-ups"],
  ["Visa interview", "A2", "Visa"],
  ["Sales call", "A2", "Sales calls"],
  ["Client negotiation", "B1", "Negotiate & decide"],
];
export function learningSections() {
  return `<section class="lesson-section paper"><h2>A Memobook for each situation.</h2><p>Each Memobook has its own level. You may have the words for a stand-up and still need practice for an interview.</p>
    <div class="sample-grid">${samples.map(([s, level, category]) => `<button data-sample="${category}"><span>${s}</span><small>${level}</small></button>`).join("")}</div></section>
    <section class="lesson-section"><h2>Then each one climbs,<br>session by session.</h2><p>Explore an example path from first words to a confident conversation.</p>
    <div class="tabs" aria-label="Example paths">${Object.keys(paths)
      .map((s) => `<button type="button" data-path="${s}">${s}</button>`)
      .join("")}</div>
    <ol class="level-path" aria-live="polite"></ol></section>
    <section class="lesson-section paper"><h2>One situation, many ways to say it.</h2><p>Hear the question again. Find a little more of your own English each time.</p>
      <div class="speech-example"><div class="speaker"><img src="/book.svg" alt="">Memo asks</div><h3>“Tell me about yourself.”</h3>
      <div class="examples"><div><small>First attempt</small><p>I am developer since five years.</p></div><div><small>After review</small><p>I’ve been a developer <strong>for five years.</strong></p></div>
      <div><small>In your own words</small><p>I build payment apps for small shops.</p></div></div></div></section>
    <section class="lesson-section"><h2>A word isn’t yours until you say it.</h2><div class="examples word-steps">
      <div><h3>Hear it.</h3><p>Memo uses a phrase from your last review in the next conversation.</p></div>
      <div><h3>Find it.</h3><p>Remember the phrase when Memo asks you a new question.</p></div>
      <div><h3>Say it.</h3><p>Use it in your answer. Your Memobook keeps track of the words you bring back.</p></div></div></section>
    <footer class="lesson-section paper"><img class="footer-memo" src="/book.svg" alt=""><h2>You don’t need perfect English.<br>You need to speak it.</h2><div class="actions"><a class="primary" href="#home">Craft your Memobook</a></div></footer>`;
}
export function wireLearningSections(root, chooseScenario) {
  root.querySelectorAll("[data-sample]").forEach((button) => {
    button.onclick = () => {
      chooseScenario(button.dataset.sample);
      root.querySelector("#situation").scrollIntoView({ block: "center" });
    };
  });
  const buttons = root.querySelectorAll("[data-path]");
  function select(name) {
    for (const b of buttons)
      b.setAttribute("aria-pressed", String(b.dataset.path === name));
    root.querySelector(".level-path").innerHTML = paths[name]
      .map((s, i) => "<li><b>" + levels[i] + "</b><span>" + s + "</span></li>")
      .join("");
  }
  buttons.forEach((b) => (b.onclick = () => select(b.dataset.path)));
  select("Job interview");
}
