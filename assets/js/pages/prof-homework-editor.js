import { requireRole, logout, toast, friendlyError, registerSW, setTitle } from "../lib/core.js";
import { NIVEIS, listarTodos, carregarParaEditar, salvar, enviarImagem } from "../lib/homework-api.js";
import {
  TIPOS, esc, icon, blankFonte, parseLacunas, validar, compilar, corrigirLocal,
  renderQuestao, wireQuestoes, lerTodas, mostrarCorrecao,
} from "../lib/questoes.js";

setTitle("Editor de homework");
registerSW();

const $ = (id) => document.getElementById(id);
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36));
const p = await requireRole("professora");

// ---------- Estado ----------
let hw = { id: null, titulo: "", nivel: NIVEIS[1], conteudo: "", instrucoes: "", publicado: false };
let qs = []; // { id, tipo, enunciado, fonte, imagem, erro }
let dirty = false;
let savedAt = null;

const PLACEHOLDER = {
  multipla: "Ex.: What time do you wake up?",
  completar: "Ex.: Complete with the correct verb.",
  figura: "Ex.: Which picture shows a kitchen?",
  associar: "Ex.: Match the words with their meanings.",
  vf: "Ex.: “She don't like coffee” is correct.",
  ordenar: "Ex.: Put the words in order.",
  escrita: "Ex.: Describe your morning routine in 3 sentences.",
};

function markDirty() { dirty = true; paintStatus(); }
function paintStatus() {
  const base = hw.publicado ? "Publicado" : "Rascunho";
  $("status").textContent = dirty ? `${base} · não salvo` : savedAt ? `${base} · salvo ${savedAt}` : base;
  $("btn-save").textContent = "Salvar";
  $("btn-publish").textContent = hw.publicado ? "Despublicar" : "Publicar";
  $("btn-publish").classList.toggle("btn-primary", !hw.publicado);
  $("btn-publish").classList.toggle("btn-soft", hw.publicado);
  $("q-count").textContent = qs.length;
}

// ---------- Campos específicos de cada tipo ----------
const radio = (name, value, checked, label) =>
  `<label class="radio-pick" title="${label}"><input type="radio" name="${name}" value="${value}" ${checked ? "checked" : ""} data-f="correta" aria-label="${label}"><span></span></label>`;

