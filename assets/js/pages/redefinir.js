import { DEMO, HOME, db, getProfile, friendlyError, setTitle } from "../lib/core.js";

setTitle("Nova senha");
const $ = (id) => document.getElementById(id);
const say = (msg, kind = "err") => { const a = $("a-reset"); a.className = `alert ${kind} show`; a.textContent = msg; };

document.querySelector("[data-peek]").addEventListener("click", () => {
  const i = $("n-pass"); i.type = i.type === "password" ? "text" : "password";
});

$("f-reset").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pass = $("n-pass").value;
  if (pass.length < 8) return say("A senha precisa ter pelo menos 8 caracteres.");
  if (pass !== $("n-pass2").value) return say("As senhas não são iguais.");
  if (DEMO) return say("Modo demonstração: nada foi alterado.", "info");
  try {
    const sb = await db();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return say("Link expirado. Peça um novo em “Esqueci minha senha”.");
    const { error } = await sb.auth.updateUser({ password: pass });
    if (error) throw error;
    say("Senha alterada! Entrando...", "ok");
    const p = await getProfile();
    setTimeout(() => location.replace(HOME[p?.papel] || "index.html"), 900);
  } catch (err) { say(friendlyError(err)); }
});
