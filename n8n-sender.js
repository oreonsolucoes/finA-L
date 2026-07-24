/**
 * n8n-sender.js
 * Disparo de eventos do Livro de Contas para o webhook do n8n.
 *
 * Carregue ANTES do app:
 *   <script src="n8n-sender.js"></script>
 *
 * Expõe window.dispararWebhookN8N(acao, dados).
 * Se este arquivo não estiver carregado, o app segue funcionando
 * normalmente — a automação é opcional, nunca bloqueia a interface.
 */
(function (global) {
  "use strict";

  var N8N_CONFIG = {
    webhookUrl: "https://n8n.oreonsolucoes.dpdns.org/webhook/84f4df30-a603-4a33-999e-fbb2eb42b0e8",
    debug: false,        // true imprime cada disparo no console
    timeoutMs: 8000,     // corta requisições penduradas
    tentativas: 2,       // 1 reenvio em caso de falha de rede
    filaMax: 40          // eventos guardados enquanto estiver offline
  };

  // Marcadores de "não configurado". A URL real NÃO entra nesta lista —
  // era esse o bug: comparar a URL de produção com ela mesma fazia a
  // função sair no primeiro if e nunca enviar nada.
  var PLACEHOLDERS = [
    "COLE_SUA_URL_AQUI",
    "SUA_URL_DO_WEBHOOK",
    "localhost/webhook/xxx",
    "webhook/teste"
  ];

  function log() {
    if (!N8N_CONFIG.debug) return;
    console.log.apply(console, ["[n8n]"].concat([].slice.call(arguments)));
  }

  function configurado() {
    var u = N8N_CONFIG.webhookUrl;
    if (!u || typeof u !== "string") return false;
    if (!/^https?:\/\//i.test(u)) return false;
    for (var i = 0; i < PLACEHOLDERS.length; i++) {
      if (u.indexOf(PLACEHOLDERS[i]) !== -1) return false;
    }
    return true;
  }

  /* ---------- fila offline ---------- */

  var CHAVE_FILA = "n8n_fila_pendente";

  function lerFila() {
    try { return JSON.parse(localStorage.getItem(CHAVE_FILA) || "[]"); }
    catch (e) { return []; }
  }
  function gravarFila(f) {
    try { localStorage.setItem(CHAVE_FILA, JSON.stringify(f.slice(-N8N_CONFIG.filaMax))); }
    catch (e) { /* localStorage cheio ou bloqueado: ignora */ }
  }
  function enfileirar(payload) {
    var f = lerFila();
    f.push(payload);
    gravarFila(f);
    log("guardado na fila (" + f.length + " pendente(s))");
  }

  async function drenarFila() {
    if (!configurado()) return;
    var f = lerFila();
    if (!f.length) return;
    log("reenviando " + f.length + " evento(s) da fila");
    gravarFila([]);
    var falharam = [];
    for (var i = 0; i < f.length; i++) {
      var ok = await enviar(f[i], 1);
      if (!ok) falharam.push(f[i]);
    }
    if (falharam.length) gravarFila(falharam);
  }

  /* ---------- envio ---------- */

  async function enviar(payload, tentativasRestantes) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, N8N_CONFIG.timeoutMs) : null;

    try {
      var resposta = await fetch(N8N_CONFIG.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined,
        keepalive: true   // sobrevive ao fechamento da aba
      });

      if (!resposta.ok) {
        // 4xx é erro de configuração: reenviar não resolve.
        if (resposta.status >= 400 && resposta.status < 500) {
          log("recusado pelo n8n (status " + resposta.status + "), não vou reenviar");
          return true;
        }
        throw new Error("status " + resposta.status);
      }

      log("enviado:", payload.acao);
      return true;

    } catch (erro) {
      if (tentativasRestantes > 1) {
        await new Promise(function (r) { setTimeout(r, 1200); });
        return enviar(payload, tentativasRestantes - 1);
      }
      log("falhou:", payload.acao, erro && erro.message);
      return false;

    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * @param {string} acao  ex: 'criar_despesa', 'status_pagamento_alterado', 'saldo_conferido'
   * @param {Object} dados corpo do evento
   * @returns {Promise<boolean>} nunca lança; false quando não conseguiu entregar
   */
  async function dispararWebhookN8N(acao, dados) {
    if (!configurado()) {
      log("webhook não configurado, ignorando", acao);
      return false;
    }

    var payload = {
      acao: acao,
      dados: dados,
      livro: global.LIVRO_ID || "casa",
      timestamp: new Date().toISOString()
    };

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      enfileirar(payload);
      return false;
    }

    var ok = await enviar(payload, N8N_CONFIG.tentativas);
    if (!ok) enfileirar(payload);
    return ok;
  }

  if (typeof global.addEventListener === "function") {
    global.addEventListener("online", drenarFila);
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", drenarFila);
    } else {
      drenarFila();
    }
  }

  global.dispararWebhookN8N = dispararWebhookN8N;
  global.N8N_CONFIG = N8N_CONFIG;

})(typeof window !== "undefined" ? window : this);