function campos(q, i) {
  const f = q.fonte;
  switch (q.tipo) {
    case "multipla":
      return `<div class="field"><label>Opções <span class="opt-label">— marque a correta</span></label>
        <div class="rows">${f.opcoes.map((o, j) => `
          <div class="row-edit">
            ${radio(`c-${q.id}`, j, f.correta === j, `Opção ${j + 1} é a correta`)}
            <input class="input" type="text" value="${esc(o)}" data-f="opcao" data-j="${j}" placeholder="Opção ${j + 1}">
            <button class="tool danger" type="button" data-act="del-opt" data-j="${j}" ${f.opcoes.length <= 2 ? "disabled" : ""} aria-label="Remover opção">${icon("x")}</button>
          </div>`).join("")}</div>
        ${f.opcoes.length < 6 ? `<button class="add-row" type="button" data-act="add-opt">${icon("plus")}Adicionar opção</button>` : ""}</div>`;

    case "vf":
      return `<div class="field"><label>Resposta correta</label>
        <div class="seg">
          <label><input type="radio" name="vf-${q.id}" value="true" data-f="vf" ${f.valor ? "checked" : ""}><span>True</span></label>
          <label><input type="radio" name="vf-${q.id}" value="false" data-f="vf" ${!f.valor ? "checked" : ""}><span>False</span></label>
        </div></div>`;

    case "figura":
      return `<div class="field"><label>Imagens <span class="opt-label">— marque a correta</span></label>
        <div class="img-slots">${f.imagens.map((im, j) => `
          <div class="img-slot ${f.correta === j && im.url ? "is-right" : ""}">
            <button class="img-drop" type="button" data-act="pick-img" data-j="${j}" aria-label="Escolher imagem ${j + 1}">
              ${im.url ? `<img src="${esc(im.url)}" alt="">` : `<span>${icon("upload")}Enviar imagem</span>`}
            </button>
            <input class="input" type="text" value="${esc(im.legenda)}" data-f="legenda" data-j="${j}" placeholder="Legenda (opcional)">
            <div class="img-slot-foot">
              <label><input type="radio" name="c-${q.id}" value="${j}" data-f="correta" ${f.correta === j ? "checked" : ""}>Correta</label>
              <button class="tool danger" type="button" data-act="del-img" data-j="${j}" ${f.imagens.length <= 2 ? "disabled" : ""} aria-label="Remover imagem">${icon("x")}</button>
            </div>
          </div>`).join("")}</div>
        ${f.imagens.length < 6 ? `<button class="add-row" type="button" data-act="add-img">${icon("plus")}Adicionar imagem</button>` : ""}</div>`;

    case "completar": {
      const n = parseLacunas(f.texto).lacunas.length;
      return `<div class="field"><label>Frase(s)</label>
        <textarea class="input textarea" rows="3" data-f="texto" placeholder="I [wake up] at 7 and I [don't|do not] drink coffee.">${esc(f.texto)}</textarea>
        <small class="hint">Coloque a resposta entre <code>[colchetes]</code>. Mais de uma resposta certa: <code>[don't|do not]</code>.
          <b data-gaps>${n ? `${n} lacuna(s)` : ""}</b></small></div>`;
    }

    case "associar":
      return `<div class="field"><label>Pares <span class="opt-label">— o aluno verá a coluna da direita embaralhada</span></label>
        <div class="rows">${f.pares.map((pr, j) => `
          <div class="row-edit">
            <input class="input" type="text" value="${esc(pr.a)}" data-f="pa" data-j="${j}" placeholder="Palavra">
            <span class="pair-sep">→</span>
            <input class="input" type="text" value="${esc(pr.b)}" data-f="pb" data-j="${j}" placeholder="Frase / significado">
            <button class="tool danger" type="button" data-act="del-pair" data-j="${j}" ${f.pares.length <= 2 ? "disabled" : ""} aria-label="Remover par">${icon("x")}</button>
          </div>`).join("")}</div>
        ${f.pares.length < 8 ? `<button class="add-row" type="button" data-act="add-pair">${icon("plus")}Adicionar par</button>` : ""}</div>`;

    case "ordenar":
      return `<div class="field"><label>Frase na ordem correta</label>
        <input class="input" type="text" value="${esc(f.frase)}" data-f="frase" placeholder="She goes to school by bus">
        <small class="hint">As palavras serão embaralhadas para o aluno.</small></div>`;

    case "escrita":
      return `<p class="hint">O aluno escreve livremente. Essa questão não entra na nota automática — você corrige depois.</p>`;
  }
  return "";
}

function card(q, i) {
  const t = TIPOS[q.tipo];
  return `<article class="qe ${q.erro ? "has-error" : ""}" data-i="${i}" id="qe-${q.id}">
    <header class="qe-head">
      <span class="qe-num">${i + 1}</span>
      <span class="qe-type">${icon(t.icon)}${t.label}</span>
      <div class="qe-tools">
        <button class="tool" type="button" data-act="up" ${i === 0 ? "disabled" : ""} aria-label="Mover para cima">${icon("up")}</button>
        <button class="tool" type="button" data-act="down" ${i === qs.length - 1 ? "disabled" : ""} aria-label="Mover para baixo">${icon("down")}</button>
        <button class="tool" type="button" data-act="clone" aria-label="Duplicar questão">${icon("copy")}</button>
        <button class="tool danger" type="button" data-act="del" aria-label="Excluir questão">${icon("trash")}</button>
      </div>
    </header>
    <div class="qe-body">
      ${q.erro ? `<div class="qe-error">${esc(q.erro)}</div>` : ""}
      <div class="field">
        <label>${q.tipo === "completar" ? 'Instrução <span class="opt-label">(opcional)</span>' : "Enunciado"}</label>
        <textarea class="input textarea" rows="2" data-f="enunciado" placeholder="${esc(PLACEHOLDER[q.tipo])}">${esc(q.enunciado)}</textarea>
      </div>
      ${campos(q, i)}
      <div class="support-img">
        ${q.imagem ? `<img src="${esc(q.imagem)}" alt="">
          <button class="add-row" type="button" data-act="support">${icon("upload")}Trocar imagem</button>
          <button class="add-row" type="button" data-act="rm-support">${icon("x")}Remover</button>`
        : `<button class="add-row" type="button" data-act="support">${icon("image")}Imagem de apoio (opcional)</button>`}
      </div>
    </div>
  </article>`;
}

