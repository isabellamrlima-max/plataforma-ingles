// ============================================================
// MOTOR DE QUESTÕES — usado pelo editor (professora), pela prévia
// e pela página do aluno. Cada tipo de questão tem:
//   fonte    → o que a professora preenche no editor
//   dados    → o que o aluno recebe (sem respostas)
//   gabarito → respostas certas (só professora / correção no banco)
// ============================================================

const SPRITE = "assets/icons/sprite.svg";
export const icon = (name, cls = "") => `<svg${cls ? ` class="${cls}"` : ""} aria-hidden="true"><use href="${SPRITE}#${name}"/></svg>`;
export const esc = (s = "") => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const TIPOS = {
  multipla:  { label: "Múltipla escolha",   desc: "Uma opção correta entre várias.",            icon: "q-multipla" },
  completar: { label: "Completar frase",    desc: "Lacunas para o aluno digitar.",              icon: "q-completar" },
  figura:    { label: "Marcar figura",      desc: "O aluno escolhe a imagem certa.",            icon: "q-figura" },
  associar:  { label: "Associar",           desc: "Ligar palavras às frases ou significados.",  icon: "q-associar" },
  vf:        { label: "Verdadeiro ou falso", desc: "True or false.",                            icon: "q-vf" },
  ordenar:   { label: "Ordenar palavras",   desc: "Montar a frase na ordem certa.",             icon: "q-ordenar" },
  escrita:   { label: "Resposta escrita",   desc: "Texto livre — você corrige depois.",         icon: "q-escrita" },
};
export const AUTO = (tipo) => tipo !== "escrita";

// ---------- Modelos em branco para o editor ----------
export function blankFonte(tipo) {
  switch (tipo) {
    case "multipla": return { opcoes: ["", "", ""], correta: 0 };
    case "vf": return { valor: true };
    case "figura": return { imagens: [{ url: "", legenda: "" }, { url: "", legenda: "" }], correta: 0 };
    case "completar": return { texto: "" };
    case "associar": return { pares: [{ a: "", b: "" }, { a: "", b: "" }, { a: "", b: "" }] };
    case "ordenar": return { frase: "" };
    default: return {};
  }
}

// ---------- Completar: "I [wake up] at [7|seven]." ----------
export function parseLacunas(texto = "") {
  const partes = [];
  const lacunas = [];
  let last = 0;
  for (const m of texto.matchAll(/\[([^\]]*)\]/g)) {
    partes.push(texto.slice(last, m.index));
    lacunas.push(m[1].split("|").map((s) => s.trim()).filter(Boolean));
    last = m.index + m[0].length;
  }
  partes.push(texto.slice(last));
  return { partes, lacunas };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// embaralha garantindo que não fique igual à ordem original (quando possível)
function shuffleDifferent(arr) {
  if (arr.length < 2) return [...arr];
  let out, tries = 0;
  do { out = shuffle(arr); tries++; } while (out.every((v, i) => v === arr[i]) && tries < 20);
  return out;
}

// ---------- Validação (antes de salvar) ----------
export function validar(q) {
  const f = q.fonte || {};
  const filled = (s) => String(s || "").trim().length > 0;
  switch (q.tipo) {
    case "multipla": {
      const ops = f.opcoes.filter(filled);
      if (ops.length < 2) return "Preencha pelo menos 2 opções.";
      if (!filled(f.opcoes[f.correta])) return "Marque qual opção é a correta.";
      break;
    }
    case "figura":
      if (f.imagens.filter((i) => i.url).length < 2) return "Envie pelo menos 2 imagens.";
      if (!f.imagens[f.correta]?.url) return "Marque qual imagem é a correta.";
      break;
    case "completar": {
      const { lacunas } = parseLacunas(f.texto);
      if (!lacunas.length) return "Coloque pelo menos uma resposta entre [colchetes].";
      if (lacunas.some((l) => !l.length)) return "Há colchetes vazios: escreva a resposta dentro deles.";
      break;
    }
    case "associar":
      if (f.pares.filter((p) => filled(p.a) && filled(p.b)).length < 2) return "Preencha pelo menos 2 pares completos.";
      break;
    case "ordenar":
      if (String(f.frase || "").trim().split(/\s+/).length < 2) return "Escreva uma frase com pelo menos 2 palavras.";
      break;
  }
  if (!filled(q.enunciado) && q.tipo !== "completar") return "Escreva o enunciado da questão.";
  return null;
}

