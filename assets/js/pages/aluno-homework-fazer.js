import { requireRole, logout, toast, friendlyError, registerSW, setTitle } from "../lib/core.js";
import { carregarParaFazer, enviarRespostas } from "../lib/homework-api.js";
import { esc, renderQuestao, wireQuestoes, lerTodas, mostrarCorrecao } from "../lib/questoes.js";

setTitle("Homework");
registerSW();

const $ = (id) => document.getElementById(id);
const p = await requireRole("aluno");
const id = new URLSearchParams(location.search).get("id");
const nota = (n) => String(n).replace(".", ",");
let hw = null;
let sent = false;

function progress() {
  const done = Object.keys(lerTodas($("questions"))).length;
  $("progress").textContent = `${done} de ${hw.questoes.length} respondida(s)`;
}

function mensagem(n) {
  if (n === null) return "Suas respostas foram enviadas para a professora.";
  if (n >= 9) return "Excellent work! Keep it up.";
  if (n >= 7) return "Great job! You're doing well.";
  if (n >= 5) return "Good effort — review the corrections below.";
  return "Don't give up! Check the answers and try again.";
}

function draw() {
  sent = false;
  $("result").hidden = true;
  $("questions").innerHTML = hw.questoes.map((q, n) => renderQuestao(q, n + 1)).join("");
  $("btn-send").disabled = false;
  $("btn-send").textContent = "Enviar respostas";
  progress();
}

async function send() {
  if (sent) { draw(); scrollTo({ top: 0, behavior: "smooth" }); return; }
  const respostas = lerTodas($("questions"));
  const falta = hw.questoes.length - Object.keys(respostas).length;
  if (falta && !confirm(`Faltam ${falta} questão(ões) sem resposta. Enviar mesmo assim?`)) return;

  $("btn-send").disabled = true;
  $("btn-send").innerHTML = `<span class="spin"></span>Corrigindo…`;
  try {
    const res = await enviarRespostas(hw.id, respostas);
    mostrarCorrecao($("questions"), hw.questoes, res);
    sent = true;
    $("last-try").hidden = true;
    $("result").hidden = false;
    $("result").innerHTML = `
      <span class="eyebrow">${res.nota === null ? "Enviado" : "Sua nota"}</span>
      ${res.nota === null ? "" : `<div class="result-score">${nota(res.nota)}<small>/10</small></div>`}
      <p>${mensagem(res.nota)}${res.pendente && res.nota !== null ? " As respostas escritas serão corrigidas pela professora." : ""}</p>
      <button class="btn" type="button" id="again">Fazer de novo</button>`;
    $("again").addEventListener("click", () => { draw(); scrollTo({ top: 0, behavior: "smooth" }); });
    $("progress").textContent = res.nota === null ? "Enviado" : `Nota ${nota(res.nota)}`;
    $("btn-send").textContent = "Fazer de novo";
    $("btn-send").disabled = false;
    scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    toast(friendlyError(err));
    $("btn-send").disabled = false;
    $("btn-send").textContent = "Enviar respostas";
  }
}

if (p) {
  $("logout").addEventListener("click", logout);
  try {
    hw = await carregarParaFazer(id);
    setTitle(hw.titulo);
    $("hw-meta").textContent = `${hw.nivel} · ${hw.conteudo}`;
    $("hw-title").textContent = hw.titulo;
    $("hw-inst").textContent = hw.instrucoes || "";
    if (hw.entrega) {
      const e = hw.entrega;
      const n = e.nota_professora ?? e.nota;
      $("last-try").hidden = false;
      $("last-try").innerHTML = `Você já fez este homework${n != null ? ` · última nota <b>${nota(n)}</b>` : ""}. Pode fazer de novo quando quiser.` +
        (e.comentario ? `<br><i>Professora:</i> ${esc(e.comentario)}` : "");
    }
    wireQuestoes($("questions"), progress);
    draw();
    $("btn-send").addEventListener("click", send);
  } catch (err) {
    $("hw-title").textContent = "Homework indisponível";
    $("hw-inst").textContent = "Ele pode ter sido removido pela professora.";
    document.querySelector(".savebar").hidden = true;
  }
}
