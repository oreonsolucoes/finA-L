import { addXP } from './gamificacao.js';

const desafios = [
    { id: 1, titulo: "Economizar R$20 hoje", xp: 5 },
    { id: 2, titulo: "Anotar todas as despesas do dia", xp: 10 },
    { id: 3, titulo: "Não gastar com delivery 🍔", xp: 15 },
];

export function renderDesafios() {
    const container = document.getElementById('metasContainer');
    container.innerHTML = '';
    desafios.forEach(d => {
        const concluido = localStorage.getItem(`desafio-${d.id}`);
        const div = document.createElement('div');
        div.classList.add('desafio');
        div.innerHTML = `
      <p>${d.titulo}</p>
      <button id="btn-${d.id}" ${concluido ? 'disabled' : ''}>
        ${concluido ? '✅ Concluído' : `Concluir (+${d.xp} XP)`}
      </button>`;
        container.appendChild(div);
        if (!concluido)
            document.getElementById(`btn-${d.id}`).onclick = () => concluirDesafio(d);
    });
}

function concluirDesafio(d) {
    addXP(d.xp);
    localStorage.setItem(`desafio-${d.id}`, 'concluido');
    alert(`✅ Desafio "${d.titulo}" concluído!`);
    renderDesafios();
}