// ---------- Compilar fonte → dados (aluno) + gabarito ----------
export function compilar(q) {
  const f = q.fonte || {};
  const base = q.imagem ? { imagem: q.imagem } : {};
  switch (q.tipo) {
    case "multipla": {
      const idx = f.opcoes.map((o, i) => (String(o).trim() ? i : -1)).filter((i) => i >= 0);
      const opcoes = idx.map((i) => f.opcoes[i].trim());
      return { dados: { ...base, opcoes }, gabarito: { correta: idx.indexOf(f.correta), fonte: f } };
    }
    case "vf":
      return { dados: base, gabarito: { valor: !!f.valor, fonte: f } };
    case "figura": {
      const idx = f.imagens.map((im, i) => (im.url ? i : -1)).filter((i) => i >= 0);
      const imagens = idx.map((i) => ({ url: f.imagens[i].url, legenda: (f.imagens[i].legenda || "").trim() }));
      return { dados: { ...base, imagens }, gabarito: { correta: idx.indexOf(f.correta), fonte: f } };
    }
    case "completar": {
      const { partes, lacunas } = parseLacunas(f.texto);
      return { dados: { ...base, partes }, gabarito: { lacunas, fonte: f } };
    }
    case "associar": {
      const pares = f.pares.filter((p) => String(p.a).trim() && String(p.b).trim());
      const ordem = shuffleDifferent(pares.map((_, i) => i));
      return {
        dados: { ...base, esquerda: pares.map((p) => p.a.trim()), direita: ordem.map((i) => pares[i].b.trim()) },
        gabarito: { pares: pares.map((_, i) => ordem.indexOf(i)), fonte: f },
      };
    }
    case "ordenar": {
      const frase = String(f.frase).trim().replace(/\s+/g, " ");
      return { dados: { ...base, palavras: shuffleDifferent(frase.split(" ")) }, gabarito: { frase, fonte: f } };
    }
    default:
      return { dados: base, gabarito: { fonte: f } };
  }
}

