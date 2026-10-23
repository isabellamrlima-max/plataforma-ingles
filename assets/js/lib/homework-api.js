// ============================================================
// DADOS DE HOMEWORK — conversa com o Supabase.
// No modo demonstração, guarda tudo neste navegador.
// ============================================================
import { DEMO, db, store } from "./core.js";
import { compilar, corrigirLocal } from "./questoes.js";

export const NIVEIS = ["Iniciante", "Básico", "Intermediário", "Avançado"];
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36));

// ---------- Imagens: reduz antes de enviar ----------
export async function prepararImagem(file, max = 1000) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("formato")); i.src = url; });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob(res, "image/jpeg", 0.82));
  } finally { URL.revokeObjectURL(url); }
}

// ============================================================
// MODO DEMONSTRAÇÃO
// ============================================================
const K = { hw: "demo_homeworks_v1", ent: "demo_entregas_v1" };
const svg = (emoji, bg) => "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 150'><rect width='200' height='150' fill='${bg}'/><text x='100' y='98' font-size='70' text-anchor='middle'>${emoji}</text></svg>`);

function demoSeed() {
  const mk = (tipo, enunciado, fonte) => {
    const q = { id: uuid(), tipo, enunciado, fonte };
    return { ...q, ...compilar(q) };
  };
  return [{
    id: uuid(), titulo: "My Daily Routine", nivel: "Básico", conteudo: "Unit 4 – Daily Routine",
    instrucoes: "Read each question carefully. Good luck!", publicado: true,
    atualizado_em: new Date().toISOString(),
    questoes: [
      mk("multipla", "What time do you usually wake up?", { opcoes: ["At night", "At 7 a.m.", "Yesterday"], correta: 1 }),
      mk("completar", "", { texto: "I [wake up] at 7 and I [brush] my teeth. I [don't|do not] drink coffee." }),
      mk("figura", "Which picture shows breakfast?", { imagens: [{ url: svg("🍳", "#f6e5e1"), legenda: "" }, { url: svg("🌙", "#ece7e0"), legenda: "" }, { url: svg("🚌", "#f6e5e1"), legenda: "" }], correta: 0 }),
      mk("associar", "Match the verbs with the activities.", { pares: [{ a: "take", b: "a shower" }, { a: "have", b: "breakfast" }, { a: "go", b: "to work" }] }),
      mk("vf", "We use “at” before times: at 7 o’clock.", { valor: true }),
      mk("ordenar", "Put the words in order.", { frase: "She goes to school by bus" }),
      mk("escrita", "Describe your morning routine in 3 sentences.", {}),
    ],
  }, {
    id: uuid(), titulo: "Present Simple – Practice", nivel: "Iniciante", conteudo: "Unit 2 – Present Simple",
    instrucoes: "", publicado: false, atualizado_em: new Date(Date.now() - 864e5).toISOString(),
    questoes: [mk("multipla", "He ___ English.", { opcoes: ["speak", "speaks", "speaking"], correta: 1 })],
  }];
}
const demoGet = () => { try { return JSON.parse(store.get(K.hw)) || null; } catch { return null; } };
const demoAll = () => { let l = demoGet(); if (!l) { l = demoSeed(); demoSave(l); } return l; };
const demoSave = (l) => store.set(K.hw, JSON.stringify(l));
const demoEnt = () => { try { return JSON.parse(store.get(K.ent)) || []; } catch { return []; } };
const pub = (q) => ({ id: q.id, tipo: q.tipo, enunciado: q.enunciado, dados: q.dados });
const resumo = (h) => ({ id: h.id, titulo: h.titulo, nivel: h.nivel, conteudo: h.conteudo, instrucoes: h.instrucoes,
  publicado: h.publicado, atualizado_em: h.atualizado_em, total: h.questoes.length });

// ============================================================
// API
// ============================================================

/** Professora: todos os homeworks (resumo). */
export async function listarTodos() {
  if (DEMO) return demoAll().map(resumo).sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em));
  const sb = await db();
  const { data, error } = await sb.from("homeworks")
    .select("id,titulo,nivel,conteudo,instrucoes,publicado,atualizado_em,questoes(count)")
    .order("atualizado_em", { ascending: false });
  if (error) throw error;
  return data.map((h) => ({ ...h, total: h.questoes?.[0]?.count ?? 0 }));
}

/** Professora: homework completo, com gabarito (para editar). */
export async function carregarParaEditar(id) {
  if (DEMO) {
    const h = demoAll().find((x) => x.id === id);
    if (!h) throw new Error("Homework não encontrado.");
    return structuredClone(h);
  }
  const sb = await db();
  const [{ data: h, error }, { data: qs, error: e2 }] = await Promise.all([
    sb.from("homeworks").select("id,titulo,nivel,conteudo,instrucoes,publicado").eq("id", id).single(),
    sb.rpc("questoes_com_gabarito", { p_homework: id }),
  ]);
  if (error || e2) throw error || e2;
  return { ...h, questoes: qs };
}

