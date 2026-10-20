// Núcleo: banco preparado, progresso salvo no aparelho, revisão espaçada,
// estatísticas e um barramento de eventos para os outros módulos se ligarem.
(function () {
  'use strict';

  const SIM = (window.SIM = window.SIM || {});

  // ---------- constantes da prova ----------

  SIM.TAM_SIMULADO = 30;
  SIM.CORTE = 20;
  SIM.MINUTOS = 60;
  SIM.LETRAS = ['A', 'B', 'C', 'D'];
  SIM.DIFICULDADES = ['Fácil', 'Intermediário', 'Difícil'];
  SIM.modulos = (window.BNQ && window.BNQ.modulos) || {};

  // ---------- utilidades ----------

  SIM.el = (id) => document.getElementById(id);

  // Texto do banco entra sempre por textContent, nunca por innerHTML.
  SIM.criar = function (tag, classe, texto) {
    const n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texto != null) n.textContent = texto;
    return n;
  };

  SIM.embaralhar = function (lista) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  SIM.br = (n) => Number(n).toLocaleString('pt-BR');

  // Dia local no formato AAAA-MM-DD (a meta diária vira à meia-noite do aparelho).
  SIM.hoje = function (ts) {
    const d = ts ? new Date(ts) : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  };

  SIM.normalizar = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // ---------- eventos ----------

  const ouvintes = {};
  SIM.on = function (nome, fn) { (ouvintes[nome] = ouvintes[nome] || []).push(fn); };
  SIM.emit = function (nome, dado) {
    (ouvintes[nome] || []).forEach((fn) => {
      try { fn(dado); } catch (e) { console.error('[SIM] ouvinte de ' + nome, e); }
    });
  };

  // ---------- banco ----------

  // O documento tem 7 questões repetidas palavra por palavra (mesmo enunciado,
  // mesma resposta). Ficam só uma vez, para não contarem em dobro.
  const cru = (window.BNQ && window.BNQ.questoes) || [];
  const vistas = new Set();
  SIM.banco = cru.filter((q) => {
    const chave = SIM.normalizar(q.e).trim() + '|' + (q.p || '') + '|' + SIM.normalizar(q.c).trim();
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
  SIM.repetidasRemovidas = cru.length - SIM.banco.length;

  SIM.porId = {};
  SIM.banco.forEach((q, n) => {
    SIM.porId[q.i] = q;
    q.n = n + 1; // número estável para mostrar no explorador
    // "Anti-chute": a certa NÃO é a alternativa mais longa. Nessas, o truque de
    // marcar a maior não funciona — medem conhecimento de verdade.
    q.ac = !(q.c.length > Math.max.apply(null, q.x.map((t) => t.length)));
  });

  // ---------- progresso ----------

  const CHAVE = 'bnq-progresso-v2';
  const CHAVE_V1 = 'bnq-progresso-v1';

  function vazio() {
    return {
      v: 2,
      q: {},            // id -> { n, a, e, ad, u, cx, pr, f }
      historico: [],    // { ts, acertos, total, modo, chefao? }
      dias: {},         // AAAA-MM-DD -> { resp, novas, revis }
      conquistas: {},   // id -> ts
      cont: {},         // contadores livres (glossário, etc.)
      config: {},       // teclas, som, meta, confirmar...
      naoEntendi: []    // palavras marcadas como "não entendi"
    };
  }

  function carregar() {
    let p = null;
    try {
      const txt = localStorage.getItem(CHAVE);
      if (txt) p = JSON.parse(txt);
    } catch (e) { p = null; }
    if (!p || typeof p !== 'object') p = vazio();
    const base = vazio();
    Object.keys(base).forEach((k) => { if (p[k] == null) p[k] = base[k]; });

    // Migração da versão original: só existia "erros" (id -> vezes).
    try {
      const velho = localStorage.getItem(CHAVE_V1);
      if (velho && !p.migradoV1) {
        const v1 = JSON.parse(velho) || {};
        Object.keys(v1.erros || {}).forEach((id) => {
          if (!SIM.porId[id]) return;
          const r = p.q[id] || (p.q[id] = novoRegistro());
          r.e += Number(v1.erros[id]) || 1;
          r.n += Number(v1.erros[id]) || 1;
          r.cx = 1; r.pr = Date.now();
        });
        (v1.historico || []).forEach((h) => p.historico.push(h));
        p.migradoV1 = true;
      }
    } catch (e) { /* sem v1 legível: segue */ }
    return p;
  }

  function novoRegistro() { return { n: 0, a: 0, e: 0, ad: 0, u: 0, cx: 0, pr: 0, f: false }; }

  SIM.progresso = carregar();

  let salvarAgendado = null;
  SIM.salvar = function () {
    clearTimeout(salvarAgendado);
    salvarAgendado = setTimeout(() => {
      try { localStorage.setItem(CHAVE, JSON.stringify(SIM.progresso)); } catch (e) { /* modo privado */ }
    }, 50);
  };
  window.addEventListener('pagehide', () => {
    try { localStorage.setItem(CHAVE, JSON.stringify(SIM.progresso)); } catch (e) { /* idem */ }
  });

  SIM.reg = function (id) { return SIM.progresso.q[id] || null; };
  function regCriando(id) { return SIM.progresso.q[id] || (SIM.progresso.q[id] = novoRegistro()); }

  SIM.config = function (chave, padrao) {
    const v = SIM.progresso.config[chave];
    return v === undefined ? padrao : v;
  };
  SIM.definirConfig = function (chave, valor) {
    SIM.progresso.config[chave] = valor;
    SIM.salvar();
    SIM.emit('config', { chave, valor });
  };

  SIM.contar = function (nome, quanto) {
    SIM.progresso.cont[nome] = (SIM.progresso.cont[nome] || 0) + (quanto || 1);
    SIM.salvar();
    SIM.emit('contador', { nome, valor: SIM.progresso.cont[nome] });
    return SIM.progresso.cont[nome];
  };

  // ---------- marcação 🚩 ----------

  SIM.marcada = (id) => !!(SIM.progresso.q[id] && SIM.progresso.q[id].f);
  SIM.alternarMarca = function (id) {
    const r = regCriando(id);
    r.f = !r.f;
    SIM.salvar();
    SIM.emit('marca', { id, marcada: r.f });
    return r.f;
  };

  // ---------- revisão espaçada (caixas de Leitner) ----------
  //
  // cx 0 = nunca respondida; 1..3 = em revisão; 4 = dominada.
  // Intervalos curtos de propósito: a prova é em semanas, não em meses.
  const MIN = 60 * 1000, DIA = 24 * 60 * MIN;
  SIM.INTERVALOS = { 1: 10 * MIN, 2: DIA, 3: 3 * DIA };
  SIM.DOMINADA = 4;

  // Registra uma resposta. resultado: 'certa' | 'errada'. duvida: estava com 🚩.
  SIM.registrar = function (id, certa, duvida, contexto) {
    const r = regCriando(id);
    const agora = Date.now();
    const nova = r.n === 0;
    r.n++; r.u = agora;
    if (!certa) {
      r.e++;
      r.cx = 1;
    } else if (duvida) {
      // Acerto com dúvida não prova domínio: volta para revisão como erro leve.
      r.ad++;
      r.cx = r.cx === 0 || r.cx === SIM.DOMINADA ? 2 : Math.max(r.cx, 1);
    } else {
      r.a++;
      r.cx = r.cx === 0 ? SIM.DOMINADA : Math.min(r.cx + 1, SIM.DOMINADA);
    }
    r.pr = r.cx >= 1 && r.cx <= 3 ? agora + SIM.INTERVALOS[r.cx] : 0;

    const dia = SIM.progresso.dias[SIM.hoje()] || (SIM.progresso.dias[SIM.hoje()] = { resp: 0, novas: 0, revis: 0 });
    dia.resp++;
    if (nova) dia.novas++;
    if (contexto && contexto.revisao) dia.revis++;

    SIM.salvar();
    SIM.emit('resposta', { id, certa, duvida, nova, registro: r, contexto: contexto || {} });
  };

  // Marcou 🚩 depois de já ter visto que acertou (no treino): era chute.
  // Converte o acerto limpo em acerto com dúvida.
  SIM.virouDuvida = function (id) {
    const r = SIM.progresso.q[id];
    if (!r || r.a < 1) return;
    r.a--; r.ad++;
    r.cx = 2; r.pr = Date.now() + SIM.INTERVALOS[2];
    SIM.salvar();
    SIM.emit('resposta-corrigida', { id, registro: r });
  };

  // Ponto de extensão: o glossário troca esta função para sublinhar termos.
  SIM.escreverTexto = function (alvo, texto) { alvo.textContent = texto; };

  SIM.pendentes = function (agora) {
    agora = agora || Date.now();
    return SIM.banco.filter((q) => {
      const r = SIM.progresso.q[q.i];
      return r && r.cx >= 1 && r.cx <= 3 && r.pr <= agora;
    });
  };

  SIM.emRevisao = function () {
    return SIM.banco.filter((q) => {
      const r = SIM.progresso.q[q.i];
      return r && r.cx >= 1 && r.cx <= 3;
    });
  };

  SIM.situacao = function (q) {
    const r = SIM.progresso.q[q.i];
    if (!r || r.n === 0) return 'nova';
    if (r.cx === SIM.DOMINADA) return 'dominada';
    if (r.e > 0 && r.cx === 1) return 'errada';
    if (r.ad > 0) return 'duvida';
    return 'revisao';
  };

  // ---------- estatísticas ----------

  // Acerto por módulo e geral, contando acerto com dúvida como meio acerto.
  SIM.estatisticas = function () {
    const est = { modulos: {}, geral: { a: 0, n: 0 }, ac: { a: 0, n: 0 }, comum: { a: 0, n: 0 } };
    Object.keys(SIM.modulos).forEach((m) => {
      est.modulos[m] = { a: 0, n: 0, total: 0, dominadas: 0, vistas: 0 };
    });
    SIM.banco.forEach((q) => {
      const m = est.modulos[q.m];
      if (!m) return;
      m.total++;
      const r = SIM.progresso.q[q.i];
      if (!r || !r.n) return;
      m.vistas++;
      if (r.cx === SIM.DOMINADA) m.dominadas++;
      const a = r.a + r.ad * 0.5;
      m.a += a; m.n += r.n;
      est.geral.a += a; est.geral.n += r.n;
      const g = q.ac ? est.ac : est.comum;
      g.a += a; g.n += r.n;
    });
    return est;
  };

  // Amostra de uma Beta(a, b) via duas Gamma (Marsaglia–Tsang).
  function gamma(k) {
    if (k < 1) return gamma(k + 1) * Math.pow(Math.random(), 1 / k);
    const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x, v;
      do {
        const u1 = Math.random(), u2 = Math.random();
        x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = Math.random();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }
  function beta(a, b) { const x = gamma(a); return x / (x + gamma(b)); }

  // Chance de tirar ≥ 20 numa prova de 30, sorteada na proporção do banco.
  // Simula 4.000 provas: para cada uma, sorteia a "habilidade" em cada módulo
  // a partir do que você já respondeu (com a incerteza de ter visto pouco),
  // e depois as 30 questões. Módulo com menos de 15 respostas = estimativa fraca.
  SIM.prontidao = function () {
    const est = SIM.estatisticas();
    const ms = Object.keys(est.modulos);
    const total = SIM.banco.length;
    const fracos = ms.filter((m) => est.modulos[m].n < 15);
    if (est.geral.n < 30) return { chance: null, fracos, est, respostas: est.geral.n };

    const pesos = ms.map((m) => est.modulos[m].total / total);
    const N = 4000;
    let passou = 0, soma = 0;
    for (let s = 0; s < N; s++) {
      const p = ms.map((m) => {
        const r = est.modulos[m];
        return beta(r.a + 1, r.n - r.a + 1);
      });
      let acertos = 0;
      for (let k = 0; k < SIM.TAM_SIMULADO; k++) {
        let u = Math.random(), j = 0;
        while (j < pesos.length - 1 && u > pesos[j]) { u -= pesos[j]; j++; }
        if (Math.random() < p[j]) acertos++;
      }
      soma += acertos;
      if (acertos >= SIM.CORTE) passou++;
    }
    return { chance: passou / N, media: soma / N, fracos, est, respostas: est.geral.n };
  };

  // ---------- meta diária e sequência ----------

  SIM.metaNovas = () => SIM.config('metaNovas', 30);

  // Meta do dia: zerar as pendentes da revisão + N questões novas.
  SIM.metaHoje = function () {
    const d = SIM.progresso.dias[SIM.hoje()] || { resp: 0, novas: 0, revis: 0 };
    const pend = SIM.pendentes().length;
    const alvo = SIM.metaNovas();
    return { novas: d.novas, alvo, pendentes: pend, cumprida: d.novas >= alvo && pend === 0, dia: d };
  };

  // Dias seguidos em que a meta de novas foi batida (hoje conta se já bateu).
  SIM.sequencia = function () {
    const alvo = SIM.metaNovas();
    let n = 0;
    const d = new Date();
    const hojeOk = (SIM.progresso.dias[SIM.hoje()] || {}).novas >= alvo;
    if (!hojeOk) d.setDate(d.getDate() - 1);
    for (;;) {
      const dia = SIM.progresso.dias[SIM.hoje(d.getTime())];
      if (!dia || dia.novas < alvo) break;
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  };

  // ---------- backup ----------

  SIM.exportar = function () {
    return JSON.stringify({ app: 'simulado-cnh', exportado: new Date().toISOString(), progresso: SIM.progresso });
  };

  SIM.importar = function (texto) {
    const obj = JSON.parse(texto);
    const p = obj && obj.progresso;
    if (!p || typeof p !== 'object' || p.v !== 2 || typeof p.q !== 'object') {
      throw new Error('Arquivo não é um backup deste simulado.');
    }
    SIM.progresso = Object.assign(vazio(), p);
    try { localStorage.setItem(CHAVE, JSON.stringify(SIM.progresso)); } catch (e) { /* idem */ }
    SIM.emit('importado');
  };

  // ---------- junção com o progresso de outro aparelho ----------
  // (o link em si é montado e lido em js/pacote.js)

  const HORA = 3600 * 1000;

  // Junta o que veio de outro aparelho com o daqui, sem perder nada:
  // em cada questão vale a resposta mais recente; contadores ficam no maior valor.
  SIM.juntar = function (o) {
    const p = SIM.progresso;
    const r = { novas: 0, atualizadas: 0 };
    Object.keys(o.q).forEach((id) => {
      const local = p.q[id];
      if (!local) { p.q[id] = o.q[id]; r.novas++; }
      else {
        // O link traz a hora cheia: na mesma hora, desempata quem respondeu mais vezes.
        const hi = Math.floor((o.q[id].u || 0) / HORA), hl = Math.floor((local.u || 0) / HORA);
        if (hi > hl || (hi === hl && o.q[id].n > local.n)) { p.q[id] = o.q[id]; r.atualizadas++; }
      }
    });

    // As datas viajam arredondadas na hora: mesma rodada = mesmo modo e placar com até 1 h de diferença.
    const mesma = (a, b) => a.modo === b.modo && a.acertos === b.acertos && a.total === b.total && Math.abs(a.ts - b.ts) < HORA;
    o.historico.forEach((h) => { if (!p.historico.some((l) => mesma(l, h))) p.historico.push(h); });
    p.historico.sort((a, b) => a.ts - b.ts);
    if (p.historico.length > 200) p.historico = p.historico.slice(-200);

    Object.keys(o.dias).forEach((dia) => {
      const l = p.dias[dia] || (p.dias[dia] = { resp: 0, novas: 0, revis: 0 });
      Object.keys(o.dias[dia]).forEach((k) => { l[k] = Math.max(Number(l[k]) || 0, Number(o.dias[dia][k]) || 0); });
    });

    p.conquistas = p.conquistas || {};
    Object.keys(o.conquistas).forEach((id) => {
      p.conquistas[id] = p.conquistas[id] ? Math.min(p.conquistas[id], o.conquistas[id]) : o.conquistas[id];
    });

    Object.keys(o.cont).forEach((k) => {
      const v = o.cont[k];
      if (typeof v === 'number') p.cont[k] = Math.max(Number(p.cont[k]) || 0, v);
      else if (p.cont[k] == null) p.cont[k] = v;
    });

    p.placas = p.placas || {};
    Object.keys(o.placas).forEach((c) => {
      const l = p.placas[c], x = o.placas[c];
      const maisNova = l && l.u && x.u ? x.u > l.u
        : (x.n || 0) > (l ? l.n || 0 : -1) || (l && (x.n || 0) === (l.n || 0) && (x.pr || 0) > (l.pr || 0));
      if (!l || maisNova) p.placas[c] = x;
    });

    p.glossarioVistos = p.glossarioVistos || {};
    Object.keys(o.glossarioVistos || {}).forEach((t) => {
      if (!p.glossarioVistos[t]) p.glossarioVistos[t] = o.glossarioVistos[t];
    });

    const ne = {};
    (p.naoEntendi || []).forEach((x) => { ne[x.palavra + '|' + x.questao] = true; });
    p.naoEntendi = (p.naoEntendi || []).concat(o.naoEntendi.filter((x) => !ne[x.palavra + '|' + x.questao]));

    try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch (e) { /* modo privado */ }
    SIM.emit('importado');
    return r;
  };
})();
