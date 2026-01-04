import { dbRT } from './firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { auth } from './firebase-config.js';

const inputPergunta = document.getElementById("perguntaFinanceira");
const btnPerguntar = document.getElementById("enviarPergunta");
const respostaDiv = document.getElementById("respostaAssistente");

onAuthStateChanged(auth, (user) => {
    if (user) {
        btnPerguntar.onclick = () => analisarPergunta(user.uid);
    }
});

async function analisarPergunta(uid) {
    const pergunta = inputPergunta.value.trim();
    if (!pergunta) return;

    respostaDiv.innerHTML = "<p>⏳ Analisando suas finanças...</p>";

    // Lê dados atuais
    const agora = new Date();
    const mesAno = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    const refGanhos = ref(dbRT, `financeiro/${uid}/ganhos/${mesAno}`);
    const refDespesas = ref(dbRT, `financeiro/${uid}/despesas/${mesAno}`);
    const snapGanhos = await get(refGanhos);
    const snapDespesas = await get(refDespesas);

    let ganhosTotais = 0, despesasTotais = 0;
    if (snapGanhos.exists()) Object.values(snapGanhos.val()).forEach(g => ganhosTotais += parseFloat(g.valor || 0));
    if (snapDespesas.exists()) Object.values(snapDespesas.val()).forEach(d => despesasTotais += parseFloat(d.valor || 0));

    const saldoAtual = ganhosTotais - despesasTotais;

    // Extrai valores mencionados na pergunta
    const regexValor = pergunta.match(/(\d+([.,]\d+)?)/);
    const valor = regexValor ? parseFloat(regexValor[0].replace(',', '.')) : 0;

    // Gera respostas com base no contexto
    let resposta = "";
    if (pergunta.includes("gastar") || pergunta.includes("comprar")) {
        const novoSaldo = saldoAtual - valor;
        const percGasto = ganhosTotais > 0 ? (valor / ganhosTotais) * 100 : 0;

        if (novoSaldo < 0) {
            resposta = `
                ⚠️ Isso deixará vocês negativos!<br>
                Seu saldo atual é de <strong>R$${saldoAtual.toFixed(2)}</strong> e, após gastar R$${valor.toFixed(2)}, ficará em <strong>R$${novoSaldo.toFixed(2)}</strong>.<br>
                🧠 Eu repensaria essa compra — talvez seja melhor esperar o próximo mês ou conferir se é prioridade.
            `;
        } else if (percGasto > 70) {
            resposta = `
                😬 Esse gasto é alto — representa ${percGasto.toFixed(1)}% do que vocês ganharam este mês.<br>
                Seu saldo ficaria em <strong>R$${novoSaldo.toFixed(2)}</strong>.<br>
                Talvez seja melhor reservar parte disso para emergências.
            `;
        } else if (percGasto > 40) {
            resposta = `
                🤔 Esse gasto é considerável (${percGasto.toFixed(1)}% dos ganhos).<br>
                Vocês ainda ficariam positivos com R$${novoSaldo.toFixed(2)}, mas avaliem se realmente vale a pena agora.
            `;
        } else if (percGasto > 10) {
            resposta = `
                💡 Gasto moderado — ${percGasto.toFixed(1)}% do saldo mensal.<br>
                Se for algo importante ou que traga alegria, pode valer a pena. 😄
            `;
        } else {
            resposta = `
                ✅ Tranquilo! Esse gasto é pequeno (${percGasto.toFixed(1)}% dos ganhos).<br>
                Vocês continuarão com R$${novoSaldo.toFixed(2)} de saldo. 😉
            `;
        }

    } else if (pergunta.includes("ganhar") || pergunta.includes("receber")) {
        const novoSaldo = saldoAtual + valor;
        const aumento = ((valor / (ganhosTotais || 1)) * 100).toFixed(1);

        if (valor > ganhosTotais * 0.5) {
            resposta = `
                🚀 Uau! Esse ganho representa ${aumento}% do total do mês.<br>
                Excelente oportunidade para reforçar a reserva de emergência ou adiantar metas grandes! 💪
            `;
        } else if (valor > ganhosTotais * 0.2) {
            resposta = `
                🎯 Um bom incremento de ${aumento}% nos ganhos mensais!<br>
                Que tal destinar parte para lazer e parte para poupança? 🌱
            `;
        } else {
            resposta = `
                💰 Um ganho é sempre bem-vindo! Esse adiciona ${aumento}% ao total do mês.<br>
                Continue assim e logo o saldo positivo vai crescer ainda mais. 😄
            `;
        }

    } else if (pergunta.includes("guardar") || pergunta.includes("poupar")) {
        resposta = `
            💎 Guardar é sempre uma ótima ideia!<br>
            Mesmo pequenas quantias fazem diferença com o tempo.<br>
            Que tal definir uma meta de economia automática mensal? 🔁
        `;
    } else if (valor === 0) {
        resposta = `
            🤔 Não encontrei um valor na sua pergunta.<br>
            Tente algo como: “Se eu gastar R$100 com pizza, fico positivo?” 🍕
        `;
    } else {
        resposta = `
            🧭 Eu posso te ajudar a decidir sobre gastos ou ganhos.<br>
            Pergunte algo como “Posso gastar R$200 em roupas?” ou “E se eu receber R$500 a mais?” 💬
        `;
    }

    respostaDiv.innerHTML = `<p>${resposta}</p>`;
}
