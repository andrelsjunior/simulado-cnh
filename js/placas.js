// Módulo placas: flashcards das placas que aparecem no banco (as que têm figura).
// Vê a figura, pensa, vira o cartão e se autoavalia. Repetição espaçada própria,
// guardada em SIM.progresso.placas = { <cod>: { cx, pr, n, ok } }.
(function () {
  'use strict';

  const SIM = window.SIM;
  const { el, criar, br } = SIM;

  // Nomes conforme o Anexo II do CTB / Manual Brasileiro de Sinalização de Trânsito.
  // [nome oficial, o que o condutor deve fazer]
  const DADOS = {
    'R-4a': ['Proibido virar à esquerda', 'Não vire à esquerda (nem faça retorno) ali: siga em frente ou vire à direita.'],
    'R-4b': ['Proibido virar à direita', 'Não vire à direita ali: siga em frente ou vire à esquerda, se permitido.'],
    'R-5a': ['Proibido retornar à esquerda', 'Não faça o retorno ali: siga até um ponto onde o retorno seja permitido.'],
    'R-5b': ['Proibido retornar à direita', 'Não faça o retorno pela direita ali: siga até um ponto permitido.'],
    'R-6a': ['Proibido estacionar', 'Pode parar rapidamente para embarque e desembarque, mas não pode estacionar.'],
    'R-6b': ['Estacionamento regulamentado', 'Pode estacionar, respeitando as condições indicadas (horário, tempo, tipo de veículo).'],
    'R-6c': ['Proibido parar e estacionar', 'Não pare nem estacione ali, nem por alguns segundos.'],
    'R-7': ['Proibido ultrapassar', 'Não ultrapasse enquanto durar o trecho sinalizado.'],
    'R-8a': ['Proibido mudar de faixa ou pista de trânsito da esquerda para a direita', 'Continue na sua faixa: não passe para a faixa da direita.'],
    'R-8b': ['Proibido mudar de faixa ou pista de trânsito da direita para a esquerda', 'Continue na sua faixa: não passe para a faixa da esquerda.'],
    'R-9': ['Proibido trânsito de caminhões', 'Caminhões não podem entrar; os outros veículos podem.'],
    'R-10': ['Proibido trânsito de veículos automotores', 'Nenhum veículo a motor pode entrar, motos inclusive.'],
    'R-14': ['Peso bruto total máximo permitido', 'Veículo mais pesado que o valor da placa não pode passar: procure outra rota.'],
    'R-15': ['Altura máxima permitida', 'Veículo, com a carga, mais alto que o valor da placa não pode passar.'],
    'R-16': ['Largura máxima permitida', 'Veículo mais largo que o valor da placa não pode passar.'],
    'R-20': ['Proibido acionar buzina ou sinal sonoro', 'Não buzine ali — comum perto de hospitais e áreas residenciais.'],
    'R-23': ['Conserve-se à direita', 'Circule pela faixa da direita.'],
    'R-24a': ['Sentido de circulação da via/pista', 'Circule apenas no sentido indicado pela seta.'],
    'R-24b': ['Passagem obrigatória', 'Passe pelo lado que a seta indica, contornando o obstáculo por ali.'],
    'R-25a': ['Vire à esquerda', 'É obrigatório virar à esquerda nesse ponto.'],
    'R-25b': ['Vire à direita', 'É obrigatório virar à direita nesse ponto.'],
    'R-25c': ['Siga em frente ou à esquerda', 'Só pode seguir em frente ou virar à esquerda; virar à direita é proibido.'],
    'R-25d': ['Siga em frente ou à direita', 'Só pode seguir em frente ou virar à direita; virar à esquerda é proibido.'],
    'R-26': ['Siga em frente', 'É obrigatório seguir em frente, sem conversões.'],
    'R-27': ['Ônibus, caminhões e veículos de grande porte mantenham-se à direita', 'Veículos pesados devem circular pela faixa da direita.'],
    'R-28': ['Duplo sentido de circulação', 'A via passa a ter trânsito nos dois sentidos: atenção a quem vem de frente.'],
    'R-29': ['Proibido trânsito de pedestres', 'Pedestres não podem andar ali (pontes, viadutos, vias expressas).'],
    'R-30': ['Pedestre, ande pela esquerda', 'O pedestre deve andar pelo lado esquerdo.'],
    'R-31': ['Pedestre, ande pela direita', 'O pedestre deve andar pelo lado direito.'],
    'R-32': ['Circulação exclusiva de ônibus', 'Só ônibus podem circular nessa via ou faixa.'],
    'R-33': ['Sentido circular na rotatória', 'Circule no sentido indicado (anti-horário) e dê a preferência a quem já está na rotatória.'],
    'R-34': ['Circulação exclusiva de bicicletas', 'Só bicicletas podem circular ali.'],
    'R-37': ['Proibido trânsito de motocicletas, motonetas e ciclomotores', 'Motos, motonetas e ciclomotores não podem entrar.'],
    'R-38': ['Proibido trânsito de ônibus', 'Ônibus não podem entrar nessa via.'],
    'R-39': ['Circulação exclusiva de caminhão', 'Só caminhões podem circular ali; carros não entram.'],

    'A-1a': ['Curva acentuada à esquerda', 'Curva fechada à esquerda: reduza bem a velocidade antes dela e mantenha-se na faixa.'],
    'A-1b': ['Curva acentuada à direita', 'Curva fechada à direita: reduza bem a velocidade antes dela e mantenha-se na faixa.'],
    'A-2a': ['Curva à esquerda', 'Curva suave à esquerda: diminua um pouco a velocidade e fique na sua faixa.'],
    'A-2b': ['Curva à direita', 'Curva suave à direita: diminua um pouco a velocidade e fique na sua faixa.'],
    'A-3a': ['Pista sinuosa à esquerda', 'Várias curvas seguidas, a primeira à esquerda: reduza e não ultrapasse.'],
    'A-4b': ['Curva acentuada em “S” à direita', 'Duas curvas fechadas seguidas, a primeira à direita: reduza bem antes de entrar.'],
    'A-5a': ['Curva em “S” à esquerda', 'Duas curvas seguidas, a primeira à esquerda: reduza e mantenha a faixa.'],
    'A-6': ['Cruzamento de vias', 'Cruzamento adiante: reduza e olhe para os dois lados.'],
    'A-7a': ['Via lateral à esquerda', 'Uma via entra pela esquerda: cuidado com quem entra e não ultrapasse ali.'],
    'A-8': ['Interseção em “T”', 'A via termina adiante: prepare-se para virar à direita ou à esquerda.'],
    'A-9': ['Bifurcação em “Y”', 'A via se divide em duas: escolha o lado com antecedência.'],
    'A-11a': ['Junções sucessivas contrárias, primeira à esquerda', 'Duas vias laterais próximas, a primeira à esquerda: atenção a quem entra ou cruza.'],
    'A-12': ['Interseção em círculo', 'Rotatória adiante: reduza e dê a preferência a quem já circula nela.'],
    'A-14': ['Semáforo à frente', 'Há um semáforo adiante: reduza e fique atento à cor do sinal.'],
    'A-15': ['Parada obrigatória à frente', 'Haverá um PARE adiante: reduza e prepare-se para parar.'],
    'A-17': ['Pista irregular', 'Pavimento com buracos ou ondulações: reduza a velocidade.'],
    'A-18': ['Saliência ou lombada', 'Lombada adiante: reduza para passar com segurança.'],
    'A-19': ['Depressão', 'Rebaixamento na pista adiante: reduza para evitar solavanco e perda de controle.'],
    'A-20a': ['Declive acentuado', 'Descida forte adiante: reduza e use o freio-motor (marcha reduzida).'],
    'A-20b': ['Aclive acentuado', 'Subida forte adiante: reduza a marcha antes de subir para não perder força.'],
    'A-31': ['Trânsito de tratores ou maquinaria agrícola', 'Tratores e máquinas lentas podem estar na pista: reduza e redobre a atenção.'],
    'A-32a': ['Trânsito de pedestres', 'Pedestres circulam ou atravessam ali: reduza e esteja pronto para parar.'],
    'A-35': ['Animais', 'Animais de grande porte podem atravessar: reduza e fique atento.'],
    'A-39': ['Passagem de nível sem barreira', 'Linha de trem sem cancela: reduza, olhe para os dois lados e só atravesse com os trilhos livres.'],
    'A-40': ['Passagem de nível com barreira', 'Linha de trem com cancela: reduza e pare se a cancela estiver baixada ou descendo.'],
    'A-41': ['Cruz de Santo André', 'Marca o ponto em que a via cruza a linha de trem: pare se vier trem.'],
    'A-42a': ['Início de pista dupla', 'A via passa a ter duas pistas separadas por canteiro: fique na pista do seu sentido.'],
    'A-42b': ['Fim de pista dupla', 'A via volta a ter mão dupla sem separação: atenção a quem vem de frente.'],
    'A-42c': ['Pista dividida', 'A pista ganha uma separação física entre fluxos do mesmo sentido: escolha o lado com antecedência.'],
    'A-45': ['Rua sem saída', 'A via não tem saída: só entre se for o seu destino.']
  };

  const TIPOS = {
    R: { id: 'reg', nome: 'Regulamentação', classe: 'reg', resumo: 'Obrigação ou proibição — desrespeitar é infração.' },
    A: { id: 'adv', nome: 'Advertência', classe: 'adv', resumo: 'Alerta de perigo ou mudança adiante.' }
  };
  const tipoDe = (cod) => TIPOS[cod.charAt(0)] || { id: 'outra', nome: 'Placa', classe: '', resumo: '' };

  // Para outros módulos (voz, explorador) — nome oficial de uma placa.
  SIM.nomePlaca = (cod) => (DADOS[cod] ? DADOS[cod][0] : null);

  // ---------- cartões (só placas com figura no banco) ----------

  const porCodigo = {};
  SIM.banco.forEach((q) => {
    if (!q.p || !q.g) return;
    (porCodigo[q.p] = porCodigo[q.p] || []).push(q);
  });
  const CODIGOS = Object.keys(porCodigo).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { numeric: true }));

  const figura = (cod) => (window.PLACAS && window.PLACAS[cod]) || ('placas/' + cod + '.svg');

  // ---------- repetição espaçada ----------

  const MIN = 60 * 1000, DIA = 24 * 60 * MIN;
  const INTERVALO = { 1: 10 * MIN, 2: DIA, 3: 3 * DIA, 4: 7 * DIA };
  const TAM_RODADA = 20;
  const MAX_REPETE = 2; // "não sabia" volta no máximo 2 vezes na mesma rodada

  // Nunca guarde isto numa variável: SIM.importar troca o objeto progresso inteiro.
  function estado() { return (SIM.progresso.placas = SIM.progresso.placas || {}); }
  function regPlaca(cod) { return estado()[cod] || null; }

  function avaliar(cod, sabia) {
    const est = estado();
    const r = est[cod] || (est[cod] = { cx: 0, pr: 0, n: 0, ok: 0 });
    r.n++;
    if (sabia) {
      r.ok++;
      r.cx = r.cx === 0 ? 3 : Math.min(r.cx + 1, 4);
    } else {
      r.cx = 1;
    }
    r.pr = Date.now() + INTERVALO[r.cx];
    SIM.salvar();
  }

  const vencida = (cod, agora) => { const r = regPlaca(cod); return !!(r && r.n && r.pr <= agora); };

  function filtroAtual() { return SIM.config('placasFiltro', 'todas'); }
  function noFiltro(cod) {
    const f = filtroAtual();
    return f === 'todas' || tipoDe(cod).id === f;
  }

  function contagem() {
    const agora = Date.now();
    return {
      total: CODIGOS.length,
      revisar: CODIGOS.filter((c) => vencida(c, agora)).length,
      novas: CODIGOS.filter((c) => !regPlaca(c) || !regPlaca(c).n).length
    };
  }

  // Rodada: vencidas primeiro (as mais atrasadas antes), depois nunca vistas,
  // e se ainda sobrar espaço, adianta as que vencem logo.
  function montarFila() {
    const agora = Date.now();
    const lista = CODIGOS.filter(noFiltro);
    const venc = lista.filter((c) => vencida(c, agora)).sort((a, b) => regPlaca(a).pr - regPlaca(b).pr);
    const novas = SIM.embaralhar(lista.filter((c) => !regPlaca(c) || !regPlaca(c).n));
    const resto = lista.filter((c) => venc.indexOf(c) < 0 && novas.indexOf(c) < 0)
      .sort((a, b) => regPlaca(a).pr - regPlaca(b).pr);
    return venc.concat(novas, resto).slice(0, TAM_RODADA);
  }

  // ---------- tela ----------

  const sec = criar('section', 'tela placas-tela');
  sec.id = 'tela-placas';
  sec.hidden = true;
  el('app').appendChild(sec);

  let rodada = null; // { fila, i, virado, primeira: {cod: bool}, repete: {cod: n}, fim }

  function novaRodada() {
    const fila = montarFila();
    rodada = { fila, i: 0, virado: false, primeira: {}, repete: {}, fim: !fila.length, total: fila.length };
    pintar();
  }

  function botao(texto, classe, fn) {
    const b = criar('button', 'btn ' + (classe || ''), texto);
    b.type = 'button';
    b.dataset.nav = '';
    b.addEventListener('click', (ev) => {
      fn(ev);
      // Clique de mouse/toque não deixa foco preso (senão Espaço clicaria de novo).
      if (ev.detail && document.activeElement && document.activeElement.blur) document.activeElement.blur();
    });
    return b;
  }

  function pintarCabecalho() {
    const cab = criar('header', 'pagina-cab placas-cab');
    cab.appendChild(criar('h1', 'pagina-titulo', 'Flashcards de placas'));
    const c = contagem();
    cab.appendChild(criar('p', 'muted', br(c.total) + ' placas que caem no banco · ' + br(c.revisar) +
      ' para revisar hoje · ' + br(c.novas) + ' nunca vistas'));

    const filtros = criar('div', 'placas-filtros');
    filtros.setAttribute('role', 'group');
    filtros.setAttribute('aria-label', 'Tipo de placa');
    [['todas', 'Todas'], ['reg', 'Regulamentação'], ['adv', 'Advertência']].forEach(([id, rot]) => {
      const n = id === 'todas' ? CODIGOS.length : CODIGOS.filter((x) => tipoDe(x).id === id).length;
      const b = botao(rot + ' · ' + n, 'vazio placas-filtro' + (filtroAtual() === id ? ' ativo' : ''), () => {
        if (filtroAtual() === id) return;
        SIM.definirConfig('placasFiltro', id);
        novaRodada();
      });
      b.setAttribute('aria-pressed', filtroAtual() === id ? 'true' : 'false');
      filtros.appendChild(b);
    });
    cab.appendChild(filtros);
    return cab;
  }

  function pintar() {
    sec.textContent = '';
    sec.appendChild(pintarCabecalho());
    if (rodada.fim) pintarFim(); else pintarCartao();
  }

  function pintarCartao() {
    const cod = rodada.fila[rodada.i];
    const d = DADOS[cod];
    const tipo = tipoDe(cod);
    const qs = porCodigo[cod] || [];

    const prog = criar('p', 'placas-prog dado', 'Cartão ' + (rodada.i + 1) + ' de ' + rodada.fila.length +
      (rodada.repete[cod] ? ' · de novo' : ''));
    sec.appendChild(prog);

    // Virada recém-pedida: pinta de frente e gira depois, para a transição acontecer.
    const animar = rodada.animar;
    rodada.animar = false;
    const cartao = criar('div', 'placas-cartao' + (rodada.virado && !animar ? ' virado' : ''));
    cartao.setAttribute('role', 'button');
    cartao.tabIndex = 0;
    cartao.setAttribute('aria-label', rodada.virado ? 'Cartão virado' : 'Virar o cartão');
    cartao.addEventListener('click', (ev) => {
      if (ev.target.closest('button')) return;
      if (!rodada.virado) virar();
    });
    const interno = criar('div', 'placas-interno');

    // Frente: só a figura.
    const frente = criar('div', 'placas-face placas-frente');
    frente.setAttribute('aria-hidden', rodada.virado ? 'true' : 'false');
    const img = criar('img', 'placas-img');
    img.src = figura(cod);
    img.alt = 'Placa a identificar';
    img.width = 180; img.height = 180;
    frente.appendChild(img);
    frente.appendChild(criar('p', 'placas-pergunta', 'Que placa é esta? O que você deve fazer?'));
    frente.appendChild(criar('p', 'muted placas-dica', 'Toque no cartão ou aperte ' + SIM.teclaDe('confirmar') + ' para virar'));
    interno.appendChild(frente);

    // Verso: código, nome, tipo, explicação, questões.
    const verso = criar('div', 'placas-face placas-verso');
    verso.setAttribute('aria-hidden', rodada.virado ? 'false' : 'true');
    const topo = criar('div', 'placas-verso-topo');
    const mini = criar('img', 'placas-mini');
    mini.src = figura(cod); mini.alt = ''; mini.width = 64; mini.height = 64;
    topo.appendChild(mini);
    const ident = criar('div');
    const linha = criar('div', 'placas-etiquetas');
    linha.appendChild(criar('span', 'chip placa', cod));
    linha.appendChild(criar('span', 'chip placas-tipo ' + tipo.classe, tipo.nome));
    ident.appendChild(linha);
    ident.appendChild(criar('h2', 'placas-nome', d ? d[0] : 'Placa ' + cod));
    topo.appendChild(ident);
    verso.appendChild(topo);
    if (d) verso.appendChild(criar('p', 'placas-explica', d[1]));
    if (tipo.resumo) verso.appendChild(criar('p', 'muted placas-tipo-resumo', tipo.nome + ': ' + tipo.resumo));
    const cai = criar('div', 'placas-cai');
    cai.appendChild(criar('span', null, 'Cai em ' + qs.length + (qs.length === 1 ? ' questão' : ' questões')));
    const treinar = botao('Treinar ' + (qs.length === 1 ? 'essa questão' : 'essas ' + qs.length), 'vazio placas-treinar', () => treinarPlaca(cod));
    if (!rodada.virado) { treinar.tabIndex = -1; treinar.disabled = true; }
    cai.appendChild(treinar);
    verso.appendChild(cai);
    interno.appendChild(verso);

    cartao.appendChild(interno);
    sec.appendChild(cartao);
    if (animar) { void cartao.offsetWidth; cartao.classList.add('virado'); }

    const acoes = criar('div', 'acoes placas-acoes');
    if (!rodada.virado) {
      acoes.appendChild(botao('Virar (' + SIM.teclaDe('confirmar') + ')', 'largo placas-virar', virar));
    } else {
      const nao = botao('', 'placas-nao', () => responder(false));
      nao.appendChild(criar('span', null, 'Não sabia'));
      nao.appendChild(criar('kbd', null, SIM.teclaDe('anterior') + ' / ' + SIM.teclaDe('altA')));
      const sim = botao('', 'placas-sim', () => responder(true));
      sim.appendChild(criar('span', null, 'Sabia'));
      sim.appendChild(criar('kbd', null, SIM.teclaDe('proxima') + ' / ' + SIM.teclaDe('altB')));
      acoes.appendChild(nao);
      acoes.appendChild(sim);
    }
    sec.appendChild(acoes);

    const rodape = criar('div', 'acoes placas-rodape');
    rodape.appendChild(botao('Sair (' + SIM.teclaDe('sair') + ')', 'vazio', () => SIM.irInicio()));
    sec.appendChild(rodape);
  }

  function virar() {
    if (!rodada || rodada.fim || rodada.virado) return;
    rodada.virado = true;
    rodada.animar = true;
    pintar();
  }

  function responder(sabia) {
    if (!rodada || rodada.fim || !rodada.virado) return;
    const cod = rodada.fila[rodada.i];
    avaliar(cod, sabia);
    if (!(cod in rodada.primeira)) rodada.primeira[cod] = sabia;
    if (!sabia && (rodada.repete[cod] || 0) < MAX_REPETE) {
      // Volta nesta rodada, alguns cartões depois (ou no fim, se a fila acabar antes).
      rodada.repete[cod] = (rodada.repete[cod] || 0) + 1;
      const pos = Math.min(rodada.i + 4, rodada.fila.length);
      rodada.fila.splice(pos, 0, cod);
    }
    SIM.contar('placasVistas');
    rodada.i++;
    rodada.virado = false;
    if (rodada.i >= rodada.fila.length) {
      rodada.fim = true;
      SIM.contar('placasRodadas');
      SIM.emit('placas-rodada', { primeira: rodada.primeira });
    }
    pintar();
  }

  function pintarFim() {
    const cods = Object.keys(rodada.primeira);
    const sab = cods.filter((c) => rodada.primeira[c]);
    const nao = cods.filter((c) => !rodada.primeira[c]);
    const caixa = criar('div', 'placas-fim');
    if (!cods.length) {
      caixa.appendChild(criar('div', 'vazio-aviso', 'Nenhuma placa neste filtro.'));
    } else {
      caixa.appendChild(criar('h2', 'veredito', 'Rodada concluída'));
      const q = criar('div', 'quebra');
      const d1 = criar('div'); d1.appendChild(criar('b', 'placas-ok', String(sab.length))); d1.appendChild(criar('span', null, 'sabia de primeira'));
      const d2 = criar('div'); d2.appendChild(criar('b', 'placas-erro', String(nao.length))); d2.appendChild(criar('span', null, 'não sabia — voltam em 10 minutos'));
      q.appendChild(d1); q.appendChild(d2);
      caixa.appendChild(q);
      if (nao.length) {
        caixa.appendChild(criar('h3', 'rotulo placas-fim-rotulo', 'Para reforçar'));
        const lista = criar('ul', 'placas-lista');
        nao.forEach((c) => {
          const li = criar('li');
          const im = criar('img'); im.src = figura(c); im.alt = ''; im.width = 40; im.height = 40;
          li.appendChild(im);
          li.appendChild(criar('b', 'dado', c));
          li.appendChild(criar('span', null, DADOS[c] ? DADOS[c][0] : ''));
          lista.appendChild(li);
        });
        caixa.appendChild(lista);
      }
    }
    sec.appendChild(caixa);
    const acoes = criar('div', 'acoes');
    acoes.appendChild(botao('Outra rodada (' + SIM.teclaDe('confirmar') + ')', 'largo', novaRodada));
    acoes.appendChild(botao('Voltar ao início', 'vazio', () => SIM.irInicio()));
    sec.appendChild(acoes);
  }

  function treinarPlaca(cod) {
    const qs = porCodigo[cod] || [];
    const abrir = () => SIM.iniciarSessao({
      modo: 'treino', titulo: 'Placa ' + cod, questoes: qs, revelar: true, refazer: abrir
    });
    abrir();
  }

  // Enter/Espaço: se o cursor de teclado está num botão da tela, clica nele;
  // senão vira o cartão (ou começa outra rodada no fim).
  function confirmar() {
    const a = document.activeElement;
    if (a && a !== document.body && sec.contains(a) && a.matches('button[data-nav]') && !a.disabled) {
      a.click();
      return;
    }
    if (rodada.fim) novaRodada(); else virar();
  }

  SIM.registrarTela('placas', {
    elemento: sec,
    aoMostrar: () => { if (!rodada || rodada.fim) novaRodada(); else pintar(); },
    voltar: () => SIM.irInicio(),
    atalhos: {
      confirmar,
      anterior: () => responder(false),
      altA: () => responder(false),
      proxima: () => responder(true),
      altB: () => responder(true),
      sair: () => SIM.irInicio()
    }
  });

  SIM.on('importado', () => { rodada = null; });

  // ---------- entrada ----------

  function iniciar() { rodada = null; SIM.mostrar('placas'); }

  SIM.registrarAcao({ id: 'modoPlacas', grupo: 'menus', rotulo: 'Flashcards de placas', padrao: ['p'] });
  SIM.registrarGlobal('modoPlacas', () => {
    const n = SIM.telaAtual().nome;
    if (n !== 'inicio' && n !== 'resultado') return false;
    iniciar();
  });

  SIM.adicionarModo({
    id: 'placas', ordem: 35, cor: 'var(--amarelo)', tecla: 'modoPlacas', icone: '🛑',
    titulo: 'Flashcards de placas',
    texto: () => br(contagem().total) + ' placas com o nome oficial. Vê a figura, pensa e vira o cartão.',
    badge: () => {
      const c = contagem();
      return c.revisar ? { texto: br(c.revisar) + ' para hoje', alerta: true } : null;
    },
    disponivel: () => CODIGOS.length > 0,
    iniciar
  });
})();
