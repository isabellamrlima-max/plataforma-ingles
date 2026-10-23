// Funções compartilhadas por todas as páginas
import { SUPABASE_URL, SUPABASE_ANON_KEY, APP_NAME } from "../config.js";

export { APP_NAME };
export const DEMO = !/^https:\/\/.+\.supabase\.co/.test(SUPABASE_URL) || !SUPABASE_ANON_KEY;
export const HOME = { aluno: "aluno.html", professora: "professora.html" };

let client = null;

/** Retorna o cliente Supabase (null em modo demonstração). */
export async function db() {
  if (DEMO) return null;
  if (!client) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

// localStorage pode falhar (aba anônima etc.)
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

const DEMO_PROFILES = {
  aluno: { id: "demo-aluno", nome: "Ana Souza", papel: "aluno", nivel: "Intermediário", email: "ana@exemplo.com",
           telefone: "(11) 98765-4321", data_nascimento: "2008-03-15", criado_em: "2026-09-02T12:00:00Z" },
  professora: { id: "demo-prof", nome: "Isabella Lima", papel: "professora", email: "isabella@exemplo.com",
                telefone: "(11) 91234-5678", data_nascimento: "1995-06-10", criado_em: "2026-08-15T12:00:00Z" },
};
const demoKey = (papel) => `demo_perfil_${papel}`;

/** Modo demonstração: grava alterações do perfil só neste navegador. */
export function saveDemoProfile(papel, changes) {
  let cur = {};
  try { cur = JSON.parse(store.get(demoKey(papel))) || {}; } catch {}
  store.set(demoKey(papel), JSON.stringify({ ...cur, ...changes }));
}

export const PAPEL_LABEL = { aluno: "Aluno(a)", professora: "Professor(a)" };

/** Perfil do usuário logado, ou null. */
export async function getProfile() {
  if (DEMO) {
    const papel = store.get("demo_papel");
    if (!papel) return null;
    let extra = {};
    try { extra = JSON.parse(store.get(demoKey(papel))) || {}; } catch {}
    return { ...DEMO_PROFILES[papel], ...extra };
  }
  const sb = await db();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data, error } = await sb.from("perfis").select("*").eq("id", session.user.id).single();
  return error ? null : data;
}

/** Protege uma página: só deixa entrar quem tem o papel certo
 *  (sem papel = qualquer usuário logado). */
export async function requireRole(papel) {
  const p = await getProfile();
  if (!p) { location.replace("index.html"); return null; }
  if (papel && p.papel !== papel) { location.replace(HOME[p.papel] || "index.html"); return null; }
  document.body.classList.remove("is-loading");
  return p;
}

export async function logout() {
  if (DEMO) store.del("demo_papel");
  else await (await db()).auth.signOut();
  location.replace("index.html");
}

/** Mostra a foto do perfil (ou as iniciais) dentro de um elemento. */
export function renderAvatar(el, p) {
  el.textContent = "";
  if (p?.avatar_url) {
    const img = document.createElement("img");
    img.alt = "";
    img.src = p.avatar_url;
    img.onerror = () => { el.textContent = initials(p.nome); };
    el.appendChild(img);
  } else {
    el.textContent = initials(p?.nome);
  }
}

export function firstName(nome = "") { return nome.trim().split(/\s+/)[0] || ""; }
export function initials(nome = "") {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts.at(-1)[0] : "")).toUpperCase() || "?";
}

let toastTimer;
export function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

/** Cards marcados com data-soon mostram aviso até a página existir. */
export function bindSoon() {
  document.querySelectorAll("[data-soon]").forEach((a) =>
    a.addEventListener("click", (e) => { e.preventDefault(); toast(`${a.dataset.soon}: em construção 🚧`); })
  );
}

/** Traduz erros do Supabase para mensagens amigáveis. */
export function friendlyError(err) {
  const m = (err?.message || String(err || "")).toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (m.includes("already registered")) return "Este e-mail já tem cadastro. Use “Entrar” ou “Esqueci minha senha”.";
  if (m.includes("database error") || m.includes("não autorizado")) return "Cadastro não autorizado. Confira o e-mail e a data de nascimento.";
  if (m.includes("password") && m.includes("6")) return "A senha precisa ter pelo menos 8 caracteres.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (m.includes("fetch") || m.includes("network")) return "Sem conexão. Verifique sua internet.";
  if (m.includes("permission denied") || m.includes("row-level security")) return "Sem permissão para isso. Entre novamente ou fale com a professora.";
  if (m.includes("does not exist") || m.includes("could not find")) return "O banco ainda não está pronto: rode os scripts do Supabase em ordem (01, 02, 03).";
  // mostra o detalhe técnico para facilitar o suporte
  const detail = err?.message ? ` (${String(err.message).slice(0, 90)})` : "";
  return `Algo deu errado. Tente novamente.${detail}`;
}

export function registerSW() {
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
}

export function setTitle(page) {
  document.title = page ? `${page} · ${APP_NAME}` : APP_NAME;
  document.querySelectorAll("[data-app-name]").forEach((el) => (el.textContent = APP_NAME));
}
