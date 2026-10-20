// Telas, modos de estudo, sessão de prova, entrega e resultado.
(function () {
  'use strict';

  const SIM = window.SIM;
  const { el, criar, br } = SIM;

  // ---------- telas ----------
  //
  // Cada tela é uma <section class="tela">. Módulos registram as suas com
  // SIM.registrarTela; o teclado usa SIM.telaAtual() para saber o contexto.

  const telas = {};
  let atual = null;
  let ultimaProntidao = null;

  SIM.registrarTela = function (nome, opcoes) {
    telas[nome] = Object.assign({ nome }, opcoes);
  };
  SIM.telaAtual = () => telas[atual] || { nome: atual };
  SIM.mostrar = function (nome, dado) {
    if (atual === 'prova' && nome !== 'prova' && nome !== 'entrega' && sessao) pararRelogio();
    Object.keys(telas).forEach((n) => { if (telas[n].elemento) telas[n].elemento.hidden = n !== nome; });
    atual = nome;
    const t = telas[nome];
    if (t && t.aoMostrar) t.aoMostrar(dado);
    if (!(t && t.manterRolagem)) window.scrollTo(0, 0);
    SIM.emit('tela', { nome, dado });
  };
  SIM.irInicio = function () { SIM.mostrar('inicio'); };

  // ---------- modos (cartões da tela inicial) ----------

  const modos = [];
  SIM.adicionarModo = function (m) {
    modos.push(Object.assign({ ordem: 50 }, m));
    modos.sort((a, b) => a.ordem - b.ordem);
    if (atual === 'inicio') pintarInicio();
  };

  const menu = [];
  SIM.adicionarMenu = function (item) {
    menu.push(Object.assign({ ordem: 50 }, item));
    menu.sort((a, b) => a.ordem - b.ordem);
    if (atual === 'inicio') pintarInicio();
  };

  // ---------- sessão ----------

  let sessao = null;
  SIM.sessao = () => sessao;

  // opcoes: { modo, titulo, questoes, tamanho, minutos, corte, revelar }
  // revelar = true mostra a correção na hora (treino); false só no fim (simulado).
  SIM.iniciarSessao = function (o) {
    const lista = o.embaralhar === false ? o.questoes.slice() : SIM.embaralhar(o.questoes);
    const escolhidas = lista.slice(0, o.tamanho || lista.length);
    if (!escolhidas.length) { SIM.aviso('Nenhuma questão para essa rodada.'); return; }
    sessao = {
      modo: o.modo,
      titulo: o.titulo || o.modo,
      revelar: !!o.revelar,
      corte: o.corte || null,
      minutos: o.minutos || null,
      opcoes: o,
      itens: escolhidas.map((q) => ({
        q,
        alternativas: SIM.embaralhar([{ texto: q.c, certa: true }]
          .concat(q.x.map((t) => ({ texto: t, certa: false })))),
        marcada: null,
        registrado: false,
        bandeiraNaHora: false
      })),
      indice: 0,
      cursor: 0,
      fim: o.minutos ? Date.now() + o.minutos * 60 * 1000 : null,
      inicio: Date.now(),
      usouPonteiro: false,
      filtroRevisao: 'erros'
    };
    el('etiqueta-modo').textContent = ' · ' + sessao.titulo;
    el('relogio').hidden = !sessao.fim;
    el('num-total').textContent = '/' + sessao.itens.length;
    montarTrilho();
    SIM.mostrar('prova');
    pintarQuestao();
    if (sessao.fim) tocarRelogio();
    SIM.emit('sessao-inicio', sessao);
  };

  function filtroInicio() {
    const m = Number(el('sel-modulo').value);
    const d = Number(el('sel-dif').value);
    const so = el('sel-extra').value;
    return SIM.banco.filter((q) => {
      if (m && q.m !== m) return false;
      if (d >= 0 && q.d !== d) return false;
      if (so === 'ac' && !q.ac) return false;
      if (so === 'marcadas' && !SIM.marcada(q.i)) return false;
      if (so === 'novas' && SIM.situacao(q) !== 'nova') return false;
      if (so === 'placa' && !q.p) return false;
      return true;
    });
  }
  SIM.filtroInicio = filtroInicio;

  // ---------- modos embutidos ----------

  SIM.adicionarModo({
    id: 'simulado', ordem: 10, cor: 'var(--amarelo)', tecla: 'modoSimulado',
    titulo: 'Simulado completo',
    texto: () => '30 questões sorteadas, 60 minutos, sem ver a resposta até o fim — igual ao dia da prova.',
    iniciar: () => SIM.iniciarSessao({
      modo: 'simulado', titulo: 'Simulado', questoes: SIM.banco,
      tamanho: SIM.TAM_SIMULADO, minutos: SIM.MINUTOS, corte: SIM.CORTE
    })
  });

  SIM.adicionarModo({
    id: 'treino', ordem: 20, cor: 'var(--azul)', tecla: 'modoTreino',
    titulo: 'Treino com correção na hora',
    texto: () => 'Responde e já vê o certo e o porquê. Usa os filtros abaixo (' +
      br(filtroInicio().length) + ' questões no filtro).',
    iniciar: () => {
      const pool = filtroInicio();
      // Prioriza as que você ainda não viu, sem deixar de fora as já vistas.
      const novas = SIM.embaralhar(pool.filter((q) => SIM.situacao(q) === 'nova'));
      const resto = SIM.embaralhar(pool.filter((q) => SIM.situacao(q) !== 'nova'));
      SIM.iniciarSessao({
        modo: 'treino', titulo: 'Treino', questoes: novas.concat(resto),
        embaralhar: false, tamanho: 20, revelar: true
      });
    }
  });

  SIM.adicionarModo({
    id: 'revisao', ordem: 30, cor: 'var(--vermelho)', tecla: 'modoRevisao',
    titulo: 'Revisão do dia',
    texto: () => {
      const p = SIM.pendentes().length;
      const em = SIM.emRevisao().length;
      if (!em) return 'Ainda não há questões em revisão. Erros e acertos com 🚩 entram aqui.';
      if (!p) return 'Nada pendente agora. ' + br(em) + ' em revisão voltam nos próximos dias.';
      return br(p) + (p === 1 ? ' questão pendente' : ' questões pendentes') +
        ' hoje. Errou, volta logo; acertou, o intervalo aumenta.';
    },
    disponivel: () => SIM.emRevisao().length > 0,
    iniciar: () => {
      let lista = SIM.pendentes();
      // Sem pendentes: adianta as que vencem primeiro, para não travar o estudo.
      if (!lista.length) {
        lista = SIM.emRevisao().sort((a, b) => SIM.reg(a.i).pr - SIM.reg(b.i).pr);
      }
      SIM.iniciarSessao({
        modo: 'revisao', titulo: 'Revisão', questoes: lista,
        tamanho: 20, revelar: true
      });
    }
  });

  SIM.adicionarModo({
    id: 'anti-chute', ordem: 40, cor: 'var(--ink)', tecla: 'modoAntiChute',
    titulo: 'Anti-chute',
    texto: () => 'Só as ' + br(SIM.banco.filter((q) => q.ac).length) +
      ' questões em que a certa NÃO é a alternativa mais longa. Mede conhecimento, não esperteza.',
    iniciar: () => SIM.iniciarSessao({
      modo: 'treino', titulo: 'Anti-chute',
      questoes: SIM.banco.filter((q) => q.ac), tamanho: 20, revelar: true
    })
  });

  // Chefão: só abre quando a chance estimada de passar chega a 80%.
  SIM.CHEFAO = { tamanho: 30, minutos: 45, corte: 25, liberaEm: 0.8 };
  SIM.chefaoLiberado = function () {
    if (SIM.progresso.cont.chefaoLiberado) return true;
    const p = ultimaProntidao;
    if (p && p.chance != null && p.chance >= SIM.CHEFAO.liberaEm && !p.fracos.length) {
      SIM.contar('chefaoLiberado');
      return true;
    }
    return false;
  };
  SIM.adicionarModo({
    id: 'chefao', ordem: 90, cor: 'var(--vermelho)', tecla: 'modoChefao',
    titulo: 'Simulado Chefão',
    texto: () => SIM.chefaoLiberado()
      ? '30 questões difíceis e anti-chute, 45 minutos, corte de 25. Vencer = pronto pro Detran.'
      : '🔒 Abre quando a chance estimada de passar chegar a 80%, com todos os módulos bem medidos.',
    disponivel: () => SIM.chefaoLiberado(),
    iniciar: () => {
      const duras = SIM.banco.filter((q) => q.d === 2 || q.ac);
      SIM.iniciarSessao({
        modo: 'chefao', titulo: 'Chefão', questoes: duras,
        tamanho: SIM.CHEFAO.tamanho, minutos: SIM.CHEFAO.minutos, corte: SIM.CHEFAO.corte
      });
    }
  });

  // ---------- tela inicial ----------

  function pintarInicio() {
    el('capa-total').textContent = br(SIM.banco.length);
    el('capa-fonte').textContent = br(SIM.banco.length) + ' questões oficiais';

    const meta = window.BNQ || {};
    el('nota-figuras').textContent = '';
    if (meta.excluidas) {
      const p = el('nota-figuras');
      p.appendChild(criar('b', null, 'Por que não são 1.500: '));
      p.appendChild(document.createTextNode('o documento oficial tem ' + br(meta.total_documento) +
        ' questões, mas ' + br(meta.excluidas) + ' delas perguntam sobre uma placa que o PDF não ' +
        'mostra e cuja figura não foi possível recuperar — ficam fora do sorteio. Outras ' +
        br(SIM.repetidasRemovidas) + ' aparecem duas vezes no documento, palavra por palavra, e ' +
        'contam uma vez só. Sobram ' + br(SIM.banco.length) + '.'));
    }
    el('nota-creditos').hidden = !meta.com_figura;

    ultimaProntidao = SIM.prontidao();
    pintarPainel(ultimaProntidao);
    pintarModos();
    pintarMenu();
    pintarHistorico();
  }
  SIM.pintarInicio = pintarInicio;

  function pct(x) { return Math.round(x * 100) + '%'; }

  function pintarPainel(pr) {
    const alvo = el('painel');
    alvo.textContent = '';

    // Chance de passar
    const topo = criar('div', 'painel-topo');
    const chance = criar('div', 'painel-chance');
    if (pr.chance == null) {
      chance.appendChild(criar('b', 'dado', '—'));
      chance.appendChild(criar('span', null, 'Chance de passar: responda pelo menos 30 questões para estimar (' +
        br(pr.respostas) + ' até agora).'));
    } else {
      const b = criar('b', 'dado ' + (pr.chance >= 0.8 ? 'ok' : pr.chance >= 0.5 ? 'meio' : 'nao'), pct(pr.chance));
      chance.appendChild(b);
      let txt = 'chance estimada de passar hoje · média ' + pr.media.toFixed(1) + ' de 30';
      if (pr.fracos.length) txt += ' · estimativa fraca no módulo ' + pr.fracos.join(', ') + ' (poucas respostas)';
      chance.appendChild(criar('span', null, txt));
    }
    topo.appendChild(chance);

    // Meta do dia
    const mh = SIM.metaHoje();
    const seq = SIM.sequencia();
    const metaBox = criar('div', 'painel-meta');
    metaBox.appendChild(criar('b', 'dado', Math.min(mh.novas, mh.alvo) + '/' + mh.alvo));
    metaBox.appendChild(criar('span', null, 'novas hoje · ' + (mh.pendentes
      ? br(mh.pendentes) + ' de revisão pendentes'
      : 'revisão em dia') + (seq ? ' · 🔥 ' + (seq === 1 ? '1 dia de meta batida' : seq + ' dias seguidos') : '')));
    topo.appendChild(metaBox);
    alvo.appendChild(topo);

    // Mapa de domínio por módulo
    const mapa = criar('div', 'mapa');
    Object.keys(pr.est.modulos).forEach((m) => {
      const r = pr.est.modulos[m];
      const linha = criar('div', 'mapa-linha');
      const cab = criar('div', 'mapa-cab');
      cab.appendChild(criar('span', 'mapa-nome', m + ' · ' + SIM.modulos[m]));
      const acerto = r.n ? pct(r.a / r.n) + ' de acerto' : 'não começado';
      cab.appendChild(criar('span', 'mapa-num dado', br(r.dominadas) + '/' + br(r.total) + ' · ' + acerto));
      linha.appendChild(cab);
      const barra = criar('div', 'mapa-barra');
      const vistas = criar('i', 'vistas'); vistas.style.width = (r.vistas / r.total * 100) + '%';
      const dom = criar('i', 'dominadas'); dom.style.width = (r.dominadas / r.total * 100) + '%';
      barra.appendChild(vistas); barra.appendChild(dom);
      linha.appendChild(barra);
      mapa.appendChild(linha);
    });
    alvo.appendChild(mapa);

    // Anti-chute x comum
    const e = pr.est;
    if (e.ac.n >= 5) {
      const pAc = e.ac.a / e.ac.n, pCo = e.comum.n ? e.comum.a / e.comum.n : 0;
      const p = criar('p', 'painel-ac');
      p.textContent = 'Anti-chute: ' + pct(pAc) + ' de acerto (' + br(e.ac.n) + ' respostas) contra ' +
        pct(pCo) + ' nas demais.' + (pCo - pAc > 0.15
          ? ' A diferença é grande: parte dos seus acertos pode ser pela alternativa mais longa.'
          : '');
      alvo.appendChild(p);
    }
    alvo.appendChild(criar('p', 'painel-legenda',
      'Barra escura = dominadas (acertou sem dúvida, ou subiu todas as caixas da revisão). Clara = já vistas.'));
  }

  function pintarModos() {
    const alvo = el('modos');
    alvo.textContent = '';
    modos.forEach((m) => {
      const b = criar('button', 'modo');
      b.type = 'button';
      b.style.setProperty('--faixa', m.cor || 'var(--line-forte)');
      b.dataset.nav = '';
      b.dataset.modo = m.id;
      const div = criar('div');
      div.appendChild(criar('h3', null, m.titulo));
      div.appendChild(criar('p', null, typeof m.texto === 'function' ? m.texto() : m.texto));
      b.appendChild(div);
      const tecla = m.tecla && SIM.teclaDe ? SIM.teclaDe(m.tecla) : '';
      const seta = criar('span', 'seta' + (tecla ? ' com-tecla' : ''));
      if (tecla) seta.appendChild(criar('span', 'seta-tecla', tecla));
      seta.appendChild(criar('span', 'seta-flecha', '→'));
      b.appendChild(seta);
      const ok = m.disponivel ? m.disponivel() : true;
      b.disabled = !ok;
      b.addEventListener('click', () => m.iniciar());
      alvo.appendChild(b);
    });
  }
  SIM.iniciarModo = function (id) {
    const m = modos.filter((x) => x.id === id)[0];
    if (m && (!m.disponivel || m.disponivel())) m.iniciar();
  };

  function pintarMenu() {
    const alvo = el('menu-mais');
    alvo.textContent = '';
    menu.forEach((item) => {
      const b = criar('button', 'menu-item');
      b.type = 'button';
      b.dataset.nav = '';
      b.appendChild(criar('span', 'menu-icone', item.icone || '•'));
      const txt = criar('span', 'menu-txt');
      txt.appendChild(criar('b', null, item.titulo));
      if (item.texto) txt.appendChild(criar('small', null, typeof item.texto === 'function' ? item.texto() : item.texto));
      b.appendChild(txt);
      const tecla = item.tecla && SIM.teclaDe ? SIM.teclaDe(item.tecla) : '';
      if (tecla) b.appendChild(criar('kbd', null, tecla));
      b.addEventListener('click', () => item.acao());
      alvo.appendChild(b);
    });
  }

  function pintarHistorico() {
    const alvo = el('historico');
    alvo.textContent = '';
    const h = SIM.progresso.historico.slice(-6).reverse();
    if (!h.length) return;
    alvo.appendChild(criar('h2', 'secao', 'Seus últimos resultados'));
    const caixa = criar('div', 'quebra');
    h.forEach((r) => {
      const acertos = Number(r.acertos) || 0;
      const total = Number(r.total) || 0;
      const quando = new Date(r.ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      let rotulo = 'treino';
      if (r.modo === 'simulado') rotulo = acertos >= SIM.CORTE ? 'passaria' : 'não passaria';
      else if (r.modo === 'chefao') rotulo = acertos >= SIM.CHEFAO.corte ? 'chefão vencido' : 'chefão';
      else if (r.modo === 'revisao') rotulo = 'revisão';
      const div = criar('div');
      div.appendChild(criar('b', null, acertos + '/' + total));
      div.appendChild(criar('span', null, quando + ' · ' + rotulo));
      caixa.appendChild(div);
    });
    alvo.appendChild(caixa);
  }

  SIM.registrarTela('inicio', { elemento: el('tela-inicio'), aoMostrar: pintarInicio });

  // ---------- prova ----------

  function montarTrilho() {
    const t = el('trilho');
    t.textContent = '';
    sessao.itens.forEach((_, i) => {
      const b = criar('i');
      b.title = 'Questão ' + (i + 1);
      t.appendChild(b);
    });
  }

  function pintarTrilho() {
    const marcas = el('trilho').children;
    sessao.itens.forEach((item, i) => {
      let c = '';
      if (i === sessao.indice) c = 'atual';
      else if (item.marcada != null) {
        if (!sessao.revelar) c = 'respondida';
        else c = item.alternativas[item.marcada].certa ? 'certa' : 'errada';
      }
      if (SIM.marcada(item.q.i)) c += ' bandeira';
      marcas[i].className = c;
    });
  }

  function revelado(item) { return sessao.revelar && item.marcada != null; }

  function pintarQuestao() {
    const item = sessao.itens[sessao.indice];
    const q = item.q;
    const mostrar = revelado(item);

    el('num-atual').textContent = sessao.indice + 1;

    const et = el('etiquetas');
    et.textContent = '';
    et.appendChild(criar('span', 'chip dif-' + q.d, SIM.DIFICULDADES[q.d]));
    et.appendChild(criar('span', 'chip', 'Módulo ' + q.m + ' · ' + SIM.modulos[q.m]));
    if (q.p) et.appendChild(criar('span', 'chip placa', 'Placa ' + q.p));
    et.appendChild(criar('span', 'chip num', 'Nº ' + q.n));

    const figura = el('placa-figura');
    if (q.g && q.p) {
      const img = el('placa-img');
      img.onerror = () => { figura.hidden = true; };
      img.src = (window.PLACAS && window.PLACAS[q.p]) || ('placas/' + q.p + '.svg');
      figura.hidden = false;
    } else {
      figura.hidden = true;
    }

    SIM.escreverTexto(el('enunciado'), q.e);

    const caixa = el('alternativas');
    caixa.textContent = '';
    item.alternativas.forEach((alt, i) => {
      const b = criar('button', 'alt');
      b.type = 'button';
      b.dataset.nav = '';
      b.dataset.indice = i;
      b.appendChild(criar('span', 'letra', SIM.LETRAS[i]));
      const t = criar('span', 'alt-texto');
      SIM.escreverTexto(t, alt.texto);
      b.appendChild(t);
      if (mostrar) {
        b.setAttribute('aria-disabled', 'true');
        b.classList.add('travada');
        if (alt.certa) b.classList.add('certa');
        else if (item.marcada === i) b.classList.add('errada');
      } else if (item.marcada === i) {
        b.classList.add('marcada');
      }
      if (i === sessao.cursor) b.classList.add('cursor');
      b.addEventListener('click', (ev) => {
        // Clique num termo do glossário não responde a questão.
        if (ev.target.closest && ev.target.closest('.termo')) return;
        sessao.usouPonteiro = true;
        responder(i);
      });
      b.addEventListener('mousemove', () => moverCursor(i, false));
      caixa.appendChild(b);
    });

    if (mostrar && q.k) {
      SIM.escreverTexto(el('comentario-texto'), q.k);
      el('comentario').hidden = false;
    } else {
      el('comentario').hidden = true;
    }

    const bm = el('btn-marcar');
    const f = SIM.marcada(q.i);
    bm.classList.toggle('ativa', f);
    bm.setAttribute('aria-pressed', f ? 'true' : 'false');
    bm.lastChild.textContent = f ? 'Marcada' : 'Marcar dúvida';

    el('btn-voltar').disabled = sessao.indice === 0;
    const ultima = sessao.indice === sessao.itens.length - 1;
    el('btn-avancar').textContent = ultima ? (sessao.revelar ? 'Terminar' : 'Entregar…') : 'Próxima';

    pintarTrilho();
    SIM.emit('questao', { sessao, item });
  }
  SIM.repintarQuestao = () => { if (sessao && atual === 'prova') pintarQuestao(); };

  function moverCursor(i, rolar) {
    if (!sessao) return;
    const n = sessao.itens[sessao.indice].alternativas.length;
    sessao.cursor = (i + n) % n;
    const alts = el('alternativas').children;
    for (let k = 0; k < alts.length; k++) alts[k].classList.toggle('cursor', k === sessao.cursor);
    if (rolar && alts[sessao.cursor]) alts[sessao.cursor].scrollIntoView({ block: 'nearest' });
  }

  function responder(i) {
    const item = sessao.itens[sessao.indice];
    if (revelado(item)) return;
    item.marcada = i;
    sessao.cursor = i;
    if (sessao.revelar) {
      const certa = item.alternativas[i].certa;
      item.bandeiraNaHora = SIM.marcada(item.q.i);
      SIM.registrar(item.q.i, certa, item.bandeiraNaHora, { modo: sessao.modo, revisao: sessao.modo === 'revisao' });
      item.registrado = true;
    }
    pintarQuestao();
  }

  // Confirmar (Enter/Espaço): marca a alternativa do cursor; se ela já é a
  // marcada (ou a correção já apareceu), passa para a próxima.
  function confirmar() {
    const item = sessao.itens[sessao.indice];
    if (revelado(item) || item.marcada === sessao.cursor) { avancar(); return; }
    responder(sessao.cursor);
  }

  function alternarMarca() {
    const item = sessao.itens[sessao.indice];
    const agora = SIM.alternarMarca(item.q.i);
    // No treino, marcar 🚩 depois de ver que acertou = assumir que foi chute.
    if (agora && item.registrado && !item.bandeiraNaHora && item.alternativas[item.marcada].certa) {
      SIM.virouDuvida(item.q.i);
      item.bandeiraNaHora = true;
    }
    pintarQuestao();
  }

  function irPara(i) {
    if (i < 0 || i >= sessao.itens.length) return;
    sessao.indice = i;
    const item = sessao.itens[i];
    sessao.cursor = item.marcada != null ? item.marcada : 0;
    pintarQuestao();
    window.scrollTo(0, 0);
  }

  function avancar() {
    if (sessao.indice === sessao.itens.length - 1) {
      if (sessao.revelar) terminar(); else SIM.mostrar('entrega');
      return;
    }
    irPara(sessao.indice + 1);
  }
  function voltar() { if (sessao.indice > 0) irPara(sessao.indice - 1); }

  function sair() {
    const respondidas = sessao.itens.filter((x) => x.marcada != null).length;
    if (!sessao.revelar && respondidas > 0 &&
      !window.confirm('Sair do ' + sessao.titulo.toLowerCase() + ' sem entregar? As respostas desta rodada não contam.')) return;
    pararRelogio();
    SIM.irInicio();
  }

  SIM.registrarTela('prova', {
    elemento: el('tela-prova'),
    atalhos: {
      cima: () => moverCursor(sessao.cursor - 1, true),
      baixo: () => moverCursor(sessao.cursor + 1, true),
      confirmar,
      proxima: avancar,
      anterior: voltar,
      altA: () => SIM.escolherLetra(0),
      altB: () => SIM.escolherLetra(1),
      altC: () => SIM.escolherLetra(2),
      altD: () => SIM.escolherLetra(3),
      marcar: alternarMarca,
      sair
    }
  });

  // Letra: marca direto, ou só move o cursor se "confirmar antes" estiver ligado.
  SIM.escolherLetra = function (i) {
    const item = sessao.itens[sessao.indice];
    if (i >= item.alternativas.length) return;
    if (SIM.config('confirmarAntes', false) && !revelado(item)) { moverCursor(i, true); return; }
    moverCursor(i, true);
    if (revelado(item)) return;
    responder(i);
  };

  el('btn-avancar').addEventListener('click', () => { sessao.usouPonteiro = true; avancar(); });
  el('btn-voltar').addEventListener('click', () => { sessao.usouPonteiro = true; voltar(); });
  el('btn-sair').addEventListener('click', () => { sessao.usouPonteiro = true; sair(); });
  el('btn-marcar').addEventListener('click', () => { sessao.usouPonteiro = true; alternarMarca(); });
  el('trilho').addEventListener('click', (ev) => {
    const i = Array.prototype.indexOf.call(el('trilho').children, ev.target);
    if (i >= 0) { sessao.usouPonteiro = true; irPara(i); }
  });

  // ---------- relógio ----------

  let timer = null;
  function tocarRelogio() {
    clearInterval(timer);
    const r = el('relogio');
    const passo = () => {
      const resta = Math.max(0, sessao.fim - Date.now());
      const min = Math.floor(resta / 60000), seg = Math.floor((resta % 60000) / 1000);
      r.textContent = String(min).padStart(2, '0') + ':' + String(seg).padStart(2, '0');
      r.classList.toggle('apertado', resta <= 5 * 60 * 1000);
      if (resta === 0) { clearInterval(timer); terminar(); }
    };
    passo();
    timer = setInterval(passo, 250);
  }
  function pararRelogio() { clearInterval(timer); }

  // ---------- entrega (simulado e chefão) ----------

  function pintarEntrega() {
    const grade = el('entrega-grade');
    grade.textContent = '';
    let sem = 0, band = 0;
    sessao.itens.forEach((item, i) => {
      const b = criar('button', 'celula');
      b.type = 'button';
      b.dataset.nav = '';
      const f = SIM.marcada(item.q.i);
      if (item.marcada == null) { b.classList.add('vazia'); sem++; }
      if (f) { b.classList.add('bandeira'); band++; }
      b.appendChild(criar('span', 'dado', String(i + 1)));
      b.appendChild(criar('small', null, item.marcada == null ? '—' : SIM.LETRAS[item.marcada]));
      b.title = 'Questão ' + (i + 1) + (item.marcada == null ? ', sem resposta' : '') + (f ? ', marcada' : '');
      b.addEventListener('click', () => {
        if (f) SIM.emit('entrega-revisou', { indice: i });
        SIM.mostrar('prova');
        irPara(i);
      });
      grade.appendChild(b);
    });
    const partes = [];
    partes.push(sem ? br(sem) + (sem === 1 ? ' sem resposta' : ' sem resposta') : 'todas respondidas');
    partes.push(band ? br(band) + ' com 🚩' : 'nenhuma 🚩');
    el('entrega-resumo').textContent = partes.join(' · ') + '. Toque numa questão para voltar a ela.';
  }

  SIM.registrarTela('entrega', {
    elemento: el('tela-entrega'),
    aoMostrar: pintarEntrega,
    atalhos: {
      confirmar: null, // usa o cursor genérico (clica no item com foco)
      sair: () => { SIM.mostrar('prova'); pintarQuestao(); }
    }
  });
  el('btn-entregar').addEventListener('click', () => terminar());
  el('btn-entrega-voltar').addEventListener('click', () => { SIM.mostrar('prova'); pintarQuestao(); });

  // ---------- resultado ----------

  function terminar() {
    pararRelogio();
    let acertos = 0;
    sessao.itens.forEach((item) => {
      const certa = item.marcada != null && item.alternativas[item.marcada].certa;
      if (certa) acertos++;
      if (!item.registrado) {
        // Simulado: registra tudo no fim, com a 🚩 do momento da entrega.
        SIM.registrar(item.q.i, certa, SIM.marcada(item.q.i), { modo: sessao.modo });
        item.registrado = true;
      }
    });
    sessao.acertos = acertos;
    sessao.duracao = Date.now() - sessao.inicio;
    SIM.progresso.historico.push({
      ts: Date.now(), acertos, total: sessao.itens.length, modo: sessao.modo
    });
    if (SIM.progresso.historico.length > 200) SIM.progresso.historico = SIM.progresso.historico.slice(-200);
    SIM.salvar();
    SIM.mostrar('resultado');
    SIM.emit('sessao-fim', sessao);
  }

  function pintarResultado() {
    const total = sessao.itens.length;
    const acertos = sessao.acertos;
    const comCorte = !!sessao.corte;
    const passou = comCorte && acertos >= sessao.corte;

    el('res-modo').textContent = sessao.titulo;
    const v = el('res-veredito');
    if (comCorte) {
      v.textContent = passou ? (sessao.modo === 'chefao' ? 'Chefão vencido' : 'Passou') : 'Não passou';
      v.className = 'veredito ' + (passou ? 'ok' : 'nao');
      el('res-sub').textContent = passou
        ? acertos + ' de ' + total + ' — o corte é ' + sessao.corte + '.' +
          (sessao.modo === 'simulado' ? ' Na prova de verdade isso é aprovação.' : '')
        : acertos + ' de ' + total + ' — faltaram ' + (sessao.corte - acertos) +
          (sessao.corte - acertos === 1 ? ' acerto' : ' acertos') + ' para o corte de ' + sessao.corte + '.';
    } else {
      v.textContent = acertos + ' de ' + total;
      v.className = 'veredito';
      el('res-sub').textContent = 'Rodada sem corte — o corte de 20 vale para a prova de 30 questões.';
    }

    const regua = el('res-regua');
    regua.hidden = !comCorte;
    if (comCorte) {
      el('res-preenche').style.width = (acertos / total * 100) + '%';
      el('res-preenche').className = 'regua-preenche' + (passou ? '' : ' nao');
      el('res-corte').style.left = (sessao.corte / total * 100) + '%';
      const rc = el('res-rotulo-corte');
      rc.style.left = (sessao.corte / total * 100) + '%';
      rc.textContent = sessao.corte + ' = corte';
      el('res-max').textContent = String(total);
    }

    const porModulo = {};
    sessao.itens.forEach((item) => {
      const m = item.q.m;
      porModulo[m] = porModulo[m] || { certas: 0, total: 0 };
      porModulo[m].total++;
      if (item.marcada != null && item.alternativas[item.marcada].certa) porModulo[m].certas++;
    });
    const q = el('res-quebra');
    q.textContent = '';
    Object.keys(porModulo).sort().forEach((m) => {
      const div = criar('div');
      div.appendChild(criar('b', null, porModulo[m].certas + '/' + porModulo[m].total));
      div.appendChild(criar('span', null, 'Módulo ' + m + ' · ' + SIM.modulos[m]));
      q.appendChild(div);
    });
    const bandeiras = sessao.itens.filter((it) => SIM.marcada(it.q.i)).length;
    if (bandeiras) {
      const div = criar('div');
      div.appendChild(criar('b', null, '🚩 ' + bandeiras));
      div.appendChild(criar('span', null, 'marcadas com dúvida — voltam na revisão'));
      q.appendChild(div);
    }

    pintarRevisao();
  }

  function pintarRevisao() {
    const filtro = sessao.filtroRevisao;
    const alvo = el('res-revisao');
    alvo.textContent = '';
    let mostrados = 0;

    sessao.itens.forEach((item, i) => {
      const certa = item.marcada != null && item.alternativas[item.marcada].certa;
      const f = SIM.marcada(item.q.i);
      if (filtro === 'erros' && certa && !f) return;
      if (filtro === 'bandeiras' && !f) return;
      mostrados++;

      const textoCerta = item.alternativas.filter((a) => a.certa)[0].texto;
      const sua = item.marcada == null ? 'Você não respondeu.' : item.alternativas[item.marcada].texto;

      const art = criar('article', 'item' + (certa ? '' : ' errou') + (f ? ' com-bandeira' : ''));
      art.dataset.nav = '';
      art.tabIndex = 0;
      const cab = criar('div', 'cab');
      cab.appendChild(criar('span', 'num', String(i + 1)));
      const qt = criar('span', 'q');
      SIM.escreverTexto(qt, item.q.e);
      cab.appendChild(qt);
      if (f) cab.appendChild(criar('span', 'band', '🚩'));
      art.appendChild(cab);

      const dl = criar('dl');
      if (!certa) {
        dl.appendChild(criar('dt', null, 'Você marcou'));
        dl.appendChild(criar('dd', 'errada', sua));
      }
      dl.appendChild(criar('dt', null, 'Resposta correta'));
      const dd = criar('dd', 'certa');
      SIM.escreverTexto(dd, textoCerta);
      dl.appendChild(dd);
      art.appendChild(dl);
      if (item.q.k) {
        const p = criar('p', 'porque');
        SIM.escreverTexto(p, item.q.k);
        art.appendChild(p);
      }
      alvo.appendChild(art);
    });

    if (!mostrados) {
      alvo.appendChild(criar('div', 'vazio-aviso', filtro === 'bandeiras'
        ? 'Nenhuma questão marcada com 🚩 nesta rodada.'
        : 'Nenhum erro nem 🚩 nesta rodada. Escolha “Tudo” para reler as questões.'));
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-filtro-rev]'), (b) => {
      b.classList.toggle('ativo', b.dataset.filtroRev === filtro);
    });
  }

  SIM.registrarTela('resultado', {
    elemento: el('tela-resultado'),
    aoMostrar: pintarResultado,
    atalhos: {
      novamente: () => SIM.refazer(),
      sair: () => SIM.irInicio()
    }
  });

  SIM.refazer = function () {
    if (!sessao) return;
    const m = modos.filter((x) => x.id === sessao.modo || (sessao.modo === 'treino' && x.id === 'treino'))[0];
    if (sessao.opcoes.refazer) sessao.opcoes.refazer();
    else if (m) m.iniciar();
    else SIM.iniciarSessao(sessao.opcoes);
  };

  el('btn-denovo').addEventListener('click', () => SIM.refazer());
  el('btn-inicio').addEventListener('click', () => SIM.irInicio());
  Array.prototype.forEach.call(document.querySelectorAll('[data-filtro-rev]'), (b) => {
    b.addEventListener('click', () => { sessao.filtroRevisao = b.dataset.filtroRev; pintarRevisao(); });
  });

  // ---------- filtros da tela inicial ----------

  ['sel-modulo', 'sel-dif', 'sel-extra'].forEach((id) => {
    el(id).addEventListener('change', () => pintarModos());
  });

  // ---------- aviso rápido (toast) ----------

  SIM.aviso = function (texto, opcoes) {
    const area = el('avisos');
    const a = criar('div', 'aviso' + (opcoes && opcoes.classe ? ' ' + opcoes.classe : ''));
    if (opcoes && opcoes.icone) a.appendChild(criar('span', 'aviso-icone', opcoes.icone));
    const corpo = criar('div', 'aviso-corpo');
    if (opcoes && opcoes.titulo) corpo.appendChild(criar('b', null, opcoes.titulo));
    corpo.appendChild(criar('span', null, texto));
    a.appendChild(corpo);
    area.appendChild(a);
    setTimeout(() => a.classList.add('saindo'), (opcoes && opcoes.ms) || 3500);
    setTimeout(() => a.remove(), ((opcoes && opcoes.ms) || 3500) + 400);
  };

  SIM.on('importado', () => SIM.irInicio());

  // Início depois que todos os scripts carregaram (módulos registram modos/menus).
  window.addEventListener('DOMContentLoaded', () => SIM.mostrar('inicio'));
})();