// ---------- Correção local (prévia da professora e modo demonstração) ----------
// Mesma regra da função enviar_homework do banco.
export const normalizar = (t) =>
  String(t ?? "").replace(/[’‘`´]/g, "'").trim().toLowerCase().replace(/\s+/g, " ").replace(/[\s.!?,;:]+$/, "");

export function corrigirLocal(questoes, respostas) {
  let soma = 0, total = 0, pendente = false;
  const detalhes = questoes.map((q) => {
    const r = respostas[q.id];
    const g = q.gabarito || {};
    let pts = null;
    switch (q.tipo) {
      case "multipla": case "figura": pts = Number.isInteger(r) && r === g.correta ? 1 : 0; break;
      case "vf": pts = typeof r === "boolean" && r === g.valor ? 1 : 0; break;
      case "completar": {
        const n = g.lacunas.length;
        const ok = g.lacunas.filter((alts, i) => Array.isArray(r) && alts.some((a) => normalizar(a) === normalizar(r[i]))).length;
        pts = n ? ok / n : 0; break;
      }
      case "associar": {
        const n = g.pares.length;
        const ok = g.pares.filter((v, i) => Array.isArray(r) && r[i] === v).length;
        pts = n ? ok / n : 0; break;
      }
      case "ordenar": pts = typeof r === "string" && normalizar(r) === normalizar(g.frase) ? 1 : 0; break;
      default: pendente = true;
    }
    if (pts !== null) { soma += pts; total++; }
    const { fonte, ...gab } = g;
    return { id: q.id, pontos: pts, gabarito: gab };
  });
  return { nota: total ? Math.round((soma / total) * 100) / 10 : null, pendente, detalhes };
}

// ---------- Desenhar a questão para o aluno ----------
// q = { id, tipo, enunciado, dados }
export function renderQuestao(q, n) {
  const d = q.dados || {};
  const name = `q-${q.id}`;
  let body = "";
  switch (q.tipo) {
    case "multipla":
      body = `<div class="opts">${(d.opcoes || []).map((o, i) => `
        <label class="opt"><input type="radio" name="${name}" value="${i}"><span class="opt-mark"></span><span class="opt-text">${esc(o)}</span></label>`).join("")}</div>`;
      break;
    case "vf":
      body = `<div class="opts vf">
        <label class="opt"><input type="radio" name="${name}" value="true"><span class="opt-mark"></span><span class="opt-text">True</span></label>
        <label class="opt"><input type="radio" name="${name}" value="false"><span class="opt-mark"></span><span class="opt-text">False</span></label></div>`;
      break;
    case "figura":
      body = `<div class="figs">${(d.imagens || []).map((im, i) => `
        <label class="fig"><input type="radio" name="${name}" value="${i}">
          <img src="${esc(im.url)}" alt="${esc(im.legenda || `Imagem ${i + 1}`)}" loading="lazy">
          ${im.legenda ? `<span class="fig-cap">${esc(im.legenda)}</span>` : ""}<span class="fig-check">${icon("check")}</span></label>`).join("")}</div>`;
      break;
    case "completar": {
      const partes = d.partes || [];
      body = `<p class="cloze">${partes.map((p, i) => esc(p) + (i < partes.length - 1
        ? `<span class="gap"><input class="gap-input" type="text" data-gap="${i}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Lacuna ${i + 1}"></span>` : "")).join("")}</p>`;
      break;
    }
    case "associar":
      body = `<div class="match">${(d.esquerda || []).map((a, i) => `
        <div class="match-row" data-row="${i}">
          <span class="match-a">${esc(a)}</span>
          <select class="input match-b" data-pair="${i}" aria-label="Par de ${esc(a)}">
            <option value="">Escolha…</option>
            ${(d.direita || []).map((b, j) => `<option value="${j}">${esc(b)}</option>`).join("")}
          </select>
        </div>`).join("")}</div>`;
      break;
    case "ordenar":
      body = `<div class="order">
        <div class="order-line" data-line aria-label="Sua frase"><span class="order-ph">Toque nas palavras na ordem certa</span></div>
        <div class="order-bank" data-bank>${(d.palavras || []).map((w, i) => `<button type="button" class="chip-word" data-w="${i}">${esc(w)}</button>`).join("")}</div>
      </div>`;
      break;
    case "escrita":
      body = `<textarea class="input textarea" rows="5" data-text placeholder="Write your answer here…"></textarea>`;
      break;
  }
  return `<article class="q" data-q="${q.id}" data-tipo="${q.tipo}">
    <header class="q-head"><span class="eyebrow">Questão ${n}</span><span class="q-type">${TIPOS[q.tipo]?.label || ""}</span></header>
    ${q.enunciado ? `<h3 class="q-title">${esc(q.enunciado)}</h3>` : ""}
    ${d.imagem ? `<img class="q-img" src="${esc(d.imagem)}" alt="" loading="lazy">` : ""}
    <div class="q-body">${body}</div>
    <div class="q-feedback" hidden></div>
  </article>`;
}

/** Liga a interação (ordenar palavras) e avisa quando algo muda. */
export function wireQuestoes(root, onChange = () => {}) {
  root.addEventListener("input", onChange);
  root.addEventListener("change", onChange);
  root.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip-word");
    if (!chip || chip.disabled) return;
    const q = chip.closest(".q");
    const line = q.querySelector("[data-line]");
    const bank = q.querySelector("[data-bank]");
    (chip.parentElement === bank ? line : bank).appendChild(chip);
    line.querySelector(".order-ph").hidden = !!line.querySelector(".chip-word");
    onChange();
  });
}

/** Lê a resposta de uma questão (undefined = não respondida). */
export function lerResposta(el) {
  const tipo = el.dataset.tipo;
  const checked = el.querySelector("input[type=radio]:checked");
  switch (tipo) {
    case "multipla": case "figura": return checked ? Number(checked.value) : undefined;
    case "vf": return checked ? checked.value === "true" : undefined;
    case "completar": {
      const vals = [...el.querySelectorAll("[data-gap]")].map((i) => i.value.trim());
      return vals.some(Boolean) ? vals : undefined;
    }
    case "associar": {
      const vals = [...el.querySelectorAll("[data-pair]")].map((s) => (s.value === "" ? null : Number(s.value)));
      return vals.some((v) => v !== null) ? vals : undefined;
    }
    case "ordenar": {
      const words = [...el.querySelectorAll("[data-line] .chip-word")].map((c) => c.textContent);
      return words.length ? words.join(" ") : undefined;
    }
    case "escrita": {
      const t = el.querySelector("[data-text]").value.trim();
      return t || undefined;
    }
  }
}

export function lerTodas(root) {
  const out = {};
  root.querySelectorAll(".q").forEach((el) => {
    const v = lerResposta(el);
    if (v !== undefined) out[el.dataset.q] = v;
  });
  return out;
}

/** Mostra certo/errado e a resposta correta depois do envio. */
export function mostrarCorrecao(root, questoes, resultado) {
  const byId = Object.fromEntries(resultado.detalhes.map((d) => [d.id, d]));
  root.querySelectorAll(".q").forEach((el) => {
    const q = questoes.find((x) => x.id === el.dataset.q);
    const det = byId[el.dataset.q];
    if (!q || !det) return;
    const g = det.gabarito || {};
    const d = q.dados || {};
    el.querySelectorAll("input, select, textarea, button").forEach((i) => (i.disabled = true));
    const pts = det.pontos;
    const state = pts === null ? "wait" : pts >= 1 ? "ok" : pts > 0 ? "part" : "bad";
    el.classList.add(`is-${state}`);
    let resp = "";

    switch (q.tipo) {
      case "multipla": case "figura": case "vf": {
        const correctVal = q.tipo === "vf" ? String(g.valor) : String(g.correta);
        el.querySelectorAll("input[type=radio]").forEach((r) => {
          const lab = r.closest("label");
          if (r.value === correctVal) lab.classList.add("right");
          else if (r.checked) lab.classList.add("wrong");
        });
        if (state !== "ok") resp = q.tipo === "vf" ? (g.valor ? "True" : "False")
          : q.tipo === "multipla" ? esc(d.opcoes?.[g.correta]) : esc(d.imagens?.[g.correta]?.legenda || "a imagem destacada");
        break;
      }
      case "completar":
        el.querySelectorAll("[data-gap]").forEach((inp, i) => {
          const alts = g.lacunas?.[i] || [];
          const ok = alts.some((a) => normalizar(a) === normalizar(inp.value));
          inp.classList.add(ok ? "right" : "wrong");
          if (!ok) inp.insertAdjacentHTML("afterend", `<span class="gap-fix">${esc(alts[0] || "")}</span>`);
        });
        break;
      case "associar":
        el.querySelectorAll("[data-pair]").forEach((s, i) => {
          const ok = s.value !== "" && Number(s.value) === g.pares?.[i];
          s.classList.add(ok ? "right" : "wrong");
          if (!ok) s.insertAdjacentHTML("afterend", `<span class="match-fix">${icon("check")}${esc(d.direita?.[g.pares?.[i]])}</span>`);
        });
        break;
      case "ordenar":
        if (state !== "ok") resp = esc(g.frase);
        break;
    }

    const label = { ok: "Correct!", part: `Quase lá · ${Math.round(pts * 100)}%`, bad: "Incorrect", wait: "Aguardando correção da professora" }[state];
    const fb = el.querySelector(".q-feedback");
    fb.hidden = false;
    fb.innerHTML = `<b>${label}</b>${resp ? `<span>Resposta: ${resp}</span>` : ""}`;
  });
}
