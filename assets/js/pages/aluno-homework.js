import { requireRole, logout, store, toast, friendlyError, registerSW, setTitle } from "../lib/core.js";
import { NIVEIS, listarPublicados } from "../lib/homework-api.js";
import { esc, icon } from "../lib/questoes.js";

setTitle("Homework");
registerSW();

const $ = (id) => document.getElementById(id);
const p = await requireRole("aluno");
let all = [];
const nota = (n) => String(n).replace(".", ",");

function renderConteudos() {
  const nivel = $("a-nivel").value;
  const cur = store.get("hw_conteudo") || "";
  const list = [...new Set(all.filter((h) => h.nivel === nivel).map((h) => h.conteudo))].sort();
  $("a-conteudo").innerHTML = `<option value="">Todos os conteúdos</option>` +
    list.map((c) => `<option ${c === cur ? "selected" : ""}>${esc(c)}</option>`).join("");
}

function status(e) {
  if (!e) return `<span class="tag new">Novo</span>`;
  if (e.nota_professora != null) return `<span class="tag done">Nota ${nota(e.nota_professora)}</span>`;
  if (e.pendente_correcao && e.nota == null) return `<span class="tag">Aguardando correção</span>`;
  return `<span class="tag done">Nota ${nota(e.nota)}</span>`;
}

function render() {
  const nivel = $("a-nivel").value;
  const cont = $("a-conteudo").value;
  const rows = all.filter((h) => h.nivel === nivel && (!cont || h.conteudo === cont));
  $("list").innerHTML = rows.length ? rows.map((h) => `
    <a class="hw-card" href="aluno-homework-fazer.html?id=${h.id}">
      <div>
        <h3 class="hw-title">${esc(h.titulo)}</h3>
        <div class="hw-meta" style="margin-top:6px"><span>${esc(h.conteudo)}</span><span>${h.total} ${h.total === 1 ? "questão" : "questões"}</span></div>
        <div style="margin-top:10px">${status(h.entrega)}</div>
      </div>
      ${icon("chev", "chev")}
    </a>`).join("")
    : `<div class="empty"><strong>Nenhum homework aqui ainda</strong>Experimente outro nível ou conteúdo.</div>`;
}

if (p) {
  $("logout").addEventListener("click", logout);
  try { all = await listarPublicados(); } catch (err) { toast(friendlyError(err)); }

  // começa no nível escolhido da última vez, ou no nível do aluno
  const saved = store.get("hw_nivel");
  const firstWithHw = NIVEIS.find((n) => all.some((h) => h.nivel === n));
  $("a-nivel").value = NIVEIS.includes(saved) ? saved : NIVEIS.includes(p.nivel) ? p.nivel : firstWithHw || NIVEIS[0];

  renderConteudos();
  render();
  $("a-nivel").addEventListener("change", () => {
    store.set("hw_nivel", $("a-nivel").value);
    store.del("hw_conteudo");
    renderConteudos();
    render();
  });
  $("a-conteudo").addEventListener("change", () => { store.set("hw_conteudo", $("a-conteudo").value); render(); });
}