/** Professora: salva homework + questões (já compiladas). Retorna o id. */
export async function salvar(hw, questoes) {
  if (DEMO) {
    const l = demoAll();
    const id = hw.id || uuid();
    const qs = questoes.map((q) => ({ ...q, id: q.id || uuid() }));
    const novo = { ...hw, id, questoes: qs, atualizado_em: new Date().toISOString() };
    const i = l.findIndex((x) => x.id === id);
    if (i >= 0) l[i] = novo; else l.unshift(novo);
    demoSave(l);
    return id;
  }
  const sb = await db();
  const { data, error } = await sb.rpc("salvar_homework", {
    p_homework: hw,
    p_questoes: questoes.map(({ id, tipo, enunciado, dados, gabarito }) => ({ id, tipo, enunciado, dados, gabarito })),
  });
  if (error) throw error;
  return data;
}

export async function publicar(id, publicado) {
  if (DEMO) {
    const l = demoAll();
    const h = l.find((x) => x.id === id);
    if (h) { h.publicado = publicado; h.atualizado_em = new Date().toISOString(); }
    return demoSave(l);
  }
  const sb = await db();
  const { error } = await sb.from("homeworks").update({ publicado, atualizado_em: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function excluir(id) {
  if (DEMO) return demoSave(demoAll().filter((x) => x.id !== id));
  const sb = await db();
  const { error } = await sb.from("homeworks").delete().eq("id", id);
  if (error) throw error;
}

/** Professora: cópia em rascunho. */
export async function duplicar(id) {
  const h = await carregarParaEditar(id);
  return salvar(
    { titulo: `${h.titulo} (cópia)`, nivel: h.nivel, conteudo: h.conteudo, instrucoes: h.instrucoes, publicado: false },
    h.questoes.map(({ tipo, enunciado, dados, gabarito }) => ({ id: uuid(), tipo, enunciado, dados, gabarito }))
  );
}

/** Professora: envia imagem de questão. Retorna a URL pública. */
export async function enviarImagem(file) {
  const blob = await prepararImagem(file, DEMO ? 600 : 1000);
  if (DEMO) return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
  const sb = await db();
  const path = `img/${uuid()}.jpg`;
  const { error } = await sb.storage.from("homework").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw error;
  return sb.storage.from("homework").getPublicUrl(path).data.publicUrl;
}

// ---------- Aluno ----------

/** Aluno: homeworks publicados (todos os níveis) + minhas últimas notas. */
export async function listarPublicados() {
  if (DEMO) {
    const ent = demoEnt();
    return demoAll().filter((h) => h.publicado).map((h) => ({ ...resumo(h), entrega: ent.find((e) => e.homework_id === h.id) || null }));
  }
  const sb = await db();
  const [{ data: hs, error }, { data: ents }] = await Promise.all([
    sb.from("homeworks").select("id,titulo,nivel,conteudo,instrucoes,publicado,atualizado_em,questoes(count)")
      .eq("publicado", true).order("conteudo").order("titulo"),
    sb.from("entregas").select("homework_id,nota,pendente_correcao,nota_professora,enviado_em").order("enviado_em", { ascending: false }),
  ]);
  if (error) throw error;
  const last = {};
  (ents || []).forEach((e) => { if (!last[e.homework_id]) last[e.homework_id] = e; });
  return hs.map((h) => ({ ...h, total: h.questoes?.[0]?.count ?? 0, entrega: last[h.id] || null }));
}

/** Aluno: um homework para fazer (sem gabarito). */
export async function carregarParaFazer(id) {
  if (DEMO) {
    const h = demoAll().find((x) => x.id === id && x.publicado);
    if (!h) throw new Error("Homework indisponível.");
    return { ...resumo(h), questoes: h.questoes.map(pub), entrega: demoEnt().find((e) => e.homework_id === id) || null };
  }
  const sb = await db();
  const [{ data: h, error }, { data: qs, error: e2 }, { data: ents }] = await Promise.all([
    sb.from("homeworks").select("id,titulo,nivel,conteudo,instrucoes").eq("id", id).eq("publicado", true).single(),
    sb.from("questoes").select("id,ordem,tipo,enunciado,dados").eq("homework_id", id).order("ordem"),
    sb.from("entregas").select("nota,pendente_correcao,nota_professora,comentario,enviado_em").eq("homework_id", id)
      .order("enviado_em", { ascending: false }).limit(1),
  ]);
  if (error || e2) throw new Error("Homework indisponível.");
  return { ...h, questoes: qs, entrega: ents?.[0] || null };
}

/** Aluno: envia respostas. O banco corrige e devolve nota + gabarito. */
export async function enviarRespostas(id, respostas) {
  if (DEMO) {
    const h = demoAll().find((x) => x.id === id);
    const res = corrigirLocal(h.questoes, respostas);
    const ent = demoEnt().filter((e) => e.homework_id !== id);
    ent.unshift({ homework_id: id, nota: res.nota, pendente_correcao: res.pendente, enviado_em: new Date().toISOString() });
    store.set(K.ent, JSON.stringify(ent));
    return res;
  }
  const sb = await db();
  const { data, error } = await sb.rpc("enviar_homework", { p_homework: id, p_respostas: respostas });
  if (error) throw error;
  return data;
}
