import { DEMO, requireRole, logout, firstName, renderAvatar, bindSoon, registerSW, setTitle } from "../lib/core.js";

setTitle("Área do aluno");
registerSW();

const p = await requireRole("aluno");
if (p) {
  document.getElementById("nome").textContent = firstName(p.nome) || "aluno";
  renderAvatar(document.getElementById("avatar"), p);

  document.getElementById("logout").addEventListener("click", logout);

  // A tabela de aulas entra num próximo bloco. Por enquanto: exemplo no modo demo.
  const box = document.getElementById("next-lesson");
  box.innerHTML = DEMO
    ? `<a class="lesson" href="#" data-soon="Aula">
        <div class="lesson-when"><small>Hoje</small><strong>14:00</strong></div>
        <div class="lesson-info">
          <h3>Inglês Geral</h3>
          <span class="lesson-unit"><svg><use href="assets/icons/sprite.svg#book"/></svg>Unit 4 – Daily Routine</span>
          <span class="pill">Confirmada</span>
        </div>
        <svg class="chev"><use href="assets/icons/sprite.svg#chev"/></svg>
      </a>`
    : `<div class="empty"><strong>Nenhuma aula agendada</strong>Quando a professora marcar sua próxima aula, ela aparece aqui.</div>`;
  bindSoon();
}
