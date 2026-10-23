import { requireRole, logout, toast, friendlyError, registerSW, setTitle } from "../lib/core.js";
import { NIVEIS, listarTodos, publicar, excluir, duplicar } from "../lib/homework-api.js";
import { esc, icon } from "../lib/questoes.js";

setTitle("Homework");
registerSW();

const $ = (id) => document.getElementById(id);
const p = await requireRole("professora");
let all = [];
let nivel = "";

const fmt = (iso) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

function renderChips() {
  $("f-nivel").innerHTML = ["", ...NIVEIS].map((n) =>
    `<button class="chip" type="button" data-n="${esc(n)}" aria-pressed="${n === nivel}">${n || "Todos"}</button>`).join("");
}

function renderConteudos() {
  const sel = $("f-conteudo");
  const cur = sel.value;
  const list = [...new Set(all.filter((h) => !nivel || h.nivel === nivel).map((h) => h.conteudo))].sort();
  sel.innerHTML = `<option value="">Todos os conteúdos</option>` + list.map((c) => `<option ${c === cur ? "selected" : ""}>${esc(c)}</option>`).join("");
}

function render() {
  const q = $("f-q").value.trim().toLowerCase();
  const cont = $("f-conteudo").value;
  const rows = all.filter((h) => (!nivel || h.nivel === nivel) && (!cont || h.conteudo === cont) && (!q || h.titulo.toLowerCase().includes(q)));

  $("list").innerHTML = rows.length ? rows.map((h) => `
    <article class="hw-card">
      <div class="hw-top">
        <h3 class="hw-title">${esc(h.titulo)}</h3>
        <span class="tag ${h.publicado ? "pub" : ""}">${h.publicado ? "Publicado" : "Rascunho"}</span>
      </div>
      <div class="hw-meta"><span>${esc(h.nivel)}</span><span>${esc(h.conteudo)}</span><span>${h.total} ${h.total === 1 ? "questão" : "questões"}</span><span>${fmt(h.atualizado_em)}</span></div>
      <div class="hw-actions">
        <a class="act primary" href="prof-homework-editor.html?id=${h.id}">${icon("edit")}Editar</a>
        <button class="act" type="button" data-act="pub" data-id="${h.id}">${icon("globe")}${h.publicado ? "Despublicar" : "Publicar"}</button>
        <button class="act" type="button" data-act="dup" data-id="${h.id}">${icon("copy")}Duplicar</button>
        <button class="act danger" type="button" data-act="del" data-id="${h.id}">${icon("trash")}Excluir</button>
      </div>
    </article>`).join("")
    : `<div class="empty"><strong>${all.length ? "Nada encontrado" : "Nenhum homework ainda"}</strong>${all.length ? "Tente outro filtro." : "Toque em “Novo homework” para criar o primeiro."}</div>`;

  const pubs = all.filter((h) => h.publicado).length;
  $("count").textContent = all.length ? `${all.length} homework(s) · ${pubs} publicado(s)` : "";
}

async function load() {
  try { all = await listarTodos(); } catch (err) { all = []; toast(friendlyError(err)); }
  renderConteudos();
  render();
}

if (p) {
  $("logout").addEventListener("click", logout);
  renderChips();
  $("f-nivel").addEventListener("click", (e) => {
    const b = e.target.closest("[data-n]");
    if (!b) return;
    nivel = b.dataset.n;
    renderChips();
    renderConteudos();
    render();
  });
  $("f-conteudo").addEventListener("change", render);
  $("f-q").addEventListener("input", render);

  $("list").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const h = all.find((x) => x.id === b.dataset.id);
    b.disabled = true;
    try {
      if (b.dataset.act === "pub") {
        if (!h.publicado && !h.total) { toast("Adicione questões antes de publicar."); b.disabled = false; return; }
        await publicar(h.id, !h.publicado);
        toast(h.publicado ? "Voltou para rascunho." : "Publicado! Os alunos já podem ver.");
      } else if (b.dataset.act === "dup") {
        await duplicar(h.id);
        toast("Cópia criada como rascunho.");
      } else if (b.dataset.act === "del") {
        if (!confirm(`Excluir “${h.titulo}”? As respostas dos alunos também serão apagadas.`)) { b.disabled = false; return; }
        await excluir(h.id);
        toast("Homework excluído.");
      }
      await load();
    } catch (err) {
      toast(friendlyError(err));
      b.disabled = false;
    }
  });

  load();
}
