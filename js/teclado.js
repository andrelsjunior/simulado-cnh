// Teclado no estilo menu de jogo: cursor com setas, Espaço/Enter confirmam,
// atalhos diretos, duas teclas por ação e tudo remapeável na tela Controles.
(function () {
  'use strict';

  const SIM = window.SIM;
  const { el, criar } = SIM;

  // ---------- ações ----------

  const acoes = [];
  const porId = {};

  // grupo: 'prova' | 'menus' | 'geral'
  SIM.registrarAcao = function (a) {
    if (porId[a.id]) return;
    acoes.push(a);
    porId[a.id] = a;
  };

  [
    { id: 'altA', grupo: 'prova', rotulo: 'Responder A', padrao: ['a', '1'] },
    { id: 'altB', grupo: 'prova', rotulo: 'Responder B', padrao: ['b', '2'] },
    { id: 'altC', grupo: 'prova', rotulo: 'Responder C', padrao: ['c', '3'] },
    { id: 'altD', grupo: 'prova', rotulo: 'Responder D', padrao: ['d', '4'] },
    { id: 'cima', grupo: 'geral', rotulo: 'Cursor para cima', padrao: ['ArrowUp', 'k'] },
    { id: 'baixo', grupo: 'geral', rotulo: 'Cursor para baixo', padrao: ['ArrowDown', 'j'] },
    { id: 'confirmar', grupo: 'geral', rotulo: 'Confirmar / próxima', padrao: ['Enter', 'Space'] },
    { id: 'proxima', grupo: 'prova', rotulo: 'Próxima questão', padrao: ['ArrowRight', 'l'] },
    { id: 'anterior', grupo: 'prova', rotulo: 'Questão anterior', padrao: ['ArrowLeft', 'h'] },
    { id: 'marcar', grupo: 'prova', rotulo: 'Marcar dúvida 🚩', padrao: ['m', 'f'] },
    { id: 'sair', grupo: 'geral', rotulo: 'Sair / voltar', padrao: ['Escape'] },
    { id: 'ajuda', grupo: 'geral', rotulo: 'Lista de atalhos', padrao: ['?'] },
    { id: 'inicio', grupo: 'geral', rotulo: 'Ir para o início', padrao: ['i'] },
    { id: 'novamente', grupo: 'menus', rotulo: 'Fazer outra rodada (no resultado)', padrao: ['n'] },
    { id: 'modoSimulado', grupo: 'menus', rotulo: 'Simulado completo', padrao: ['s'] },
    { id: 'modoTreino', grupo: 'menus', rotulo: 'Treino', padrao: ['t'] },
    { id: 'modoRevisao', grupo: 'menus', rotulo: 'Revisão do dia', padrao: ['r'] },
    { id: 'modoAntiChute', grupo: 'menus', rotulo: 'Anti-chute', padrao: ['u'] },
    { id: 'modoChefao', grupo: 'menus', rotulo: 'Simulado Chefão', padrao: ['x'] },
    { id: 'controles', grupo: 'menus', rotulo: 'Controles (esta tela)', padrao: [','] }
  ].forEach(SIM.registrarAcao);

  // ---------- mapa de teclas ----------

  function mapa() {
    const salvo = SIM.config('teclas', {}) || {};
    const m = {};
    acoes.forEach((a) => {
      const s = salvo[a.id];
      m[a.id] = Array.isArray(s) ? [s[0] || null, s[1] || null] : [a.padrao[0] || null, a.padrao[1] || null];
    });
    return m;
  }

  function acoesDaTecla(k) {
    const m = mapa();
    return acoes.filter((a) => m[a.id][0] === k || m[a.id][1] === k).map((a) => a.id);
  }

  SIM.nomeTecla = function (k) {
    if (!k) return '';
    const nomes = {
      ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter',
      Space: 'Espaço', Escape: 'Esc', Backspace: '⌫', Tab: 'Tab', Delete: 'Del',
      Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn'
    };
    return nomes[k] || (k.length === 1 ? k.toUpperCase() : k);
  };
  SIM.teclaDe = function (acao) {
    if (!porId[acao]) return '';
    const m = mapa()[acao];
    return SIM.nomeTecla(m[0] || m[1]);
  };

  function normalizar(ev) {
    if (ev.key === ' ' || ev.key === 'Spacebar') return 'Space';
    if (ev.key && ev.key.length === 1) return ev.key.toLowerCase();
    return ev.key;
  }

  // ---------- cursor genérico (telas que não são a prova) ----------

  const cursores = {};

  function navegaveis() {
    const t = SIM.telaAtual();
    const raiz = (dialogo && !dialogo.hidden) ? dialogo : (t.elemento || document);
    return Array.prototype.filter.call(raiz.querySelectorAll('[data-nav]'), (n) =>
      !n.disabled && n.offsetParent !== null && !n.closest('[hidden]'));
  }

  function chaveCursor() { return (dialogo && !dialogo.hidden) ? '__dialogo' : SIM.telaAtual().nome; }

  function moverGenerico(delta) {
    const lista = navegaveis();
    if (!lista.length) return;
    const ch = chaveCursor();
    let i = lista.indexOf(document.activeElement);
    if (i < 0) i = cursores[ch] != null ? Math.min(cursores[ch], lista.length - 1) - delta : (delta > 0 ? -1 : 0);
    i = (i + delta + lista.length) % lista.length;
    cursores[ch] = i;
    destacar(lista[i]);
  }

  function destacar(no) {
    Array.prototype.forEach.call(document.querySelectorAll('.cursor-nav'), (n) => n.classList.remove('cursor-nav'));
    if (!no) return;
    no.classList.add('cursor-nav');
    no.focus({ preventScroll: true });
    no.scrollIntoView({ block: 'nearest' });
  }

  function confirmarGenerico() {
    const a = document.activeElement;
    if (a && a.matches && a.matches('[data-nav]') && !a.disabled) {
      if (a.tagName === 'SELECT') { mudarSelect(a, 1); return; }
      a.click();
      return;
    }
    moverGenerico(1);
  }

  function mudarSelect(s, delta) {
    const n = s.options.length;
    s.selectedIndex = (s.selectedIndex + delta + n) % n;
    s.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // O mouse passando por cima leva o cursor junto (como em jogo).
  document.addEventListener('mousemove', (ev) => {
    const alvo = ev.target.closest && ev.target.closest('[data-nav]');
    if (!alvo || alvo.classList.contains('cursor-nav') || alvo.classList.contains('alt')) return;
    if (alvo.disabled) return;
    Array.prototype.forEach.call(document.querySelectorAll('.cursor-nav'), (n) => n.classList.remove('cursor-nav'));
    alvo.classList.add('cursor-nav');
  });

  SIM.on('tela', () => {
    Array.prototype.forEach.call(document.querySelectorAll('.cursor-nav'), (n) => n.classList.remove('cursor-nav'));
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    pintarDica();
  });

  // ---------- despacho ----------

  let capturando = null; // { acao, slot } enquanto a tela Controles espera uma tecla

  function emCampoDeTexto(t) {
    if (!t || !t.tagName) return false;
    if (t.isContentEditable) return true;
    if (t.tagName === 'TEXTAREA') return true;
    if (t.tagName === 'INPUT') {
      const tipo = (t.type || 'text').toLowerCase();
      return ['text', 'search', 'number', 'email', 'url', 'tel', 'password'].indexOf(tipo) >= 0;
    }
    return false;
  }

  // Ações que funcionam de qualquer tela, se a tela não tratar.
  const globais = {
    cima: () => moverGenerico(-1),
    baixo: () => moverGenerico(1),
    confirmar: confirmarGenerico,
    sair: () => {
      if (dialogo && !dialogo.hidden) { fecharDialogo(); return; }
      const t = SIM.telaAtual();
      if (t.voltar) t.voltar(); else if (t.nome !== 'inicio') SIM.irInicio();
    },
    ajuda: () => abrirAjuda(),
    inicio: () => { if (!SIM.sessaoAtivaComTempo()) SIM.irInicio(); },
    controles: () => SIM.mostrar('controles')
  };
  SIM.registrarGlobal = function (acao, fn) { globais[acao] = fn; };

  // Atalhos de modo só valem fora da prova (para não sair de um simulado sem querer).
  const telasDeMenu = { inicio: true, resultado: true };
  ['modoSimulado', 'modoTreino', 'modoRevisao', 'modoAntiChute', 'modoChefao'].forEach((a) => {
    globais[a] = () => {
      if (!telasDeMenu[SIM.telaAtual().nome]) return false;
      SIM.iniciarModo({ modoSimulado: 'simulado', modoTreino: 'treino', modoRevisao: 'revisao',
        modoAntiChute: 'anti-chute', modoChefao: 'chefao' }[a]);
    };
  });

  SIM.sessaoAtivaComTempo = function () {
    const s = SIM.sessao && SIM.sessao();
    const n = SIM.telaAtual().nome;
    return !!(s && s.fim && (n === 'prova' || n === 'entrega'));
  };

  document.addEventListener('keydown', (ev) => {
    if (capturando) { capturar(ev); return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k = normalizar(ev);

    if (emCampoDeTexto(ev.target)) {
      if (k === 'Escape') { ev.target.blur(); ev.preventDefault(); }
      else if ((k === 'ArrowDown' || k === 'Enter') && ev.target.dataset.navSair != null) {
        ev.target.blur(); moverGenerico(1); ev.preventDefault();
      }
      return;
    }

    // Em <select> com cursor: ← → trocam a opção.
    if (ev.target && ev.target.tagName === 'SELECT' && (k === 'ArrowLeft' || k === 'ArrowRight')) {
      mudarSelect(ev.target, k === 'ArrowLeft' ? -1 : 1);
      ev.preventDefault();
      return;
    }

    const ids = acoesDaTecla(k);
    if (!ids.length) return;
    const t = SIM.telaAtual();
    const doDialogo = dialogo && !dialogo.hidden;

    for (let i = 0; i < ids.length; i++) {
      const a = ids[i];
      const fnTela = !doDialogo && t.atalhos ? t.atalhos[a] : undefined;
      let r;
      if (typeof fnTela === 'function') r = fnTela(ev);
      else if (globais[a]) r = globais[a](ev);
      else continue;
      if (r !== false) {
        ev.preventDefault();
        if (k === 'Space') engoliuEspaco = true;
        SIM.emit('tecla', { acao: a });
        return;
      }
    }
  });

  // O botão com foco "clica" no keyup do Espaço; como a ação já rodou no
  // keydown, engole esse clique para não executar duas vezes.
  let engoliuEspaco = false;
  document.addEventListener('keyup', (ev) => {
    if (engoliuEspaco && (ev.key === ' ' || ev.key === 'Spacebar')) { ev.preventDefault(); engoliuEspaco = false; }
  });

  // ---------- diálogo (ajuda) ----------

  let dialogo = null;

  function abrirDialogo(titulo, corpo) {
    if (!dialogo) {
      dialogo = criar('div', 'dialogo');
      dialogo.setAttribute('role', 'dialog');
      dialogo.setAttribute('aria-modal', 'true');
      dialogo.addEventListener('click', (ev) => { if (ev.target === dialogo) fecharDialogo(); });
      document.body.appendChild(dialogo);
    }
    dialogo.textContent = '';
    const caixa = criar('div', 'dialogo-caixa');
    caixa.appendChild(criar('h2', 'secao', titulo));
    caixa.appendChild(corpo);
    const fechar = criar('button', 'btn vazio', 'Fechar (' + SIM.teclaDe('sair') + ')');
    fechar.type = 'button';
    fechar.dataset.nav = '';
    fechar.addEventListener('click', fecharDialogo);
    const acoesDiv = criar('div', 'acoes');
    acoesDiv.appendChild(fechar);
    caixa.appendChild(acoesDiv);
    dialogo.appendChild(caixa);
    dialogo.hidden = false;
  }
  function fecharDialogo() { if (dialogo) dialogo.hidden = true; }
  SIM.abrirDialogo = abrirDialogo;
  SIM.fecharDialogo = fecharDialogo;

  const GRUPOS = { prova: 'Na questão', geral: 'Em qualquer tela', menus: 'Atalhos de menu' };

  function abrirAjuda() {
    const m = mapa();
    const corpo = criar('div', 'ajuda-teclas');
    Object.keys(GRUPOS).forEach((g) => {
      const lista = acoes.filter((a) => a.grupo === g);
      if (!lista.length) return;
      corpo.appendChild(criar('h3', 'rotulo', GRUPOS[g]));
      const dl = criar('dl');
      lista.forEach((a) => {
        const dt = criar('dt');
        m[a.id].filter(Boolean).forEach((k, i) => {
          if (i) dt.appendChild(document.createTextNode(' '));
          dt.appendChild(criar('kbd', null, SIM.nomeTecla(k)));
        });
        if (!dt.childNodes.length) dt.appendChild(criar('span', 'muted', 'sem tecla'));
        dl.appendChild(dt);
        dl.appendChild(criar('dd', null, a.rotulo));
      });
      corpo.appendChild(dl);
    });
    const p = criar('p', 'muted', 'Para trocar as teclas, abra Controles (' + SIM.teclaDe('controles') + ') no início.');
    corpo.appendChild(p);
    abrirDialogo('Atalhos do teclado', corpo);
  }

  // ---------- dica de atalhos na prova (só com teclado/mouse) ----------

  function pintarDica() {
    const d = el('dica-teclas');
    if (!d) return;
    const s = SIM.sessao && SIM.sessao();
    const partes = [
      SIM.teclaDe('altA') + '–' + SIM.teclaDe('altD') + ' responder',
      SIM.teclaDe('cima') + SIM.teclaDe('baixo') + ' + ' + SIM.teclaDe('confirmar') + ' escolher',
      SIM.teclaDe('anterior') + SIM.teclaDe('proxima') + ' navegar',
      SIM.teclaDe('marcar') + ' 🚩'
    ];
    if (s && s.revelar) partes.splice(2, 0, SIM.teclaDe('confirmar') + ' de novo = próxima');
    if (porId.voz) partes.push(SIM.teclaDe('voz') + ' ouvir');
    partes.push(SIM.teclaDe('ajuda') + ' todos');
    d.textContent = partes.join(' · ');
  }
  SIM.on('sessao-inicio', pintarDica);
  SIM.on('config', pintarDica);

  // ---------- tela Controles ----------

  const tela = criar('section', 'tela');
  tela.id = 'tela-controles';
  tela.hidden = true;
  el('app').appendChild(tela);

  function definir(acao, slot, tecla) {
    const m = mapa();
    const antiga = m[acao][slot];
    if (tecla) {
      // Conflito: a outra ação fica com a tecla que esta tinha (troca).
      acoes.forEach((a) => {
        if (a.id === acao) return;
        [0, 1].forEach((s) => {
          if (m[a.id][s] === tecla) {
            m[a.id][s] = antiga;
            SIM.aviso('“' + SIM.nomeTecla(tecla) + '” era de “' + a.rotulo + '”. As duas ações trocaram de tecla.',
              { icone: '⇄' });
          }
        });
      });
      if (m[acao][1 - slot] === tecla) m[acao][1 - slot] = antiga;
    }
    m[acao][slot] = tecla;
    SIM.definirConfig('teclas', m);
  }

  function capturar(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    const k = normalizar(ev);
    const c = capturando;
    capturando = null;
    if (k === 'Escape') { pintarControles(); return; }
    if (k === 'Backspace' || k === 'Delete') { definir(c.acao, c.slot, null); pintarControles(); return; }
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].indexOf(k) >= 0) { capturando = c; return; }
    definir(c.acao, c.slot, k);
    pintarControles();
  }

  function pintarControles() {
    tela.textContent = '';
    const cab = criar('header', 'pagina-cab');
    cab.appendChild(criar('h1', 'pagina-titulo', 'Controles'));
    cab.appendChild(criar('p', 'muted',
      'Cada ação aceita duas teclas. Clique numa tecla (ou leve o cursor e aperte ' + SIM.teclaDe('confirmar') +
      ') e depois aperte a nova. Esc cancela, ⌫ apaga. Se a tecla já for de outra ação, as duas trocam.'));
    tela.appendChild(cab);

    const m = mapa();
    Object.keys(GRUPOS).forEach((g) => {
      const lista = acoes.filter((a) => a.grupo === g);
      if (!lista.length) return;
      tela.appendChild(criar('h2', 'secao', GRUPOS[g]));
      const tabela = criar('div', 'controles');
      lista.forEach((a) => {
        const linha = criar('div', 'controle');
        linha.appendChild(criar('span', 'controle-nome', a.rotulo));
        [0, 1].forEach((slot) => {
          const b = criar('button', 'tecla');
          b.type = 'button';
          b.dataset.nav = '';
          const esperando = capturando && capturando.acao === a.id && capturando.slot === slot;
          b.textContent = esperando ? 'aperte…' : (SIM.nomeTecla(m[a.id][slot]) || '—');
          if (esperando) b.classList.add('esperando');
          b.addEventListener('click', () => {
            capturando = { acao: a.id, slot };
            pintarControles();
          });
          linha.appendChild(b);
        });
        tabela.appendChild(linha);
      });
      tela.appendChild(tabela);
    });

    tela.appendChild(criar('h2', 'secao', 'Opções'));
    const op = criar('label', 'opcao');
    const cb = criar('input');
    cb.type = 'checkbox';
    cb.dataset.nav = '';
    cb.checked = !!SIM.config('confirmarAntes', false);
    cb.addEventListener('change', () => SIM.definirConfig('confirmarAntes', cb.checked));
    op.appendChild(cb);
    op.appendChild(criar('span', null, 'Confirmar antes de responder: a letra só move o cursor, e ' +
      SIM.teclaDe('confirmar') + ' responde. Evita resposta por toque acidental.'));
    tela.appendChild(op);

    const acoesDiv = criar('div', 'acoes');
    const restaurar = criar('button', 'btn vazio', 'Restaurar padrão');
    restaurar.type = 'button';
    restaurar.dataset.nav = '';
    restaurar.addEventListener('click', () => {
      if (window.confirm('Voltar todas as teclas ao padrão?')) { SIM.definirConfig('teclas', null); pintarControles(); }
    });
    const voltar = criar('button', 'btn', 'Voltar ao início');
    voltar.type = 'button';
    voltar.dataset.nav = '';
    voltar.addEventListener('click', () => SIM.irInicio());
    acoesDiv.appendChild(voltar);
    acoesDiv.appendChild(restaurar);
    tela.appendChild(acoesDiv);
  }

  SIM.registrarTela('controles', { elemento: tela, aoMostrar: pintarControles });
  SIM.adicionarMenu({
    id: 'controles', ordem: 80, icone: '⌨', titulo: 'Controles', tecla: 'controles',
    texto: 'Trocar as teclas de cada ação', acao: () => SIM.mostrar('controles')
  });
})();
