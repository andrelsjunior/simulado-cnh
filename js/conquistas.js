// Conquistas: medalhas que premiam aprendizado (domínio, constância, saber
// sem chutar), não volume. Sem XP, sem nível, sem punição: conquista ganha
// nunca se perde. Grava em SIM.progresso.conquistas[id] = timestamp.
(function () {
  'use strict';

  const SIM = window.SIM;
  const { el, criar, br } = SIM;

  // Estado próprio do módulo (sequências que podem zerar, aviso de boas-vindas).
  // Sempre lido via SIM.progresso: importar um backup troca o objeto inteiro.
  function estado() {
    const p = SIM.progresso;
    if (!p.conquistas || typeof p.conquistas !== 'object') p.conquistas = {};
    if (!p.conquistasEstado || typeof p.conquistasEstado !== 'object') {
      p.conquistasEstado = { acSeq: 0, acMelhor: 0, iniciado: false };
    }
    return p.conquistasEstado;
  }
  function ganhas() { estado(); return SIM.progresso.conquistas; }

  // ---------- leituras do progresso ----------

  function registros() {
    const q = SIM.progresso.q;
    return Object.keys(q).map((id) => q[id]);
  }
  function contaReg(fn) { return registros().filter(fn).length; }
  const DOM = () => SIM.DOMINADA;

  function vistasDistintas() { return contaReg((r) => r.n > 0); }
  function voltaramDoErro() { return contaReg((r) => r.e > 0 && r.cx === DOM()); }
  function duvidasDominadas() { return contaReg((r) => r.ad > 0 && r.cx === DOM()); }

  function dominioModulo(m) {
    let total = 0, dom = 0;
    SIM.banco.forEach((q) => {
      if (String(q.m) !== String(m)) return;
      total++;
      const r = SIM.progresso.q[q.i];
      if (r && r.cx === DOM()) dom++;
    });
    return { atual: dom, alvo: total };
  }
  function melhorModulo() {
    let melhor = { atual: 0, alvo: 1, frac: 0 };
    Object.keys(SIM.modulos).forEach((m) => {
      const d = dominioModulo(m);
      const frac = d.alvo ? d.atual / d.alvo : 0;
      if (frac > melhor.frac) melhor = Object.assign({ frac, m }, d);
    });
    return melhor;
  }
  function dominioTotal() {
    return { atual: contaReg((r) => r.cx === DOM()), alvo: SIM.banco.length };
  }

  // Simulados completos do histórico (entradas antigas da v1 não têm modo: 30 questões = simulado).
  function simulados() {
    return (SIM.progresso.historico || []).filter((h) =>
      h.modo === 'simulado' || (!h.modo && Number(h.total) === SIM.TAM_SIMULADO));
  }
  function passou(h) { return Number(h.acertos) >= SIM.CORTE; }
  function sequenciaAprovadaAtual() {
    let n = 0;
    simulados().forEach((h) => { n = passou(h) ? n + 1 : 0; });
    return n;
  }
  function melhorSequenciaAprovada() {
    let n = 0, melhor = 0;
    simulados().forEach((h) => { n = passou(h) ? n + 1 : 0; melhor = Math.max(melhor, n); });
    return melhor;
  }
  function chefaoVencido() {
    return (SIM.progresso.historico || []).some((h) =>
      h.modo === 'chefao' && Number(h.acertos) >= SIM.CHEFAO.corte);
  }
  function cont(nome) { return Number(SIM.progresso.cont[nome]) || 0; }

  // ---------- catálogo ----------
  //
  // cumprida(ctx): ctx vem do evento que disparou a checagem (ou {} na checagem completa).
  // progresso(): { atual, alvo } para a barra parcial nas bloqueadas.

  const nomesMod = {
    1: { id: 'dominio-1', nome: 'Mestre das Placas', icone: '🚦' },
    2: { id: 'dominio-2', nome: 'Escolha Certa', icone: '⚖️' },
    3: { id: 'dominio-3', nome: 'Direção Defensiva', icone: '🛡️' },
    4: { id: 'dominio-4', nome: 'Anjo da Guarda', icone: '⛑️' }
  };

  const catalogo = [
    // Marcos
    {
      id: 'primeira-marcha', categoria: 'marcos', icone: '🚗', nome: 'Primeira marcha',
      descricao: 'Responder 50 questões diferentes.',
      cumprida: () => vistasDistintas() >= 50,
      progresso: () => ({ atual: vistasDistintas(), alvo: 50 })
    },
    {
      id: 'primeira-habilitacao', categoria: 'marcos', icone: '🪪', nome: 'Primeira habilitação',
      descricao: 'Passar num simulado completo: 20 ou mais de 30.',
      cumprida: () => simulados().some(passou)
    },
    {
      id: 'sem-susto', categoria: 'marcos', icone: '😌', nome: 'Sem susto',
      descricao: 'Passar em 3 simulados completos seguidos.',
      cumprida: () => melhorSequenciaAprovada() >= 3,
      progresso: () => ({ atual: sequenciaAprovadaAtual(), alvo: 3, rotulo: 'seguidos agora' })
    },
    {
      id: 'folga', categoria: 'marcos', icone: '🎯', nome: 'Folga',
      descricao: 'Fazer 27 ou mais num simulado completo.',
      cumprida: () => simulados().some((h) => Number(h.acertos) >= 27)
    },

    // Domínio
    {
      id: 'base-firme', categoria: 'dominio', icone: '🧱', nome: 'Base firme',
      descricao: 'Dominar metade das questões de um módulo.',
      cumprida: () => melhorModulo().frac >= 0.5,
      progresso: () => {
        const m = melhorModulo();
        return { atual: m.atual, alvo: Math.ceil(m.alvo / 2), rotulo: m.m ? 'módulo ' + m.m : '' };
      }
    }
  ].concat(Object.keys(nomesMod).map((m) => ({
    id: nomesMod[m].id, categoria: 'dominio', icone: nomesMod[m].icone, nome: nomesMod[m].nome,
    descricao: 'Dominar todas as questões do módulo ' + m + ' (' + (SIM.modulos[m] || '') + ').',
    cumprida: () => { const d = dominioModulo(m); return d.alvo > 0 && d.atual >= d.alvo; },
    progresso: () => dominioModulo(m)
  }))).concat([
    {
      id: 'tudo-dominado', categoria: 'dominio', icone: '🏆', nome: 'Tudo dominado',
      descricao: 'Dominar todas as questões do banco.',
      cumprida: () => { const d = dominioTotal(); return d.atual >= d.alvo; },
      progresso: dominioTotal
    },

    // Aprendizado
    {
      id: 'pegadinha', categoria: 'aprendizado', icone: '🕵️', nome: 'Não caio em pegadinha',
      descricao: 'Acertar 20 questões anti-chute seguidas, sem 🚩 de dúvida.',
      cumprida: () => estado().acMelhor >= 20,
      progresso: () => ({ atual: estado().acSeq, alvo: 20, rotulo: 'seguidas agora' })
    },
    {
      id: 'aprendeu-erro', categoria: 'aprendizado', icone: '📈', nome: 'Aprendeu com o erro',
      descricao: 'Fazer 25 questões que você já errou virarem dominadas.',
      cumprida: () => voltaramDoErro() >= 25,
      progresso: () => ({ atual: voltaramDoErro(), alvo: 25 })
    },
    {
      id: 'revisao-limpa', categoria: 'aprendizado', icone: '🧹', nome: 'Revisão limpa',
      descricao: 'Acertar todas de uma Revisão do dia com 10 ou mais questões, sem 🚩.',
      cumprida: (ctx) => {
        const s = ctx.sessaoFim;
        if (!s || s.modo !== 'revisao' || s.itens.length < 10) return false;
        return s.itens.every((it) => it.marcada != null && it.alternativas[it.marcada].certa &&
          !it.bandeiraNaHora && !SIM.marcada(it.q.i));
      }
    },

    // Constância
    {
      id: 'sequencia-3', categoria: 'constancia', icone: '🔥', nome: 'Três dias na estrada',
      descricao: 'Bater a meta de questões novas 3 dias seguidos.',
      cumprida: () => SIM.sequencia() >= 3,
      progresso: () => ({ atual: SIM.sequencia(), alvo: 3, rotulo: 'dias' })
    },
    {
      id: 'sequencia-7', categoria: 'constancia', icone: '📅', nome: 'Semana cheia',
      descricao: 'Bater a meta de questões novas 7 dias seguidos.',
      cumprida: () => SIM.sequencia() >= 7,
      progresso: () => ({ atual: SIM.sequencia(), alvo: 7, rotulo: 'dias' })
    },

    // Chefão
    {
      id: 'na-mira', categoria: 'chefao', icone: '🔓', nome: 'Na mira',
      descricao: 'Chegar a 80% de chance estimada de passar, com todos os módulos bem medidos. Abre o Chefão.',
      cumprida: () => cont('chefaoLiberado') > 0
    },
    {
      id: 'pronto-detran', categoria: 'chefao', icone: '👑', nome: 'Pronto pro Detran',
      descricao: 'Vencer o Simulado Chefão: 25 ou mais de 30.',
      cumprida: chefaoVencido
    },

    // Secretas
    {
      id: 'sinistro', categoria: 'secretas', secreta: true, icone: '📖', nome: 'Sinistro é acidente',
      dica: 'As palavras do trânsito têm sentido próprio.',
      descricao: 'Consultar 10 termos no glossário.',
      cumprida: () => cont('glossarioConsultas') >= 10,
      progresso: () => ({ atual: cont('glossarioConsultas'), alvo: 10 })
    },
    {
      id: 'sem-mouse', categoria: 'secretas', secreta: true, icone: '⌨️', nome: 'Sem mouse',
      dica: 'Dá para fazer a prova inteira sem tirar as mãos de um lugar só?',
      descricao: 'Terminar um simulado respondendo tudo só pelo teclado.',
      cumprida: (ctx) => {
        const s = ctx.sessaoFim;
        return !!s && (s.modo === 'simulado' || s.modo === 'chefao') && s.usouPonteiro === false &&
          s.itens.every((it) => it.marcada != null);
      }
    },
    {
      id: 'revisao-entrega', categoria: 'secretas', secreta: true, icone: '🔍', nome: 'Revisão de entrega',
      dica: 'Antes de entregar, vale olhar de novo o que ficou em dúvida.',
      descricao: 'Voltar a uma questão com 🚩 na tela de entrega e depois entregar.',
      cumprida: (ctx) => !!ctx.sessaoFim && ctx.sessaoFim === sessaoQueRevisou
    },
    {
      id: 'voltou-erro', categoria: 'secretas', secreta: true, icone: '🪃', nome: 'Voltou do erro',
      dica: 'Errar faz parte. O que vem depois é que conta.',
      descricao: 'Acertar 3 vezes seguidas, sem dúvida, uma questão que você tinha errado.',
      cumprida: () => voltaramDoErro() >= 1
    },
    {
      id: 'duvida-honesta', categoria: 'secretas', secreta: true, icone: '🙋', nome: 'Dúvida honesta',
      dica: 'Admitir que não tem certeza também é estudar.',
      descricao: 'Dominar 3 questões que você tinha marcado com 🚩 de dúvida.',
      cumprida: () => duvidasDominadas() >= 3,
      progresso: () => ({ atual: duvidasDominadas(), alvo: 3 })
    }
  ]);

  const porId = {};
  catalogo.forEach((c) => { porId[c.id] = c; });

  const CATEGORIAS = [
    ['marcos', 'Marcos'],
    ['dominio', 'Domínio'],
    ['aprendizado', 'Aprendizado'],
    ['constancia', 'Constância'],
    ['chefao', 'Chefão'],
    ['secretas', 'Secretas']
  ];

  // ---------- conceder ----------

  let pronto = false;          // só depois da checagem silenciosa do carregamento
  let sessaoQueRevisou = null; // sessão em que a entrega voltou a uma questão com 🚩
  const fila = [];             // avisos segurados durante sessão cronometrada

  function emProvaCronometrada() {
    if (SIM.sessaoAtivaComTempo) return SIM.sessaoAtivaComTempo();
    const s = SIM.sessao && SIM.sessao();
    const n = SIM.telaAtual && SIM.telaAtual().nome;
    return !!(s && s.fim && (n === 'prova' || n === 'entrega'));
  }

  function ganhar(id, silencioso) {
    const c = porId[id];
    if (!c) return false;
    const g = ganhas();
    if (g[id]) return false;
    g[id] = Date.now();
    SIM.salvar();
    SIM.emit('conquista', { id, conquista: c, silencioso: !!silencioso });
    if (!silencioso) {
      fila.push(c);
      if (!emProvaCronometrada()) despejarFila();
    }
    if (telaAberta()) pintar();
    return true;
  }

  // Um aviso a cada 700 ms, para três medalhas juntas não virarem um bloco só.
  let proximoAviso = 0;
  function despejarFila() {
    if (!fila.length) return;
    fila.splice(0, fila.length).forEach((c) => {
      const agora = Date.now();
      const quando = Math.max(agora, proximoAviso);
      proximoAviso = quando + 700;
      setTimeout(() => {
        SIM.aviso(c.descricao, { icone: c.icone, titulo: 'Conquista: ' + c.nome, classe: 'conquista', ms: 5000 });
        tocarSom();
      }, quando - agora);
    });
  }

  // Checa o catálogo inteiro; ctx traz o que só existe no momento do evento.
  function verificar(ctx, silencioso) {
    const g = ganhas();
    const novas = [];
    catalogo.forEach((c) => {
      if (g[c.id]) return;
      let ok = false;
      try { ok = !!c.cumprida(ctx || {}); } catch (e) { ok = false; }
      if (ok && ganhar(c.id, silencioso)) novas.push(c.id);
    });
    return novas;
  }

  // ---------- som (opcional, desligado por padrão) ----------

  let audio = null;
  function tocarSom() {
    if (!SIM.config('som', false)) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = audio || new AC();
      if (audio.state === 'suspended') audio.resume();
      const t0 = audio.currentTime + 0.02;
      [659.25, 987.77].forEach((f, i) => {
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        const t = t0 + i * 0.11;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        o.connect(g); g.connect(audio.destination);
        o.start(t); o.stop(t + 0.3);
      });
    } catch (e) { /* sem áudio: segue em silêncio */ }
  }

  // ---------- eventos ----------

  function seguirAntiChute(d) {
    const q = SIM.porId[d.id];
    if (!q || !q.ac) return;
    const e = estado();
    if (d.certa && !d.duvida) {
      e.acSeq++;
      e.acMelhor = Math.max(e.acMelhor || 0, e.acSeq);
    } else {
      e.acSeq = 0;
    }
    SIM.salvar();
  }

  SIM.on('resposta', (d) => {
    seguirAntiChute(d);
    if (pronto) verificar({ resposta: d });
  });

  // Marcou 🚩 depois de ver que acertou: aquele acerto era chute, a sequência anti-chute zera.
  SIM.on('resposta-corrigida', (d) => {
    const q = SIM.porId[d.id];
    if (q && q.ac) { estado().acSeq = 0; SIM.salvar(); }
  });

  SIM.on('entrega-revisou', () => { sessaoQueRevisou = SIM.sessao ? SIM.sessao() : null; });
  SIM.on('sessao-inicio', () => { sessaoQueRevisou = null; });

  SIM.on('sessao-fim', (s) => {
    if (!pronto) return;
    verificar({ sessaoFim: s });
    sessaoQueRevisou = null;
  });

  SIM.on('contador', (d) => { if (pronto) verificar({ contador: d }); });

  // Saiu da prova cronometrada: mostra o que ficou segurado.
  SIM.on('tela', () => { if (!emProvaCronometrada()) despejarFila(); });

  // Backup importado: concede em silêncio o que o progresso trazido já cumpre.
  SIM.on('importado', () => {
    estado();
    setTimeout(() => checagemInicial(true), 0);
  });

  function checagemInicial(forcarResumo) {
    const e = estado();
    const primeira = !e.iniciado;
    // Primeira vez (ou backup importado): o que já estava cumprido entra sem festa.
    const novas = verificar({}, primeira || forcarResumo);
    e.iniciado = true;
    SIM.salvar();
    if ((primeira || forcarResumo) && novas.length) {
      const n = novas.length;
      SIM.aviso('Seu progresso já valia ' + (n === 1 ? '1 conquista' : n + ' conquistas') +
        '. Veja em Conquistas (' + SIM.teclaDe('conquistas') + ').',
      { icone: '🏅', titulo: 'Você já tinha ' + n + (n === 1 ? ' conquista' : ' conquistas'), classe: 'conquista', ms: 6000 });
    }
    pronto = true;
    if (SIM.telaAtual && SIM.telaAtual().nome === 'inicio' && SIM.pintarInicio) SIM.pintarInicio();
  }

  // app.js mostra o início no DOMContentLoaded dele (registrado antes deste).
  window.addEventListener('DOMContentLoaded', () => checagemInicial(false));

  // ---------- tela ----------

  const tela = criar('section', 'tela tela-conquistas');
  tela.id = 'tela-conquistas';
  tela.hidden = true;
  el('app').appendChild(tela);

  function telaAberta() { return SIM.telaAtual && SIM.telaAtual().nome === 'conquistas'; }

  function dataCurta(ts) {
    return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function cartao(c) {
    const g = ganhas()[c.id];
    const escondida = c.secreta && !g;
    const art = criar('article', 'medalha' + (g ? ' ganha' : ' bloqueada') + (escondida ? ' secreta' : ''));
    art.dataset.nav = '';
    art.tabIndex = 0;
    art.setAttribute('role', 'listitem');

    const ic = criar('span', 'medalha-icone', escondida ? '?' : c.icone);
    ic.setAttribute('aria-hidden', 'true');
    art.appendChild(ic);

    const corpo = criar('div', 'medalha-corpo');
    corpo.appendChild(criar('b', 'medalha-nome', escondida ? '???' : c.nome));
    corpo.appendChild(criar('p', 'medalha-desc', escondida ? 'Dica: ' + c.dica : c.descricao));

    let rotuloAria = (escondida ? 'Conquista secreta' : c.nome) + '. ';
    if (g) {
      corpo.appendChild(criar('span', 'medalha-status dado', '✓ ganha em ' + dataCurta(g)));
      rotuloAria += 'Ganha em ' + dataCurta(g) + '. ';
    } else if (c.progresso && !escondida) {
      let p = null;
      try { p = c.progresso(); } catch (e) { p = null; }
      if (p && p.alvo > 0) {
        const atual = Math.min(p.atual, p.alvo);
        const barra = criar('div', 'medalha-barra');
        barra.setAttribute('aria-hidden', 'true');
        const i = criar('i');
        i.style.width = (atual / p.alvo * 100) + '%';
        barra.appendChild(i);
        corpo.appendChild(barra);
        const txt = br(atual) + '/' + br(p.alvo) + (p.rotulo ? ' · ' + p.rotulo : '');
        corpo.appendChild(criar('span', 'medalha-status dado', txt));
        rotuloAria += 'Progresso ' + txt + '. ';
      }
    } else {
      corpo.appendChild(criar('span', 'medalha-status dado', escondida ? '' : 'bloqueada'));
    }
    art.appendChild(corpo);
    art.setAttribute('aria-label', rotuloAria + (escondida ? 'Dica: ' + c.dica : c.descricao));
    return art;
  }

  function contagem() {
    const g = ganhas();
    return catalogo.filter((c) => g[c.id]).length;
  }

  function pintar() {
    const focoId = document.activeElement && document.activeElement.closest &&
      document.activeElement.closest('.medalha') ? document.activeElement.dataset.id : null;
    tela.textContent = '';
    const cab = criar('header', 'pagina-cab');
    cab.appendChild(criar('h1', 'pagina-titulo', 'Conquistas'));
    const n = contagem();
    const sub = criar('p', 'muted');
    sub.appendChild(criar('b', 'dado conquistas-conta', n + ' de ' + catalogo.length));
    sub.appendChild(document.createTextNode(' · premiam o que você aprendeu, não quantas horas passou aqui. ' +
      'Conquista ganha não se perde.'));
    cab.appendChild(sub);
    tela.appendChild(cab);

    CATEGORIAS.forEach(([cat, titulo]) => {
      const lista = catalogo.filter((c) => c.categoria === cat);
      if (!lista.length) return;
      const ganhasCat = lista.filter((c) => ganhas()[c.id]).length;
      const h = criar('h2', 'secao conquistas-secao');
      h.appendChild(criar('span', null, titulo));
      h.appendChild(criar('span', 'dado muted', ganhasCat + '/' + lista.length));
      tela.appendChild(h);
      const grade = criar('div', 'medalhas');
      grade.setAttribute('role', 'list');
      lista.forEach((c) => {
        const card = cartao(c);
        card.dataset.id = c.id;
        grade.appendChild(card);
      });
      tela.appendChild(grade);
    });

    const op = criar('label', 'opcao');
    const cb = criar('input');
    cb.type = 'checkbox';
    cb.dataset.nav = '';
    cb.checked = !!SIM.config('som', false);
    cb.addEventListener('change', () => {
      SIM.definirConfig('som', cb.checked);
      if (cb.checked) tocarSom();
    });
    op.appendChild(cb);
    op.appendChild(criar('span', null, 'Tocar um som curto ao ganhar uma conquista.'));
    tela.appendChild(op);

    const acoes = criar('div', 'acoes');
    const voltar = criar('button', 'btn', 'Voltar ao início');
    voltar.type = 'button';
    voltar.dataset.nav = '';
    voltar.addEventListener('click', () => SIM.irInicio());
    acoes.appendChild(voltar);
    tela.appendChild(acoes);

    if (focoId) {
      const alvo = tela.querySelector('.medalha[data-id="' + focoId + '"]');
      if (alvo) { alvo.classList.add('cursor-nav'); alvo.focus({ preventScroll: true }); }
    }
  }

  SIM.registrarTela('conquistas', { elemento: tela, aoMostrar: pintar, voltar: () => SIM.irInicio() });

  // ---------- teclado e menu ----------

  SIM.registrarAcao({ id: 'conquistas', grupo: 'menus', rotulo: 'Conquistas', padrao: ['y'] });
  SIM.registrarGlobal('conquistas', () => {
    const n = SIM.telaAtual().nome;
    if (n === 'prova' || n === 'entrega' || n === 'conquistas') return false;
    SIM.mostrar('conquistas');
  });

  SIM.adicionarMenu({
    id: 'conquistas', ordem: 30, icone: '🏅', titulo: 'Conquistas', tecla: 'conquistas',
    texto: () => contagem() + ' de ' + catalogo.length,
    acao: () => SIM.mostrar('conquistas')
  });

  // ---------- API para outros módulos ----------

  SIM.conquistas = {
    catalogo,
    ganhar: (id) => ganhar(id, false),
    verificar: (ctx) => verificar(ctx || {}, false),
    ganhas: () => Object.assign({}, ganhas())
  };
})();