function renderAll() {
  $("questions").innerHTML = qs.length ? qs.map(card).join("")
    : `<div class="q-empty"><b>Nenhuma questão ainda</b>Toque em “Adicionar questão” para começar.</div>`;
  paintStatus();
}
function renderOne(i) {
  const el = $("questions").querySelector(`[data-i="${i}"]`);
  if (el) el.outerHTML = card(qs[i], i);
}

// ---------- Tipo de questão ----------
function openPicker() {
  $("type-grid").innerHTML = Object.entries(TIPOS).map(([k, t], n) => `
    <button class="type-card" type="button" data-tipo="${k}">
      <span class="bubble ${n % 2 ? "taupe" : "blush"}">${icon(t.icon)}</span>
      <b>${t.label}</b><small>${t.desc}</small>
    </button>`).join("");
  $("type-picker").showModal();
}
function addQuestion(tipo) {
  qs.push({ id: uuid(), tipo, enunciado: "", fonte: blankFonte(tipo), imagem: null });
  markDirty();
  renderAll();
  const el = $(`qe-${qs.at(-1).id}`);
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => el.querySelector("textarea, input")?.focus({ preventScroll: true }), 350);
}

// ---------- Imagens ----------
let imgTarget = null; // { i, j | "support" }
function pickImage(target) { imgTarget = target; $("img-input").click(); }
$("img-input").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file || !imgTarget) return;
  const { i, j } = imgTarget;
  const q = qs[i];
  const el = $("questions").querySelector(`[data-i="${i}"]`);
  const btn = j === "support" ? el.querySelector('[data-act="support"]') : el.querySelector(`[data-act="pick-img"][data-j="${j}"]`);
  if (btn) btn.innerHTML = `<span><span class="spin"></span>Enviando…</span>`;
  try {
    const url = await enviarImagem(file);
    if (j === "support") q.imagem = url;
    else q.fonte.imagens[j].url = url;
    markDirty();
  } catch (err) {
    toast(err?.message === "formato" ? "Não consegui abrir essa imagem. Use JPG ou PNG." : friendlyError(err));
  }
  renderOne(i);
});

// ---------- Eventos da lista de questões ----------
$("questions").addEventListener("input", (e) => {
  const el = e.target.closest("[data-f]");
  const box = e.target.closest("[data-i]");
  if (!el || !box) return;
  const q = qs[Number(box.dataset.i)];
  const j = Number(el.dataset.j);
  switch (el.dataset.f) {
    case "enunciado": q.enunciado = el.value; break;
    case "opcao": q.fonte.opcoes[j] = el.value; break;
    case "legenda": q.fonte.imagens[j].legenda = el.value; break;
    case "pa": q.fonte.pares[j].a = el.value; break;
    case "pb": q.fonte.pares[j].b = el.value; break;
    case "frase": q.fonte.frase = el.value; break;
    case "texto": {
      q.fonte.texto = el.value;
      const n = parseLacunas(el.value).lacunas.length;
      box.querySelector("[data-gaps]").textContent = n ? `${n} lacuna(s)` : "";
      break;
    }
    default: return;
  }
  markDirty();
});

