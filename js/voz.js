// Módulo voz: lê a questão em voz alta (botão 🔊 / tecla V) e o modo "Ouvir"
// (mãos livres, como podcast). Usa o speechSynthesis do navegador em pt-BR.
//
// Cuidados com o speechSynthesis (sobretudo no Chrome):
// - fala longa corta depois de ~15 s → o texto vai em frases curtas, uma por vez;
// - getVoices() vem vazio até 'voiceschanged' → a voz é escolhida na hora de falar;
// - onend às vezes não chega → cada frase tem um vigia de tempo;
// - pause()/resume() não são confiáveis → "pausar" = cancelar e lembrar onde parou.
(function () {
  'use strict';

  const SIM = window.SIM;
  const { el, criar } = SIM;

  const sintese = ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) ? window.speechSynthesis : null;

  // ---------- vozes ----------

  let vozes = [];
  function carregarVozes() {
    try { vozes = sintese ? sintese.getVoices() || [] : []; } catch (e) { vozes = []; }
    SIM.emit('voz-vozes', { total: vozes.length });
  }
  if (sintese) {
    carregarVozes();
    try { sintese.addEventListener('voiceschanged', carregarVozes); } catch (e) { sintese.onvoiceschanged = carregarVozes; }
  }

  const langDe = (v) => String(v.lang || '').replace('_', '-').toLowerCase();

  // Prefere pt-BR do sistema (offline); depois pt-BR de rede; depois qualquer português.
  function escolherVoz() {
    if (!vozes.length) carregarVozes();
    const br = vozes.filter((v) => langDe(v) === 'pt-br');
    const pt = vozes.filter((v) => langDe(v).indexOf('pt') === 0);
    const melhor = (l) => l.filter((v) => v.localService)[0] || l[0] || null;
    return melhor(br) || melhor(pt) || null;
  }

  // 'ok' | 'sem-pt' (há vozes, nenhuma em português) | 'sem-voz' (nenhuma voz) | 'sem-suporte'
  function situacaoVoz() {
    if (!sintese) return 'sem-suporte';
    if (!vozes.length) carregarVozes();
    if (!vozes.length) return 'sem-voz';
    return escolherVoz() ? 'ok' : 'sem-pt';
  }
  SIM.situacaoVoz = situacaoVoz;

  function avisoVoz() {
    switch (situacaoVoz()) {
      case 'sem-suporte': return 'Este navegador não fala. O texto aparece na tela no ritmo da leitura.';
      case 'sem-voz': return 'Nenhuma voz encontrada neste aparelho (ou ainda carregando). Se não ouvir nada, ' +
        'instale a voz “Português (Brasil)” nas configurações de fala do sistema.';
      case 'sem-pt': return 'Não há voz em português neste aparelho: vai sair com sotaque estranho. Instale a voz ' +
        '“Português (Brasil)” nas configurações de fala do sistema.';
      default: return '';
    }
  }

  // ---------- texto falado ----------

  const SIGLAS = { CTB: 'cê tê bê', CNH: 'cê ene agá', CRLV: 'cê erre éle vê', CRV: 'cê erre vê',
    ABS: 'a bê ésse', EPI: 'é pê í', SAMU: 'Samu', PRF: 'pê erre éfe', ACC: 'a cê cê', IPVA: 'í pê vê a',
    DPVAT: 'dê pê vat', GNV: 'gê ene vê', RCP: 'erre cê pê', AVC: 'a vê cê', BNQ: 'bê ene quê' };

  function expandir(t) {
    return String(t)
      .replace(/km\s*\/\s*h/gi, ' quilômetros por hora')
      .replace(/(\d)\s*km\b/gi, '$1 quilômetros')
      .replace(/\bkm\b/gi, 'quilômetros')
      .replace(/(\d)\s*kg\b/gi, '$1 quilos')
      .replace(/(\d)\s*m\b(?![²³])/g, '$1 metros')
      .replace(/(\d)\s*t\b/g, '$1 toneladas')
      .replace(/(\d{1,2})\s*h\s*(\d{2})\b/g, '$1 horas e $2')
      .replace(/(\d{1,2})\s*h\b/g, '$1 horas')
      .replace(/\bn[º°o]\.?\s*(?=\d)/gi, 'número ')
      .replace(/\bart\.\s*/gi, 'artigo ')
      .replace(/\binc\.\s*/gi, 'inciso ')
      .replace(/§\s*/g, 'parágrafo ')
      .replace(/\bex\.:?\s*/gi, 'por exemplo, ')
      .replace(/\betc\./gi, 'etcétera.')
      .replace(/\bCONTRAN\b/g, 'Contran').replace(/\bDETRAN\b/g, 'Detran').replace(/\bDENATRAN\b/g, 'Denatran')
      .replace(/\bSENATRAN\b/g, 'Senatran').replace(/\bJARI\b/g, 'Jari')
      .replace(/\b[A-Z]{2,5}\b/g, (s) => SIGLAS[s] || s)
      .replace(/\b([RA])-(\d+)([a-e]?)\b/g, (m, l, n, x) => l + ' ' + n + (x ? ' ' + x : ''))
      .replace(/[“”"]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  SIM.textoFalado = expandir;

  // Quebra em frases curtas (o Chrome corta falas longas).
  function frases(t) {
    const cruas = String(t).split(/(?<=[.!?;:])\s+/).filter(Boolean);
    // Pedaço curto ("A:", "Questão 3.") vai junto com o seguinte.
    const partes = [];
    cruas.forEach((p) => {
      const ant = partes[partes.length - 1];
      if (ant != null && ant.length < 14) partes[partes.length - 1] = ant + ' ' + p;
      else partes.push(p);
    });
    const out = [];
    partes.forEach((p) => {
      while (p.length > 180) {
        let corte = p.lastIndexOf(', ', 180);
        if (corte < 60) corte = p.lastIndexOf(' ', 180);
        if (corte < 1) corte = 180;
        out.push(p.slice(0, corte + 1).trim());
        p = p.slice(corte + 1).trim();
      }
      if (p) out.push(p);
    });
    return out;
  }

  // ---------- fala ----------
  //
  // falar(trechos, { aoTrecho(i), aoFim() }) — cada trecho é uma string (que pode
  // virar várias frases). Uma nova fala, ou parar(), invalida a anterior.

  let geracao = 0;
  let vigia = null;
  let falandoAgora = false;

  function velocidade() { return Number(SIM.config('vozVelocidade', 1)) || 1; }

  // Tempo estimado de leitura, para o vigia e para o modo sem voz.
  function estimativa(texto) { return Math.max(900, texto.length * 62 / velocidade()); }

  function parar() {
    geracao++;
    clearTimeout(vigia);
    if (sintese) { try { sintese.cancel(); } catch (e) { /* nada */ } }
    if (falandoAgora) { falandoAgora = false; SIM.emit('voz-estado', { falando: false }); }
  }

  function falar(trechos, op) {
    op = op || {};
    parar();
    const g = geracao;
    const fila = [];
    trechos.forEach((t, i) => frases(expandir(t)).forEach((f) => fila.push({ f, i })));
    let k = 0;
    let ultimoTrecho = -1;
    falandoAgora = true;
    SIM.emit('voz-estado', { falando: true });
    const comVoz = situacaoVoz() !== 'sem-suporte';
    const voz = comVoz ? escolherVoz() : null;

    function seguinte() {
      if (g !== geracao) return;
      clearTimeout(vigia);
      if (k >= fila.length) {
        falandoAgora = false;
        SIM.emit('voz-estado', { falando: false });
        if (op.aoFim) op.aoFim();
        return;
      }
      const item = fila[k++];
      if (item.i !== ultimoTrecho) { ultimoTrecho = item.i; if (op.aoTrecho) op.aoTrecho(item.i); }
      let feito = false;
      const pronto = () => { if (feito) return; feito = true; seguinte(); };
      if (!comVoz) { vigia = setTimeout(pronto, estimativa(item.f)); return; }
      const u = new SpeechSynthesisUtterance(item.f);
      u.lang = 'pt-BR';
      if (voz) u.voice = voz;
      u.rate = velocidade();
      u.onend = pronto;
      u.onerror = (ev) => {
        if (g !== geracao) return;
        if (ev && (ev.error === 'interrupted' || ev.error === 'canceled')) return;
        pronto();
      };
      // Vigia: se o onend nunca vier (bug conhecido), segue mesmo assim.
      vigia = setTimeout(pronto, estimativa(item.f) * 2.2 + 2500);
      try {
        if (sintese.paused) sintese.resume();
        sintese.speak(u);
      } catch (e) { pronto(); }
    }
    seguinte();
  }

  SIM.voz = { falar, parar, frases, falando: () => falandoAgora };

  // Pare toda fala ao trocar de tela ou de questão.
  // (A tela Ouvir começa a falar no aoMostrar, que roda antes do evento 'tela'.)
  SIM.on('tela', (d) => { if (d.nome !== 'ouvir') parar(); });
  SIM.on('questao', parar);
  window.addEventListener('pagehide', parar);

  // ---------- (a) botão 🔊 na questão ----------

  function textoQuestao(sessao, item) {
    const q = item.q;
    const partes = [q.e];
    item.alternativas.forEach((a, i) => partes.push(SIM.LETRAS[i] + ': ' + a.texto));
    if (sessao.revelar && item.marcada != null) {
      const i = item.alternativas.findIndex((a) => a.certa);
      partes.push('Resposta certa: ' + SIM.LETRAS[i] + '. ' + item.alternativas[i].texto);
      if (q.k) partes.push('Por quê: ' + q.k);
    }
    return partes;
  }

  let btnVoz = null;
  function pintarBotao() {
    if (!btnVoz) return;
    const tecla = SIM.teclaDe('voz');
    btnVoz.textContent = '';
    btnVoz.appendChild(criar('span', null, falandoAgora ? '■' : '🔊'));
    btnVoz.appendChild(document.createTextNode(' ' + (falandoAgora ? 'Parar' : 'Ouvir') + (tecla ? ' (' + tecla + ')' : '')));
    btnVoz.setAttribute('aria-pressed', falandoAgora ? 'true' : 'false');
    btnVoz.classList.toggle('ativa', falandoAgora);
  }

  function alternarLeitura() {
    if (falandoAgora) { parar(); return; }
    const s = SIM.sessao && SIM.sessao();
    if (!s) return;
    const item = s.itens[s.indice];
    if (situacaoVoz() !== 'ok') SIM.aviso(avisoVoz(), { icone: '🔇', ms: 5000 });
    falar(textoQuestao(s, item));
  }

  function criarBotao() {
    const alvo = el('acoes-questao');
    if (!alvo || btnVoz) return;
    btnVoz = criar('button', 'btn vazio btn-voz');
    btnVoz.type = 'button';
    btnVoz.addEventListener('click', (ev) => {
      const s = SIM.sessao && SIM.sessao();
      if (s) s.usouPonteiro = true;
      alternarLeitura();
      if (ev.detail) btnVoz.blur();
    });
    const sair = el('btn-sair');
    if (sair && sair.parentNode === alvo) alvo.insertBefore(btnVoz, sair); else alvo.appendChild(btnVoz);
    pintarBotao();
  }
  SIM.registrarAcao({ id: 'voz', grupo: 'prova', rotulo: 'Ouvir a questão / parar', padrao: ['v'] });
  criarBotao();
  SIM.on('voz-estado', pintarBotao);
  SIM.on('config', pintarBotao);

  SIM.registrarGlobal('voz', () => {
    if (SIM.telaAtual().nome !== 'prova') return false;
    alternarLeitura();
  });

  // ---------- (b) modo Ouvir (mãos livres) ----------

  const sec = criar('section', 'tela ouvir-tela');
  sec.id = 'tela-ouvir';
  sec.hidden = true;
  el('app').appendChild(sec);

  const PAUSA_MIN = 2, PAUSA_MAX = 20, VEL_MIN = 0.8, VEL_MAX = 1.4;
  const pausaSeg = () => Number(SIM.config('vozPausa', 6)) || 6;

  // st: { fila, i, passo, passos, pausado, timer, fimEspera, contou }
  let st = null;
  let wake = null;

  function montarFila() {
    // Questões com figura de placa precisam da imagem: ficam de fora.
    const ok = (q) => !(q.p && q.g);
    const pend = SIM.pendentes().filter(ok).sort((a, b) => SIM.reg(a.i).pr - SIM.reg(b.i).pr);
    const ids = new Set(pend.map((q) => q.i));
    const resto = SIM.embaralhar(SIM.filtroInicio().filter((q) => ok(q) && !ids.has(q.i)));
    return pend.map((q) => ({ q, revisao: true })).concat(resto.map((q) => ({ q, revisao: false })));
  }

  // Cada questão vira uma sequência de passos: falas e esperas.
  function montarPassos(entrada) {
    const q = entrada.q;
    const alts = SIM.embaralhar([{ texto: q.c, certa: true }].concat(q.x.map((t) => ({ texto: t, certa: false }))));
    const iCerta = alts.findIndex((a) => a.certa);
    const p = [];
    p.push({ tipo: 'fala', parte: 'enunciado', texto: 'Questão ' + (st.i + 1) + '. ' + q.e, mostra: q.e });
    alts.forEach((a, i) => p.push({ tipo: 'fala', parte: 'alt', indice: i, texto: SIM.LETRAS[i] + ': ' + a.texto }));
    p.push({ tipo: 'espera', parte: 'pensar', ms: () => pausaSeg() * 1000 });
    p.push({ tipo: 'fala', parte: 'resposta', texto: 'Resposta certa: ' + SIM.LETRAS[iCerta] + '. ' + alts[iCerta].texto });
    if (q.k) p.push({ tipo: 'fala', parte: 'comentario', texto: 'Por quê: ' + q.k });
    p.push({ tipo: 'espera', parte: 'intervalo', ms: () => 1500 });
    return { alts, iCerta, passos: p };
  }

  function limparTimers() {
    if (!st) return;
    clearTimeout(st.timer); clearInterval(st.tique);
    st.timer = null; st.tique = null;
  }

  function carregarQuestao(i) {
    limparTimers();
    parar();
    st.i = i;
    st.passo = 0;
    st.contou = false;
    if (i >= st.fila.length) { st.fim = true; pintarOuvir(); return; }
    st.fim = false;
    const m = montarPassos(st.fila[i]);
    st.alts = m.alts; st.iCerta = m.iCerta; st.passos = m.passos;
    pintarOuvir();
    if (!st.pausado) executar();
  }

  function executar() {
    if (!st || st.pausado || st.fim) return;
    if (st.passo >= st.passos.length) { carregarQuestao(st.i + 1); return; }
    const p = st.passos[st.passo];
    if (p.parte === 'resposta' && !st.contou) { st.contou = true; SIM.contar('questoesOuvidas'); }
    pintarDestaque();
    if (p.tipo === 'fala') {
      falar([p.texto], { aoFim: () => { st.passo++; executar(); } });
    } else {
      const ms = p.ms();
      st.fimEspera = Date.now() + ms;
      pintarContagem();
      st.tique = setInterval(pintarContagem, 250);
      st.timer = setTimeout(() => { clearInterval(st.tique); st.passo++; executar(); }, ms);
    }
  }

  function alternarPausa() {
    if (!st) return;
    if (st.fim) { st = novoEstado(); carregarQuestao(0); return; }
    st.pausado = !st.pausado;
    if (st.pausado) { limparTimers(); parar(); pintarOuvir(); }
    else { pintarOuvir(); executar(); } // retoma do início do passo atual
  }
  function proxima() { if (st && !st.fim) carregarQuestao(st.i + 1); }
  function repetir() {
    if (!st) return;
    if (st.fim) { carregarQuestao(Math.max(0, st.fila.length - 1)); return; }
    carregarQuestao(st.i);
  }

  function novoEstado() { return { fila: montarFila(), i: 0, passo: 0, pausado: false, fim: false }; }

  function iniciarOuvir() {
    SIM.mostrar('ouvir');
  }

  function aoMostrarOuvir() {
    st = novoEstado();
    pedirTelaLigada();
    if (!st.fila.length) { st.fim = true; st.vazio = true; pintarOuvir(); return; }
    carregarQuestao(0);
  }

  function sairOuvir() {
    limparTimers();
    parar();
    soltarTela();
    st = null;
    SIM.irInicio();
  }

  SIM.on('tela', (d) => {
    if (d.nome !== 'ouvir' && st) { limparTimers(); soltarTela(); st = null; }
  });

  // Mantém a tela acesa enquanto ouve (quando o navegador permite).
  function pedirTelaLigada() {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request('screen').then((w) => { wake = w; }).catch(() => { /* sem permissão */ });
      }
    } catch (e) { /* nada */ }
  }
  function soltarTela() { try { if (wake) wake.release(); } catch (e) { /* nada */ } wake = null; }

  // ---------- desenho da tela Ouvir ----------

  function botao(rotulo, classe, fn, tecla) {
    const b = criar('button', 'btn ' + (classe || ''));
    b.type = 'button';
    b.dataset.nav = '';
    b.appendChild(criar('span', 'ouvir-rot', rotulo));
    if (tecla) b.appendChild(criar('kbd', null, tecla));
    b.addEventListener('click', (ev) => {
      fn();
      if (ev.detail && document.activeElement && document.activeElement.blur) document.activeElement.blur();
    });
    return b;
  }

  function ajuste(rotulo, valor, menos, mais, desc) {
    const d = criar('div', 'ouvir-ajuste');
    d.appendChild(criar('span', 'rotulo', rotulo));
    const linha = criar('div', 'ouvir-ajuste-linha');
    const bm = botao('−', 'vazio ouvir-mm', menos); bm.setAttribute('aria-label', 'Diminuir ' + desc);
    const bp = botao('+', 'vazio ouvir-mm', mais); bp.setAttribute('aria-label', 'Aumentar ' + desc);
    const v = criar('b', 'dado ouvir-valor', valor);
    v.setAttribute('aria-live', 'polite');
    linha.appendChild(bm); linha.appendChild(v); linha.appendChild(bp);
    d.appendChild(linha);
    return d;
  }

  function mudarPausa(delta) {
    const n = Math.min(PAUSA_MAX, Math.max(PAUSA_MIN, pausaSeg() + delta));
    SIM.definirConfig('vozPausa', n);
    // Se estiver no meio da espera, ajusta o tempo que falta.
    if (st && !st.pausado && st.passos && st.passos[st.passo] && st.passos[st.passo].parte === 'pensar' && st.timer) {
      clearTimeout(st.timer);
      st.fimEspera += delta * 1000;
      const resta = Math.max(0, st.fimEspera - Date.now());
      st.timer = setTimeout(() => { clearInterval(st.tique); st.passo++; executar(); }, resta);
    }
    pintarOuvir();
  }
  function mudarVel(delta) {
    const v = Math.round(Math.min(VEL_MAX, Math.max(VEL_MIN, velocidade() + delta)) * 10) / 10;
    SIM.definirConfig('vozVelocidade', v);
    pintarOuvir();
  }

  const fmtVel = (v) => v.toFixed(1).replace('.', ',') + '×';

  function pintarOuvir() {
    if (!st) return;
    sec.textContent = '';
    const cab = criar('header', 'pagina-cab');
    cab.appendChild(criar('h1', 'pagina-titulo', 'Ouvir'));
    const pend = st.fila.filter((x) => x.revisao).length;
    cab.appendChild(criar('p', 'muted', st.fila.length
      ? st.fila.length + ' questões na fila' + (pend ? ' (' + pend + ' da revisão primeiro)' : '') +
        '. Questões com figura de placa ficam de fora. Ouvir não conta como resposta.'
      : ''));
    sec.appendChild(cab);

    const aviso = avisoVoz();
    if (aviso) sec.appendChild(criar('div', 'vazio-aviso ouvir-aviso', aviso));

    const palco = criar('div', 'ouvir-palco');
    if (st.vazio) {
      palco.appendChild(criar('p', 'ouvir-status', 'Nada para ouvir com os filtros atuais da tela inicial.'));
    } else if (st.fim) {
      palco.appendChild(criar('p', 'ouvir-status', 'Fim da fila — ' + st.fila.length + ' questões ouvidas.'));
    } else {
      const e = st.fila[st.i];
      const q = e.q;
      const topo = criar('div', 'ouvir-topo');
      topo.appendChild(criar('span', 'dado', 'Questão ' + (st.i + 1) + ' de ' + st.fila.length));
      if (e.revisao) topo.appendChild(criar('span', 'chip', 'Revisão'));
      topo.appendChild(criar('span', 'chip', 'Módulo ' + q.m));
      palco.appendChild(topo);
      const status = criar('p', 'ouvir-status');
      status.id = 'ouvir-status';
      palco.appendChild(status);
      const en = criar('p', 'ouvir-enunciado');
      en.dataset.parte = 'enunciado';
      SIM.escreverTexto(en, q.e);
      palco.appendChild(en);
      const lista = criar('ol', 'ouvir-alts');
      st.alts.forEach((a, i) => {
        const li = criar('li');
        li.dataset.parte = 'alt' + i;
        li.appendChild(criar('span', 'ouvir-letra', SIM.LETRAS[i]));
        const t = criar('span'); SIM.escreverTexto(t, a.texto); li.appendChild(t);
        lista.appendChild(li);
      });
      palco.appendChild(lista);
      const resp = criar('div', 'ouvir-resposta');
      resp.id = 'ouvir-resposta';
      resp.hidden = true;
      const r1 = criar('p', null);
      r1.dataset.parte = 'resposta';
      r1.appendChild(criar('span', 'rotulo', 'Resposta certa · ' + SIM.LETRAS[st.iCerta]));
      const rt = criar('span', 'ouvir-certa'); SIM.escreverTexto(rt, st.alts[st.iCerta].texto); r1.appendChild(rt);
      resp.appendChild(r1);
      if (q.k) {
        const r2 = criar('p', 'ouvir-porque');
        r2.dataset.parte = 'comentario';
        SIM.escreverTexto(r2, q.k);
        resp.appendChild(r2);
      }
      palco.appendChild(resp);
    }
    sec.appendChild(palco);

    const ctr = criar('div', 'ouvir-controles');
    ctr.appendChild(botao('↺ Repetir', 'vazio', repetir, SIM.teclaDe('anterior')));
    ctr.appendChild(botao(st.fim ? '▶ Recomeçar' : (st.pausado ? '▶ Continuar' : '⏸ Pausar'),
      'ouvir-principal', alternarPausa, SIM.teclaDe('confirmar')));
    ctr.appendChild(botao('Próxima ⏭', 'vazio', proxima, SIM.teclaDe('proxima')));
    sec.appendChild(ctr);

    const aj = criar('div', 'ouvir-ajustes');
    aj.appendChild(ajuste('Tempo para pensar', pausaSeg() + ' s', () => mudarPausa(-1), () => mudarPausa(1), 'o tempo para pensar'));
    aj.appendChild(ajuste('Velocidade da fala', fmtVel(velocidade()), () => mudarVel(-0.1), () => mudarVel(0.1), 'a velocidade'));
    sec.appendChild(aj);

    const rod = criar('div', 'acoes');
    rod.appendChild(botao('Sair', 'vazio', sairOuvir, SIM.teclaDe('sair')));
    sec.appendChild(rod);

    pintarDestaque();
  }

  function pintarDestaque() {
    if (!st || st.fim || !st.passos) return;
    const p = st.passos[st.passo] || {};
    const chave = p.parte === 'alt' ? 'alt' + p.indice : p.parte;
    Array.prototype.forEach.call(sec.querySelectorAll('[data-parte]'), (n) => {
      n.classList.toggle('lendo', n.dataset.parte === chave);
    });
    const depois = st.passos.findIndex((x) => x.parte === 'resposta');
    const resp = el('ouvir-resposta');
    if (resp) resp.hidden = st.passo < depois;
    const cert = sec.querySelector('[data-parte="alt' + st.iCerta + '"]');
    if (cert) cert.classList.toggle('certa', st.passo >= depois);
    const s = el('ouvir-status');
    if (!s) return;
    if (st.pausado) s.textContent = '⏸ Pausado';
    else if (p.parte === 'pensar') pintarContagem();
    else if (p.parte === 'resposta' || p.parte === 'comentario') s.textContent = '🔊 Resposta';
    else if (p.parte === 'intervalo') s.textContent = 'Próxima…';
    else s.textContent = '🔊 Lendo';
    const lendo = sec.querySelector('.lendo');
    if (lendo && lendo.scrollIntoView) lendo.scrollIntoView({ block: 'nearest' });
  }

  function pintarContagem() {
    const s = el('ouvir-status');
    if (!s || !st || st.pausado) return;
    const resta = Math.max(0, Math.ceil((st.fimEspera - Date.now()) / 1000));
    s.textContent = '🤔 Pense… ' + resta + ' s';
  }

  // Enter/Espaço: clica no botão com cursor de teclado; senão pausa/continua.
  function confirmarOuvir() {
    const a = document.activeElement;
    if (a && sec.contains(a) && a.matches('button[data-nav]') && !a.disabled) { a.click(); return; }
    alternarPausa();
  }

  SIM.registrarTela('ouvir', {
    elemento: sec,
    aoMostrar: aoMostrarOuvir,
    voltar: sairOuvir,
    atalhos: {
      confirmar: confirmarOuvir,
      proxima,
      anterior: repetir,
      sair: sairOuvir
    }
  });

  SIM.on('voz-vozes', () => { if (st && SIM.telaAtual().nome === 'ouvir') pintarOuvir(); });

  SIM.registrarAcao({ id: 'modoOuvir', grupo: 'menus', rotulo: 'Ouvir (mãos livres)', padrao: ['o'] });
  SIM.registrarGlobal('modoOuvir', () => {
    const n = SIM.telaAtual().nome;
    if (n !== 'inicio' && n !== 'resultado') return false;
    iniciarOuvir();
  });

  SIM.adicionarModo({
    id: 'ouvir', ordem: 60, cor: 'var(--verde)', tecla: 'modoOuvir',
    titulo: 'Ouvir (mãos livres)',
    texto: () => 'Estudar ouvindo, como podcast: lê a questão, espera você pensar e diz a resposta. ' +
      'Revisão pendente primeiro, depois os filtros abaixo.',
    iniciar: iniciarOuvir
  });

  SIM._vozDebug = () => ({ st: st && { i: st.i, passo: st.passo, parte: st.passos && st.passos[st.passo] && st.passos[st.passo].parte,
    pausado: st.pausado, fim: st.fim, fila: st.fila.length }, falando: falandoAgora, geracao, situacao: situacaoVoz(), vozes: vozes.length });
})();
