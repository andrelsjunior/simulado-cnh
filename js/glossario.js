// Glossário: sublinha termos técnicos no texto das questões, mostra a
// explicação simples + a definição oficial do CTB num balão, e tem uma
// página com todos os termos. Dados em js/glossario-dados.js.
(function () {
  'use strict';

  const SIM = window.SIM;
  const { el, criar } = SIM;
  const termos = (window.GLOSSARIO || []).slice();

  // ---------- casamento ----------

  // Cada forma (termo ou variação) aponta para o índice do termo. Formas
  // mais longas primeiro, para "passagem de nível com barreira" vencer
  // "passagem de nível".
  const formas = [];
  termos.forEach((t, idx) => {
    [t.t].concat(t.v || []).forEach((f) => { if (f) formas.push({ f: String(f), idx }); });
  });
  formas.sort((a, b) => b.f.length - a.f.length);
  const porForma = {};
  formas.forEach((x) => { porForma[x.f.toLowerCase()] = x.idx; });

  const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let regex = null;
  try {
    if (formas.length) {
      regex = new RegExp('(?<![\\p{L}\\p{N}])(' + formas.map((x) => escapar(x.f)).join('|') +
        ')(?![\\p{L}\\p{N}])', 'giu');
    }
  } catch (e) { regex = null; /* navegador sem lookbehind: segue sem sublinhar */ }

  SIM.glossario = { termos, buscar: (forma) => termos[porForma[String(forma).toLowerCase()]] };

  const ativo = () => SIM.config('glossarioSublinhar', true);

  // Troca o escritor de texto do núcleo: mesmo texto, com os termos em <span>.
  // Cada termo é sublinhado só na primeira vez em cada bloco, para não poluir.
  SIM.escreverTexto = function (alvo, texto) {
    alvo.textContent = '';
    if (!regex || !ativo()) { alvo.textContent = texto; return; }
    const vistos = new Set();
    let ultimo = 0;
    texto.replace(regex, (casou, _g, pos) => {
      const idx = porForma[casou.toLowerCase()];
      if (idx == null || vistos.has(idx)) return casou;
      vistos.add(idx);
      if (pos > ultimo) alvo.appendChild(document.createTextNode(texto.slice(ultimo, pos)));
      const s = criar('span', 'termo', casou);
      s.dataset.termo = idx;
      s.setAttribute('role', 'button');
      s.setAttribute('aria-label', casou + ' — ver significado');
      s.tabIndex = -1;
      alvo.appendChild(s);
      ultimo = pos + casou.length;
      return casou;
    });
    if (ultimo < texto.length) alvo.appendChild(document.createTextNode(texto.slice(ultimo)));
  };

  // ---------- balão ----------

  let balao = null;

  function corpoDefinicao(t) {
    const div = criar('div', 'def');
    div.appendChild(criar('p', 'def-simples', t.s));
    if (t.o) {
      const of = criar('div', 'def-oficial');
      of.appendChild(criar('span', 'rotulo', 'Definição oficial' + (t.f ? ' · ' + t.f : '')));
      of.appendChild(criar('p', null, t.o));
      div.appendChild(of);
    }
    return div;
  }

  function abrirBalao(idx, ancora) {
    const t = termos[idx];
    if (!t) return;
    fecharBalao();
    balao = criar('div', 'balao');
    balao.setAttribute('role', 'dialog');
    const cab = criar('div', 'balao-cab');
    cab.appendChild(criar('b', null, t.t));
    const x = criar('button', 'balao-fechar', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Fechar');
    x.addEventListener('click', fecharBalao);
    cab.appendChild(x);
    balao.appendChild(cab);
    balao.appendChild(corpoDefinicao(t));
    document.body.appendChild(balao);

    // Posiciona abaixo do termo (ou acima, se não couber), dentro da tela.
    const r = ancora.getBoundingClientRect();
    const larg = Math.min(340, window.innerWidth - 24);
    balao.style.width = larg + 'px';
    let left = r.left + r.width / 2 - larg / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - larg - 12));
    balao.style.left = (left + window.scrollX) + 'px';
    const h = balao.offsetHeight;
    const abaixo = r.bottom + 8 + h < window.innerHeight || r.top < h + 16;
    balao.style.top = ((abaixo ? r.bottom + 8 : r.top - h - 8) + window.scrollY) + 'px';

    SIM.contar('glossarioConsultas');
    const vistos = SIM.progresso.glossarioVistos || (SIM.progresso.glossarioVistos = {});
    if (!vistos[t.t]) { vistos[t.t] = Date.now(); SIM.contar('glossarioTermosDistintos'); }
  }

  function fecharBalao() { if (balao) { balao.remove(); balao = null; } }

  document.addEventListener('click', (ev) => {
    const termo = ev.target.closest && ev.target.closest('.termo');
    if (termo) {
      ev.preventDefault();
      ev.stopPropagation();
      abrirBalao(Number(termo.dataset.termo), termo);
      return;
    }
    if (balao && !balao.contains(ev.target)) fecharBalao();
  }, true);
  document.addEventListener('keydown', (ev) => {
    if (balao && ev.key === 'Escape') { fecharBalao(); ev.stopPropagation(); ev.preventDefault(); }
  }, true);
  window.addEventListener('scroll', fecharBalao, { passive: true });
  SIM.on('tela', fecharBalao);
  SIM.on('questao', fecharBalao);

  // ---------- termos da questão (tecla G) ----------

  function termosDaQuestao() {
    const s = SIM.sessao && SIM.sessao();
    const tela = SIM.telaAtual().elemento;
    const nos = tela ? tela.querySelectorAll('.termo') : [];
    const idxs = [];
    Array.prototype.forEach.call(nos, (n) => {
      const i = Number(n.dataset.termo);
      if (idxs.indexOf(i) < 0) idxs.push(i);
    });
    const corpo = criar('div', 'glossario-lista');
    if (!idxs.length) {
      corpo.appendChild(criar('p', 'muted', 'Nenhum termo do glossário nesta tela.' +
        (s ? ' Se alguma palavra ficou estranha, use “Não entendi uma palavra”.' : '')));
    }
    idxs.forEach((i) => {
      const t = termos[i];
      const art = criar('article', 'glossario-item');
      art.dataset.nav = '';
      art.tabIndex = 0;
      art.appendChild(criar('h3', null, t.t));
      art.appendChild(corpoDefinicao(t));
      corpo.appendChild(art);
      SIM.contar('glossarioConsultas');
    });
    SIM.abrirDialogo('Termos desta tela', corpo);
  }

  SIM.registrarAcao({ id: 'glossario', grupo: 'geral', rotulo: 'Glossário (termos da tela / página)', padrao: ['g'] });
  SIM.registrarGlobal('glossario', () => {
    const n = SIM.telaAtual().nome;
    if (n === 'prova' || n === 'resultado' || n === 'explorador') termosDaQuestao();
    else SIM.mostrar('glossario');
  });

  // ---------- "não entendi uma palavra" ----------

  function naoEntendi() {
    const s = SIM.sessao && SIM.sessao();
    const item = s && s.itens[s.indice];
    let palavra = String(window.getSelection ? window.getSelection() : '').trim();
    if (!palavra || palavra.length > 60) {
      palavra = (window.prompt('Qual palavra ou expressão você não entendeu?') || '').trim();
    }
    if (!palavra) return;
    SIM.progresso.naoEntendi.push({ palavra, questao: item ? item.q.i : null, ts: Date.now() });
    SIM.salvar();
    const ja = SIM.glossario.buscar(palavra);
    if (ja) {
      SIM.aviso(ja.s, { titulo: ja.t, icone: '📖', ms: 7000 });
    } else {
      SIM.aviso('Guardei “' + palavra + '”. A lista fica em Configurações para mandar e entrar no glossário.',
        { icone: '📝' });
    }
  }

  function garantirBotao() {
    const area = el('acoes-questao');
    if (!area || el('btn-nao-entendi')) return;
    const b = criar('button', 'btn vazio', 'Não entendi uma palavra');
    b.id = 'btn-nao-entendi';
    b.type = 'button';
    b.title = 'Dica: selecione a palavra antes de tocar aqui';
    b.addEventListener('mousedown', (ev) => ev.preventDefault()); // não perde a seleção
    b.addEventListener('click', naoEntendi);
    area.insertBefore(b, el('btn-sair'));
  }
  SIM.on('sessao-inicio', garantirBotao);

  // ---------- página do glossário ----------

  const CATS = {
    via: 'Vias', veiculo: 'Veículos', sinalizacao: 'Sinalização', legislacao: 'Leis e multas',
    conducao: 'Condução', socorros: 'Primeiros socorros', mecanica: 'Mecânica', ambiente: 'Meio ambiente',
    geral: 'Geral'
  };

  const tela = criar('section', 'tela');
  tela.id = 'tela-glossario';
  tela.hidden = true;
  el('app').appendChild(tela);

  let busca = '', cat = '';

  function pintarPagina() {
    tela.textContent = '';
    const cab = criar('header', 'pagina-cab');
    cab.appendChild(criar('h1', 'pagina-titulo', 'Glossário'));
    cab.appendChild(criar('p', 'muted', termos.length
      ? termos.length + ' termos que aparecem nas questões. Explicação simples primeiro; quando existe, a definição oficial do Código de Trânsito (Anexo I) logo abaixo.'
      : 'O glossário ainda está vazio.'));
    tela.appendChild(cab);

    const campo = criar('input', 'campo');
    campo.type = 'search';
    campo.placeholder = 'Buscar termo…';
    campo.value = busca;
    campo.dataset.nav = '';
    campo.dataset.navSair = '';
    campo.addEventListener('input', () => { busca = campo.value; pintarLista(); });
    tela.appendChild(campo);

    const chips = criar('div', 'filtros');
    [''].concat(Object.keys(CATS)).forEach((c) => {
      if (c && !termos.some((t) => t.c === c)) return;
      const b = criar('button', 'btn vazio chip-filtro' + (c === cat ? ' ativo' : ''), c ? CATS[c] : 'Todos');
      b.type = 'button';
      b.dataset.nav = '';
      b.addEventListener('click', () => { cat = c; pintarPagina(); });
      chips.appendChild(b);
    });
    tela.appendChild(chips);

    const lista = criar('div', 'glossario-lista');
    lista.id = 'glossario-lista';
    tela.appendChild(lista);
    pintarLista();

    const sw = criar('label', 'opcao');
    const cb = criar('input');
    cb.type = 'checkbox';
    cb.dataset.nav = '';
    cb.checked = ativo();
    cb.addEventListener('change', () => SIM.definirConfig('glossarioSublinhar', cb.checked));
    sw.appendChild(cb);
    sw.appendChild(criar('span', null, 'Sublinhar os termos nas questões'));
    tela.appendChild(sw);
  }

  function pintarLista() {
    const lista = el('glossario-lista');
    if (!lista) return;
    lista.textContent = '';
    const q = SIM.normalizar(busca.trim());
    const filtrados = termos.filter((t) => {
      if (cat && t.c !== cat) return false;
      if (!q) return true;
      return SIM.normalizar(t.t + ' ' + (t.v || []).join(' ') + ' ' + t.s).indexOf(q) >= 0;
    });
    if (!filtrados.length) lista.appendChild(criar('p', 'muted', 'Nenhum termo encontrado.'));
    filtrados.forEach((t) => {
      const art = criar('article', 'glossario-item');
      art.dataset.nav = '';
      art.tabIndex = 0;
      const h = criar('h3', null, t.t);
      if (t.c && CATS[t.c]) h.appendChild(criar('span', 'chip', CATS[t.c]));
      art.appendChild(h);
      art.appendChild(corpoDefinicao(t));
      lista.appendChild(art);
    });
  }

  SIM.registrarTela('glossario', { elemento: tela, aoMostrar: pintarPagina });
  SIM.adicionarMenu({
    id: 'glossario', ordem: 20, icone: '📖', titulo: 'Glossário', tecla: 'glossario',
    texto: () => termos.length + ' termos de trânsito explicados', acao: () => SIM.mostrar('glossario')
  });
})();
