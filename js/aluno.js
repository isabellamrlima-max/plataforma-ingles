import { DEMO, requireRole, logout, firstName, initials, bindSoon, registerSW, setTitle } from "./core.js";

setTitle("Área do aluno");
registerSW();

const p = await requireRole("aluno");
if (p) {
  document.getElementById("nome").textContent = firstName(p.nome) || "aluno";
  const av = document.getElementById("avatar");
  if (p.avatar_url) av.innerHTML = `<img src="${encodeURI(p.avatar_url)}" alt="">`;
  else av.textContent = initials(p.nome);

  document.getElementById("logout").addEventListener("click", logout);

  // A tabela de aulas entra num próximo bloco. Por enquanto: exemplo no modo demo.
  const box = document.getElementById("next-lesson");
  box.innerHTML = DEMO
    ? `<a class="lesson" href="#" data-soon="Aula">
        <div class="lesson-when"><small>Hoje</small><strong>14:00</strong></div>
        <div class="lesson-info">
          <h3>Inglês Geral</h3>
          <span class="lesson-unit"><svg><use href="#i-book"/></svg>Unit 4 – Daily Routine</span>
          <span class="pill">Confirmada</span>
        </div>
        <svg class="chev"><use href="#i-chev"/></svg>
      </a>`
    : `<div class="empty"><strong>Nenhuma aula agendada</strong>Quando a professora marcar sua próxima aula, ela aparece aqui.</div>`;
  bindSoon();
}
