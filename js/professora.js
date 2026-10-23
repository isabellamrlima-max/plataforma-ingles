import { DEMO, db, requireRole, logout, initials, bindSoon, registerSW, setTitle } from "./core.js";

setTitle("Área da professora");
registerSW();

const p = await requireRole("professora");
if (p) {
  const av = document.getElementById("avatar");
  if (p.avatar_url) av.innerHTML = `<img src="${encodeURI(p.avatar_url)}" alt="">`;
  else av.textContent = initials(p.nome);

  document.getElementById("logout").addEventListener("click", logout);

  // A agenda real entra num próximo bloco (tabela "aulas"). Exemplo no modo demo:
  const demo = [
    { hora: "14:00", aluno: "Ana", turma: "Inglês intermediário" },
    { hora: "16:00", aluno: "Pedro", turma: "Conversação" },
  ];
  const box = document.getElementById("agenda");
  box.innerHTML = DEMO
    ? `<div class="agenda">${demo
        .map((a) => `<a class="row-card" href="#" data-soon="Aula"><strong>${a.hora}</strong><span>${a.aluno} • ${a.turma}</span><svg class="chev"><use href="#i-chev"/></svg></a>`)
        .join("")}</div>`
    : `<div class="empty"><strong>Agenda livre hoje</strong>As aulas do dia aparecem aqui.</div>`;
  bindSoon();

  // Quantos alunos ainda não fizeram o primeiro acesso
  try {
    let pend = 1;
    if (!DEMO) {
      const sb = await db();
      const { count } = await sb.from("pre_cadastro").select("id", { count: "exact", head: true })
        .eq("papel", "aluno").is("usado_em", null);
      pend = count || 0;
    }
    if (pend) document.getElementById("pend-count").textContent = `${pend} aguardando primeiro acesso`;
  } catch {}
}
