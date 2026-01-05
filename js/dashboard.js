// =============================
// DASHBOARD.JS (versão RTDB + Metas Dinâmicas + Despesas Fixas + Gráficos + Valores)
// =============================

import { auth, dbRT } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, push, set, get, remove, update } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";
import { addXP, updateXPBar } from './gamificacao.js';
import { carregarMetas } from './metas.js';
const db = getDatabase();

// =============================
// LOGIN / LOGOUT
// =============================
const logoutBtn = document.getElementById('logoutBtn');
logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, user => {
    if (!user) window.location.href = "login.html";
    else initDashboard(user.uid);
});

// =============================
// INICIALIZAÇÃO
// =============================
async function initDashboard(uid) {
    ['Ganhos', 'Despesas', 'Reservas'].forEach(tipo => {
        const btn = document.getElementById(`add${tipo}`);
        if (btn) btn.onclick = () => addRegistro(uid, tipo.toLowerCase());
    });

    await carregarDados(uid);
    await gerarMetasAutomaticas(uid);
    await compararDespesasFixas(uid);
    
    async function processarViradaDeMes(uid) {
        const agora = new Date();
        const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

        // Calcula o mês passado para buscar as fixas
        let anoAnt = agora.getFullYear();
        let mesAntNum = agora.getMonth();
        if (mesAntNum === 0) { mesAntNum = 12; anoAnt--; }
        const mesAnterior = `${anoAnt}-${String(mesAntNum).padStart(2, '0')}`;

        const refPassado = ref(db, `financeiro/${uid}/despesas/${mesAnterior}`);
        const refAtual = ref(db, `financeiro/${uid}/despesas/${mesAtual}`);

        const snapPassado = await get(refPassado);
        const snapAtual = await get(refAtual);

        if (snapPassado.exists()) {
            const despesasPassadas = snapPassado.val();
            const despesasAtuais = snapAtual.exists() ? Object.values(snapAtual.val()) : [];

            for (const id in despesasPassadas) {
                const d = despesasPassadas[id];

                // Se for fixa e ainda não existir no mês atual (pela descrição)
                if (d.fixa && !despesasAtuais.some(atual => atual.desc === d.desc)) {
                    const novoValor = d.valorFixo ? d.valor : 0; // Se valor fixo, mantém. Se não, zerado.

                    await push(refAtual, {
                        desc: d.desc,
                        valor: novoValor,
                        fixa: true,
                        valorFixo: d.valorFixo,
                        data: agora.toISOString()
                    });
                }
            }
        }
    }

}


// =============================
// ADICIONAR REGISTROS
// =============================
async function addRegistro(uid, tipo) {
    const desc = document.getElementById(`desc${capitalize(tipo)}`)?.value || '';
    const valor = parseFloat(document.getElementById(`valor${capitalize(tipo)}`)?.value);

    const ehFixa = document.getElementById(`fixa${capitalize(tipo)}`)?.checked || false;
    const ehValorFixo = document.getElementById(`valorFixo${capitalize(tipo)}`)?.checked || false;

    if (!desc || isNaN(valor)) {
        alert("Preencha todos os campos corretamente!");
        return;
    }

    const agora = new Date();
    const mesAno = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

    const registroRef = ref(db, `financeiro/${uid}/${tipo}/${mesAno}`);
    const novoRef = push(registroRef);

    await set(novoRef, {
        desc,
        valor,
        data: agora.toISOString(),
        fixa: ehFixa,
        valorFixo: ehValorFixo,
        pago: false // <-- NOVA LINHA: Toda despesa nasce não paga
    });

    addXP(10);
    carregarDados(uid);
}

// =============================
// CARREGAR DADOS
// =============================
async function carregarDados(uid) {
    await renderLista(uid, "ganhos");
    await renderLista(uid, "despesas");
    await renderLista(uid, "reservas");

    await atualizarGrafico(uid);
    await updateFinanceProgress(uid);

    // Substitua a chamada de metas antiga por esta:
    await carregarMetas(uid);

    await compararDespesasFixas(uid);
    updateXPBar();
}

