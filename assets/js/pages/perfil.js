import {
  DEMO, HOME, PAPEL_LABEL, db, requireRole, logout, renderAvatar, saveDemoProfile,
  toast, friendlyError, registerSW, setTitle,
} from "../lib/core.js";

setTitle("Meu perfil");
registerSW();

const $ = (id) => document.getElementById(id);
let p = await requireRole(); // aluno ou professora

// ---------- Utilidades ----------
const fmtSince = (iso) => {
  if (!iso) return "—";
  const s = new Date(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const maskPhone = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
};
function say(msg, kind = "err") {
  const a = $("a-profile");
  a.className = `alert ${kind} show`;
  a.textContent = msg;
}

// ---------- Mostrar dados ----------
function paint() {
  renderAvatar($("avatar"), p);
  $("btn-remove").hidden = !p.avatar_url;
  $("p-name").textContent = p.nome || "—";
  $("p-role").textContent = PAPEL_LABEL[p.papel] || "";
  $("p-since").textContent = fmtSince(p.criado_em);
  const lv = $("p-level");
  if (lv && p.papel === "aluno") lv.textContent = p.nivel || "A definir";
  else if (lv) lv.closest("div").remove(); // professora não tem nível
}

function fillForm() {
  $("f-name").value = p.nome || "";
  $("f-birth").value = p.data_nascimento || "";
  $("f-phone").value = maskPhone(p.telefone || "");
  $("f-email").value = p.email || "";
  $("f-role").value = PAPEL_LABEL[p.papel] || "";
  if (p.papel === "aluno") $("f-level").value = p.nivel || "A definir";
  else $("level-field").remove();
}

// ---------- Foto: tratar imagem (recorte quadrado 512px) ----------
async function toSquareJpeg(source) {
  const bmp = source instanceof Blob ? await loadImage(source) : source;
  const w = bmp.videoWidth || bmp.naturalWidth || bmp.width;
  const h = bmp.videoHeight || bmp.naturalHeight || bmp.height;
  const side = Math.min(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const mirror = source instanceof HTMLVideoElement; // selfie da webcam sai espelhada
  if (mirror) { ctx.translate(512, 0); ctx.scale(-1, 1); }
  ctx.drawImage(bmp, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 512, 512);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("imagem"))), "image/jpeg", 0.86));
}

function loadImage(blob) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("formato")); };
    img.src = url;
  });
}

const blobToDataUrl = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });

// ---------- Foto: salvar ----------
async function savePhoto(source) {
  $("photo-busy").hidden = false;
  try {
    const blob = await toSquareJpeg(source);
    let url;
    if (DEMO) {
      url = await blobToDataUrl(blob);
      saveDemoProfile(p.papel, { avatar_url: url });
    } else {
      const sb = await db();
      const path = `${p.id}/avatar.jpg`;
      const { error: upErr } = await sb.storage.from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data } = sb.storage.from("avatars").getPublicUrl(path);
      url = `${data.publicUrl}?v=${Date.now()}`; // força o navegador a mostrar a foto nova
      const { error } = await sb.from("perfis").update({ avatar_url: url }).eq("id", p.id);
      if (error) throw error;
    }
    p = { ...p, avatar_url: url };
    paint();
    toast("Foto atualizada ✨");
  } catch (err) {
    toast(err?.message === "formato" ? "Não consegui abrir essa imagem. Tente outra (JPG ou PNG)." : friendlyError(err));
  }
  $("photo-busy").hidden = true;
}

async function removePhoto() {
  if (!confirm("Remover sua foto de perfil?")) return;
  try {
    if (DEMO) saveDemoProfile(p.papel, { avatar_url: null });
    else {
      const sb = await db();
      await sb.storage.from("avatars").remove([`${p.id}/avatar.jpg`]);
      const { error } = await sb.from("perfis").update({ avatar_url: null }).eq("id", p.id);
      if (error) throw error;
    }
    p = { ...p, avatar_url: null };
    paint();
    toast("Foto removida.");
  } catch (err) { toast(friendlyError(err)); }
}

// ---------- Câmera ----------
// Celular: abre a câmera do aparelho. Computador: usa a webcam numa janela.
const isTouch = matchMedia("(pointer: coarse)").matches;
let stream = null;

async function openCamera() {
  if (isTouch || !navigator.mediaDevices?.getUserMedia) return $("file-camera").click();
  const dlg = $("cam");
  $("cam-msg").textContent = "Permita o acesso à câmera no navegador.";
  dlg.showModal();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1024 } }, audio: false });
    $("cam-video").srcObject = stream;
    $("cam-msg").textContent = "";
  } catch {
    $("cam-msg").textContent = "Não foi possível usar a câmera. Use “Enviar foto”.";
  }
}
function closeCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  $("cam-video").srcObject = null;
  if ($("cam").open) $("cam").close();
}

// ---------- Início ----------
if (p) {
  // "Início" e logo levam para a área certa
  document.querySelectorAll("[data-home]").forEach((a) => (a.href = HOME[p.papel]));
  $("logout").addEventListener("click", logout);
  paint();
  fillForm();

  $("btn-camera").addEventListener("click", openCamera);
  $("btn-upload").addEventListener("click", () => $("file-upload").click());
  $("btn-remove").addEventListener("click", removePhoto);
  ["file-camera", "file-upload"].forEach((id) =>
    $(id).addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      if (f.size > 15 * 1024 * 1024) return toast("Imagem muito grande (máx. 15 MB).");
      savePhoto(f);
    })
  );
  $("cam-cancel").addEventListener("click", closeCamera);
  $("cam").addEventListener("close", closeCamera);
  $("cam-shot").addEventListener("click", async () => {
    const v = $("cam-video");
    if (!stream || !v.videoWidth) return;
    const shot = await toSquareJpeg(v);
    closeCamera();
    savePhoto(shot);
  });

  $("f-phone").addEventListener("input", (e) => (e.target.value = maskPhone(e.target.value)));
  $("f-birth").max = new Date().toISOString().slice(0, 10);

  $("f-profile").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = $("f-name").value.trim();
    const data_nascimento = $("f-birth").value;
    const telefone = $("f-phone").value.trim() || null;
    if (nome.length < 3) return say("Digite seu nome completo.");
    if (!data_nascimento) return say("Informe a data de nascimento.");
    if (telefone && telefone.replace(/\D/g, "").length < 10) return say("Telefone incompleto. Use DDD + número.");

    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const changes = { nome, data_nascimento, telefone };
      if (DEMO) saveDemoProfile(p.papel, changes);
      else {
        const sb = await db();
        const { error } = await sb.from("perfis").update(changes).eq("id", p.id);
        if (error) throw error;
      }
      p = { ...p, ...changes };
      paint();
      say("Cadastro atualizado!", "ok");
    } catch (err) {
      say(friendlyError(err));
    }
    btn.disabled = false;
  });
}
