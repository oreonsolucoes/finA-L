import { dbRT } from "./firebase-config.js";
import { ref, get, set, update, push, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 🎯 Metas base organizadas por dificuldade
const metasBase = {
    basico: [
        { titulo: "Anotar todas as despesas de hoje", valorMeta: 0 },
        { titulo: "Economizar R$50 essa semana", valorMeta: 50 },
        { titulo: "Ler 5 páginas de um livro financeiro", valorMeta: 0 },
    ],
    intermediario: [
        { titulo: "Passar um mês sem usar o cartão de crédito", valorMeta: 0 },
        { titulo: "Juntar R$500 para reserva de emergência", valorMeta: 500 },
        { titulo: "Revisar as assinaturas mensais e cancelar 1", valorMeta: 0 },
    ],
    avancado: [
        { titulo: "Atingir R$2000 em investimentos", valorMeta: 2000 },
        { titulo: "Planejar uma viagem sem se endividar", valorMeta: 0 },
        { titulo: "Aumentar a renda em 10% este mês", valorMeta: 0 },
    ]
};

// === Função principal: carregar metas ===
export async function carregarMetas(uid) {
    const lista = document.getElementById("listaMetas");
    if (!lista) return;

    const metasRef = ref(dbRT, `financeiro/${uid}/metas`);
    const snap = await get(metasRef);

    lista.innerHTML = "";

    if (snap.exists()) {
        const metas = snap.val();
        Object.entries(metas).forEach(([id, meta]) => {
            exibirMeta(uid, id, meta);
        });
    }

    // Garante que sempre tenha 3 metas ativas
    await atualizarMetasAutomaticas(uid);
}

// === Cria um elemento visual de meta ===
function exibirMeta(uid, id, meta) {
    const lista = document.getElementById("listaMetas");
    const li = document.createElement("li");

    li.innerHTML = `
    <div>
      <strong>${meta.titulo}</strong><br>
      <small>${meta.valorMeta > 0 ? `Meta: R$${meta.valorMeta}` : "Meta sem valor específico"}</small>
      <div class="meta-bar"><div class="meta-progress" id="progress-${id}"></div></div>
    </div>
    <button data-id="${id}" class="concluirMeta">✔</button>
  `;

    li.querySelector(".concluirMeta").addEventListener("click", async () => {
        const metaRef = ref(dbRT, `financeiro/${uid}/metas/${id}`);
        await remove(metaRef);
        li.remove();
        atualizarMetasAutomaticas(uid);
    });

    lista.appendChild(li);
    atualizarProgressoVisual(id, meta.progresso || 0);
}

// === Atualiza barra de progresso da meta (visual) ===
function atualizarProgressoVisual(id, progresso) {
    const barra = document.getElementById(`progress-${id}`);
    if (barra) {
        barra.style.width = `${Math.min(progresso, 100)}%`;
    }
}

// === Adiciona uma meta no Firebase ===
async function adicionarMetaNoBanco(uid, meta) {
    const metasRef = ref(dbRT, `financeiro/${uid}/metas`);
    await push(metasRef, {
        ...meta,
        progresso: 0,
        concluida: false,
        criadaEm: Date.now()
    });
    await carregarMetas(uid);
}

// === Atualiza metas automaticamente ===
export async function atualizarMetasAutomaticas(uid) {
    const metasRef = ref(dbRT, `financeiro/${uid}/metas`);
    const snap = await get(metasRef);
    let metasAtuais = snap.exists() ? Object.values(snap.val()) : [];

    if (metasAtuais.length < 3) {
        const niveis = ["basico", "intermediario", "avancado"];

        for (const nivel of niveis) {
            const jaTem = metasAtuais.some(m => metasBase[nivel].some(b => b.titulo === m.titulo));
            if (!jaTem) {
                const novaMeta = metasBase[nivel][Math.floor(Math.random() * metasBase[nivel].length)];
                await adicionarMetaNoBanco(uid, novaMeta);
            }
        }
    }
}

// === Inicialização automática quando logado ===
document.addEventListener("DOMContentLoaded", async () => {
    const uid = localStorage.getItem("uid");
    if (!uid) return;
    await carregarMetas(uid);
});