// ============================
// RENDERIZAR LISTAS PADRÃO
// =============================
async function renderLista(uid, tipo) {
    const ul = document.getElementById(`lista${capitalize(tipo)}`);
    if (!ul) return;
    ul.innerHTML = '';

    const tipoRef = ref(db, `financeiro/${uid}/${tipo}`);
    const snapshot = await get(tipoRef);
    if (!snapshot.exists()) return;

    const meses = snapshot.val();

    Object.entries(meses).forEach(([mesAno, registros]) => {
        Object.entries(registros).forEach(([id, item]) => {
            const li = document.createElement('li');
            
            // Se for despesa e estiver paga, adiciona a classe CSS 'pago'
            if (tipo === 'despesas' && item.pago) {
                li.classList.add('pago');
            }

            li.innerHTML = `
      <div style="display: flex; align-items: center;">
        ${tipo === 'despesas' ? `
            <button class="check-pago" data-id="${id}" data-mes="${mesAno}" style="background:none; border:none; color:white; cursor:pointer; margin-right:10px; font-size:1.2rem;">
                ${item.pago ? '✅' : '✔️'}
            </button>
        ` : ''}
        <span>${item.desc} - R$${item.valor?.toFixed(2) || 0} <small>(${mesAno})</small></span>
      </div>
      <div>
        <button class="edit" data-id="${id}" data-tipo="${tipo}" data-mes="${mesAno}">✏️</button>
        <button class="del" data-id="${id}" data-tipo="${tipo}" data-mes="${mesAno}">🗑️</button>
      </div>`;
            ul.appendChild(li);
        });
    });

    // LÓGICA DO BOTÃO PAGO (CHECK)
    ul.querySelectorAll('.check-pago').forEach(b => {
        b.onclick = async () => {
            const mes = b.dataset.mes;
            const id = b.dataset.id;
            const li = b.closest('li');
            const estaPago = li.classList.contains('pago');

            // Inverte o estado no Firebase
            const itemRef = ref(db, `financeiro/${uid}/despesas/${mes}/${id}`);
            await update(itemRef, { pago: !estaPago });

            // Atualiza a interface
            carregarDados(uid); 
        };
    });

    // LÓGICA DE EXCLUIR
    ul.querySelectorAll('.del').forEach(b => {
        b.onclick = async () => {
            await remove(ref(db, `financeiro/${uid}/${b.dataset.tipo}/${b.dataset.mes}/${b.dataset.id}`));
            carregarDados(uid);
        };
    });

    // LÓGICA DE EDITAR
    ul.querySelectorAll('.edit').forEach(b => {
        b.onclick = async () => {
            const novoValor = prompt("Novo valor:");
            if (novoValor) {
                await update(ref(db, `financeiro/${uid}/${b.dataset.tipo}/${b.dataset.mes}/${b.dataset.id}`), {
                    valor: parseFloat(novoValor)
                });
                carregarDados(uid);
            }
        };
    });
}

// =============================
// SISTEMA DE METAS DINÂMICAS
// =============================
const metasBase = {
    basico: [
        { titulo: "Anotar todas as despesas de hoje", valorMeta: 0 },
        { titulo: "Economizar R$50 essa semana", valorMeta: 50 },
        { titulo: "Ler 5 páginas de um livro financeiro", valorMeta: 0 }
    ],
    intermediario: [
        { titulo: "Passar um mês sem usar o cartão de crédito", valorMeta: 0 },
        { titulo: "Juntar R$500 para reserva de emergência", valorMeta: 500 },
        { titulo: "Revisar as assinaturas mensais e cancelar 1", valorMeta: 0 }
    ],
    avancado: [
        { titulo: "Atingir R$2000 em investimentos", valorMeta: 2000 },
        { titulo: "Planejar uma viagem sem se endividar", valorMeta: 0 },
        { titulo: "Aumentar a renda em 10% este mês", valorMeta: 0 }
    ]
};

async function gerarMetasAutomaticas(uid) {
    const agora = new Date();
    const mesAno = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    const metasRef = ref(db, `financeiro/${uid}/metas/${mesAno}`);
    const snapshot = await get(metasRef);

    if (!snapshot.exists()) {
        const novas = [
            metasBase.basico[Math.floor(Math.random() * metasBase.basico.length)],
            metasBase.intermediario[Math.floor(Math.random() * metasBase.intermediario.length)],
            metasBase.avancado[Math.floor(Math.random() * metasBase.avancado.length)]
        ];

        for (const meta of novas) {
            const novaRef = push(metasRef);
            await set(novaRef, { ...meta, progresso: 0, concluida: false });
        }
    }
}

// =============================
// RENDERIZAR METAS
// =============================
async function renderMetas(uid) {
    const ul = document.getElementById('listaMetas');
    if (!ul) return;
    ul.innerHTML = '';

    const agora = new Date();
    const mesAno = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

    const snapshot = await get(ref(db, `financeiro/${uid}/metas/${mesAno}`));
    if (!snapshot.exists()) return;

    const data = snapshot.val();

    Object.entries(data).forEach(([id, item]) => {
        const percent = Math.min((item.progresso / (item.valorMeta || 1)) * 100, 100);
        const li = document.createElement('li');
        li.innerHTML = `
      <div>
        <strong>${item.titulo}</strong> - ${percent.toFixed(0)}%
        <div class="meta-bar"><div style="width:${percent}%" class="meta-progress"></div></div>
      </div>
      <div>
        ${!item.concluida ? `<button class="checkMeta" data-id="${id}">✅ Concluir</button>` : '<span>🎉 Concluída!</span>'}
      </div>`;
        ul.appendChild(li);
    });

    ul.querySelectorAll('.checkMeta').forEach(b => {
        b.onclick = async () => {
            const metaRef = ref(db, `financeiro/${uid}/metas/${mesAno}/${b.dataset.id}`);
            await update(metaRef, { concluida: true, progresso: 100 });
            addXP(50);
            await carregarDados(uid);
            await gerarMetasAutomaticas(uid);
        };
    });
}

