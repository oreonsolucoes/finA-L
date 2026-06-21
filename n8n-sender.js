/**
 * n8n-sender.js
 * Script isolado para gerenciar os disparos para o Webhook do n8n
 */

const N8N_CONFIG = {
  // AJUSTE: Insira a sua URL de produção do Webhook do n8n aqui
  webhookUrl: "https://n8n.oreonsolucoes.dpdns.org/webhook/84f4df30-a603-4a33-999e-fbb2eb42b0e8",
  debug: true // Ativa mensagens no console para facilitar seus testes
};

/**
 * Função principal para disparar os eventos para o n8n
 * @param {string} acao - O tipo de evento (ex: 'criar_despesa', 'status_pagamento_alterado', 'saldo_atualizado')
 * @param {Object} dados - O objeto com as informações que serão enviadas
 */
async function dispararWebhookN8N(acao, dados) {
  // Valida se a URL padrão foi alterada
  if (!N8N_CONFIG.webhookUrl || N8N_CONFIG.webhookUrl.includes("SUA_URL_AQUI")) {
    if (N8N_CONFIG.debug) console.warn("⚠️ n8n: URL do webhook não configurada corretamente.");
    return;
  }

  const payload = {
    acao: acao,
    dados: dados,
    timestamp: new Date().toISOString()
  };

  if (N8N_CONFIG.debug) {
    console.log(`🚀 n8n: Tentando disparar ação [${acao}]`, payload);
  }

  try {
    const resposta = await fetch(N8N_CONFIG.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!resposta.ok) {
      throw new Error(`Erro no servidor n8n (Status: ${resposta.status})`);
    }

    // Se o n8n retornar um JSON válido, você pode ler aqui
    const resultado = await resposta.json().catch(() => ({ msg: "Sem resposta JSON" }));
    
    if (N8N_CONFIG.debug) {
      console.log("✅ n8n: Enviado com sucesso!", resultado);
    }
    return true;

  } catch (erro) {
    console.error("❌ n8n: Erro crítico ao enviar requisição:", erro);
    return false;
  }
}

// Se quiser testar direto no console chamando o arquivo, descomente a linha abaixo:
// dispararWebhookN8N("teste_separado", { status: "funcionando" });