$("questions").addEventListener("change", (e) => {
  const el = e.target.closest("[data-f]");
  const box = e.target.closest("[data-i]");
  if (!el || !box) return;
  const i = Number(box.dataset.i);
  const q = qs[i];
  if (el.dataset.f === "correta") { q.fonte.correta = Number(el.value); markDirty(); if (q.tipo === "figura") renderOne(i); }
  if (el.dataset.f === "vf") { q.fonte.valor = el.value === "true"; markDirty(); }
});

$("questions").addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  const box = e.target.closest("[data-i]");
  if (!b || !box) return;
  const i = Number(box.dataset.i);
  const q = qs[i];
  const j = Number(b.dataset.j);
  const f = q.fonte;
  switch (b.dataset.act) {
    case "up": [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]]; markDirty(); return renderAll();
    case "down": [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]]; markDirty(); return renderAll();
    case "clone": qs.splice(i + 1, 0, { ...structuredClone(q), id: uuid(), erro: null }); markDirty(); return renderAll();
    case "del":
      if (!confirm(`Excluir a questão ${i + 1}?`)) return;
      qs.splice(i, 1); markDirty(); return renderAll();
    case "add-opt": f.opcoes.push(""); break;
    case "del-opt": f.opcoes.splice(j, 1); if (f.correta >= j && f.correta > 0) f.correta--; break;
    case "add-pair": f.pares.push({ a: "", b: "" }); break;
    case "del-pair": f.pares.splice(j, 1); break;
    case "add-img": f.imagens.push({ url: "", legenda: "" }); break;
    case "del-img": f.imagens.splice(j, 1); if (f.correta >= j && f.correta > 0) f.correta--; break;
    case "pick-img": return pickImage({ i, j });
    case "support": return pickImage({ i, j: "support" });
    case "rm-support": q.imagem = null; break;
    default: return;
  }
  markDirty();
  renderOne(i);
  if (b.dataset.act.startsWith("add-")) {
    const inputs = $("questions").querySelector(`[data-i="${i}"]`).querySelectorAll('.rows input[type=text], .img-slots input[type=text]');
    inputs[inputs.length - (b.dataset.act === "add-pair" ? 2 : 1)]?.focus();
  }
});

// ---------- Salvar ----------
function lerMeta() {
  hw.titulo = $("m-titulo").value.trim();
  hw.nivel = $("m-nivel").value;
  hw.conteudo = $("m-conteudo").value.trim();
  hw.instrucoes = $("m-inst").value.trim();
}

async function save(publicado) {
  lerMeta();
  if (!hw.titulo) { $("m-titulo").focus(); return toast("Dê um título ao homework."); }
  if (!hw.conteudo) { $("m-conteudo").focus(); return toast("Informe o conteúdo (ex.: Unit 4 – Daily Routine)."); }

  // Para publicar, todas as questões precisam estar completas
  qs.forEach((q) => (q.erro = null));
  if (publicado) {
    if (!qs.length) return toast("Adicione pelo menos uma questão.");
    let first = -1;
    qs.forEach((q, i) => { q.erro = validar(q); if (q.erro && first < 0) first = i; });
    if (first >= 0) {
      renderAll();
      $(`qe-${qs[first].id}`).scrollIntoView({ behavior: "smooth", block: "center" });
      return toast(`Revise a questão ${first + 1} antes de publicar.`);
    }
  }

  const btns = [$("btn-save"), $("btn-publish")];
  btns.forEach((b) => (b.disabled = true));
  try {
    const compiled = qs.map((q) => ({ id: q.id, tipo: q.tipo, enunciado: q.enunciado.trim(), ...compilar(q) }));
    const id = await salvar({ ...hw, publicado }, compiled);
    hw.id = id;
    hw.publicado = publicado;
    if (!location.search.includes(id)) history.replaceState(null, "", `?id=${id}`);
    $("ed-title").textContent = hw.titulo;
    dirty = false;
    savedAt = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    renderAll();
    toast(publicado ? "Publicado! Os alunos já podem fazer." : "Salvo.");
  } catch (err) {
    toast(friendlyError(err));
  }
  btns.forEach((b) => (b.disabled = false));
}

