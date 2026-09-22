(function(){
"use strict";

/* ═══════════════════════════════════════════════════════════════
   CONFIGURAÇÃO
   ═══════════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "AIzaSyC8hKLZ_pKHJ7DlS6OqvDvqzPk9FN3-8OM",
  authDomain: "financas-ael.firebaseapp.com",
  databaseURL: "https://financas-ael-default-rtdb.firebaseio.com",
  projectId: "financas-ael",
  storageBucket: "financas-ael.firebasestorage.app",
  messagingSenderId: "928624497972",
  appId: "1:928624497972:web:7204275e84d1ac40e84161"
};

const LIVRO_ID = "casa";
window.LIVRO_ID = LIVRO_ID;

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.database();

/* ═══════════════════════════════════════════════════════════════
   CONSTANTES
   ═══════════════════════════════════════════════════════════════ */

const CATEGORIAS = [
  { id:"moradia",     nome:"Moradia",       cor:"var(--c-moradia)" },
  { id:"mercado",     nome:"Mercado",       cor:"var(--c-mercado)" },
  { id:"transporte",  nome:"Transporte",    cor:"var(--c-transporte)" },
  { id:"saude",       nome:"Saúde",         cor:"var(--c-saude)" },
  { id:"assinaturas", nome:"Assinaturas",   cor:"var(--c-assinaturas)" },
  { id:"lazer",       nome:"Lazer",         cor:"var(--c-lazer)" },
  { id:"beleza",      nome:"Beleza",        cor:"var(--c-beleza)" },
  { id:"fatura",      nome:"Cartão/Fatura", cor:"var(--c-fatura)" },
  { id:"outros",      nome:"Outros",        cor:"var(--c-outros)" }
];

const MESES = ["janeiro","fevereiro","março","abril","maio","junho",
               "julho","agosto","setembro","outubro","novembro","dezembro"];

const PALETA_PESSOA = ["#1F5D50","#9E3B2F","#2C5578","#5D4680"];

const JANELAS_ENTRADA = [
  { dia:5,  recebidoPor:"Adailton", valor:2450, antecipar:true  },
  { dia:15, recebidoPor:"Laryssa",  valor:1050, antecipar:false },
  { dia:20, recebidoPor:"Adailton", valor:1745, antecipar:true  },
  { dia:30, recebidoPor:"Laryssa",  valor:650,  antecipar:false }
];

// Feriados nacionais fixos — atualize anualmente os móveis (Carnaval, Páscoa, Corpus Christi)
const FERIADOS = new Set([
  // 2025
  "2025-01-01","2025-04-18","2025-04-21","2025-05-01",
  "2025-09-07","2025-10-12","2025-11-02","2025-11-15","2025-12-25",
  // 2026
  "2026-01-01","2026-04-03","2026-04-21","2026-05-01",
  "2026-09-07","2026-10-12","2026-11-02","2026-11-15","2026-12-25",
  // 2027
  "2027-01-01","2027-03-26","2027-04-21","2027-05-01",
  "2027-09-07","2027-10-12","2027-11-02","2027-11-15","2027-12-25"
]);

// Retrocede até o dia útil anterior (sexta, ou anterior se feriado)
function diaUtilAnterior(iso){
  const d = new Date(iso + "T12:00:00");
  while(d.getDay() === 0 || d.getDay() === 6 || FERIADOS.has(d.toISOString().slice(0,10))){
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().slice(0,10);
}

function janelasPadrao(){
  return S.janelasEntrada || JANELAS_ENTRADA;
}
function categoriasPadrao(){
  return S.categorias || CATEGORIAS;
}

/* ═══════════════════════════════════════════════════════════════
   ESTADO
   ═══════════════════════════════════════════════════════════════ */

const S = {
  user: null,
  authReady: false,
  dataReady: false,
  authMode: "login",
  authErr: "",
  authBusy: false,

  saldoBase: 0,
  saldoBaseEm: null,
  perfis: [],
  despesas: [],

  mesAtivo: mesAtualISO(),
  filtro: "todas",
  aba: "contas",
  janelasEntrada: null,
  distConfig: null,
  categorias: null,
  janela: 6,
  filtroCat: null,
  modal: null,
  tema: localStorage.getItem("tema") || "auto"
};

document.documentElement.dataset.theme = S.tema;

const root  = document.getElementById("root");
const toast = document.getElementById("toast");

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function uid(){
  return crypto.randomUUID ? crypto.randomUUID()
       : "id-"+Date.now()+"-"+Math.random().toString(36).slice(2,9);
}
function hojeISO(){
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
}
function mesAtualISO(){ return hojeISO().slice(0,7); }

function money(v){
  return (Number(v)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}
function moneyShort(v){
  const n = Number(v)||0;
  return (n<0?"−":"") + Math.abs(n).toLocaleString("pt-BR",{minimumFractionDigits:2, maximumFractionDigits:2});
}
function fmtData(iso){
  if(!iso) return "—";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function fmtDiaLongo(iso){
  const dt = new Date(iso+"T12:00:00");
  const dia = String(dt.getDate()).padStart(2,"0");
  const sem = ["dom","seg","ter","qua","qui","sex","sáb"][dt.getDay()];
  return `${sem} ${dia}/${String(dt.getMonth()+1).padStart(2,"0")}`;
}
function diasDe(iso){
  const a = new Date(iso+"T00:00:00"), b = new Date(hojeISO()+"T00:00:00");
  return Math.round((b-a)/864e5);
}
function addMes(ym, delta){
  let [y,m] = ym.split("-").map(Number);
  m += delta;
  while(m > 12){ m -= 12; y++; }
  while(m < 1){ m += 12; y--; }
  return `${y}-${String(m).padStart(2,"0")}`;
}
function labelMes(ym){
  const [y,m] = ym.split("-").map(Number);
  return { nome: MESES[m-1], ano: y };
}
function cat(id){ const cs = categoriasPadrao(); return cs.find(c=>c.id===id) || cs[cs.length-1]; }

function dividirParcelas(total, n){
  const cent  = Math.round((Number(total)||0) * 100);
  const base  = Math.floor(cent / n);
  const sobra = cent - base * n;
  return Array.from({length:n}, (_,i) => (base + (i < sobra ? 1 : 0)) / 100);
}

function dataParcela(vencInicial, i){
  const ym  = addMes(vencInicial.slice(0,7), i);
  const dia = Number(vencInicial.slice(8,10)) || 1;
  const [y,mo] = ym.split("-").map(Number);
  const ultimo = new Date(y, mo, 0).getDate();
  return `${ym}-${String(Math.min(dia, ultimo)).padStart(2,"0")}`;
}
function pessoa(id){ return S.perfis.find(p=>p.id===id) || S.perfis[0] || {id:"?",nome:"?",cor:"#888"}; }
function inicial(nome){ return (nome||"?").trim().charAt(0).toUpperCase(); }

function esc(s){
  return String(s==null?"":s).replace(/[&<>"']/g, m =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}
function atrasada(d){ return !d.pago && d.tipo !== "entrada" && d.vencimento < hojeISO(); }

function say(msg, erro){
  toast.textContent = msg;
  toast.classList.toggle("err", !!erro);
  toast.classList.add("show");
  clearTimeout(say._t);
  say._t = setTimeout(()=> toast.classList.remove("show"), 3400);
}

/* ═══════════════════════════════════════════════════════════════
   WEBHOOK
   ═══════════════════════════════════════════════════════════════ */

function avisarN8N(acao, dados){
  if(typeof window.dispararWebhookN8N !== "function") return;
  try{ window.dispararWebhookN8N(acao, dados); }
  catch(e){}
}

function textoN8N(acao, d, extra){
  const nomeCat  = d.categoria ? cat(d.categoria).nome : "";
  const venc     = d.vencimento ? fmtData(d.vencimento) : "—";
  const val      = money(d.valor || 0);
  const desc     = d.descricao || "Sem descrição";
  const quem     = d.adicionadoPor ? pessoa(d.adicionadoPor).nome : "";

  if(acao === "nova_despesa"){
    const nParc   = extra && extra.nParc > 1 ? extra.nParc : 1;
    const parcStr = nParc > 1 ? `\n🔢 Parcelado em ${nParc}x` : "";
    const recStr  = d.recorrente ? "\n↺ Recorrente todo mês" : "";
    return `💸 *Nova conta lançada*\n📝 ${desc}\n💰 ${val}\n🏷 ${nomeCat}\n📅 Vence ${venc}${parcStr}${recStr}${quem ? `\n👤 ${quem}` : ""}`;
  }
  if(acao === "editar_despesa"){
    return `✏️ *Conta editada*\n📝 ${desc}\n💰 ${val}\n🏷 ${nomeCat}\n📅 Vence ${venc}${quem ? `\n👤 ${quem}` : ""}`;
  }
  if(acao === "quitar_despesa"){
    const dataPag = extra && extra.dataPagamento ? fmtData(extra.dataPagamento) : fmtData(hojeISO());
    return `✅ *Conta quitada!*\n📝 ${desc}\n💰 ${val}${nomeCat ? `\n🏷 ${nomeCat}` : ""}\n📅 Pago em ${dataPag}`;
  }
  if(acao === "excluir_despesa"){
    return `🗑 *Conta excluída*\n📝 ${desc}\n💰 ${val}${nomeCat ? `\n🏷 ${nomeCat}` : ""}`;
  }
  return `📱 ${acao}: ${desc} — ${val}`;
}

/* ═══════════════════════════════════════════════════════════════
   FIREBASE
   ═══════════════════════════════════════════════════════════════ */

function refLivro(){ return db.ref("livros/"+LIVRO_ID); }

let unsubs = [];

function ouvirDados(){
  desligarDados();
  const rMeta = refLivro().child("meta");
  const rDesp = refLivro().child("despesas");

  const h1 = rMeta.on("value", snap => {
    const m = snap.val() || {};
    S.saldoBase       = Number(m.saldoBase) || 0;
    S.saldoBaseEm     = m.saldoBaseEm || null;
    S.perfis          = m.perfis && m.perfis.length ? m.perfis : perfisPadrao();
    S.janelasEntrada  = m.janelasEntrada && m.janelasEntrada.length ? m.janelasEntrada : null;
    S.distConfig      = m.distConfig || null;
    S.categorias      = m.categorias  && m.categorias.length  ? m.categorias  : null;
    S.dataReady = true;
    render();
  }, () => { S.dataReady = true; say("Sem permissão para ler o livro.", true); render(); });

  let recMatOk = false;
  const h2 = rDesp.on("value", snap => {
    const obj = snap.val() || {};
    S.despesas = Object.keys(obj).map(k => Object.assign({ id:k }, obj[k]));
    S.dataReady = true;
    if(!recMatOk){ recMatOk = true; materializarRecorrentes(); }
    render();
  }, () => { S.dataReady = true; render(); });

  unsubs = [
    ()=> rMeta.off("value", h1),
    ()=> rDesp.off("value", h2)
  ];
}
function desligarDados(){ unsubs.forEach(f=>f()); unsubs = []; }

function perfisPadrao(){
  const nome = (S.user && (S.user.displayName || (S.user.email||"").split("@")[0])) || "Você";
  return [
    { id:"p1", nome: nome.slice(0,20), cor: PALETA_PESSOA[0] },
    { id:"p2", nome:"Parceiro(a)",     cor: PALETA_PESSOA[1] }
  ];
}

async function salvarMeta(patch){
  try{ await refLivro().child("meta").update(patch); }
  catch(e){ say("Não foi possível salvar.", true); }
}
async function gravarDespesa(id, dados){
  try{ await refLivro().child("despesas/"+id).update(dados); }
  catch(e){ say("Não foi possível salvar a despesa.", true); }
}
async function apagarDespesa(id){
  try{ await refLivro().child("despesas/"+id).remove(); }
  catch(e){ say("Não foi possível excluir.", true); }
}

/* ═══════════════════════════════════════════════════════════════
   CÁLCULOS DERIVADOS
   ═══════════════════════════════════════════════════════════════ */

function rendaFixaMensal(){ return janelasPadrao().reduce((s,j)=>s+j.valor,0); }

function rendaNoMes(ym){
  return S.despesas
    .filter(d => d.tipo==="entrada" && (d.vencimento||"").slice(0,7)===ym)
    .reduce((s,d)=>s+(Number(d.valor)||0),0);
}

function saldoAtual(){
  const desde = S.saldoBaseEm;
  const depois = S.despesas.filter(d =>
    d.pago && d.dataPagamento && (!desde || d.dataPagamento > desde)
  );
  const entradas = depois.filter(d => d.tipo==="entrada")
    .reduce((s,d) => s + (Number(d.valor)||0), 0);
  const saidas   = depois.filter(d => d.tipo!=="entrada")
    .reduce((s,d) => s + (Number(d.valor)||0), 0);
  return S.saldoBase + entradas - saidas;
}

function doMes(ym){
  return S.despesas.filter(d => (d.vencimento||"").slice(0,7) === ym);
}

function resumo(ym){
  const lista = doMes(ym).filter(d => d.tipo !== "entrada");
  const pagas     = lista.filter(d=>d.pago);
  const abertas   = lista.filter(d=>!d.pago);
  const atrasadas = lista.filter(atrasada);

  const total    = lista.reduce((s,d)=>s+(Number(d.valor)||0),0);
  const vlPago   = pagas.reduce((s,d)=>s+(Number(d.valor)||0),0);
  const vlAberto = abertas.reduce((s,d)=>s+(Number(d.valor)||0),0);
  const vlAtraso = atrasadas.reduce((s,d)=>s+(Number(d.valor)||0),0);

  return {
    lista, total, vlPago, vlAberto, vlAtraso,
    nTodas: lista.length, nPagas: pagas.length,
    nAbertas: abertas.length, nAtrasadas: atrasadas.length,
    pctPago: total>0 ? (vlPago/total)*100 : 0,
    pctAtraso: total>0 ? (vlAtraso/total)*100 : 0
  };
}

function acerto(ym){
  const compartilhadas = doMes(ym).filter(d => d.pago && d.divisao !== "individual" && d.tipo !== "entrada");
  if(compartilhadas.length === 0 || S.perfis.length < 2) return null;

  const porPessoa = {};
  S.perfis.forEach(p => porPessoa[p.id] = 0);
  compartilhadas.forEach(d => {
    const quem = d.pagoPor || d.adicionadoPor || S.perfis[0].id;
    if(porPessoa[quem] === undefined) porPessoa[quem] = 0;
    porPessoa[quem] += Number(d.valor)||0;
  });

  const total = Object.values(porPessoa).reduce((a,b)=>a+b,0);
  const justo = total / S.perfis.length;

  const a = S.perfis[0], b = S.perfis[1];
  const difA = (porPessoa[a.id]||0) - justo;

  if(Math.abs(difA) < 0.01) return { quitado:true, total };

  const devedor  = difA > 0 ? b : a;
  const credor   = difA > 0 ? a : b;
  return { quitado:false, devedor, credor, valor: Math.abs(difA), total };
}

/* ═══════════════════════════════════════════════════════════════
   ANÁLISE / RELATÓRIOS
   ═══════════════════════════════════════════════════════════════ */

const MES_CURTO = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
function labelCurto(ym){ return `${MES_CURTO[+ym.slice(5)-1]}/${ym.slice(2,4)}`; }

function serieMeses(ateYM, n){
  const arr = [];
  for(let i = n-1; i >= 0; i--){
    const ym = addMes(ateYM, -i);
    const lista = doMes(ym).filter(d => d.tipo !== "entrada");
    const total = lista.reduce((s,d)=>s+(Number(d.valor)||0),0);
    const pago  = lista.filter(d=>d.pago).reduce((s,d)=>s+(Number(d.valor)||0),0);
    arr.push({ ym, total, pago, aberto: total-pago, n: lista.length });
  }
  return arr;
}

function porCategoria(ateYM, n){
  const acc = {};
  for(let i = 0; i < n; i++){
    doMes(addMes(ateYM, -i)).filter(d => d.tipo !== "entrada").forEach(d => {
      acc[d.categoria] = (acc[d.categoria] || 0) + (Number(d.valor)||0);
    });
  }
  return Object.entries(acc)
    .map(([id,total]) => ({ id, total, media: total/n }))
    .sort((a,b)=> b.total - a.total);
}

function mediaVariavel(n){
  const base = mesAtualISO();
  let soma = 0;
  for(let i = 1; i <= n; i++){
    soma += doMes(addMes(base, -i))
      .filter(d => d.tipo !== "entrada" && !d.recorrente && !(d.parcelas > 1))
      .reduce((s,d)=>s+(Number(d.valor)||0),0);
  }
  return n ? soma/n : 0;
}

function travadoNoMes(ym){
  return doMes(ym).filter(d => d.tipo !== "entrada").reduce((s,d)=>s+(Number(d.valor)||0),0);
}

function projecao(n){
  const base = mesAtualISO();
  const mv = mediaVariavel(3);
  const saldo0 = saldoAtual();
  let pisoSaldo = saldo0, provSaldo = saldo0;
  const renda = rendaFixaMensal();
  const linhas = [];
  for(let i = 1; i <= n; i++){
    const ym = addMes(base, i);
    const travado = travadoNoMes(ym);
    const rendaReal = rendaNoMes(ym) || renda;
    pisoSaldo = pisoSaldo + rendaReal - travado;
    provSaldo = provSaldo + rendaReal - (travado + mv);
    linhas.push({ ym, travado, rendaReal, pisoSaldo, provSaldo });
  }
  return { mediaVariavel: mv, saldo0, linhas };
}

function planoPagamento(ym){
  const [y,m] = ym.split("-").map(Number);
  const janelas = janelasPadrao().map(j => {
    const dia = Math.min(j.dia, new Date(y, m, 0).getDate());
    let data = `${ym}-${String(dia).padStart(2,"0")}`;
    if(j.antecipar) data = diaUtilAnterior(data);
    return { data, valor:j.valor, recebidoPor:j.recebidoPor };
  });
  // última janela do mês anterior — contas que vencem antes do dia 5 vão aqui
  const ymAnt = addMes(ym, -1);
  const [yA,mA] = ymAnt.split("-").map(Number);
  const jUltAnt = (()=>{
    const j = janelasPadrao()[janelasPadrao().length - 1];
    const dia = Math.min(j.dia, new Date(yA, mA, 0).getDate());
    return { data:`${ymAnt}-${String(dia).padStart(2,"0")}`, valor:j.valor, recebidoPor:j.recebidoPor };
  })();
  const contas = doMes(ym).filter(d => !d.pago && d.tipo !== "entrada")
    .sort((a,b) => (a.vencimento||"").localeCompare(b.vencimento||""));
  let acumBase = saldoAtual();
  const saldosJanela = janelas.map((j) => { acumBase += j.valor; return acumBase; });
  const plano = [];
  const alocado = janelas.map(()=>0);
  contas.forEach(d => {
    const venc = d.vencimento;
    const candidatas = janelas.map((j,i) => ({i, j})).filter(({j}) => j.data <= venc);
    if(!candidatas.length){
      // vence antes do dia 5 → jogar na última janela do mês anterior
      plano.push({ conta:d, data:jUltAnt.data, dataVenc:venc, janela:null, adiantou:true, tipo:"anterior" });
      return;
    }
    let escolhida = null;
    for(let k = candidatas.length-1; k >= 0; k--){
      const {i} = candidatas[k];
      const disponivelNaJanela = saldosJanela[i] - alocado[i];
      if(disponivelNaJanela >= (Number(d.valor)||0)){ escolhida = i; break; }
    }
    if(escolhida === null) escolhida = candidatas[candidatas.length-1].i;
    alocado[escolhida] += Number(d.valor)||0;
    const dSug = janelas[escolhida].data;
    const adiantou = dSug < venc;
    plano.push({ conta:d, data:dSug, dataVenc:venc, janela:escolhida, adiantou, tipo:"normal" });
  });
  return { plano, janelas, saldosJanela, jUltAnt };
}

function distribuirSobra(ym){
  const renda  = rendaNoMes(ym) || rendaFixaMensal();
  const gastos = resumo(ym).total;
  const sobra  = renda - gastos;
  if(sobra <= 0) return { sobra, nada:true };

  const cfg = Object.assign({ reserva:15, investimento:10 }, S.distConfig || {});
  const pRes = Math.max(0, Math.min(cfg.reserva, 100)) / 100;
  const pInv = Math.max(0, Math.min(cfg.investimento, 100 - cfg.reserva)) / 100;
  const pLivre = Math.max(0, 1 - pRes - pInv);

  const jan = janelasPadrao();
  // agrupa renda por pessoa (usa nome como chave)
  const porPessoa = {};
  jan.forEach(j => { porPessoa[j.recebidoPor] = (porPessoa[j.recebidoPor]||0) + j.valor; });
  // Adiciona entradas avulsas pagas
  (S.despesas||[]).filter(d => d.tipo==="entrada" && d.pago && (d.vencimento||"").slice(0,7)===ym)
    .forEach(d => {
      const nome = pessoa(d.adicionadoPor||S.perfis[0]?.id).nome;
      porPessoa[nome] = (porPessoa[nome]||0) + (Number(d.valor)||0);
    });

  const totalR = Object.values(porPessoa).reduce((s,v)=>s+v,0) || 1;
  const vlLivre   = sobra * pLivre;
  const vlRes     = sobra * pRes;
  const vlInvest  = sobra * pInv;
  const livres    = Object.entries(porPessoa).map(([nome,v])=>({ nome, pct: v/totalR, valor: vlLivre * (v/totalR) }));

  return { sobra, vlRes, vlInvest, vlLivre, livres, cfg, nada:false };
}

function sugestoes(){
  const out = [];
  const base = mesAtualISO();

  const atr = doMes(base).filter(atrasada);
  if(atr.length){
    const v = atr.reduce((s,d)=>s+(Number(d.valor)||0),0);
    out.push({ icon:"alert", prio:1,
      titulo:"Contas atrasadas",
      texto:`${atr.length} conta${atr.length>1?"s":""} vencida${atr.length>1?"s":""} somando ${money(v)}. Quite antes de gerar juros.` });
  }

  const abertoMes = doMes(base).filter(d=>!d.pago && d.tipo!=="entrada").reduce((s,d)=>s+(Number(d.valor)||0),0);
  const prev = saldoAtual() - abertoMes;
  if(prev < 0){
    out.push({ icon:"alert", prio:1,
      titulo:"Saldo aperta este mês",
      texto:`Pagando tudo que falta, o saldo fica em ${money(prev)}. Segure gastos não essenciais ou reforce a conta.` });
  }

  const catAtual = {}, catHist = {};
  doMes(base).filter(d=>d.tipo!=="entrada").forEach(d => catAtual[d.categoria] = (catAtual[d.categoria]||0) + (Number(d.valor)||0));
  for(let i=1;i<=3;i++) doMes(addMes(base,-i)).filter(d=>d.tipo!=="entrada").forEach(d =>
    catHist[d.categoria] = (catHist[d.categoria]||0) + (Number(d.valor)||0));
  Object.entries(catAtual).forEach(([c,v])=>{
    const media = (catHist[c]||0)/3;
    if(media > 0 && v > media*1.25){
      out.push({ icon:"up", prio:2,
        titulo:`${cat(c).nome} acima do normal`,
        texto:`${Math.round((v/media-1)*100)}% acima da média dos últimos meses (${money(v)} vs ${money(media)}).` });
    }
  });

  const mediaGasto = (()=>{ let s=0; for(let j=1;j<=3;j++) s+=travadoNoMes(addMes(base,-j)); return s/3; })();
  for(let i=1;i<=6;i++){
    const ym = addMes(base,i);
    const trav = travadoNoMes(ym);
    if(trav > 0 && mediaGasto > 0 && trav > mediaGasto){
      out.push({ icon:"calendar", prio:2,
        titulo:`${MES_CURTO[+ym.slice(5)-1]} vem pesado`,
        texto:`Já há ${money(trav)} comprometidos em ${labelMes(ym).nome}, acima do gasto médio. Vale reservar antes.` });
      break;
    }
  }

  const { plano } = planoPagamento(base);
  const anteriores = plano.filter(p=>p.tipo==="anterior");
  if(anteriores.length){
    out.push({ icon:"calendar", prio:2,
      titulo:"Pagar antes do mês virar",
      texto:`${anteriores.length} conta${anteriores.length>1?"s":""} vencem antes do dia 5 e devem ser pagas na última janela do mês anterior. Veja o Plano.` });
  }

  if(S.perfis.length === 2){
    const por = {}; S.perfis.forEach(p=>por[p.id]=0);
    doMes(base).filter(d=>d.pago && d.divisao!=="individual" && d.tipo!=="entrada").forEach(d=>{
      const q = d.pagoPor || d.adicionadoPor || S.perfis[0].id;
      por[q] = (por[q]||0) + (Number(d.valor)||0);
    });
    const a = por[S.perfis[0].id]||0, b = por[S.perfis[1].id]||0, tot = a+b;
    if(tot > 0){
      const dif = Math.abs(a-b)/2;
      if(dif > tot*0.15){
        const credor = a > b ? S.perfis[0] : S.perfis[1];
        out.push({ icon:"users", prio:3,
          titulo:"Contas do casal desequilibradas",
          texto:`${esc(credor.nome)} pagou mais das despesas divididas. Um acerto de ${money(dif)} fecha o mês em paz.` });
      }
    }
  }

  if(out.length === 0){
    out.push({ icon:"check", prio:9,
      titulo:"Tudo sob controle",
      texto:"Nenhum alerta neste mês: sem atrasos, gastos dentro da média e contas equilibradas." });
  }

  return out.sort((x,y)=> x.prio - y.prio);
}

/* ═══════════════════════════════════════════════════════════════
   RECORRÊNCIAS
   ═══════════════════════════════════════════════════════════════ */

function materializarRecorrentes(){
  const hoje   = hojeISO();
  const ym     = hoje.slice(0,7);
  const ateFut = addMes(ym, 12); // sempre pré-cria 12 meses à frente

  // Templates = entradas com recorrente:true (o original nunca perde essa flag)
  const templates = S.despesas.filter(d => d.recorrente);

  templates.forEach(tmpl => {
    const baseYM = (tmpl.vencimento || hoje).slice(0,7);
    // Cria cópias do mês seguinte ao template até (mês atual + janela)
    let cursor = addMes(baseYM, 1);
    while(cursor <= ateFut){
      // Já existe cópia para este mês?
      const jaExiste = S.despesas.some(d =>
        !d.recorrente &&
        d.origem === tmpl.id &&
        d.vencimento && d.vencimento.slice(0,7) === cursor
      );
      if(!jaExiste){
        const novoVenc = dataParcela(tmpl.vencimento,
          (Number(cursor.split("-")[0]) - Number(baseYM.split("-")[0])) * 12 +
          (Number(cursor.split("-")[1]) - Number(baseYM.split("-")[1]))
        );
        const novo = Object.assign({}, tmpl, {
          id:            uid(),
          vencimento:    novoVenc,
          pago:          false,
          dataPagamento: null,
          origem:        tmpl.id,
        });
        delete novo.recorrente;
        gravarDespesa(novo.id, novo);
      }
      cursor = addMes(cursor, 1);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   RENDER
   ═══════════════════════════════════════════════════════════════ */

function render(){
  if(!S.authReady){ root.innerHTML = skeleton(); return; }
  if(!S.user){ root.innerHTML = viewGate(); montarGate(); return; }
  if(!S.dataReady){ root.innerHTML = skeleton(); return; }

  const ym = S.mesAtivo;

  // remove overlay anterior antes de reescrever
  const oldOver = document.getElementById("modal-overlay");
  if(oldOver) oldOver.remove();

  let html = viewTop();

  if(S.aba === "contas"){
    html += `<div class="app-shell">
      <div class="shell-left">
        ${viewMonthNav(ym)}
        <div class="shell-pad">
          ${viewToolbar()}
          ${viewLista(ym)}
        </div>
      </div>
      <div class="shell-right">
        ${viewLedgerCard(ym)}
        ${viewAcertoSidebar(ym)}
        ${viewSugsSidebar()}
      </div>
    </div>${viewFab()}`;
  } else {
    let corpo = "";
    if(S.aba === "relatorios") corpo = viewRelatorios();
    else if(S.aba === "renda") corpo = viewRenda(ym);
    else if(S.aba === "plano") corpo = viewPlano(ym);
    html += viewMonthNav(ym) + `<main class="main-content">${corpo}</main>`;
  }

  root.innerHTML = html;
  if(S.aba === "relatorios") montarGraficos();
  if(S.modal) montarModal(S.modal);
}

function skeleton(){
  return `<div class="skeleton-screen"><div class="sk-logo"></div><div class="sk-bar"></div><div class="sk-bar short"></div></div>`;
}

/* ═══════════════════════════════════════════════════════════════
   TOP NAV
   ═══════════════════════════════════════════════════════════════ */

function viewTop(){
  const tabs = [
    { id:"contas",    label:"Contas",    ic: icLivro()    },
    { id:"plano",     label:"Plano",     ic: icCalendar() },
    { id:"renda",     label:"Renda",     ic: icUsers()    },
    { id:"relatorios",label:"Relatórios",ic: icChart()    }
  ];
  const tabsHtml = tabs.map(t =>
    `<button class="tab${S.aba===t.id?" active":""}" data-aba="${t.id}">${t.ic}<span>${t.label}</span></button>`
  ).join("");
  return `<nav class="top-nav"><div class="top-brand">${icLivro()}<span>Livro de Contas</span></div><div class="top-tabs">${tabsHtml}</div><button class="btn-icon top-config" data-action="config" title="Configurações">${icGear()}</button></nav>`;
}

/* ═══════════════════════════════════════════════════════════════
   MONTH NAV
   ═══════════════════════════════════════════════════════════════ */

function viewMonthNav(ym){
  const { nome, ano } = labelMes(ym);
  const prev = addMes(ym, -1);
  const next = addMes(ym, +1);
  return `<div class="month-nav">
    <button class="mnav-btn" data-mes="${prev}">${icChevron("left")}</button>
    <div class="mnav-label"><span class="mnav-nome">${nome}</span><span class="mnav-ano">${ano}</span></div>
    <button class="mnav-btn" data-mes="${next}">${icChevron("right")}</button>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   LEDGER CARD
   ═══════════════════════════════════════════════════════════════ */

function viewLedgerCard(ym){
  const r   = resumo(ym);
  const sal = saldoAtual();
  const pct = r.pctPago.toFixed(0);
  const barra = `<div class="prog-bar"><div class="prog-fill${r.pctAtraso>0?" has-atraso":""}" style="width:${pct}%"></div></div>`;
  const entradas = doMes(ym).filter(d=>d.tipo==="entrada");
  const totalEntradas = entradas.reduce((s,d)=>s+(Number(d.valor)||0),0);
  return `<div class="ledger-card">
    <div class="ledger-top">
      <div class="ledger-saldo" data-action="saldo" title="Clique para ajustar saldo" style="cursor:pointer">
        <span class="ledger-label">Saldo atual ✏️</span>
        <span class="ledger-valor${sal<0?" neg":""}">${money(sal)}</span>
      </div>
      ${totalEntradas>0?`<div class="ledger-entrada"><span class="ledger-label">Entradas do mês</span><span class="ledger-valor entrada">${money(totalEntradas)}</span></div>`:""}
    </div>
    <div class="ledger-stats">
      <div class="stat"><span class="stat-label">Total do mês</span><span class="stat-val">${money(r.total)}</span></div>
      <div class="stat"><span class="stat-label">Pago</span><span class="stat-val ok">${money(r.vlPago)}</span></div>
      <div class="stat"><span class="stat-label">A pagar</span><span class="stat-val${r.vlAberto>0?" warn":""}">${money(r.vlAberto)}</span></div>
      ${r.vlAtraso>0?`<div class="stat"><span class="stat-label">Atrasado</span><span class="stat-val err">${money(r.vlAtraso)}</span></div>`:""}
    </div>
    ${barra}
    <div class="ledger-pct">${pct}% pago${r.nAtrasadas>0?` · <span class="err">${r.nAtrasadas} atrasada${r.nAtrasadas>1?"s":""}</span>`:""}</div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   TOOLBAR / FILTROS
   ═══════════════════════════════════════════════════════════════ */

function viewToolbar(){
  const filtros = [
    { id:"todas",    label:"Todas"    },
    { id:"abertas",  label:"Abertas"  },
    { id:"pagas",    label:"Pagas"    },
    { id:"atrasadas",label:"Atrasadas"}
  ];
  const ym = S.mesAtivo;
  const catIds = new Set(doMes(ym).filter(d=>d.tipo!=="entrada").map(d=>d.categoria));
  const cats = categoriasPadrao().filter(c=>catIds.has(c.id));
  const catChipsHtml = cats.map(c=>
    `<button class="cat-chip${S.filtroCat===c.id?" active":""}" data-filtro-cat="${c.id}" style="--chip-cor:${c.cor}">${c.nome}</button>`
  ).join("");
  return `<div class="toolbar">
    <div class="filter-pills">
      ${filtros.map(f=>`<button class="pill${S.filtro===f.id?" active":""}" data-filtro="${f.id}">${f.label}</button>`).join("")}
    </div>
    ${catChipsHtml?`<div class="cat-chips">${catChipsHtml}</div>`:""}
  </div>`;
}

function filtrar(lista){
  let r = lista;
  if(S.filtro === "abertas")   r = r.filter(d=>!d.pago && d.tipo!=="entrada");
  else if(S.filtro === "pagas")     r = r.filter(d=>d.pago);
  else if(S.filtro === "atrasadas") r = r.filter(atrasada);
  if(S.filtroCat) r = r.filter(d=>d.categoria===S.filtroCat);
  return r;
}

/* ═══════════════════════════════════════════════════════════════
   LISTA DE DESPESAS
   ═══════════════════════════════════════════════════════════════ */

function viewLista(ym){
  const base  = doMes(ym);
  const lista = filtrar(base);
  if(lista.length === 0){
    return `<div class="empty-state">${icCheck()}<p>Nenhuma conta aqui.</p></div>`;
  }
  // group by: entradas primeiro, depois por categoria
  const entradas  = lista.filter(d=>d.tipo==="entrada");
  const despesas  = lista.filter(d=>d.tipo!=="entrada");
  let html = "";
  if(entradas.length){
    html += `<div class="group-label">Entradas</div>` + entradas.map(d=>linha(d,"entrada")).join("");
  }
  // group expenses by due-date section (atrasadas, hoje, futuras)
  const atrasadas = despesas.filter(atrasada);
  const outras    = despesas.filter(d=>!atrasada(d));
  if(atrasadas.length){
    html += `<div class="group-label err">Atrasadas</div>` + atrasadas.map(d=>linha(d)).join("");
  }
  if(outras.length){
    html += outras.map(d=>linha(d)).join("");
  }
  return `<div class="lista-despesas">${html}</div>`;
}

function linha(d, extraClass=""){
  const c        = cat(d.categoria);
  const atras    = atrasada(d);
  const pago     = !!d.pago;
  const isEntr   = d.tipo === "entrada";
  const p        = pessoa(d.adicionadoPor||"p1");
  const pago_p   = d.pagoPor ? pessoa(d.pagoPor) : null;
  const iParc    = d.parcela || 1;
  const nParc    = d.totalParcelas ||
    (d.grupo ? Math.max(...S.despesas.filter(x=>x.grupo===d.grupo).map(x=>x.parcela||1)) : 1);
  const chips    = [];
  if(d.recorrente || d.origem) chips.push(`<span class="chip rec">↺ Recorrente</span>`);
  if(nParc > 1) chips.push(`<span class="chip parc">${iParc}/${nParc}</span>`);
  if(d.divisao === "individual") chips.push(`<span class="chip ind">Individual</span>`);
  if(atras){
    chips.push(`<span class="chip atras">Atrasada ${diasDe(d.vencimento)}d</span>`);
  } else if(!pago && d.vencimento && !isEntr){
    const diasVence = Math.ceil((new Date(d.vencimento+"T00:00:00") - new Date(hojeISO()+"T00:00:00")) / 864e5);
    if(diasVence >= 0 && diasVence <= 5){
      chips.push(`<span class="chip vence">${diasVence===0?"⚡ Vence hoje":`⏰ Vence em ${diasVence}d`}</span>`);
    }
  }

  return `<div class="row${pago?" pago":""}${atras?" atrasada":""}${isEntr?" entrada-row":""}" data-id="${d.id}">
    <div class="row-cat" style="background:${isEntr?"var(--c-ok)":c.cor}"></div>
    <div class="row-body">
      <div class="row-top">
        <span class="row-desc">${esc(d.descricao||"Sem descrição")}</span>
        <span class="row-amt${isEntr?" entrada":atras?" atrasada":pago?" ok":""}">${isEntr?"+":""}${money(d.valor)}</span>
      </div>
      <div class="row-meta">
        <span class="row-venc">${icCalendar()} ${fmtData(d.vencimento)}</span>
        ${pago && d.dataPagamento?`<span class="row-pago-em">${icCheck()} pago ${fmtData(d.dataPagamento)}</span>`:""}
        ${!isEntr?`<span class="row-cat-label">${c.nome}</span>`:""}
        <span class="avatar" style="background:${p.cor}" title="${esc(p.nome)}">${inicial(p.nome)}</span>
        ${pago_p&&pago_p.id!==p.id?`<span class="avatar" style="background:${pago_p.cor}" title="Pago por ${esc(pago_p.nome)}">${inicial(pago_p.nome)}</span>`:""}
      </div>
      ${chips.length?`<div class="row-chips">${chips.join("")}</div>`:""}
    </div>
    <div class="row-actions">
      ${!pago&&!isEntr?`<button class="act-btn quitar" data-id="${d.id}" title="Quitar">${icCheck()}</button>`:""}
      <button class="act-btn edit" data-id="${d.id}" title="Editar">${icEdit()}</button>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   VIEW RENDA
   ═══════════════════════════════════════════════════════════════ */

function viewRenda(ym){
  const { nome, ano } = labelMes(ym);
  const jan = janelasPadrao();

  // Renda fixa: tabela das janelas
  const fixaRows = jan.map((j,i)=>{
    const dia = Math.min(j.dia, new Date(...ym.split("-").map(Number).map((v,k)=>k===1?v:v), 0).getDate());
    let dataBase = `${ym}-${String(dia).padStart(2,"0")}`;
    const dataReal = j.antecipar ? diaUtilAnterior(dataBase) : dataBase;
    const antecipou = dataReal !== dataBase;
    return `<div class="renda-row">
      <div class="renda-row-left">
        <span class="janela-chip${antecipou?" neg":""}">dia ${j.dia}${antecipou?` → ${fmtData(dataReal)}`:""}</span>
        <span class="renda-pessoa">${esc(j.recebidoPor)}</span>
      </div>
      <span class="renda-valor">${money(j.valor)}</span>
    </div>`;
  }).join("");

  const totalFixo = jan.reduce((s,j)=>s+j.valor,0);

  // Entradas avulsas do mês
  const avulsas = (S.despesas||[]).filter(d => d.tipo==="entrada" && (d.vencimento||"").slice(0,7)===ym);
  const totalAvulso = avulsas.reduce((s,d)=>s+(Number(d.valor)||0),0);

  const avulsaRows = avulsas.length
    ? avulsas.map(d=>`<div class="row${d.pago?" pago":""} entrada-row" data-id="${d.id}">
        <div class="row-cat" style="background:var(--c-ok)"></div>
        <div class="row-body">
          <div class="row-top">
            <span class="row-desc">${esc(d.descricao||"Entrada")}</span>
            <span class="row-amt entrada">+${money(d.valor)}</span>
          </div>
          <div class="row-meta">
            <span class="row-venc">${icCalendar()} ${fmtData(d.vencimento)}</span>
            ${d.pago?`<span class="row-pago-em">${icCheck()} recebido ${fmtData(d.dataPagamento)}</span>`:""}
          </div>
        </div>
        <div class="row-actions">
          <button class="act-btn edit" data-id="${d.id}" title="Editar">${icEdit()}</button>
        </div>
      </div>`).join("")
    : `<div class="empty-state">${icCheck()}<p>Nenhuma entrada avulsa este mês.</p></div>`;

  const dist = distribuirSobra(ym);
  const distHtml = dist.nada
    ? `<div class="plano-alert" style="background:var(--debit-soft);border-color:var(--debit)">
        ${icAlert()} Neste mês o gasto supera a renda — sem sobra para distribuir.
       </div>`
    : `<div class="dist-grid">
        <div class="dist-card reserva">
          <span class="dist-label">Reserva de emergência</span>
          <span class="dist-pct">${dist.cfg.reserva}%</span>
          <span class="dist-valor">${money(dist.vlRes)}</span>
        </div>
        <div class="dist-card investimento">
          <span class="dist-label">Investimento</span>
          <span class="dist-pct">${dist.cfg.investimento}%</span>
          <span class="dist-valor">${money(dist.vlInvest)}</span>
        </div>
        ${dist.livres.map(l=>`<div class="dist-card livre">
          <span class="dist-label">Livre · ${esc(l.nome)}</span>
          <span class="dist-pct">${Math.round(l.pct*100*(1-(dist.cfg.reserva+dist.cfg.investimento)/100))}% da sobra</span>
          <span class="dist-valor">${money(l.valor)}</span>
        </div>`).join("")}
      </div>
      <div class="dist-sobra">Sobra total: <strong>${money(dist.sobra)}</strong>
        · ${100 - dist.cfg.reserva - dist.cfg.investimento}% livre</div>`;

  return `<div class="relatorios">
    <h2 class="section-title">Renda fixa · ${nome} ${ano}</h2>
    <div class="ledger-card" style="padding:0">
      <div style="padding:14px 16px 0">${fixaRows}</div>
      <div class="ledger-stats" style="padding:10px 16px 14px;border-top:1px solid var(--rule-soft);margin-top:10px">
        <div class="stat"><span class="stat-label">Total fixo/mês</span><span class="stat-val ok">${money(totalFixo)}</span></div>
      </div>
    </div>
    <button class="btn-sec" style="margin-top:10px;width:100%" data-action="editar-renda-padrao">
      ✏️ Editar salários padrão
    </button>

    <h2 class="section-title" style="margin-top:20px">Entradas avulsas · ${nome} ${ano}</h2>
    <div class="lista-despesas">${avulsaRows}</div>
    ${totalAvulso>0?`<div class="ledger-card" style="margin-top:8px">
      <div class="ledger-stats">
        <div class="stat"><span class="stat-label">Total avulso</span><span class="stat-val ok">${money(totalAvulso)}</span></div>
        <div class="stat"><span class="stat-label">Renda total do mês</span><span class="stat-val ok">${money(totalFixo+totalAvulso)}</span></div>
      </div>
    </div>`:""}
    <button class="fab" data-action="nova-entrada" title="Nova entrada avulsa">${icPlus()}</button>

    <h2 class="section-title" style="margin-top:20px">Destino da sobra · ${nome} ${ano}</h2>
    ${distHtml}
    <button class="btn-sec" style="margin-top:10px;width:100%" data-action="editar-dist">
      ✏️ Editar percentuais
    </button>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR WIDGETS (contas tab)
   ═══════════════════════════════════════════════════════════════ */

function viewAcertoSidebar(ym){
  const ac = acerto(ym);
  if(!ac) return "";
  if(ac.quitado){
    return `<div class="side-card side-ok">
      <div class="side-card-title">${icCheck()} Acerto do mês</div>
      <p class="side-card-body">Contas equilibradas — cada um pagou a sua parte ✓</p>
    </div>`;
  }
  return `<div class="side-card side-warn">
    <div class="side-card-title">${icUsers()} Acerto do mês</div>
    <p class="side-card-body">💸 <strong>${esc(ac.credor.nome)}</strong> bancou <strong>${money(ac.valor)}</strong> a mais este mês</p>
    <p class="side-card-sub">Total compartilhado: ${money(ac.total)} · metade justa: ${money(ac.total/2)}</p>
    <button class="btn-sec btn-sm" data-action="registrar-acerto" data-ym="${ym}">Registrar repasse</button>
  </div>`;
}

function viewSugsSidebar(){
  const sugs = sugestoes().slice(0,3);
  if(!sugs.length) return "";
  return `<div class="side-card">
    <div class="side-card-title">Alertas</div>
    <div class="side-sugs">
      ${sugs.map(s=>`<div class="side-sug">
        <span class="side-sug-ic">${sugIcon(s.icon)}</span>
        <div class="side-sug-txt"><strong>${esc(s.titulo)}</strong><span>${esc(s.texto)}</span></div>
      </div>`).join("")}
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   FAB
   ═══════════════════════════════════════════════════════════════ */

function viewFab(){
  return `<button class="fab" data-action="nova" title="Nova conta">${icPlus()}</button>`;
}

/* ═══════════════════════════════════════════════════════════════
   KPI
   ═══════════════════════════════════════════════════════════════ */

function kpi(rotulo, valor, sub, tom, cor, extraClass=""){
  const cls = ["kpi-card", tom, extraClass].filter(Boolean).join(" ");
  return `<div class="${cls}"${cor?` style="--kpi-accent:${cor}"`:""}>
    <span class="kpi-rotulo">${rotulo}</span>
    <span class="kpi-valor">${valor}</span>
    ${sub?`<span class="kpi-sub">${sub}</span>`:""}
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   SUGESTÃO ICON
   ═══════════════════════════════════════════════════════════════ */

function sugIcon(ic){
  if(ic==="alert")    return icAlert();
  if(ic==="check")    return icCheck();
  if(ic==="calendar") return icCalendar();
  if(ic==="users")    return icUsers();
  if(ic==="chart")    return icChart();
  return icAlert();
}

/* ═══════════════════════════════════════════════════════════════
   VIEW PLANO DE PAGAMENTO
   ═══════════════════════════════════════════════════════════════ */

function viewPlano(ym){
  const { plano, janelas, saldosJanela, jUltAnt } = planoPagamento(ym);
  const { nome, ano } = labelMes(ym);

  const janelaHtml = janelas.map((j,i) => {
    const itens = plano.filter(p=>p.janela===i);
    const total = itens.reduce((s,p)=>s+(Number(p.conta.valor)||0),0);
    const dispon = saldosJanela[i] - total;
    return `<div class="plano-item">
      <div class="plano-day">
        <span class="janela-chip">${fmtData(j.data)}</span>
        <span class="plano-meta">${esc(j.recebidoPor)} · ${money(j.valor)}</span>
      </div>
      <div class="plano-body">
        ${itens.length===0
          ? `<div class="plano-empty">Nenhuma conta nesta janela.</div>`
          : itens.map(p=>`<div class="plano-conta${p.adiantou?" adiantou":""}">
              <span class="plano-title">${esc(p.conta.descricao||"Conta")}</span>
              <span class="plano-meta">${p.adiantou?`Adiantar de ${fmtData(p.dataVenc)} para ${fmtData(p.data)}`:`Vence ${fmtData(p.dataVenc||p.data)}`}</span>
              <span class="plano-valor">${money(p.conta.valor)}</span>
            </div>`).join("")
        }
        <div class="plano-saldo">Saldo após: <strong>${money(dispon)}</strong></div>
      </div>
    </div>`;
  }).join("");

  const anteriores = plano.filter(p=>p.tipo==="anterior");
  const anteriorHtml = anteriores.length
    ? `<div class="plano-item" style="border-color:var(--warn)">
        <div class="plano-day">
          <span class="janela-chip" style="background:var(--warn-soft);color:var(--warn)">${fmtData(jUltAnt.data)}</span>
          <div class="plano-meta">${esc(jUltAnt.recebidoPor)} · ${money(jUltAnt.valor)}</div>
        </div>
        <div class="plano-body">
          <div class="plano-meta" style="color:var(--warn);font-weight:600;margin-bottom:6px">
            ⚠ Pagar no mês anterior — para não iniciar no vermelho
          </div>
          ${anteriores.map(p=>`<div class="plano-conta adiantou">
            <span class="plano-title">${esc(p.conta.descricao||"Conta")}</span>
            <span class="plano-meta">Vence ${fmtData(p.dataVenc)} · pagar em ${fmtData(p.data)}</span>
            <span class="plano-valor">${money(p.conta.valor)}</span>
          </div>`).join("")}
        </div>
      </div>`
    : "";

  // Contas do mês seguinte que vencem antes do dia 5 (devem ser pagas neste mês)
  const ymProx = addMes(ym, 1);
  const { plano: planoProx, jUltAnt: jProxUlt } = planoPagamento(ymProx);
  const antecipProx = planoProx.filter(p => p.tipo === "anterior");
  const antecipProxHtml = antecipProx.length
    ? `<div class="plano-item" style="border-color:var(--accent);opacity:.85">
        <div class="plano-day">
          <span class="janela-chip">${fmtData(jProxUlt.data)}</span>
          <div class="plano-meta" style="font-size:11px">${esc(jProxUlt.recebidoPor)}</div>
        </div>
        <div class="plano-body">
          <div class="plano-meta" style="color:var(--accent);font-weight:600;margin-bottom:6px">
            📅 Contas do mês seguinte que vencem antes do dia 5
          </div>
          ${antecipProx.map(p=>`<div class="plano-conta adiantou">
            <span class="plano-title">${esc(p.conta.descricao||"Conta")}</span>
            <span class="plano-meta">Vence ${fmtData(p.dataVenc)} (${labelMes(ymProx).nome})</span>
            <span class="plano-valor">${money(p.conta.valor)}</span>
          </div>`).join("")}
        </div>
      </div>`
    : "";

  return `<div class="plano-list">
    <h2 class="section-title">Plano de pagamento · ${nome} ${ano}</h2>
    ${anteriorHtml}
    ${janelaHtml}
    ${antecipProxHtml}
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   VIEW JANELA (relatórios — janela de meses)
   ═══════════════════════════════════════════════════════════════ */

function viewJanela(){
  const ops = [3,6,12];
  return `<div class="janela-sel">
    ${ops.map(n=>`<button class="pill${S.janela===n?" active":""}" data-janela="${n}">${n}m</button>`).join("")}
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   VIEW RELATÓRIOS
   ═══════════════════════════════════════════════════════════════ */

function viewRelatorios(){
  const ym  = S.mesAtivo;
  const r   = resumo(ym);
  const sal = saldoAtual();
  const { nome, ano } = labelMes(ym);
  const renda   = rendaNoMes(ym) || rendaFixaMensal();
  const sobra   = renda - r.total;
  const ac      = acerto(ym);

  // Projeção
  const proj  = projecao(S.janela);
  const sugs  = sugestoes();

  // Acerto section
  let acertoHtml = "";
  if(ac){
    const devedor  = ac.devedor;
    const credor   = ac.credor;
    const valorAc  = ac.valor;
    acertoHtml = `<div class="acerto-card">
      <h3 class="acerto-title">${icUsers()} Acerto do mês</h3>
      <p class="acerto-body">💸 <strong>${esc(credor.nome)}</strong> bancou <strong>${money(valorAc)}</strong> a mais — combinar um repasse</p>
    </div>`;
  }

  // Sugestões
  const sugsHtml = sugs.map(s=>`<div class="sug-card">
    <div class="sug-icon">${sugIcon(s.icon)}</div>
    <div class="sug-content"><strong>${esc(s.titulo)}</strong><p>${esc(s.texto)}</p></div>
  </div>`).join("");

  // Projeção table — 5 cols: Mês / Renda / Gastos Fixos / Saldo Piso / Saldo Provável
  const projRows = proj.linhas.map(l=>{
    const { ym:lym, rendaReal, travado, pisoSaldo, provSaldo } = l;
    const { nome:mn, ano:ay } = labelMes(lym);
    const pisoOk = pisoSaldo >= 0;
    const provOk = provSaldo >= 0;
    return `<tr class="proj-tr">
      <td>${mn.slice(0,3)} ${ay}</td>
      <td class="num ok">${money(rendaReal)}</td>
      <td class="num">${money(travado)}</td>
      <td class="num${pisoOk?" ok":" err"}">${money(pisoSaldo)}</td>
      <td class="num${provOk?" ok":" err"}">${money(provSaldo)}</td>
    </tr>`;
  }).join("");

  return `<div class="relatorios">
    <h2 class="section-title">Resumo · ${nome} ${ano}</h2>

    <div class="kpi-grid">
      ${kpi("Renda do mês", money(renda), "salários + extras", "pos", null, "renda-kpi")}
      ${kpi("Total de gastos", money(r.total), `${r.nTodas} conta${r.nTodas===1?"":"s"}`, r.total>renda?"neg":"")}
      ${kpi("Sobra real", money(sobra), sobra>=0?"no verde":"atenção!", sobra>=0?"pos":"neg", null, "sobra-kpi")}
      ${kpi("Saldo atual", money(sal), "em conta", sal<0?"neg":"")}
      ${r.vlAtraso>0?kpi("Em atraso", money(r.vlAtraso), `${r.nAtrasadas} conta${r.nAtrasadas===1?"":"s"}`, "neg"):""}
    </div>

    ${acertoHtml}

    <div class="chart-section">
      <div class="chart-section-header">
        <h2 class="section-title">Renda × Gastos</h2>
        <span class="chart-sub">Últimos 6 meses · barra e sobra</span>
      </div>
      <div class="chart-wrap"><canvas id="cvRenda"></canvas></div>
    </div>

    <div class="chart-section">
      <div class="chart-section-header">
        <h2 class="section-title">Gastos por categoria</h2>
        <span class="chart-sub">${nome} ${ano} · distribuição percentual</span>
      </div>
      <div class="chart-wrap chart-wrap--donut"><canvas id="cvPizza"></canvas></div>
    </div>

    <div class="chart-section">
      <div class="chart-section-header">
        <h2 class="section-title">Histórico mensal</h2>
        <span class="chart-sub">Pago + a pagar vs. renda · últimos ${Math.min(S.janela,12)} meses</span>
      </div>
      <div class="chart-wrap chart-wrap--tall"><canvas id="cvHistorico"></canvas></div>
    </div>

    <div class="chart-section">
      <div class="chart-section-header">
        <h2 class="section-title">Evolução por categoria</h2>
        <span class="chart-sub">Top 5 categorias · tendência dos últimos 6 meses</span>
      </div>
      <div class="chart-wrap chart-wrap--tall"><canvas id="cvCatTrend"></canvas></div>
    </div>

    <h2 class="section-title">Projeção · próximos ${S.janela} meses</h2>
    ${viewJanela()}
    <div class="proj-scroll">
      <table class="proj-table">
        <thead><tr>
          <th>Mês</th><th class="num">Renda</th><th class="num">Fixos</th><th class="num">Saldo piso</th><th class="num">Saldo provável</th>
        </tr></thead>
        <tbody>${projRows}</tbody>
      </table>
    </div>
    <p class="proj-note">Variável estimado: ${money(proj.mediaVariavel)}/mês · Saldo base: ${money(proj.saldo0)}</p>

    <h2 class="section-title">Plano de pagamento</h2>
    ${viewPlano(ym)}

    <h2 class="section-title">Sugestões</h2>
    <div class="sugestoes">${sugsHtml}</div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   GRÁFICOS
   ═══════════════════════════════════════════════════════════════ */

const charts = {};

function destruirGraficos(){
  Object.values(charts).forEach(c=>{ try{ c.destroy(); }catch(e){} });
  Object.keys(charts).forEach(k=>delete charts[k]);
}

function montarGraficos(){
  destruirGraficos();

  const ym   = S.mesAtivo;
  const base = mesAtualISO();
  const cs   = getComputedStyle(document.documentElement);
  const cv   = k => cs.getPropertyValue(k).trim();
  const isMobile = window.innerWidth < 600;

  // Cores do tema
  const C = {
    accent:  cv("--accent"),
    debit:   cv("--debit"),
    warn:    cv("--warn"),
    ink2:    cv("--ink-2"),
    ink3:    cv("--ink-3"),
    rule:    cv("--rule-soft"),
    paper:   cv("--paper"),
    card:    cv("--card"),
  };

  // Defaults Chart.js
  Chart.defaults.font.family = "'Inter',-apple-system,sans-serif";
  Chart.defaults.font.size   = 11.5;
  Chart.defaults.color       = C.ink3;

  const ptFmt = v => (Number(v)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const shortFmt = v => {
    const n = Math.abs(Number(v)||0);
    if(n >= 1000) return "R$"+(n/1000).toLocaleString("pt-BR",{maximumFractionDigits:1})+"k";
    return "R$"+n.toLocaleString("pt-BR",{maximumFractionDigits:0});
  };
  const gridOpts  = { color: C.rule, drawBorder:false };
  const tickBase  = { color: C.ink3, padding:6 };
  const tooltipBase = {
    backgroundColor:C.card, titleColor:C.ink2, bodyColor:C.ink2,
    borderColor:C.rule, borderWidth:1, padding:12,
    boxPadding:4, cornerRadius:10,
  };

  // ── 1. Renda × Gastos × Sobra (bar + linha) ──────────────────
  const cvRendaEl = document.getElementById("cvRenda");
  if(cvRendaEl){
    const n = 6;
    const meses   = Array.from({length:n},(_,i)=>addMes(base,-n+1+i));
    const labels  = meses.map(m=>{ const{nome,ano}=labelMes(m); return nome.slice(0,3)+"/"+String(ano).slice(2); });
    const rendas  = meses.map(m=>rendaNoMes(m)||rendaFixaMensal());
    const gastos  = meses.map(m=>resumo(m).total);
    const sobras  = meses.map((_,i)=>rendas[i]-gastos[i]);

    charts.renda = new Chart(cvRendaEl, {
      type:"bar",
      data:{
        labels,
        datasets:[
          {
            label:"Renda", data:rendas, order:2,
            backgroundColor: meses.map(m => m===ym ? C.accent : C.accent+"88"),
            borderRadius:5, borderSkipped:false,
          },
          {
            label:"Gastos", data:gastos, order:2,
            backgroundColor: meses.map(m => m===ym ? C.debit : C.debit+"88"),
            borderRadius:5, borderSkipped:false,
          },
          {
            label:"Sobra", data:sobras, order:1, type:"line",
            borderColor:C.warn, backgroundColor:C.warn+"22",
            pointBackgroundColor: sobras.map(v=>v>=0?C.warn:C.debit),
            pointRadius:4, pointHoverRadius:7, pointBorderWidth:0,
            tension:0.38, fill:true, borderWidth:2,
          }
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        interaction:{ mode:"index", intersect:false },
        plugins:{
          legend:{ position:"bottom", labels:{ boxWidth:10,boxHeight:10,padding:16,usePointStyle:true } },
          tooltip:{
            ...tooltipBase,
            callbacks:{
              label: ctx => ` ${ctx.dataset.label}: ${ptFmt(ctx.parsed.y)}`,
              afterBody: items => {
                if(!items.length) return;
                const i = items[0].dataIndex;
                const pct = rendas[i]>0 ? Math.round(gastos[i]/rendas[i]*100) : 0;
                return ["", ` Comprometido: ${pct}% da renda`];
              }
            }
          }
        },
        scales:{
          x:{ grid:{display:false}, ticks:tickBase },
          y:{ grid:gridOpts, ticks:{...tickBase, callback:v=>shortFmt(v)}, grace:"5%" }
        }
      }
    });
  }

  // ── 2. Gastos por categoria — doughnut ────────────────────────
  const cvPizzaEl = document.getElementById("cvPizza");
  if(cvPizzaEl){
    const dadosCat = porCategoria(ym, 1).map(d => {
      const c = cat(d.id);
      const cor = c.cor.startsWith("var(") ? cv(c.cor.slice(4,-1).trim()) || "#888" : c.cor;
      return { nome:c.nome, valor:d.total, cor };
    }).filter(d=>d.valor>0);
    const total = dadosCat.reduce((s,d)=>s+d.valor,0);

    charts.pizza = new Chart(cvPizzaEl, {
      type:"doughnut",
      data:{
        labels: dadosCat.map(d=>d.nome),
        datasets:[{
          data: dadosCat.map(d=>d.valor),
          backgroundColor: dadosCat.map(d=>d.cor),
          borderColor: C.card, borderWidth:3,
          hoverBorderWidth:0, hoverOffset:8,
        }]
      },
      options:{
        responsive:true, maintainAspectRatio:false, cutout:"65%",
        layout:{ padding: isMobile ? 4 : 8 },
        plugins:{
          legend:{
            position: isMobile ? "bottom" : "right",
            labels:{
              boxWidth:10, boxHeight:10, padding:12, usePointStyle:true,
              generateLabels: chart => {
                const ds = chart.data.datasets[0];
                return chart.data.labels.map((label,i)=>{
                  const val = ds.data[i];
                  const pct = total>0 ? Math.round(val/total*100) : 0;
                  return {
                    text:`${label}  ${pct}%`,
                    fillStyle:ds.backgroundColor[i],
                    strokeStyle:ds.backgroundColor[i],
                    pointStyle:"rectRounded", index:i, hidden:false
                  };
                });
              }
            }
          },
          tooltip:{
            ...tooltipBase,
            callbacks:{
              label: ctx => {
                const val = ctx.parsed;
                const pct = total>0 ? (val/total*100).toFixed(1) : "0";
                return [` ${ptFmt(val)}`, ` ${pct}% do total`];
              }
            }
          }
        }
      }
    });
  }

  // ── 3. Histórico: stacked (pago+aberto) + linha renda ─────────
  const cvHistEl = document.getElementById("cvHistorico");
  if(cvHistEl){
    const n = Math.min(S.janela, 12);
    const meses   = Array.from({length:n},(_,i)=>addMes(base,-n+1+i));
    const labels  = meses.map(m=>{ const{nome,ano}=labelMes(m); return nome.slice(0,3)+"/"+String(ano).slice(2); });
    const pago    = meses.map(m=>resumo(m).vlPago);
    const aberto  = meses.map(m=>resumo(m).vlAberto);
    const rendas  = meses.map(m=>rendaNoMes(m)||rendaFixaMensal());

    charts.hist = new Chart(cvHistEl, {
      type:"bar",
      data:{
        labels,
        datasets:[
          {
            label:"Pago", data:pago, order:2, stack:"g",
            backgroundColor: meses.map(m=>m===ym ? C.accent : C.accent+"99"),
            borderRadius:{topLeft:4,topRight:4}, borderSkipped:"bottom",
          },
          {
            label:"A pagar", data:aberto, order:2, stack:"g",
            backgroundColor: meses.map(m=>m===ym ? C.debit+"DD" : C.debit+"66"),
            borderRadius:{topLeft:4,topRight:4}, borderSkipped:"bottom",
          },
          {
            label:"Renda", data:rendas, order:1, type:"line",
            borderColor:C.warn, borderWidth:2, borderDash:[5,4],
            pointRadius:3, pointHoverRadius:6, pointBorderWidth:0,
            pointBackgroundColor:C.warn, fill:false, tension:0.3,
          }
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        interaction:{ mode:"index", intersect:false },
        plugins:{
          legend:{ position:"bottom", labels:{ boxWidth:10,boxHeight:10,padding:16,usePointStyle:true } },
          tooltip:{
            ...tooltipBase,
            callbacks:{
              label: ctx => ` ${ctx.dataset.label}: ${ptFmt(ctx.parsed.y)}`,
              afterBody: items => {
                if(!items.length) return;
                const i   = items[0].dataIndex;
                const tot = pago[i]+aberto[i];
                const pct = rendas[i]>0 ? Math.round(tot/rendas[i]*100) : 0;
                return ["", ` Total: ${ptFmt(tot)}`, ` ${pct}% da renda`];
              }
            }
          }
        },
        scales:{
          x:{ grid:{display:false}, ticks:tickBase, stacked:true },
          y:{ grid:gridOpts, ticks:{...tickBase, callback:v=>shortFmt(v)}, grace:"10%", stacked:false }
        }
      }
    });
  }

  // ── 4. Evolução das top categorias (linhas) ───────────────────
  const cvCatEl = document.getElementById("cvCatTrend");
  if(cvCatEl){
    const n = 6;
    const meses   = Array.from({length:n},(_,i)=>addMes(base,-n+1+i));
    const labels  = meses.map(m=>{ const{nome,ano}=labelMes(m); return nome.slice(0,3)+"/"+String(ano).slice(2); });
    const topCats = porCategoria(ym, 3).slice(0,5);

    const datasets = topCats.map(tc=>{
      const c   = cat(tc.id);
      const cor = c.cor.startsWith("var(") ? cv(c.cor.slice(4,-1).trim()) || "#888" : c.cor;
      const data = meses.map(m =>
        doMes(m).filter(d=>d.tipo!=="entrada"&&d.categoria===tc.id)
          .reduce((s,d)=>s+(Number(d.valor)||0),0)
      );
      return {
        label:c.nome, data, borderColor:cor, backgroundColor:cor+"22",
        pointBackgroundColor:cor, pointRadius:4, pointHoverRadius:7, pointBorderWidth:0,
        tension:0.4, fill:false, borderWidth:2.5,
      };
    });

    charts.catTrend = new Chart(cvCatEl, {
      type:"line",
      data:{ labels, datasets },
      options:{
        responsive:true, maintainAspectRatio:false,
        interaction:{ mode:"index", intersect:false },
        plugins:{
          legend:{ position:"bottom", labels:{ boxWidth:10,boxHeight:10,padding:14,usePointStyle:true } },
          tooltip:{
            ...tooltipBase,
            callbacks:{
              label: ctx => ` ${ctx.dataset.label}: ${ptFmt(ctx.parsed.y)}`
            }
          }
        },
        scales:{
          x:{ grid:{display:false}, ticks:tickBase },
          y:{ grid:gridOpts, ticks:{...tickBase, callback:v=>shortFmt(v)}, grace:"5%", beginAtZero:true }
        }
      }
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   AUTH GATE
   ═══════════════════════════════════════════════════════════════ */

function viewGate(){
  const isLogin = S.authMode === "login";
  return `<div class="gate">
    <div class="gate-card">
      <div class="gate-logo">${icLivro()}<h1>Livro de Contas</h1></div>
      ${S.authErr?`<p class="gate-err">${esc(S.authErr)}</p>`:""}
      <form id="gate-form" class="gate-form">
        <label class="gate-label">E-mail
          <input type="email" id="gate-email" autocomplete="username" required placeholder="voce@email.com">
        </label>
        <label class="gate-label">Senha
          <input type="password" id="gate-pass" autocomplete="${isLogin?"current-password":"new-password"}" required minlength="6" placeholder="••••••">
        </label>
        ${!isLogin?`<label class="gate-label">Confirmar senha
          <input type="password" id="gate-pass2" autocomplete="new-password" required minlength="6" placeholder="••••••">
        </label>`:""}
        <button type="submit" class="gate-btn${S.authBusy?" busy":""}" ${S.authBusy?"disabled":""}>
          ${S.authBusy?"Aguarde…":isLogin?"Entrar":"Criar conta"}
        </button>
      </form>
      <button class="gate-switch" data-auth-switch>
        ${isLogin?"Não tem conta? Criar":"Já tem conta? Entrar"}
      </button>
    </div>
  </div>`;
}

function montarGate(){
  const form = document.getElementById("gate-form");
  if(!form) return;
  form.addEventListener("submit", e=>{ e.preventDefault(); autenticar(); });
  const sw = document.querySelector("[data-auth-switch]");
  if(sw) sw.addEventListener("click",()=>{ S.authMode = S.authMode==="login"?"signup":"login"; S.authErr=""; render(); });
}

async function autenticar(){
  const email = (document.getElementById("gate-email")||{}).value||"";
  const pass  = (document.getElementById("gate-pass")||{}).value||"";
  const pass2 = (document.getElementById("gate-pass2")||{}).value||"";
  if(S.authMode==="signup" && pass!==pass2){ S.authErr="As senhas não coincidem."; render(); return; }
  S.authBusy = true; S.authErr = ""; render();
  try{
    if(S.authMode==="login"){
      await auth.signInWithEmailAndPassword(email, pass);
    } else {
      await auth.createUserWithEmailAndPassword(email, pass);
    }
  } catch(e){
    const msgs = {
      "auth/user-not-found":"Usuário não encontrado.",
      "auth/wrong-password":"Senha incorreta.",
      "auth/email-already-in-use":"E-mail já cadastrado.",
      "auth/invalid-email":"E-mail inválido.",
      "auth/weak-password":"Senha muito fraca (mínimo 6 caracteres)."
    };
    S.authErr = msgs[e.code] || e.message;
    S.authBusy = false; render();
  }
}

/* ═══════════════════════════════════════════════════════════════
   MODAIS
   ═══════════════════════════════════════════════════════════════ */

function fecharModalDom(){
  const m = document.getElementById("modal-overlay");
  if(m){
    m.classList.add("saindo");
    setTimeout(()=>{ m.remove(); S.modal = null; render(); }, 200);
  } else {
    S.modal = null; render();
  }
}

function montarModal(cfg){
  const over = document.createElement("div");
  over.id = "modal-overlay";
  over.className = "modal-overlay";
  over.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <div class="modal-header">
      <h3 class="modal-title">${esc(cfg.titulo||"")}</h3>
      <button class="modal-close" data-action="fechar">${icX()}</button>
    </div>
    <div class="modal-body">${conteudoModal(cfg)}</div>
  </div>`;
  document.body.appendChild(over);
  requestAnimationFrame(()=> over.classList.add("aberto"));
  over.addEventListener("click", e=>{
    if(e.target === over) fecharModalDom();
  });
  // focus first input
  const fi = over.querySelector("input,select,textarea");
  if(fi) setTimeout(()=>fi.focus(), 100);
}

function pillsPessoas(){
  return S.perfis.map(p=>
    `<label class="pill-pessoa"><input type="radio" name="adicionadoPor" value="${p.id}"> <span style="background:${p.cor}">${inicial(p.nome)}</span> ${esc(p.nome)}</label>`
  ).join("");
}

function conteudoModal(cfg){
  const d   = cfg.dado || {};
  const ym  = S.mesAtivo;
  const hoje = hojeISO();
  const isCasa = S.perfis.length >= 2;

  if(cfg.tipo === "nova" || cfg.tipo === "editar"){
    const isEntrada = d.tipo === "entrada" || !!cfg._prefixoEntrada;
    // propagação — só relevante no modo editar
    const nProxParcelas = (cfg.tipo==="editar" && d.grupo && (d.totalParcelas||1) > 1 && (d.parcela||1) < (d.totalParcelas||1))
      ? ((d.totalParcelas||1) - (d.parcela||1)) : 0;
    const ehRecorrente = cfg.tipo==="editar" && !!d.recorrente;
    return `<form id="modal-form">
      <div class="campo">
        <label>Tipo</label>
        <div class="seg-ctrl">
          <button type="button" class="seg${!isEntrada?" active":""}" data-seg-tipo="saida">Despesa</button>
          <button type="button" class="seg${isEntrada?" active":""}" data-seg-tipo="entrada">Entrada</button>
        </div>
      </div>
      <div class="campo">
        <label for="m-desc">Descrição *</label>
        <input id="m-desc" name="descricao" required placeholder="Ex: Conta de luz" value="${esc(d.descricao||"")}">
      </div>
      <div class="campo">
        <label for="m-val">Valor (R$) *</label>
        <input id="m-val" name="valor" type="number" min="0.01" step="0.01" required placeholder="0,00" value="${d.valor||""}">
      </div>
      <div class="campo" id="campo-cat"${isEntrada?' style="display:none"':""}>
        <label for="m-cat">Categoria</label>
        <select id="m-cat" name="categoria">
          ${categoriasPadrao().map(c=>`<option value="${c.id}"${d.categoria===c.id?" selected":""}>${c.nome}</option>`).join("")}
        </select>
      </div>
      <div class="campo">
        <label for="m-venc">Vencimento</label>
        <input id="m-venc" name="vencimento" type="date" value="${d.vencimento||ym+"-01"}">
      </div>
      <div class="campo" id="campo-div"${isEntrada?' style="display:none"':""}>
        <label>Divisão</label>
        <div class="seg-ctrl">
          <button type="button" class="seg${(d.divisao||"compartilhada")==="compartilhada"?" active":""}" data-seg-div="compartilhada">Compartilhada</button>
          <button type="button" class="seg${d.divisao==="individual"?" active":""}" data-seg-div="individual">Individual</button>
        </div>
      </div>
      <div class="campo">
        <label>Quem adicionou</label>
        <div class="pills-pessoas">${pillsPessoas()}</div>
      </div>
      ${cfg.tipo==="nova"?`<div class="campo">
        <label for="m-parc">Parcelar em</label>
        <select id="m-parc" name="parcelas">
          <option value="1">Sem parcelas</option>
          ${[2,3,4,5,6,9,10,12,18,24].map(n=>`<option value="${n}">${n}x</option>`).join("")}
        </select>
      </div>`:""}
      <div class="campo check-linha">
        <label><input type="checkbox" name="recorrente"${d.recorrente?" checked":""}> Recorrente (todo mês)</label>
      </div>
      <div class="campo check-linha" id="campo-pago">
        <label><input type="checkbox" name="pago" id="m-pago"${d.pago?" checked":""}> Já pago</label>
      </div>
      <div class="campo" id="campo-dpag" style="${d.pago?"":"display:none"}">
        <label for="m-dpag">Data do pagamento</label>
        <input id="m-dpag" name="dataPagamento" type="date" value="${d.dataPagamento||hoje}">
      </div>
      ${isCasa&&cfg.tipo==="nova"?`<div class="campo check-linha">
        <label><input type="checkbox" name="pagoPorOutro"> Pago por outra pessoa</label>
      </div>`:""}

      ${nProxParcelas > 0 ? `
      <details class="prop-section">
        <summary>📋 Aplicar às próximas ${nProxParcelas} parcela${nProxParcelas>1?"s":""}</summary>
        <div class="prop-body">
          <div class="check-linha">
            <label><input type="checkbox" name="prop_ativa" id="prop-ativa-cb"> Propagar alterações às parcelas seguintes</label>
          </div>
          <div class="prop-campos" id="prop-campos" style="display:none">
            <span class="prop-campos-label">Quais campos atualizar</span>
            <div class="check-linha"><label><input type="checkbox" name="prop_categoria" checked> Categoria</label></div>
            <div class="check-linha"><label><input type="checkbox" name="prop_descricao"> Descrição</label></div>
            <div class="check-linha"><label><input type="checkbox" name="prop_divisao"> Divisão (compartilhada / individual)</label></div>
            <div class="check-linha"><label><input type="checkbox" name="prop_valor"> Valor <span style="font-size:11px;color:var(--ink-3)">(mesmo valor em cada parcela)</span></label></div>
          </div>
        </div>
      </details>` : ehRecorrente ? `
      <p class="prop-note">↺ <strong>Recorrente:</strong> alterações em descrição, categoria e divisão já valem para os próximos meses automaticamente — o registro atual é o template.</p>` : ""}

      <div class="modal-footer">
        ${cfg.tipo==="editar"?`<button type="button" class="btn-danger" data-action="excluir" data-id="${d.id}">Excluir</button>`:""}
        <button type="button" class="btn-sec" data-action="fechar">Cancelar</button>
        <button type="submit" class="btn-pri">${cfg.tipo==="nova"?"Salvar":"Atualizar"}</button>
      </div>
    </form>`;
  }

  if(cfg.tipo === "dist"){
    const c = Object.assign({ reserva:15, investimento:10 }, S.distConfig || {});
    const pLivre = 100 - c.reserva - c.investimento;
    return `<form id="modal-form">
      <p style="font-size:13px;color:var(--ink-2);margin-bottom:12px">
        Total deve ser ≤ 100%. O restante é dividido proporcionalmente pela renda de cada um.
      </p>
      <div class="campo">
        <label for="dist-res">Reserva de emergência (%)</label>
        <input id="dist-res" name="reserva" type="number" min="0" max="100" step="1" value="${c.reserva}">
      </div>
      <div class="campo">
        <label for="dist-inv">Investimento (%)</label>
        <input id="dist-inv" name="investimento" type="number" min="0" max="100" step="1" value="${c.investimento}">
      </div>
      <p style="font-size:12px;color:var(--ink-3);margin-top:4px" id="dist-preview">
        Livre para dividir: ${pLivre}%
      </p>
      <div class="modal-footer">
        <button type="button" class="btn-sec" data-action="fechar">Cancelar</button>
        <button type="submit" class="btn-pri">Salvar</button>
      </div>
    </form>`;
  }

  if(cfg.tipo === "renda-padrao"){
    const jan = janelasPadrao();
    return `<form id="modal-form">
      ${jan.map((j,i)=>`<fieldset style="border:1px solid var(--rule-soft);border-radius:var(--r);padding:12px 14px;margin-bottom:10px">
        <legend style="font-size:12px;color:var(--ink-3);padding:0 6px">${esc(j.recebidoPor)}</legend>
        <div class="campo">
          <label>Quem recebe</label>
          <input name="jp_nome_${i}" value="${esc(j.recebidoPor)}" maxlength="20" placeholder="Nome">
        </div>
        <div class="campo">
          <label>Dia do mês</label>
          <input name="jp_dia_${i}" type="number" min="1" max="31" value="${j.dia}">
        </div>
        <div class="campo">
          <label>Valor (R$)</label>
          <input name="jp_val_${i}" type="number" min="0" step="0.01" value="${j.valor}">
        </div>
        <div class="campo check-linha">
          <label><input type="checkbox" name="jp_ant_${i}"${j.antecipar?" checked":""}> Antecipar se cair em fim de semana/feriado</label>
        </div>
      </fieldset>`).join("")}
      <div class="modal-footer">
        <button type="button" class="btn-sec" data-action="fechar">Cancelar</button>
        <button type="submit" class="btn-pri">Salvar</button>
      </div>
    </form>`;
  }

  if(cfg.tipo === "saldo"){
    return `<form id="modal-form">
      <div class="campo">
        <label for="m-saldo">Saldo atual (R$)</label>
        <input id="m-saldo" name="saldoBase" type="number" step="0.01" value="${S.saldoBase}">
      </div>
      <div class="campo">
        <label for="m-saldo-em">Data de referência</label>
        <input id="m-saldo-em" name="saldoBaseEm" type="date" value="${S.saldoBaseEm||hoje}">
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-sec" data-action="fechar">Cancelar</button>
        <button type="submit" class="btn-pri">Salvar</button>
      </div>
    </form>`;
  }

  if(cfg.tipo === "config"){
    return `<form id="modal-form">
      <div class="campo">
        <label>Tema</label>
        <div class="seg-ctrl">
          <button type="button" class="seg${S.tema==="auto"?" active":""}" data-tema="auto">Auto</button>
          <button type="button" class="seg${S.tema==="light"?" active":""}" data-tema="light">Claro</button>
          <button type="button" class="seg${S.tema==="dark"?" active":""}" data-tema="dark">Escuro</button>
        </div>
      </div>
      <h4>Perfis</h4>
      ${S.perfis.map((p,i)=>`<div class="campo">
        <label>Pessoa ${i+1}</label>
        <input name="perfil_${p.id}" value="${esc(p.nome)}" maxlength="20" placeholder="Nome">
      </div>`).join("")}
      <div style="margin-top:16px">
        <button type="button" class="btn-sec" style="width:100%" data-action="editar-categorias">🏷 Editar categorias</button>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-danger" data-action="limpar">Limpar tudo</button>
        <button type="button" class="btn-sec" data-action="fechar">Cancelar</button>
        <button type="submit" class="btn-pri">Salvar</button>
      </div>
    </form>`;
  }

  if(cfg.tipo === "categorias"){
    const cats = categoriasPadrao();
    const rows = cats.map((c,i)=>`
      <div class="cat-row" data-cat-idx="${i}">
        <input name="cat_id_${i}"   type="hidden" value="${esc(c.id)}">
        <input name="cat_nome_${i}" type="text"   value="${esc(c.nome)}" placeholder="Nome" maxlength="30" style="flex:1">
        <input name="cat_cor_${i}"  type="color"  value="${c.cor.startsWith("var(")? "#888888" : c.cor}" style="width:38px;height:38px;padding:2px;border-radius:6px;cursor:pointer">
        <button type="button" class="btn-icon cat-del" data-cat-idx="${i}" title="Remover">${icX()}</button>
      </div>`).join("");
    return `<form id="modal-form">
      <p style="font-size:12px;color:var(--ink-2);margin-bottom:12px">
        A última categoria fica como "outros" (fallback). Atenção: remover uma categoria não altera contas existentes.
      </p>
      <div id="cat-list">${rows}</div>
      <button type="button" class="btn-sec" id="cat-add-btn" style="margin-top:8px;width:100%">+ Nova categoria</button>
      <input type="hidden" name="cat_total" id="cat-total" value="${cats.length}">
      <div class="modal-footer">
        <button type="button" class="btn-sec" data-action="fechar">Cancelar</button>
        <button type="submit" class="btn-pri">Salvar</button>
      </div>
    </form>`;
  }

  return "<p>Modal desconhecido.</p>";
}

/* ═══════════════════════════════════════════════════════════════
   AÇÕES
   ═══════════════════════════════════════════════════════════════ */

async function salvarNova(form){
  const fd   = new FormData(form);
  const get  = k => fd.get(k) || "";
  const tipo = form.querySelector("[data-seg-tipo].active")?.dataset.segTipo || "saida";
  const div  = form.querySelector("[data-seg-div].active")?.dataset.segDiv || "compartilhada";
  const pagas= get("pago") === "on";
  const nParc= parseInt(get("parcelas")||"1", 10) || 1;
  const adicionadoPor = get("adicionadoPor") || S.perfis[0]?.id || "p1";
  const pagoPorOutro  = get("pagoPorOutro") === "on";

  const base = {
    descricao:   get("descricao").trim(),
    valor:       parseFloat(get("valor")) || 0,
    categoria:   get("categoria") || "outros",
    vencimento:  get("vencimento") || hojeISO(),
    divisao:     div,
    recorrente:  get("recorrente") === "on",
    adicionadoPor,
    pago:        pagas,
    dataPagamento: pagas ? (get("dataPagamento")||hojeISO()) : null,
    tipo:        tipo === "entrada" ? "entrada" : undefined
  };
  if(!base.tipo) delete base.tipo;
  if(pagoPorOutro && S.perfis.length >= 2){
    const outro = S.perfis.find(p=>p.id!==adicionadoPor);
    if(outro) base.pagoPor = outro.id;
  }

  if(nParc > 1){
    const valores = dividirParcelas(base.valor, nParc);
    const grp = uid();
    for(let i=0;i<nParc;i++){
      const id = uid();
      await gravarDespesa(id, Object.assign({}, base, {
        valor: valores[i],
        vencimento: dataParcela(base.vencimento, i),
        parcela: i+1,
        totalParcelas: nParc,
        grupo: grp
      }));
    }
  } else {
    await gravarDespesa(uid(), base);
  }

  avisarN8N("nova_despesa", {
    descricao:    base.descricao,
    valor:        base.valor,
    categoria:    base.categoria,
    vencimento:   base.vencimento,
    adicionadoPor: base.adicionadoPor,
    recorrente:   base.recorrente,
    nParc,
    totalParcelas: nParc > 1 ? nParc : undefined,
    texto: textoN8N("nova_despesa", base, { nParc })
  });
  fecharModalDom();
  say("Conta salva!");
}

async function salvarEdicao(form, id){
  const fd   = new FormData(form);
  const get  = k => fd.get(k) || "";
  const tipo = form.querySelector("[data-seg-tipo].active")?.dataset.segTipo || "saida";
  const div  = form.querySelector("[data-seg-div].active")?.dataset.segDiv || "compartilhada";
  const pagas= get("pago") === "on";
  const adicionadoPor = get("adicionadoPor") || S.perfis[0]?.id || "p1";

  const patch = {
    descricao:    get("descricao").trim(),
    valor:        parseFloat(get("valor")) || 0,
    categoria:    get("categoria") || "outros",
    vencimento:   get("vencimento") || hojeISO(),
    divisao:      div,
    recorrente:   get("recorrente") === "on",
    adicionadoPor,
    pago:         pagas,
    dataPagamento: pagas ? (get("dataPagamento")||hojeISO()) : null,
    tipo:         tipo === "entrada" ? "entrada" : null
  };
  if(!patch.tipo) delete patch.tipo;

  await gravarDespesa(id, patch);

  // Propagação para parcelas futuras do mesmo grupo
  if(fd.get("prop_ativa") === "on"){
    const orig  = S.modal?.dado || {};
    const grupo = orig.grupo;
    if(grupo){
      const parcelaAtual = orig.parcela || 1;
      const proximas = S.despesas.filter(d =>
        d.grupo === grupo && (d.parcela || 1) > parcelaAtual
      );
      if(proximas.length > 0){
        const campoProp = {};
        if(fd.get("prop_categoria") === "on") campoProp.categoria = patch.categoria;
        if(fd.get("prop_descricao") === "on") campoProp.descricao = patch.descricao;
        if(fd.get("prop_divisao")   === "on") campoProp.divisao   = patch.divisao;
        if(fd.get("prop_valor")     === "on") campoProp.valor     = patch.valor;
        if(Object.keys(campoProp).length > 0){
          await Promise.all(proximas.map(dx => gravarDespesa(dx.id, campoProp)));
          avisarN8N("editar_despesa", Object.assign({}, patch, { id, propagado: proximas.length + 1, texto: textoN8N("editar_despesa", patch) }));
          fecharModalDom();
          say(`✓ Atualizado em ${proximas.length + 1} parcelas!`);
          return;
        }
      }
    }
  }

  avisarN8N("editar_despesa", Object.assign({}, patch, { id, texto: textoN8N("editar_despesa", patch) }));
  fecharModalDom();
  say("Atualizado!");
}

async function quitar(id){
  const d = S.despesas.find(d=>d.id===id);
  if(!d) return;
  const dataPag = hojeISO();
  await gravarDespesa(id, { pago: true, dataPagamento: dataPag });
  avisarN8N("quitar_despesa", {
    id,
    descricao:     d.descricao,
    valor:         d.valor,
    categoria:     d.categoria,
    vencimento:    d.vencimento,
    adicionadoPor: d.adicionadoPor,
    dataPagamento: dataPag,
    texto: textoN8N("quitar_despesa", d, { dataPagamento: dataPag })
  });
  say("Quitada! ✓");
}

async function duplicar(id){
  const d = S.despesas.find(d=>d.id===id);
  if(!d) return;
  const copia = Object.assign({}, d, { id: uid(), pago: false, dataPagamento: null });
  delete copia.id;
  await gravarDespesa(uid(), copia);
  say("Duplicada!");
}

async function alternarRecorrencia(id){
  const d = S.despesas.find(d=>d.id===id);
  if(!d) return;
  await gravarDespesa(id, { recorrente: !d.recorrente });
  say(d.recorrente ? "Recorrência removida." : "Marcada como recorrente!");
}

async function excluir(id){
  const d = S.despesas.find(x=>x.id===id);
  await apagarDespesa(id);
  if(d) avisarN8N("excluir_despesa", {
    id,
    descricao:  d.descricao,
    valor:      d.valor,
    categoria:  d.categoria,
    vencimento: d.vencimento,
    texto: textoN8N("excluir_despesa", d)
  });
  fecharModalDom();
  say("Excluída.");
}

async function excluirGrupo(grupo){
  const ids = S.despesas.filter(d=>d.grupo===grupo).map(d=>d.id);
  await Promise.all(ids.map(id=>apagarDespesa(id)));
  fecharModalDom();
  say(`${ids.length} parcela${ids.length>1?"s":""} excluída${ids.length>1?"s":""}!`);
}

async function limparTudo(){
  if(!confirm("Excluir TODAS as despesas do livro? Essa ação não pode ser desfeita.")) return;
  try{
    await refLivro().child("despesas").remove();
    fecharModalDom();
    say("Tudo limpo!");
  } catch(e){ say("Erro ao limpar.", true); }
}

async function salvarDist(form){
  const fd  = new FormData(form);
  const res = Math.max(0, Math.min(100, parseFloat(fd.get("reserva"))||15));
  const inv = Math.max(0, Math.min(100 - res, parseFloat(fd.get("investimento"))||10));
  await salvarMeta({ distConfig: { reserva: res, investimento: inv } });
  fecharModalDom();
  say("Distribuição salva!");
}

async function salvarRendaPadrao(form){
  const fd = new FormData(form);
  const jan = janelasPadrao();
  const novas = jan.map((_,i)=>({
    recebidoPor: (fd.get(`jp_nome_${i}`)||"").trim() || jan[i].recebidoPor,
    dia:         parseInt(fd.get(`jp_dia_${i}`)||jan[i].dia, 10) || jan[i].dia,
    valor:       parseFloat(fd.get(`jp_val_${i}`)) || jan[i].valor,
    antecipar:   fd.get(`jp_ant_${i}`) === "on"
  }));
  await salvarMeta({ janelasEntrada: novas });
  fecharModalDom();
  say("Salários atualizados!");
}

async function salvarCategorias(form){
  const fd    = new FormData(form);
  const total = parseInt(fd.get("cat_total")||"0", 10);
  const novas = [];
  for(let i = 0; i < total; i++){
    const nome = (fd.get(`cat_nome_${i}`)||"").trim();
    const cor  = fd.get(`cat_cor_${i}`) || "#888888";
    const id   = (fd.get(`cat_id_${i}`)||"").trim() || nome.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");
    if(nome) novas.push({ id, nome, cor });
  }
  if(novas.length === 0){ say("Adicione ao menos uma categoria.", true); return; }
  await salvarMeta({ categorias: novas });
  fecharModalDom();
  say("Categorias salvas!");
}

async function salvarSaldo(form){
  const fd  = new FormData(form);
  const val = parseFloat(fd.get("saldoBase")) || 0;
  const em  = fd.get("saldoBaseEm") || hojeISO();
  await salvarMeta({ saldoBase: val, saldoBaseEm: em });
  fecharModalDom();
  say("Saldo atualizado!");
}

async function salvarConfig(form){
  // tema
  const temaBtn = form.querySelector("[data-tema].active");
  if(temaBtn){
    S.tema = temaBtn.dataset.tema;
    localStorage.setItem("tema", S.tema);
    document.documentElement.dataset.theme = S.tema;
  }
  // perfis
  const fd = new FormData(form);
  const perfisAtuais = S.perfis.map(p=>{
    const nome = (fd.get("perfil_"+p.id)||"").trim() || p.nome;
    return Object.assign({}, p, { nome });
  });
  await salvarMeta({ perfis: perfisAtuais });
  fecharModalDom();
  say("Configurações salvas!");
}

/* ═══════════════════════════════════════════════════════════════
   EVENT LISTENERS
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener("click", e=>{
  const t = e.target.closest("[data-aba]");
  if(t){ S.aba = t.dataset.aba; destruirGraficos(); render(); return; }

  const mes = e.target.closest("[data-mes]");
  if(mes){ S.mesAtivo = mes.dataset.mes; render(); return; }

  const filtro = e.target.closest("[data-filtro]");
  if(filtro){ S.filtro = filtro.dataset.filtro; S.filtroCat = null; render(); return; }

  const filtroCat = e.target.closest("[data-filtro-cat]");
  if(filtroCat){
    const id = filtroCat.dataset.filtroCat;
    S.filtroCat = S.filtroCat === id ? null : id;
    render(); return;
  }

  const janela = e.target.closest("[data-janela]");
  if(janela){ S.janela = parseInt(janela.dataset.janela,10); destruirGraficos(); render(); return; }

  const nova = e.target.closest("[data-action='nova']");
  if(nova){ S.modal = { tipo:"nova", titulo:"Nova conta" }; render(); return; }

  const saldo = e.target.closest("[data-action='saldo']");
  if(saldo){ S.modal = { tipo:"saldo", titulo:"Atualizar saldo" }; render(); return; }

  const editDist = e.target.closest("[data-action='editar-dist']");
  if(editDist){ S.modal = { tipo:"dist", titulo:"Distribuição da sobra" }; render(); return; }

  const editCats = e.target.closest("[data-action='editar-categorias']");
  if(editCats){ S.modal = { tipo:"categorias", titulo:"Categorias" }; render(); return; }

  // botão + dentro do modal de categorias (delegado)
  const catAdd = e.target.closest("#cat-add-btn");
  if(catAdd){
    const list  = document.getElementById("cat-list");
    const total = document.getElementById("cat-total");
    const i     = parseInt(total.value, 10);
    const div   = document.createElement("div");
    div.className = "cat-row";
    div.dataset.catIdx = i;
    div.innerHTML = `
      <input name="cat_id_${i}"   type="hidden" value="">
      <input name="cat_nome_${i}" type="text"   value="" placeholder="Nova categoria" maxlength="30" style="flex:1">
      <input name="cat_cor_${i}"  type="color"  value="#888888" style="width:38px;height:38px;padding:2px;border-radius:6px;cursor:pointer">
      <button type="button" class="btn-icon cat-del" data-cat-idx="${i}" title="Remover">${icX()}</button>`;
    list.appendChild(div);
    total.value = i + 1;
    div.querySelector("input[type=text]").focus();
    return;
  }

  const catDel = e.target.closest(".cat-del");
  if(catDel){
    const row = catDel.closest(".cat-row");
    if(row) row.remove();
    return;
  }

  const editRenda = e.target.closest("[data-action='editar-renda-padrao']");
  if(editRenda){ S.modal = { tipo:"renda-padrao", titulo:"Editar salários padrão" }; render(); return; }

  const novaEntrada = e.target.closest("[data-action='nova-entrada']");
  if(novaEntrada){ S.modal = { tipo:"nova", titulo:"Nova entrada", _prefixoEntrada:true }; render(); return; }

  const cfg = e.target.closest("[data-action='config']");
  if(cfg){ S.modal = { tipo:"config", titulo:"Configurações" }; render(); return; }

  const acertoBtn = e.target.closest("[data-action='registrar-acerto']");
  if(acertoBtn){
    const ym = acertoBtn.dataset.ym || S.mesAtivo;
    const ac = acerto(ym);
    if(ac && !ac.quitado){
      S.modal = { tipo:"nova", titulo:"Registrar acerto",
        _prefixoEntrada: false,
        dado: {
          descricao: `Acerto ${labelMes(ym).nome} — ${ac.devedor.nome} → ${ac.credor.nome}`,
          valor: ac.valor,
          categoria: "outros",
          vencimento: hojeISO(),
          divisao: "individual",
          adicionadoPor: ac.devedor.id
        }
      };
      render();
    }
    return;
  }

  const fechar = e.target.closest("[data-action='fechar']");
  if(fechar){ fecharModalDom(); return; }

  const excluirBtn = e.target.closest("[data-action='excluir'][data-id]");
  if(excluirBtn){ excluir(excluirBtn.dataset.id); return; }

  const limpar = e.target.closest("[data-action='limpar']");
  if(limpar){ limparTudo(); return; }

  const quitar_ = e.target.closest(".act-btn.quitar[data-id]");
  if(quitar_){ quitar(quitar_.dataset.id); return; }

  const edit_ = e.target.closest(".act-btn.edit[data-id]");
  if(edit_){
    const d = S.despesas.find(x=>x.id===edit_.dataset.id);
    if(d){ S.modal = { tipo:"editar", titulo:"Editar conta", dado:d }; render(); }
    return;
  }

  const row = e.target.closest(".row[data-id]");
  if(row && !e.target.closest(".act-btn")){
    const d = S.despesas.find(x=>x.id===row.dataset.id);
    if(d){ S.modal = { tipo:"editar", titulo:"Editar conta", dado:d }; render(); }
    return;
  }

  // seg-ctrl buttons (tipo, div, tema)
  const segTipo = e.target.closest("[data-seg-tipo]");
  if(segTipo){
    segTipo.closest(".seg-ctrl").querySelectorAll(".seg").forEach(b=>b.classList.remove("active"));
    segTipo.classList.add("active");
    const isMod = !!document.getElementById("campo-cat");
    if(isMod){
      const isEntr = segTipo.dataset.segTipo === "entrada";
      const camposCat = ["campo-cat","campo-div"].map(id=>document.getElementById(id)).filter(Boolean);
      camposCat.forEach(c=>c.style.display = isEntr?"none":"");
    }
    return;
  }

  const segDiv = e.target.closest("[data-seg-div]");
  if(segDiv){
    segDiv.closest(".seg-ctrl").querySelectorAll(".seg").forEach(b=>b.classList.remove("active"));
    segDiv.classList.add("active");
    return;
  }

  const segTema = e.target.closest("[data-tema]");
  if(segTema){
    segTema.closest(".seg-ctrl").querySelectorAll(".seg").forEach(b=>b.classList.remove("active"));
    segTema.classList.add("active");
    return;
  }

  // logout
  const logout = e.target.closest("[data-action='logout']");
  if(logout){ auth.signOut(); return; }
});

document.addEventListener("submit", e=>{
  e.preventDefault();
  const form = e.target;
  if(form.id !== "modal-form") return;
  const cfg = S.modal;
  if(!cfg) return;

  if(cfg.tipo === "nova"){
    salvarNova(form);
  } else if(cfg.tipo === "editar"){
    salvarEdicao(form, cfg.dado.id);
  } else if(cfg.tipo === "saldo"){
    salvarSaldo(form);
  } else if(cfg.tipo === "dist"){
    salvarDist(form);
  } else if(cfg.tipo === "renda-padrao"){
    salvarRendaPadrao(form);
  } else if(cfg.tipo === "config"){
    salvarConfig(form);
  } else if(cfg.tipo === "categorias"){
    salvarCategorias(form);
  }
});

// "pago" checkbox → mostra/esconde data de pagamento
document.addEventListener("change", e=>{
  const cb = e.target.closest("#m-pago");
  if(cb){
    const campo = document.getElementById("campo-dpag");
    if(campo) campo.style.display = cb.checked ? "" : "none";
  }
  // mostrar/ocultar campos de propagação
  const propAtivaCb = e.target.closest("#prop-ativa-cb");
  if(propAtivaCb){
    const campos = document.getElementById("prop-campos");
    if(campos) campos.style.display = propAtivaCb.checked ? "" : "none";
    return;
  }

  // preview de % livre no modal de distribuição
  const distInp = e.target.closest("#dist-res, #dist-inv");
  if(distInp){
    const res = parseFloat(document.getElementById("dist-res")?.value||0)||0;
    const inv = parseFloat(document.getElementById("dist-inv")?.value||0)||0;
    const prev = document.getElementById("dist-preview");
    if(prev) prev.textContent = `Livre para dividir: ${Math.max(0,100-res-inv)}%`;
  }
});

document.addEventListener("keydown", e=>{
  if(e.key === "Escape" && S.modal) fecharModalDom();
});

/* ═══════════════════════════════════════════════════════════════
   ÍCONES SVG
   ═══════════════════════════════════════════════════════════════ */

function icPlus(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
}
function icCheck(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}
function icEdit(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
}
function icX(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
}
function icGear(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
}
function icAlert(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
}
function icChart(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`;
}
function icCalendar(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
}
function icUsers(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
}
function icChevron(dir){
  return dir==="left"
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
}
function icLivro(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;
}

/* ═══════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════ */

auth.onAuthStateChanged(user=>{
  S.user      = user || null;
  S.authReady = true;
  S.authBusy  = false;
  if(user){
    ouvirDados(); // materializarRecorrentes é chamado dentro do callback de dados
  } else {
    desligarDados();
    S.dataReady = false;
    S.despesas  = [];
  }
  render();
});

render();

// test hook
if(typeof window !== "undefined") window.__appState = S;

})();
