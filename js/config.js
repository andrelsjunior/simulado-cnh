// Configurações: meta diária, som, backup do progresso, palavras "não entendi"
// e zerar tudo.
(function () {
  'use strict';

  const SIM = window.SIM;
  const { el, criar, br } = SIM;

  const tela = criar('section', 'tela');
  tela.id = 'tela-config';
  tela.hidden = true;
  el('app').appendChild(tela);

  function botao(texto, classe, fn) {
    const b = criar('button', 'btn ' + (classe || ''), texto);
    b.type = 'button';
    b.dataset.nav = '';
    b.addEventListener('click', fn);
    return b;
  }

  function caixaOpcao(texto, chave, padrao) {
    const op = criar('label', 'opcao');
    const cb = criar('input');
    cb.type = 'checkbox';
    cb.dataset.nav = '';
    cb.checked = !!SIM.config(chave, padrao);
    cb.addEventListener('change', () => SIM.definirConfig(chave, cb.checked));
    op.appendChild(cb);
    op.appendChild(criar('span', null, texto));
    return op;
  }

  function baixar() {
    const blob = new Blob([SIM.exportar()], { type: 'application/json' });
    const a = criar('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'simulado-cnh-backup-' + SIM.hoje() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    SIM.aviso('Backup baixado. Abra em outro aparelho em Configurações → Restaurar.', { icone: '💾' });
  }

  async function copiarTexto(texto, ok) {
    try {
      await navigator.clipboard.writeText(texto);
      SIM.aviso(ok, { icone: '📋' });
    } catch (e) {
      window.prompt('Copie o texto abaixo:', texto);
    }
  }

  function restaurarDe(texto) {
    // Link de "Enviar progresso" colado aqui: junta em vez de substituir.
    if (SIM.receberLink && SIM.receberLink(texto)) return;
    if (!window.confirm('Restaurar este backup? O progresso atual deste aparelho será substituído.')) return;
    try {
      SIM.importar(texto);
      SIM.aviso('Progresso restaurado.', { icone: '✅' });
    } catch (e) {
      SIM.aviso(e.message || 'Não consegui ler esse backup.', { icone: '⚠️' });
    }
  }

  function pintar() {
    tela.textContent = '';
    const cab = criar('header', 'pagina-cab');
    cab.appendChild(criar('h1', 'pagina-titulo', 'Configurações'));
    tela.appendChild(cab);

    // Meta diária
    tela.appendChild(criar('h2', 'secao', 'Meta diária'));
    const linha = criar('div', 'filtros');
    const lab = criar('label', 'rotulo', 'Questões novas por dia');
    lab.htmlFor = 'sel-meta';
    const sel = criar('select');
    sel.id = 'sel-meta';
    sel.dataset.nav = '';
    [10, 20, 30, 40, 50, 80, 100].forEach((n) => {
      const o = criar('option', null, String(n));
      o.value = n;
      if (n === SIM.metaNovas()) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => SIM.definirConfig('metaNovas', Number(sel.value)));
    linha.appendChild(lab);
    linha.appendChild(sel);
    tela.appendChild(linha);
    tela.appendChild(criar('p', 'muted', 'A meta do dia é zerar a revisão pendente e responder essa quantidade de questões novas. A sequência 🔥 conta os dias seguidos em que você bateu as novas. Perder um dia só zera a sequência — nada mais.'));

    // Preferências
    tela.appendChild(criar('h2', 'secao', 'Preferências'));
    tela.appendChild(caixaOpcao('Som ao ganhar conquista', 'som', false));
    tela.appendChild(caixaOpcao('Sublinhar termos do glossário nas questões', 'glossarioSublinhar', true));
    tela.appendChild(caixaOpcao('Confirmar antes de responder (a letra só move o cursor)', 'confirmarAntes', false));
    const ctrl = criar('p', 'muted');
    ctrl.appendChild(document.createTextNode('Teclas: '));
    const link = criar('a', null, 'abrir Controles');
    link.href = '#';
    link.dataset.nav = '';
    link.addEventListener('click', (ev) => { ev.preventDefault(); SIM.mostrar('controles'); });
    ctrl.appendChild(link);
    tela.appendChild(ctrl);

    // Backup
    tela.appendChild(criar('h2', 'secao', 'Backup e outro aparelho'));
    const n = Object.keys(SIM.progresso.q).length;
    tela.appendChild(criar('p', 'muted', 'O progresso fica só neste navegador (' + br(n) +
      ' questões com histórico). Para levar ao celular ou ao computador, baixe ou copie o backup aqui e restaure lá.'));
    const ac0 = criar('div', 'acoes');
    ac0.appendChild(botao('📲 Enviar para outro aparelho', '', () => SIM.enviarProgresso()));
    tela.appendChild(ac0);
    tela.appendChild(criar('p', 'muted', 'O jeito do dia a dia: gera um link para mandar a você mesmo (WhatsApp, e-mail). Tocando nele no outro aparelho, o progresso é juntado ao de lá. Abaixo, o backup completo, que substitui tudo.'));
    const ac1 = criar('div', 'acoes');
    ac1.appendChild(botao('Baixar backup', '', baixar));
    ac1.appendChild(botao('Copiar como texto', 'vazio', () => copiarTexto(SIM.exportar(), 'Backup copiado. Cole em Restaurar no outro aparelho.')));
    tela.appendChild(ac1);

    const arquivo = criar('input');
    arquivo.type = 'file';
    arquivo.accept = 'application/json,.json,.txt';
    arquivo.hidden = true;
    arquivo.addEventListener('change', () => {
      const f = arquivo.files && arquivo.files[0];
      if (!f) return;
      f.text().then(restaurarDe);
      arquivo.value = '';
    });
    tela.appendChild(arquivo);
    const ac2 = criar('div', 'acoes');
    ac2.appendChild(botao('Restaurar de arquivo', 'vazio', () => arquivo.click()));
    ac2.appendChild(botao('Restaurar de texto colado', 'vazio', () => {
      const t = window.prompt('Cole aqui o texto do backup ou o link de progresso:');
      if (t) restaurarDe(t);
    }));
    tela.appendChild(ac2);

    // Não entendi
    const ne = SIM.progresso.naoEntendi || [];
    tela.appendChild(criar('h2', 'secao', 'Palavras que você não entendeu'));
    if (!ne.length) {
      tela.appendChild(criar('p', 'muted', 'Nenhuma ainda. Na questão, selecione a palavra e toque em “Não entendi uma palavra”.'));
    } else {
      const ul = criar('ul', 'lista-palavras');
      ne.slice().reverse().forEach((x) => {
        const q = x.questao && SIM.porId[x.questao];
        ul.appendChild(criar('li', null, x.palavra + (q ? ' — questão nº ' + q.n : '')));
      });
      tela.appendChild(ul);
      const ac3 = criar('div', 'acoes');
      ac3.appendChild(botao('Copiar lista', 'vazio', () => copiarTexto(
        ne.map((x) => x.palavra + (x.questao && SIM.porId[x.questao] ? ' (questão ' + SIM.porId[x.questao].n + ')' : '')).join('\n'),
        'Lista copiada.')));
      ac3.appendChild(botao('Limpar lista', 'vazio', () => {
        if (window.confirm('Apagar a lista de palavras?')) { SIM.progresso.naoEntendi = []; SIM.salvar(); pintar(); }
      }));
      tela.appendChild(ac3);
    }

    // Zerar
    tela.appendChild(criar('h2', 'secao', 'Começar do zero'));
    const ac4 = criar('div', 'acoes');
    ac4.appendChild(botao('Apagar todo o progresso', 'vazio perigo', () => {
      if (!window.confirm('Apagar TODO o progresso deste aparelho (respostas, revisão, 🚩, conquistas)?')) return;
      if (!window.confirm('Tem certeza? Isso não tem volta. Se quiser, baixe um backup antes.')) return;
      SIM.importar(JSON.stringify({ progresso: { v: 2, q: {}, config: SIM.progresso.config } }));
      SIM.aviso('Progresso apagado.', { icone: '🧹' });
    }));
    ac4.appendChild(botao('Voltar ao início', '', () => SIM.irInicio()));
    tela.appendChild(ac4);
  }

  SIM.registrarTela('config', { elemento: tela, aoMostrar: pintar });
  SIM.registrarAcao({ id: 'config', grupo: 'menus', rotulo: 'Configurações e backup', padrao: ['.'] });
  SIM.registrarGlobal('config', () => {
    if (SIM.sessaoAtivaComTempo()) return false;
    SIM.mostrar('config');
  });
  SIM.adicionarMenu({
    id: 'config', ordem: 90, icone: '⚙', titulo: 'Configurações', tecla: 'config',
    texto: 'Meta diária, som, backup', acao: () => SIM.mostrar('config')
  });
})();
