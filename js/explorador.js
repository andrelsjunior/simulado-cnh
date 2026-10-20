// Explorador: busca, filtra e relê qualquer uma das questões do banco, sem
// entregar a resposta antes da hora, e manda o resultado filtrado para um treino.
(function () {
  'use strict';

  const SIM = window.SIM;
  const { criar, br } = SIM;

  const PAGINA = 40;

  const SITUACOES = {
    nova: 'Nova',
    errada: 'Errada',
    duvida: 'Acertou com dúvida',
    revisao: 'Em revisão',
    dominada: 'Dominada'
  };
  const ROTULO_CHIP = { nova: 'Nova', errada: 'Errada', duvida: 'Com dúvida', revisao: 'Em revisão', dominada: 'Dominada' };

  // Estado lembrado enquanto o app está aberto.
  const PADRAO = { busca: '', modulo: '', dif: '', situacao: '', ac: '', placa: '', ordem: 'numero' };
  const estado = Object.assign({}, PADRAO);
  let mostrando = PAGINA;
  let resultado = [];
  const abertas = {};    // id -> true
  const reveladas = {};  // id -> true
  let focarBusca = false;

  // ---------- ações de teclado ----------

  SIM.registrarAcao({ id: 'explorar', grupo: 'menus', rotulo: 'Explorador de questões', padrao: ['e'] });
  SIM.registrarAcao({ id: 'buscar', grupo: 'geral', rotulo: 'Buscar questão (abre o explorador)', padrao: ['/'] });

  function podeSair() {
    const n = SIM.telaAtual().nome;
    return n !== 'prova' && n !== 'entrega';
  }

  function abrir(comBusca) {
    focarBusca = !!comBusca;
    SIM.mostrar('explorador');
  }

  SIM.registrarGlobal('explorar', () => { if (!podeSair()) return false; abrir(false); });
  SIM.registrarGlobal('buscar', () => { if (!podeSair()) return false; abrir(true); });

  // ---------- busca ----------

  // Texto pesquisável de cada questão, normalizado uma vez só (na primeira busca).
  let palheiro = null;
  function textoDe(q) {
    if (!palheiro) {
      palheiro = {};
      SIM.banco.forEach((x) => {
        palheiro[x.i] = SIM.normalizar([x.e, x.c].concat(x.x, x.k || '', x.p || '').join(' \n '));
      });
    }
    return palheiro[q.i];
  }

  function filtrar() {
    const termos = SIM.normalizar(estado.busca).split(/\s+/).filter(Boolean);
    const m = Number(estado.modulo);
    const d = estado.dif === '' ? -1 : Number(estado.dif);
    const lista = SIM.banco.filter((q) => {
      if (m && q.m !== m) return false;
      if (d >= 0 && q.d !== d) return false;
      if (estado.ac === 'sim' && !q.ac) return false;
      if (estado.ac === 'nao' && q.ac) return false;
      if (estado.placa === 'sim' && !q.p) return false;
      if (estado.placa === 'nao' && q.p) return false;
      if (estado.situacao === 'marcada') { if (!SIM.marcada(q.i)) return false; }
      else if (estado.situacao && SIM.situacao(q) !== estado.situacao) return false;
      if (termos.length) {
        const t = textoDe(q);
        for (let k = 0; k < termos.length; k++) {
          // Um número sozinho também acha a questão por "Nº".
          if (t.indexOf(termos[k]) < 0 && String(q.n) !== termos[k]) return false;
        }
      }
      return true;
    });
    return ordenar(lista);
  }

  function ordenar(lista) {
    const r = (q) => SIM.reg(q.i) || { n: 0, e: 0, u: 0 };
    const porNumero = (a, b) => a.n - b.n;
    if (estado.ordem === 'erros') {
      return lista.sort((a, b) => (r(b).e - r(a).e) ||
        ((r(b).e / (r(b).n || 1)) - (r(a).e / (r(a).n || 1))) || porNumero(a, b));
    }
    if (estado.ordem === 'recentes') {
      return lista.sort((a, b) => (r(b).u || 0) - (r(a).u || 0) || porNumero(a, b));
    }
    if (estado.ordem === 'dificeis') {
      return lista.sort((a, b) => (b.d - a.d) || (r(b).e - r(a).e) || porNumero(a, b));
    }
    return lista.sort(porNumero);
  }

  function filtrosAtivos() {
    return Object.keys(PADRAO).some((k) => k !== 'ordem' && estado[k] !== PADRAO[k]);
  }

  // ---------- tela ----------

  const sec = criar('section', 'tela explorador');
  sec.id = 'tela-explorador';
  sec.hidden = true;
  SIM.el('app').appendChild(sec);

  const cab = criar('header', 'pagina-cab');
  cab.appendChild(criar('h1', 'pagina-titulo', 'Explorador'));
  const dicaCab = criar('p', 'muted');
  cab.appendChild(dicaCab);
  sec.appendChild(cab);

  // Busca
  const rotBusca = criar('label', 'exp-busca');
  const iBusca = criar('input', 'campo');
  iBusca.type = 'search';
  iBusca.name = 'exp-busca';
  iBusca.placeholder = 'Buscar no enunciado, alternativas e comentário';
  iBusca.setAttribute('aria-label', 'Buscar questões');
  iBusca.autocomplete = 'off';
  iBusca.spellcheck = false;
  iBusca.dataset.nav = '';
  iBusca.dataset.navSair = '';
  rotBusca.appendChild(iBusca);
  sec.appendChild(rotBusca);

  let atrasoBusca = null;
  iBusca.addEventListener('input', () => {
    clearTimeout(atrasoBusca);
    atrasoBusca = setTimeout(() => { estado.busca = iBusca.value; aplicar(); }, 140);
  });

  // ↓/Enter no campo vão direto para a primeira coisa abaixo dele (o primeiro filtro
  // ou, com Enter, o primeiro resultado). Tratado aqui porque o cursor genérico,
  // depois de tirar o foco do campo, volta a cair no próprio campo.
  iBusca.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key !== 'ArrowDown' && ev.key !== 'Enter') return;
    ev.preventDefault();
    ev.stopPropagation();
    clearTimeout(atrasoBusca);
    if (estado.busca !== iBusca.value) { estado.busca = iBusca.value; aplicar(); }
    const alvo = ev.key === 'Enter' ? (lista.querySelector('.exp-linha-cab') || btnTreinar) : selects[0];
    destacar(alvo);
  });

  // Filtros
  const filtros = criar('div', 'exp-filtros');
  sec.appendChild(filtros);
  const selects = [];

  function select(chave, rotulo, opcoes) {
    const lab = criar('label', 'exp-filtro');
    lab.appendChild(criar('span', 'rotulo', rotulo));
    const s = criar('select');
    s.dataset.nav = '';
    s.dataset.chave = chave;
    s.name = 'exp-' + chave;
    opcoes.forEach((o) => {
      const op = criar('option', null, o[1]);
      op.value = o[0];
      s.appendChild(op);
    });
    s.addEventListener('change', () => { estado[chave] = s.value; aplicar(); });
    lab.appendChild(s);
    filtros.appendChild(lab);
    selects.push(s);
    return s;
  }

  select('modulo', 'Módulo', [['', 'Todos']].concat(Object.keys(SIM.modulos).map((m) => [m, m + ' · ' + SIM.modulos[m]])));
  select('dif', 'Dificuldade', [['', 'Todas']].concat(SIM.DIFICULDADES.map((d, i) => [String(i), d])));
  select('situacao', 'Situação', [['', 'Todas']].concat(Object.keys(SITUACOES).map((k) => [k, SITUACOES[k]]))
    .concat([['marcada', '🚩 Marcadas']]));
  select('ac', 'Anti-chute', [['', 'Tanto faz'], ['sim', 'Só anti-chute'], ['nao', 'Sem anti-chute']]);
  select('placa', 'Placa', [['', 'Tanto faz'], ['sim', 'Com placa'], ['nao', 'Sem placa']]);
  select('ordem', 'Ordem', [['numero', 'Número da questão'], ['erros', 'Mais erradas'],
    ['recentes', 'Vistas por último'], ['dificeis', 'Mais difíceis primeiro']]);

  // Barra fixa: contador + treinar
  const barra = criar('div', 'exp-barra');
  const contador = criar('p', 'exp-contador dado');
  contador.setAttribute('aria-live', 'polite');
  const limparTopo = criar('button', 'btn vazio exp-limpar', 'Limpar');
  limparTopo.appendChild(criar('span', 'exp-so-largo', ' filtros'));
  limparTopo.type = 'button';
  limparTopo.dataset.nav = '';
  limparTopo.addEventListener('click', limpar);
  const btnTreinar = criar('button', 'btn exp-treinar');
  btnTreinar.type = 'button';
  btnTreinar.dataset.nav = '';
  btnTreinar.addEventListener('click', treinar);
  barra.appendChild(contador);
  barra.appendChild(limparTopo);
  barra.appendChild(btnTreinar);
  sec.appendChild(barra);

  const lista = criar('div', 'exp-lista');
  sec.appendChild(lista);

  const btnMais = criar('button', 'btn vazio exp-mais');
  btnMais.type = 'button';
  btnMais.dataset.nav = '';
  btnMais.addEventListener('click', mostrarMais);
  sec.appendChild(btnMais);

  // ---------- pintura ----------

  function pintarControles() {
    if (document.activeElement !== iBusca) iBusca.value = estado.busca;
    selects.forEach((s) => { s.value = estado[s.dataset.chave]; });
    dicaCab.textContent = 'As ' + br(SIM.banco.length) + ' questões do banco. Abra uma para reler; a resposta ' +
      'só aparece quando você pedir.' + (SIM.teclaDe('buscar') ? ' ' + SIM.teclaDe('buscar') + ' busca de qualquer tela.' : '');
  }

  function pintarBarra() {
    const n = resultado.length;
    contador.textContent = n === SIM.banco.length
      ? br(n) + ' questões'
      : br(n) + ' de ' + br(SIM.banco.length);
    btnTreinar.textContent = 'Treinar estas ' + br(n);
    btnTreinar.disabled = n === 0;
    btnTreinar.title = n > 20 ? 'Sorteia 20 destas para um treino com correção na hora' : 'Treino com correção na hora';
    limparTopo.hidden = !filtrosAtivos();
  }

  function aplicar() {
    resultado = filtrar();
    mostrando = PAGINA;
    pintarLista();
  }

  function pintarLista() {
    pintarBarra();
    lista.textContent = '';
    if (!resultado.length) {
      const v = criar('div', 'vazio-aviso exp-vazio');
      v.appendChild(criar('span', null, 'Nada com esses filtros. '));
      const b = criar('button', 'btn vazio', 'Limpar filtros');
      b.type = 'button';
      b.dataset.nav = '';
      b.addEventListener('click', limpar);
      v.appendChild(b);
      lista.appendChild(v);
    } else {
      resultado.slice(0, mostrando).forEach((q) => lista.appendChild(linha(q)));
    }
    pintarMais();
  }

  function pintarMais() {
    const resta = resultado.length - mostrando;
    btnMais.hidden = resta <= 0;
    if (resta > 0) btnMais.textContent = 'Mostrar mais ' + br(Math.min(PAGINA, resta)) + ' (faltam ' + br(resta) + ')';
  }

  function mostrarMais() {
    const antes = mostrando;
    mostrando += PAGINA;
    const novas = resultado.slice(antes, mostrando).map(linha);
    novas.forEach((n) => lista.appendChild(n));
    pintarMais();
    if (novas[0]) destacar(novas[0].querySelector('.exp-linha-cab'));
  }

  function limpar() {
    Object.keys(PADRAO).forEach((k) => { if (k !== 'ordem') estado[k] = PADRAO[k]; });
    iBusca.value = '';
    pintarControles();
    aplicar();
    destacar(iBusca);
  }

  // Ordem fixa por questão (o banco guarda a certa separada; mostrá-la sempre em A
  // entregaria a resposta).
  function ordemAlternativas(q) {
    let h = 2166136261;
    for (let i = 0; i < q.i.length; i++) { h ^= q.i.charCodeAt(i); h = Math.imul(h, 16777619); }
    const alts = [{ texto: q.c, certa: true }].concat(q.x.map((t) => ({ texto: t, certa: false })));
    for (let i = alts.length - 1; i > 0; i--) {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      const j = (h >>> 0) % (i + 1);
      const t = alts[i]; alts[i] = alts[j]; alts[j] = t;
    }
    return alts;
  }

  function historico(q) {
    const r = SIM.reg(q.i);
    if (!r || !r.n) return 'nunca vista';
    const partes = [r.n + '× vista'];
    partes.push(r.e ? r.e + (r.e === 1 ? ' erro' : ' erros') : 'nenhum erro');
    if (r.ad) partes.push(r.ad + ' com dúvida');
    if (r.u) partes.push('última ' + new Date(r.u).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    return partes.join(' · ');
  }

  function linha(q) {
    const art = criar('article', 'exp-linha');
    art.dataset.id = q.i;

    const cab = criar('button', 'exp-linha-cab');
    cab.type = 'button';
    cab.dataset.nav = '';
    cab.id = 'exp-cab-' + q.i;
    cab.addEventListener('click', (ev) => {
      if (ev.target.closest && ev.target.closest('.termo')) return; // termo do glossário
      apertar(q);
    });
    art.appendChild(cab);

    const corpo = criar('div', 'exp-corpo');
    corpo.id = 'exp-corpo-' + q.i;
    cab.setAttribute('aria-controls', corpo.id);
    art.appendChild(corpo);

    pintarLinha(art, q);
    return art;
  }

  function pintarLinha(art, q) {
    const cab = art.querySelector('.exp-linha-cab');
    const corpo = art.querySelector('.exp-corpo');
    const aberta = !!abertas[q.i];
    const revelada = !!reveladas[q.i];
    const sit = SIM.situacao(q);
    const f = SIM.marcada(q.i);

    art.className = 'exp-linha sit-' + sit + (aberta ? ' aberta' : '') + (f ? ' com-bandeira' : '');
    cab.setAttribute('aria-expanded', aberta ? 'true' : 'false');

    cab.textContent = '';
    const topo = criar('span', 'exp-topo');
    topo.appendChild(criar('span', 'exp-num dado', 'Nº ' + q.n));
    topo.appendChild(criar('span', 'chip', 'Mód. ' + q.m));
    topo.appendChild(criar('span', 'chip dif-' + q.d, SIM.DIFICULDADES[q.d]));
    topo.appendChild(criar('span', 'chip exp-sit sit-' + sit, ROTULO_CHIP[sit]));
    if (q.p) topo.appendChild(criar('span', 'chip placa', q.p));
    if (q.ac) topo.appendChild(criar('span', 'chip exp-ac', 'Anti-chute'));
    if (f) topo.appendChild(criar('span', 'exp-band', '🚩'));
    cab.appendChild(topo);
    const enun = criar('span', 'exp-enunciado');
    SIM.escreverTexto(enun, q.e);
    cab.appendChild(enun);
    const rodape = criar('span', 'exp-rodape');
    rodape.appendChild(criar('span', 'exp-hist dado', historico(q)));
    rodape.appendChild(criar('span', 'exp-dica', aberta ? (revelada ? 'fechar' : 'mostrar resposta') : 'abrir'));
    cab.appendChild(rodape);

    corpo.textContent = '';
    corpo.hidden = !aberta;
    if (!aberta) return;

    if (q.g && q.p) {
      const fig = criar('figure', 'placa-figura exp-figura');
      const img = criar('img');
      img.alt = 'Placa ' + q.p;
      img.loading = 'lazy';
      img.onerror = () => { fig.hidden = true; };
      img.src = (window.PLACAS && window.PLACAS[q.p]) || ('placas/' + q.p + '.svg');
      fig.appendChild(img);
      corpo.appendChild(fig);
    }

    const alts = criar('div', 'alternativas exp-alts');
    ordemAlternativas(q).forEach((a, i) => {
      const d = criar('div', 'alt travada' + (revelada && a.certa ? ' certa' : ''));
      d.appendChild(criar('span', 'letra', SIM.LETRAS[i]));
      const t = criar('span', 'alt-texto');
      SIM.escreverTexto(t, a.texto);
      d.appendChild(t);
      if (revelada && a.certa) d.setAttribute('aria-label', 'Correta: ' + a.texto);
      alts.appendChild(d);
    });
    corpo.appendChild(alts);

    if (revelada && q.k) {
      const c = criar('div', 'comentario');
      c.appendChild(criar('span', 'rotulo', 'Por quê'));
      const p = criar('p', 'exp-coment');
      SIM.escreverTexto(p, q.k);
      c.appendChild(p);
      corpo.appendChild(c);
    }

    const acoes = criar('div', 'exp-acoes');
    const bRev = criar('button', 'btn' + (revelada ? ' vazio' : ''), revelada ? 'Esconder resposta' : 'Mostrar resposta');
    bRev.type = 'button';
    bRev.dataset.nav = '';
    bRev.addEventListener('click', () => {
      reveladas[q.i] = !reveladas[q.i];
      pintarLinha(art, q);
      destacar(art.querySelector('.exp-acoes .btn'));
    });
    const tecla = SIM.teclaDe('marcar');
    const bBand = criar('button', 'btn vazio btn-marcar' + (f ? ' ativa' : ''), f ? '🚩 Marcada' : '🚩 Marcar');
    if (tecla) bBand.appendChild(criar('span', 'exp-tecla', ' (' + tecla + ')'));
    bBand.type = 'button';
    bBand.dataset.nav = '';
    bBand.setAttribute('aria-pressed', f ? 'true' : 'false');
    bBand.addEventListener('click', () => {
      SIM.alternarMarca(q.i);
      destacar(art.querySelectorAll('.exp-acoes .btn')[1]);
    });
    const bFechar = criar('button', 'btn vazio', 'Fechar');
    bFechar.type = 'button';
    bFechar.dataset.nav = '';
    bFechar.addEventListener('click', () => {
      abertas[q.i] = false;
      pintarLinha(art, q);
      destacar(cab);
    });
    acoes.appendChild(bRev);
    acoes.appendChild(bBand);
    acoes.appendChild(bFechar);
    corpo.appendChild(acoes);
  }

  // Apertar a linha: abre; aberta, mostra a resposta; já mostrada, fecha.
  function apertar(q) {
    if (!abertas[q.i]) abertas[q.i] = true;
    else if (!reveladas[q.i]) reveladas[q.i] = true;
    else abertas[q.i] = false;
    const art = linhaDe(q.i);
    if (art) pintarLinha(art, q);
  }

  function linhaDe(id) {
    return lista.querySelector('.exp-linha[data-id="' + id + '"]');
  }

  // Igual ao cursor do teclado.js (que não exporta o seu): uma só peça com .cursor-nav.
  function destacar(no) {
    if (!no) return;
    Array.prototype.forEach.call(document.querySelectorAll('.cursor-nav'), (n) => n.classList.remove('cursor-nav'));
    if (no !== iBusca) no.classList.add('cursor-nav');
    no.focus({ preventScroll: true });
    no.scrollIntoView({ block: 'nearest' });
  }

  // A 🚩 muda em qualquer lugar (aqui ou no treino): repinta a linha, se estiver na tela.
  SIM.on('marca', (d) => {
    if (sec.hidden) return;
    const art = linhaDe(d.id);
    if (!art) return;
    const foco = document.activeElement;
    const eraCab = foco && foco.classList && foco.classList.contains('exp-linha-cab') && art.contains(foco);
    pintarLinha(art, SIM.porId[d.id]);
    if (eraCab) destacar(art.querySelector('.exp-linha-cab'));
  });

  function marcarComCursor() {
    const a = document.activeElement;
    const art = a && a.closest && a.closest('.exp-linha');
    if (!art || !sec.contains(art)) {
      SIM.aviso('Leve o cursor até uma questão para marcar com 🚩.', { icone: '🚩', ms: 2200 });
      return;
    }
    const id = art.dataset.id;
    const ficou = SIM.alternarMarca(id);
    SIM.aviso(ficou ? 'Nº ' + SIM.porId[id].n + ' marcada' : 'Nº ' + SIM.porId[id].n + ' desmarcada',
      { icone: '🚩', ms: 1600 });
  }

  // ---------- treinar ----------

  function treinar() {
    const questoes = resultado.slice();
    if (!questoes.length) return;
    const opcoes = {
      modo: 'treino', titulo: 'Explorador', questoes, tamanho: 20, revelar: true,
      refazer: () => SIM.iniciarSessao(opcoes)
    };
    SIM.iniciarSessao(opcoes);
  }

  // ---------- registro ----------

  SIM.registrarTela('explorador', {
    elemento: sec,
    aoMostrar: () => {
      // A situação pode ter mudado num treino: refiltra e repinta tudo.
      pintarControles();
      resultado = filtrar();
      mostrando = Math.max(mostrando, PAGINA);
      pintarLista();
    },
    atalhos: {
      marcar: marcarComCursor,
      buscar: () => destacar(iBusca),
      explorar: () => destacar(iBusca),
      sair: () => SIM.irInicio()
    },
    voltar: () => SIM.irInicio()
  });

  // O teclado.js tira o foco ao trocar de tela; este ouvinte roda depois dele.
  SIM.on('tela', (d) => {
    if (d.nome !== 'explorador' || !focarBusca) return;
    focarBusca = false;
    destacar(iBusca);
    iBusca.select();
  });

  SIM.adicionarMenu({
    id: 'explorador', ordem: 10, icone: '🔎', titulo: 'Explorador', tecla: 'explorar',
    texto: () => 'Buscar e reler as ' + br(SIM.banco.length) + ' questões',
    acao: () => abrir(false)
  });
})();
