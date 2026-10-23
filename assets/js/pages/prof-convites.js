import { DEMO, db, store, requireRole, logout, toast, friendlyError, registerSW, setTitle } from "../lib/core.js";

setTitle("Pré-cadastro");
registerSW();

const $ = (id) => document.getElementById(id);
const p = await requireRole("professora");

// ---------- Acesso aos dados (Supabase ou demonstração) ----------
const DEMO_KEY = "demo_convites";
const demoSeed = [
  { id: 1, email: "ana@exemplo.com", data_nascimento: "2008-03-15", nivel: "Intermediário", usado_em: "2026-10-01T12:00:00Z", nome: "Ana Souza" },
  { id: 2, email: "pedro@exemplo.com", data_nascimento: "2010-07-02", nivel: "Básico", usado_em: null },
];
const demoList = () => { try { return JSON.parse(store.get(DEMO_KEY)) || demoSeed; } catch { return demoSeed; } };
const demoSave = (l) => store.set(DEMO_KEY, JSON.stringify(l));

const api = {
  async list() {
    if (DEMO) return demoList();
    const sb = await db();
    const [{ data: inv, error }, { data: perfis }] = await Promise.all([
      sb.from("pre_cadastro").select("id,email,data_nascimento,nivel,usado_em,criado_em")
        .eq("papel", "aluno").order("criado_em", { ascending: false }),
      sb.from("perfis").select("email,nome").eq("papel", "aluno"),
    ]);
    if (error) throw error;
    const nomes = Object.fromEntries((perfis || []).map((x) => [x.email, x.nome]));
    return inv.map((i) => ({ ...i, nome: nomes[i.email] }));
  },
  async add(row) {
    if (DEMO) {
      const l = demoList();
      if (l.some((x) => x.email === row.email)) throw { code: "23505" };
      l.unshift({ id: Date.now(), usado_em: null, ...row });
      return demoSave(l);
    }
    const sb = await db();
    const { error } = await sb.from("pre_cadastro").insert({ ...row, papel: "aluno" });
    if (error) throw error;
  },
  async remove(id) {
    if (DEMO) return demoSave(demoList().filter((x) => x.id !== id));
    const sb = await db();
    const { error } = await sb.from("pre_cadastro").delete().eq("id", id).is("usado_em", null);
    if (error) throw error;
  },
};

// ---------- Interface ----------
let all = [];
let filter = "todos";

const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (iso) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

function say(msg, kind = "err") {
  const a = $("a-invite");
  a.className = `alert ${kind} show`;
  a.textContent = msg;
}

function render() {
  const q = $("q").value.trim().toLowerCase();
  const rows = all.filter((i) =>
    (filter === "todos" || (filter === "ativo" ? i.usado_em : !i.usado_em)) &&
    (!q || i.email.includes(q) || (i.nome || "").toLowerCase().includes(q))
  );
  const pend = all.filter((i) => !i.usado_em).length;

  $("list").innerHTML = rows.length
    ? rows.map((i) => {
        const active = !!i.usado_em;
        return `<div class="invite ${active ? "active" : "pending"}">
          <span class="dot" aria-hidden="true">${esc((i.nome || i.email)[0].toUpperCase())}</span>
          <div class="invite-main">
            <b>${esc(i.nome || i.email)}</b>
            <small>${i.nome ? esc(i.email) + " · " : ""}Nasc. ${fmtDate(i.data_nascimento)}${i.nivel ? " · " + esc(i.nivel) : ""}</small>
          </div>
          <span class="status ${active ? "active" : "pending"}">${active ? "Conta ativa" : "Aguardando"}</span>
          ${active ? "" : `<button class="del" type="button" data-del="${i.id}" aria-label="Apagar convite de ${esc(i.email)}"><svg><use href="assets/icons/sprite.svg#trash"/></svg></button>`}
        </div>`;
      }).join("")
    : `<div class="empty"><strong>${all.length ? "Nada encontrado" : "Nenhum convite ainda"}</strong>${all.length ? "Tente outro filtro ou busca." : "Cadastre o primeiro aluno ao lado."}</div>`;

  $("count").textContent = all.length ? `${all.length} convite(s) · ${pend} aguardando primeiro acesso` : "";
}

async function load() {
  try {
    all = await api.list();
  } catch (err) {
    all = [];
    toast(friendlyError(err));
  }
  render();
}

if (p) {
  $("logout").addEventListener("click", logout);
  $("i-birth").max = new Date().toISOString().slice(0, 10);

  document.querySelectorAll("[data-f]").forEach((b) =>
    b.addEventListener("click", () => {
      filter = b.dataset.f;
      document.querySelectorAll("[data-f]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      render();
    })
  );
  $("q").addEventListener("input", render);

  $("list").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-del]");
    if (!btn) return;
    const id = Number(btn.dataset.del);
    const inv = all.find((x) => x.id === id);
    if (!confirm(`Apagar o convite de ${inv?.email}?`)) return;
    try {
      await api.remove(id);
      toast("Convite apagado.");
      load();
    } catch (err) { toast(friendlyError(err)); }
  });

  $("f-invite").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("i-email").value.trim().toLowerCase();
    const data_nascimento = $("i-birth").value;
    const nivel = $("i-level").value || null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return say("Digite um e-mail válido.");
    if (!data_nascimento) return say("Informe a data de nascimento.");

    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await api.add({ email, data_nascimento, nivel });
      say(`Convite criado! Avise o aluno para entrar em “Primeiro acesso” com ${email}.`, "ok");
      e.target.reset();
      load();
    } catch (err) {
      say(err?.code === "23505" ? "Este e-mail já tem um convite." : friendlyError(err));
    }
    btn.disabled = false;
  });

  load();
}
