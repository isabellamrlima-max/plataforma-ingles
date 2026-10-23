import { DEMO, HOME, db, getProfile, store, friendlyError, registerSW, setTitle } from "../lib/core.js";

setTitle("Entrar");
registerSW();

const $ = (id) => document.getElementById(id);
const views = [...document.querySelectorAll(".view")];
let checked = null; // { email, nascimento } após o passo 1

function show(id) {
  views.forEach((v) => (v.hidden = v.id !== id));
  document.querySelectorAll(".alert").forEach((a) => a.classList.remove("show"));
  scrollTo({ top: 0, behavior: "smooth" });
  const first = $(id).querySelector("input:not([readonly])");
  if (first && matchMedia("(min-width: 760px)").matches) first.focus();
}

function alertMsg(id, msg, kind = "err") {
  const el = $(id);
  el.className = `alert ${kind} show`;
  el.textContent = msg;
}

function busy(form, on, label) {
  const btn = form.querySelector("button[type=submit]");
  if (on) {
    btn.dataset.label = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = `<span class="spin"></span>${label || "Aguarde..."}`;
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.label;
  }
}

const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

// Navegação entre telas
document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => show(b.dataset.go)));

// Mostrar / ocultar senha
document.querySelectorAll("[data-peek]").forEach((b) =>
  b.addEventListener("click", () => {
    const inp = $(b.dataset.peek);
    inp.type = inp.type === "password" ? "text" : "password";
    b.setAttribute("aria-label", inp.type === "password" ? "Mostrar senha" : "Ocultar senha");
  })
);

// Limita a data de nascimento a hoje
$("c-birth").max = new Date().toISOString().slice(0, 10);

// Se já está logado, vai direto para a área certa
getProfile().then((p) => { if (p) location.replace(HOME[p.papel]); });

// ---------- Modo demonstração ----------
if (DEMO) {
  $("demo-box").hidden = false;
  document.querySelectorAll("[data-demo]").forEach((b) =>
    b.addEventListener("click", () => {
      store.set("demo_papel", b.dataset.demo);
      location.href = HOME[b.dataset.demo];
    })
  );
}

// ---------- 1. Entrar ----------
$("f-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("l-email").value.trim().toLowerCase();
  const password = $("l-pass").value;
  if (!validEmail(email) || !password) return alertMsg("a-login", "Preencha e-mail e senha.");

  if (DEMO) {
    store.set("demo_papel", email.startsWith("prof") ? "professora" : "aluno");
    return location.replace(HOME[store.get("demo_papel")]);
  }

  busy(e.target, true, "Entrando...");
  try {
    const sb = await db();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const p = await getProfile();
    if (!p) throw new Error("Perfil não encontrado.");
    location.replace(HOME[p.papel]);
  } catch (err) {
    alertMsg("a-login", err.message === "Perfil não encontrado." ? "Sua conta não tem perfil. Fale com a professora." : friendlyError(err));
    busy(e.target, false);
  }
});

// ---------- 2. Primeiro acesso: conferir pré-cadastro ----------
$("f-check").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("c-email").value.trim().toLowerCase();
  const nascimento = $("c-birth").value; // AAAA-MM-DD
  if (!validEmail(email)) return alertMsg("a-check", "Digite um e-mail válido.");
  if (!nascimento) return alertMsg("a-check", "Informe sua data de nascimento.");

  busy(e.target, true, "Conferindo...");
  try {
    let status = "ok";
    if (!DEMO) {
      const sb = await db();
      const { data, error } = await sb.rpc("verificar_pre_cadastro", { p_email: email, p_nascimento: nascimento });
      if (error) throw error;
      status = data;
    }
    if (status === "nao_encontrado") {
      alertMsg("a-check", "Não encontramos um convite com esses dados. Confira o e-mail e a data, ou fale com a professora.");
    } else if (status === "ja_cadastrado") {
      alertMsg("a-check", "Este convite já foi usado. Volte e entre com seu e-mail e senha.");
    } else {
      checked = { email, nascimento };
      $("s-email").value = email;
      show("v-signup");
    }
  } catch (err) {
    alertMsg("a-check", friendlyError(err));
  }
  busy(e.target, false);
});

// Máscara simples de celular
$("s-phone").addEventListener("input", (e) => {
  const d = e.target.value.replace(/\D/g, "").slice(0, 11);
  e.target.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
});

// ---------- 3. Primeiro acesso: criar conta ----------
$("f-signup").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!checked) return show("v-check");
  const nome = $("s-name").value.trim();
  const telefone = $("s-phone").value.trim();
  const pass = $("s-pass").value;
  if (nome.length < 3) return alertMsg("a-signup", "Digite seu nome completo.");
  if (pass.length < 8) return alertMsg("a-signup", "A senha precisa ter pelo menos 8 caracteres.");
  if (pass !== $("s-pass2").value) return alertMsg("a-signup", "As senhas não são iguais.");

  if (DEMO) {
    store.set("demo_papel", "aluno");
    return location.replace(HOME.aluno);
  }

  busy(e.target, true, "Criando conta...");
  try {
    const sb = await db();
    const redirect = new URL("index.html", location.href).href;
    const { data, error } = await sb.auth.signUp({
      email: checked.email,
      password: pass,
      options: {
        emailRedirectTo: redirect,
        // O banco confere estes dados de novo antes de criar a conta
        data: { nome, telefone, data_nascimento: checked.nascimento },
      },
    });
    if (error) throw error;
    if (data.session) {
      const p = await getProfile();
      return location.replace(HOME[p?.papel] || "index.html");
    }
    $("confirm-email").textContent = checked.email;
    show("v-confirm");
  } catch (err) {
    alertMsg("a-signup", friendlyError(err));
  }
  busy(e.target, false);
});

// ---------- 4. Esqueci a senha ----------
$("f-forgot").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("r-email").value.trim().toLowerCase();
  if (!validEmail(email)) return alertMsg("a-forgot", "Digite um e-mail válido.");
  busy(e.target, true, "Enviando...");
  try {
    if (!DEMO) {
      const sb = await db();
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("redefinir-senha.html", location.href).href,
      });
      if (error) throw error;
    }
    alertMsg("a-forgot", "Se este e-mail tiver cadastro, você receberá o link em instantes.", "ok");
  } catch (err) {
    alertMsg("a-forgot", friendlyError(err));
  }
  busy(e.target, false);
});
