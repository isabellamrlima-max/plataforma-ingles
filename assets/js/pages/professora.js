import { DEMO, db, requireRole, logout, renderAvatar, bindSoon, registerSW, setTitle } from "../lib/core.js";

setTitle("Área da professora");
registerSW();

const p = await requireRole("professora");
if (p) {
  renderAvatar(document.getElementById("avatar"), p);

  document.getElementById("logout").addEventListener("click", logout);

  // A agenda real entra num próximo bloco (tabela "aulas"). Exemplo no modo demo:
  const demo = [
    { hora: "14:00", aluno: "Ana", turma: "Inglês intermediário" },
    { hora: "16:00", aluno: "Pedro", turma: "Conversação" },
  ];
  const box = document.getElementById("agenda");
  box.innerHTML = DEMO
    ? `<div class="agenda">${demo
        .map((a) => `<a class="row-card" href="#" data-soon="Aula"><strong>${a.hora}</strong><span>${a.aluno} • ${a.turma}</span><svg class="chev"><use href="assets/icons/sprite.svg#chev"/></svg></a>`)
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
