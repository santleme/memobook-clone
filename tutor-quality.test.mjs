import assert from "node:assert/strict";
import { test } from "node:test";

const origin = `http://127.0.0.1:${process.env.MEMOBOOK_PORT || 4827}`;
async function chat(...turns) {
  const response = await fetch(origin + "/api/chat", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ turns, context: "Daily stand-up. The teammate owns the dashboard data." }),
  });
  assert.equal(response.status, 200);
  return (await response.json()).answer.trim();
}

test("A simple real-world request gets a ready-to-say line", async () => {
  const answer = await chat("Num café, quero pedir um descafeinado com leite de aveia, sem açúcar. Como eu digo isso?");
  assert.match(answer, /decaf/i);
  assert.match(answer, /oat milk/i);
  assert.match(answer, /(?:no|without(?: any)?) sugar|unsweetened/i);
  assert.doesNotMatch(answer, /\n\s*\n/);
});

test("One requested correction stays a single sentence", async () => {
  assert.equal(await chat("Corrija só o erro e devolva apenas a frase em inglês: We discussed about the delay yesterday."), "We discussed the delay yesterday.");
});

test("The tutor grades its own gap and offers the next unsolved item", async () => {
  const request = "Faça um exercício com since e for usando uma duração de dois anos. Uma lacuna por vez. Espere minha resposta.";
  const exercise = await chat(request);
  assert.match(exercise, /_{2,}|\[\s*\]|…/);
  assert.match(exercise, /(?:two|2) years/i);
  assert.doesNotMatch(exercise, /\bfor (?:two|2) years\b/i);
  const feedback = await chat(request, exercise, "Minha resposta é since.");
  assert.match(feedback, /\bfor\b/i);
  assert.match(feedback, /duração|período|tempo decorrido/i);
  assert.match(feedback, /_{2,}|\[\s*\]|…/);
});

test("Text-only coaching does not promise to hear uploaded recordings", async () => {
  const answer = await chat("Pelo que você ouviu na minha última sessão, qual som do inglês pronuncio errado com mais frequência?");
  assert.match(answer, /não (?:tenho|consigo|posso|dá)|sem (?:áudio|gravação|dados)/i);
  assert.doesNotMatch(answer, /(?:envi[ae]|mand[ae]|compartilh[ae]|anex[ae]|enviar)[^.!?\n]{0,70}(?:áudio|gravação)/i);
});