// ---------- Prévia ----------
let preview = [];
function openPreview() {
  lerMeta();
  preview = qs.filter((q) => !validar(q)).map((q) => ({ id: q.id, tipo: q.tipo, enunciado: q.enunciado.trim(), ...compilar(q) }));
  const skipped = qs.length - preview.length;
  $("pv-title").textContent = hw.titulo || "Sem título";
  $("pv-body").innerHTML =
    (hw.instrucoes ? `<p class="hello-sub" style="margin:0">${esc(hw.instrucoes)}</p>` : "") +
    (skipped ? `<div class="alert info show">${skipped} questão(ões) incompleta(s) não aparece(m) na prévia.</div>` : "") +
    (preview.length ? preview.map((q, n) => renderQuestao(q, n + 1)).join("") : `<div class="q-empty"><b>Nada para mostrar</b>Complete pelo menos uma questão.</div>`);
  $("pv-check").disabled = !preview.length;
  $("preview").showModal();
}
wireQuestoes($("pv-body"));
$("pv-check").addEventListener("click", () => {
  const res = corrigirLocal(preview, lerTodas($("pv-body")));
  mostrarCorrecao($("pv-body"), preview, res);
  $("pv-check").disabled = true;
  toast(res.nota === null ? "Só há questões de resposta escrita." : `Nota da prévia: ${String(res.nota).replace(".", ",")}`);
});

// ---------- Início ----------
if (p) {
  $("logout").addEventListener("click", logout);
  $("m-nivel").innerHTML = NIVEIS.map((n) => `<option>${n}</option>`).join("");

  const id = new URLSearchParams(location.search).get("id");
  if (id) {
    try {
      const h = await carregarParaEditar(id);
      hw = { id: h.id, titulo: h.titulo, nivel: h.nivel, conteudo: h.conteudo, instrucoes: h.instrucoes || "", publicado: h.publicado };
      qs = (h.questoes || []).map((q) => ({
        id: q.id, tipo: q.tipo, enunciado: q.enunciado || "",
        fonte: structuredClone(q.gabarito?.fonte || blankFonte(q.tipo)),
        imagem: q.dados?.imagem || null,
      }));
      $("ed-title").textContent = hw.titulo;
      setTitle(hw.titulo);
    } catch (err) {
      toast(friendlyError(err));
    }
  }
  $("m-titulo").value = hw.titulo;
  $("m-nivel").value = hw.nivel;
  $("m-conteudo").value = hw.conteudo;
  $("m-inst").value = hw.instrucoes;
  ["m-titulo", "m-nivel", "m-conteudo", "m-inst"].forEach((k) => $(k).addEventListener("input", markDirty));

  // sugestões de conteúdo já usados
  listarTodos().then((l) => {
    $("conteudos").innerHTML = [...new Set(l.map((h) => h.conteudo))].sort().map((c) => `<option value="${esc(c)}">`).join("");
  }).catch(() => {});

  renderAll();
  $("add-q").addEventListener("click", openPicker);
  $("type-grid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tipo]");
    if (!b) return;
    $("type-picker").close();
    addQuestion(b.dataset.tipo);
  });
  document.querySelectorAll("dialog [data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));

  $("btn-save").addEventListener("click", () => save(hw.publicado));
  $("btn-publish").addEventListener("click", () => {
    if (hw.publicado && !confirm("Despublicar? Os alunos deixam de ver este homework.")) return;
    save(!hw.publicado);
  });
  $("btn-preview").addEventListener("click", openPreview);
  addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
}