// =============================
// DESPESAS FIXAS E COMPARATIVO
// =============================
async function compararDespesasFixas(uid) {
    const agora = new Date();
    const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

    // Cálculo correto do mês anterior (ajusta o ano se for janeiro)
    let anoAnt = agora.getFullYear();
    let mesAntNum = agora.getMonth(); // getMonth() retorna 0 para Janeiro
    if (mesAntNum === 0) {
        mesAntNum = 12;
        anoAnt--;
    }
    const mesAnterior = `${anoAnt}-${String(mesAntNum).padStart(2, '0')}`;

    const refAtual = ref(db, `financeiro/${uid}/despesas/${mesAtual}`);
    const refAnterior = ref(db, `financeiro/${uid}/despesas/${mesAnterior}`);

    const snapAtual = await get(refAtual);
    const snapAnterior = await get(refAnterior);

    const el = document.getElementById("comparativoFixas");
    if (!el) return;

    // Se não houver mês anterior, exibe a mensagem amigável
    if (!snapAnterior.exists()) {
        el.innerHTML = "<em>Primeiro mês detectado! O comparativo aparecerá quando houver dados do mês anterior.</em>";
        return;
    }

    // Se não houver despesas no mês atual ainda
    if (!snapAtual.exists()) {
        el.innerHTML = "<em>Adicione despesas este mês para comparar com o mês passado.</em>";
        return;
    }

    const atuais = snapAtual.val();
    const anteriores = snapAnterior.val();

    const comparacoes = [];
    Object.entries(atuais).forEach(([id, item]) => {
        // Busca pelo mesmo nome da despesa ignorando maiúsculas/minúsculas
        const anterior = Object.values(anteriores).find(a => a.desc.toLowerCase() === item.desc.toLowerCase());

        if (anterior) {
            const diff = item.valor - anterior.valor;
            if (diff > 0) {
                comparacoes.push(`📈 <strong>${item.desc}</strong>: gastou R$${diff.toFixed(2)} a mais que mês passado.`);
            } else if (diff < 0) {
                comparacoes.push(`📉 <strong>${item.desc}</strong>: economizou R$${Math.abs(diff).toFixed(2)} em relação ao mês passado.`);
            }
        }
    });

    el.innerHTML = comparacoes.length > 0 ? comparacoes.join("<br>") : "<em>Nenhuma conta repetida encontrada para comparar.</em>";
}

// =============================
// PROGRESSO FINANCEIRO
// =============================
async function updateFinanceProgress(uid) {
    const agora = new Date();
    const mesAno = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

    const snapG = await get(ref(db, `financeiro/${uid}/ganhos/${mesAno}`));
    const snapD = await get(ref(db, `financeiro/${uid}/despesas/${mesAno}`));

    let gTotal = 0, dTotal = 0;
    if (snapG.exists()) Object.values(snapG.val()).forEach(v => gTotal += parseFloat(v.valor || 0));
    if (snapD.exists()) Object.values(snapD.val()).forEach(v => dTotal += parseFloat(v.valor || 0));

    const saldo = gTotal - dTotal;
    const porcentagem = gTotal > 0 ? Math.max(0, Math.min((saldo / gTotal) * 100, 100)) : 0;

    const bar = document.getElementById('financeProgress');
    if (bar) bar.style.width = `${porcentagem}%`;

    // Atualiza o texto do Saldo com o valor real
    const statusLabel = document.getElementById("financeStatus");
    if (statusLabel) {
        statusLabel.innerHTML = `Saldo atual: <strong style="color:${saldo >= 0 ? '#ffffffff' : '#f857a6'}">💰 R$ ${saldo.toFixed(2)}</strong>`;
    }
}

// =============================
// GRÁFICOS
// =============================
import { ref as ref2, get as get2 } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";
let grafico;

export async function atualizarGrafico(uid) {
    const agora = new Date();
    const mesAno = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

    const snapG = await get(ref(db, `financeiro/${uid}/ganhos/${mesAno}`));
    const snapD = await get(ref(db, `financeiro/${uid}/despesas/${mesAno}`));

    let gT = 0, dT = 0;
    if (snapG.exists()) Object.values(snapG.val()).forEach(v => gT += parseFloat(v.valor || 0));
    if (snapD.exists()) Object.values(snapD.val()).forEach(v => dT += parseFloat(v.valor || 0));

    const ctx = document.getElementById('graficoMensal');
    if (!ctx) return;

    if (grafico) grafico.destroy();

    grafico = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Entradas', 'Saídas'],
            datasets: [{
                label: 'R$',
                data: [gT, dT],
                backgroundColor: ['#00b09b', '#f857a6'],
                borderRadius: 10
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

// =============================
// FUNÇÃO AUXILIAR
// =============================
function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

