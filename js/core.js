// Funções compartilhadas por todas as páginas
import { SUPABASE_URL, SUPABASE_ANON_KEY, APP_NAME } from "./config.js";

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
  aluno: { nome: "Ana Souza", papel: "aluno", nivel: "Intermediário", email: "ana@exemplo.com" },
  professora: { nome: "Professora", papel: "professora", email: "prof@exemplo.com" },
};

/** Perfil do usuário logado, ou null. */
export async function getProfile() {
  if (DEMO) {
    const papel = store.get("demo_papel");
    return papel ? DEMO_PROFILES[papel] : null;
  }
  const sb = await db();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data, error } = await sb.from("perfis").select("*").eq("id", session.user.id).single();
  return error ? null : data;
}

/** Protege uma página: só deixa entrar quem tem o papel certo. */
export async function requireRole(papel) {
  const p = await getProfile();
  if (!p) { location.replace("index.html"); return null; }
  if (p.papel !== papel) { location.replace(HOME[p.papel] || "index.html"); return null; }
  document.body.classList.remove("is-loading");
  return p;
}

export async function logout() {
  if (DEMO) store.del("demo_papel");
  else await (await db()).auth.signOut();
  location.replace("index.html");
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
  return "Algo deu errado. Tente novamente.";
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
