// Pacote do link "Enviar para outro aparelho": o progresso inteiro em poucos caracteres.
//
// Em vez de JSON + deflate, usa um codificador aritmético binário adaptativo (o mesmo
// princípio do LZMA): cada campo tem seu próprio modelo de probabilidade, que aprende
// enquanto codifica. Campos previsíveis (caixa de revisão, 🚩, a sessão que se repete)
// custam frações de bit. O resultado vai em base64url depois de "#p=".
//
// O que mais pesou, medido com 14 a 30 dias de estudo simulado:
//  - aprendizado por contagem (rápido nas primeiras ocorrências, como no AV1): -8%;
//  - a caixa de revisão vem primeiro e serve de contexto para acertos/erros e para a
//    sessão (quem está na caixa 1 errou há pouco): -15%;
//  - sessão = respostas com menos de 2 h entre si (até 3 h no total), não a hora cheia: -8%.
// Mistura logística de modelos (PAQ) foi testada e não ganhou nada aqui.
//
// Uma única função, esquema(), descreve a ordem dos campos e roda nos dois sentidos:
// codificando (c.enc = true, lê de "d") e decodificando (preenche "o").
//
// Não viajam: tentativas (= acertos + erros + dúvidas) e a próxima revisão (= última
// resposta + intervalo da caixa). Datas vão com precisão de 1 hora.
(function () {
  'use strict';

  const SIM = window.SIM;
  const HORA = 3600 * 1000;
  const VERSAO = 6;
  const MODOS = ['simulado', 'treino', 'revisao', 'chefao'];
  // Contadores conhecidos viram um índice de 3 bits; 7 = outro (vai o nome).
  const CONT = ['nivel', 'chefaoLiberado', 'glossarioConsultas', 'glossarioTermosDistintos',
    'placasRodadas', 'placasVistas', 'questoesOuvidas'];
  const MAX_HIST = 30, MAX_DIAS = 60;

  // ---------- codificador aritmético (probabilidades de 11 bits, adaptação rápida) ----------

  // Só + - * / e Math.round: o resultado é idêntico em qualquer navegador (Math.exp/log não).
  const PMAX = 65536, PMIN = 64, TOPO = 0x1000000, LIMITE = 30;
  // Probabilidade de o bit ser 0 (em 1/65536) e quantas vezes o contexto já foi visto.
  // Aprende como uma média (rápido no começo) até LIMITE observações; depois, média móvel.
  function aprende(m, i, b) {
    const n = m.n[i];
    const taxa = (n < LIMITE ? n : LIMITE) + 2;
    let p = m.p[i];
    p = b ? p - p / taxa : p + (PMAX - p) / taxa;
    m.p[i] = Math.min(PMAX - PMIN, Math.max(PMIN, Math.round(p)));
    if (n < 255) m.n[i] = n + 1;
  }

  function Codificador() {
    this.enc = true;
    this.low = 0; this.range = 0xFFFFFFFF; this.cache = 0; this.pend = 1; this.out = [];
  }
  Codificador.prototype.desloca = function () {
    if (this.low < 0xFF000000 || this.low >= 0x100000000) {
      const vai = this.low >= 0x100000000 ? 1 : 0;
      let t = this.cache;
      do { this.out.push((t + vai) & 0xFF); t = 0xFF; } while (--this.pend !== 0);
      this.cache = Math.floor(this.low / TOPO) & 0xFF;
    }
    this.pend++;
    this.low = (this.low % TOPO) * 256;
  };
  Codificador.prototype.bit = function (m, i, b) {
    b = b ? 1 : 0;
    const lim = (this.range >>> 16) * m.p[i];
    if (!b) this.range = lim;
    else { this.low += lim; this.range -= lim; }
    aprende(m, i, b);
    while (this.range < TOPO) { this.range = (this.range * 256) >>> 0; this.desloca(); }
    return b;
  };
  Codificador.prototype.fim = function () {
    for (let i = 0; i < 5; i++) this.desloca();
    // Zeros no fim não precisam ir: o decodificador lê zero além do fim.
    let n = this.out.length;
    while (n > 0 && this.out[n - 1] === 0) n--;
    return Uint8Array.from(this.out.slice(0, n));
  };

  function Decodificador(bytes) {
    this.enc = false;
    this.b = bytes; this.pos = 0; this.range = 0xFFFFFFFF; this.code = 0;
    for (let i = 0; i < 5; i++) this.code = ((this.code << 8) | this.prox()) >>> 0;
  }
  Decodificador.prototype.prox = function () { return this.pos < this.b.length ? this.b[this.pos++] : 0; };
  Decodificador.prototype.bit = function (m, i) {
    const lim = (this.range >>> 16) * m.p[i];
    let b;
    if (this.code < lim) { this.range = lim; b = 0; }
    else { this.code -= lim; this.range -= lim; b = 1; }
    aprende(m, i, b);
    while (this.range < TOPO) {
      this.range = (this.range * 256) >>> 0;
      this.code = ((this.code << 8) | this.prox()) >>> 0;
    }
    return b;
  };

  // ---------- primitivas (mesmo código para codificar e decodificar) ----------

  const modelo = (n) => ({ p: new Uint16Array(n).fill(PMAX >> 1), n: new Uint8Array(n) });

  // Inteiro de "nbits" bits por árvore binária (cada prefixo tem sua probabilidade).
  function arvore(c, m, nbits, v, base) {
    base = base || 0;
    let idx = 1, r = 0;
    for (let k = nbits - 1; k >= 0; k--) {
      const b = c.bit(m, base + idx, (v >> k) & 1);
      idx = (idx << 1) | b; r = (r << 1) | b;
    }
    return r;
  }

  // Inteiro >= 0 sem limite: Exp-Golomb adaptativo (quantos bits, em unário; depois os bits).
  const numModelo = () => ({ u: modelo(34), b: modelo(34 * 32) });
  function num(c, M, v) {
    const x = c.enc ? Math.max(0, Math.round(v)) + 1 : 0;
    const k = c.enc ? 31 - Math.clz32(x) : 0;
    let kk = 0;
    while (kk < 32 && c.bit(M.u, kk, kk < k)) kk++;
    let r = 1;
    for (let i = kk - 1; i >= 0; i--) r = r * 2 + c.bit(M.b, kk * 32 + i, Math.floor(x / Math.pow(2, i)) & 1);
    return r - 1;
  }
  const comSinal = (c, M, v) => {
    const z = num(c, M, c.enc ? (v >= 0 ? v * 2 : -v * 2 - 1) : 0);
    return z % 2 ? -(z + 1) / 2 : z / 2;
  };

  function texto(c, M, s) {
    const bytes = c.enc ? new TextEncoder().encode(String(s)) : null;
    const n = num(c, M.len, c.enc ? bytes.length : 0);
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = arvore(c, M.byte, 8, c.enc ? bytes[i] : 0);
    return c.enc ? s : new TextDecoder().decode(out);
  }

  // ---------- o esquema ----------

  function esquema(c, d) {
    const E = c.enc;
    const o = {};
    const M = {
      g: numModelo(),
      visto: modelo(4), cx: modelo(8), f: modelo(2), temU: modelo(2), sn: numModelo(), sd: numModelo(),
      eC: Array.from({ length: 8 }, numModelo), aC: Array.from({ length: 16 }, numModelo),
      adC: Array.from({ length: 8 }, numModelo),
      hn: numModelo(), hd: numModelo(), modo: modelo(4), ac: numModelo(), tot: numModelo(),
      dn: numModelo(), dd: numModelo(), dr: numModelo(), dv: numModelo(), dx: numModelo(),
      conq: modelo(2), cn: numModelo(), ck: modelo(8), cv: numModelo(),
      pl: modelo(4), pcx: modelo(8), pn: numModelo(), pok: numModelo(), ptem: modelo(4), ppr: numModelo(), pu: numModelo(),
      gl: modelo(4), nen: numModelo(), neq: numModelo(),
      str: { len: numModelo(), byte: modelo(256) }
    };

    const agora = num(c, M.g, E ? d.agora : 0);
    o.agora = agora;

    // Questões: para cada uma do banco, se tem registro e os campos dele.
    const total = num(c, M.g, E ? SIM.banco.length : 0);
    if (!E && total !== SIM.banco.length) throw new Error('O link veio de outra versão do simulado. Recarregue as duas páginas e envie de novo.');
    // Tabela de sessões: as horas distintas em que houve resposta (da mais recente para a
    // mais antiga). Cada questão depois diz só o número da sessão.
    // Tabela de sessões (horas atrás, da mais recente para a mais antiga). Sessão = respostas
    // com menos de 2 h entre uma e outra, até 3 h no total; vale a hora da última resposta.
    // Cada questão depois diz só o número da sessão.
    let sessoes = [];
    const sessaoDe = {};
    if (E) {
      const us = [];
      SIM.banco.forEach((q) => { const r = d.q[q.i]; if (r && (r.n || r.f) && r.u > 0) us.push(r.u); });
      us.sort((x, y) => y - x);
      let atual = null, ultimo = 0, inicio = 0;
      us.forEach((t) => {
        if (atual === null || ultimo - t > 2 * HORA || inicio - t > 3 * HORA) {
          atual = Math.max(0, agora - Math.floor(t / HORA));
          sessoes.push(atual);
          inicio = t;
        }
        sessaoDe[t] = atual;
        ultimo = t;
      });
      sessoes = Array.from(new Set(sessoes)).sort((x, y) => x - y);
    }
    const ns = num(c, M.sn, sessoes.length);
    let hAnt = -1;
    for (let i = 0; i < ns; i++) {
      hAnt += num(c, M.sd, E ? sessoes[i] - hAnt - 1 : 0) + 1;
      if (!E) sessoes.push(hAnt);
    }
    const nb = ns > 1 ? 32 - Math.clz32(ns - 1) : 0;
    // Um modelo de sessão por (caixa, tentativas 1/2/3+): erradas e revisadas são recentes.
    const mSessao = Array.from({ length: 32 }, () => modelo(2 << nb));

    const posSessao = {};
    sessoes.forEach((h, i) => { posSessao[h] = i; });
    const idxDe = (r) => posSessao[sessaoDe[r.u]];

    o.q = {};
    let antes = 0;
    for (let i = 0; i < total; i++) {
      const q = SIM.banco[i];
      const r = E ? d.q[q.i] : null;
      const tem = E ? !!(r && (r.n || r.f)) : 0;
      const visto = c.bit(M.visto, antes, tem);
      antes = visto;
      if (!visto) continue;
      // A caixa vem primeiro e prevê o resto (caixa 1 = a última foi erro).
      const cx = arvore(c, M.cx, 3, E ? r.cx & 7 : 0);
      const e = num(c, M.eC[cx], E ? r.e || 0 : 0);
      const a = num(c, M.aC[cx * 2 + (e ? 1 : 0)], E ? Math.min(r.a || 0, 1e6) : 0);
      const ad = num(c, M.adC[cx], E ? r.ad || 0 : 0);
      const f = c.bit(M.f, 0, E ? r.f : 0);
      let u = 0;
      if (c.bit(M.temU, 0, E ? r.u > 0 : 0)) {
        const j = arvore(c, mSessao[cx * 4 + Math.min(a + e + ad, 3)], nb, E ? idxDe(r) : 0);
        if (!E && sessoes[j] === undefined) throw new Error('Link de progresso inválido ou cortado.');
        u = (agora - sessoes[j]) * HORA;
      }
      if (!E) {
        o.q[q.i] = { n: a + e + ad, a, e, ad, u, cx, f: !!f,
          pr: cx >= 1 && cx <= 3 && u ? u + SIM.INTERVALOS[cx] : 0 };
      }
    }

    // Histórico de rodadas (as mais recentes primeiro, em horas de distância).
    const hist = E ? d.historico.filter((h) => MODOS.indexOf(h.modo) >= 0).slice(-MAX_HIST).reverse() : [];
    const nh = num(c, M.hn, hist.length);
    o.historico = [];
    let ref = agora;
    for (let i = 0; i < nh; i++) {
      const h = hist[i] || {};
      const ht = E ? Math.min(ref, Math.floor(h.ts / HORA)) : 0;
      const dist = num(c, M.hd, ref - ht);
      ref -= dist;
      const modo = arvore(c, M.modo, 2, E ? MODOS.indexOf(h.modo) : 0);
      const ac = num(c, M.ac, E ? h.acertos : 0);
      const tot = num(c, M.tot, E ? h.total : 0);
      o.historico.push({ ts: ref * HORA, modo: MODOS[modo], acertos: ac, total: tot });
    }

    // Dias de estudo (meta e sequência), contados a partir do dia do envio.
    const diaBase = Date.parse(SIM.hoje(agora * HORA) + 'T12:00:00');
    const deslocamento = (dia) => Math.round((diaBase - Date.parse(dia + 'T12:00:00')) / (24 * HORA));
    const dias = E ? Object.keys(d.dias).map((k) => [deslocamento(k), d.dias[k]])
      .filter((x) => x[0] >= 0 && x[0] < MAX_DIAS).sort((x, y) => x[0] - y[0]) : [];
    const nd = num(c, M.dn, dias.length);
    o.dias = {};
    let ant = -1;
    for (let i = 0; i < nd; i++) {
      const x = dias[i] || [0, {}];
      ant += num(c, M.dd, x[0] - ant - 1) + 1;
      const resp = num(c, M.dr, E ? x[1].resp || 0 : 0);
      const novas = num(c, M.dv, E ? x[1].novas || 0 : 0);
      const revis = num(c, M.dx, E ? x[1].revis || 0 : 0);
      o.dias[SIM.hoje(diaBase - ant * 24 * HORA)] = { resp, novas, revis };
    }

    // Conquistas: um bit por item do catálogo.
    const cat = SIM.conquistas ? SIM.conquistas.catalogo : [];
    const nc = num(c, M.g, cat.length);
    o.conquistas = {};
    for (let i = 0; i < nc; i++) {
      const tem = c.bit(M.conq, 0, E ? !!(d.conquistas && d.conquistas[cat[i].id]) : 0);
      if (tem && cat[i]) o.conquistas[cat[i].id] = agora * HORA;
    }

    // Contadores.
    const cont = E ? Object.keys(d.cont || {}).filter((k) => Number.isInteger(d.cont[k]) && d.cont[k] > 0) : [];
    const nk = num(c, M.cn, cont.length);
    o.cont = {};
    for (let i = 0; i < nk; i++) {
      const k0 = cont[i];
      const ki = arvore(c, M.ck, 3, E ? (CONT.indexOf(k0) >= 0 ? CONT.indexOf(k0) : 7) : 0);
      const nome = ki < 7 ? CONT[ki] : texto(c, M.str, k0);
      o.cont[nome] = num(c, M.cv, E ? d.cont[k0] : 0);
    }

    // Placas (flashcards): um bit por placa da lista e os campos de quem tem registro.
    const codigos = SIM.placasCodigos || [];
    const np = num(c, M.g, codigos.length);
    o.placas = {};
    let antP = 0;
    for (let i = 0; i < np; i++) {
      const x = E ? (d.placas || {})[codigos[i]] : null;
      const tem = c.bit(M.pl, antP, E ? !!(x && x.n) : 0);
      antP = tem;
      if (!tem) continue;
      const cx = arvore(c, M.pcx, 3, E ? x.cx & 7 : 0);
      const n = num(c, M.pn, E ? x.n : 0);
      const ok = num(c, M.pok, E ? x.ok : 0);
      const pr = c.bit(M.ptem, 0, E ? x.pr > 0 : 0) ? comSinal(c, M.ppr, E ? Math.floor(x.pr / HORA) - agora : 0) : null;
      const u = c.bit(M.ptem, 1, E ? x.u > 0 : 0) ? num(c, M.pu, E ? Math.max(0, agora - Math.floor(x.u / HORA)) : 0) : null;
      if (codigos[i]) {
        o.placas[codigos[i]] = { cx, n, ok, pr: pr == null ? 0 : (agora + pr) * HORA, u: u == null ? 0 : (agora - u) * HORA };
      }
    }

    // Termos do glossário já consultados: um bit por termo.
    const termos = SIM.glossario ? SIM.glossario.termos : [];
    const vistos = E ? d.glossarioVistos || {} : null;
    const nt = num(c, M.g, termos.length);
    o.glossarioVistos = {};
    let antG = 0;
    for (let i = 0; i < nt; i++) {
      const tem = c.bit(M.gl, antG, E ? !!(termos[i] && vistos[termos[i].t]) : 0);
      antG = tem;
      if (tem && termos[i]) o.glossarioVistos[termos[i].t] = agora * HORA;
    }

    // Palavras marcadas como "não entendi".
    const ne = E ? d.naoEntendi || [] : [];
    const nn = num(c, M.nen, ne.length);
    o.naoEntendi = [];
    for (let i = 0; i < nn; i++) {
      const x = ne[i] || {};
      const palavra = texto(c, M.str, E ? x.palavra : '');
      const qi = E ? (x.questao && SIM.porId[x.questao] ? SIM.banco.indexOf(SIM.porId[x.questao]) + 1 : 0) : 0;
      const qq = num(c, M.neq, qi);
      o.naoEntendi.push({ palavra, questao: qq && SIM.banco[qq - 1] ? SIM.banco[qq - 1].i : null });
    }
    return o;
  }

  // ---------- base64url ----------

  function paraBase64url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function deBase64url(txt) {
    const b = atob(txt.replace(/-/g, '+').replace(/_/g, '/'));
    const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  }

  // Soma de verificação de 16 bits (FNV-1a dobrado): um link cortado ou alterado é recusado.
  function soma(bytes) {
    let h = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193) >>> 0;
    return (h ^ (h >>> 16)) & 0xFFFF;
  }

  // ---------- API ----------

  SIM.pacoteTransferencia = function () {
    const c = new Codificador();
    const p = SIM.progresso;
    esquema(c, {
      agora: Math.floor(Date.now() / HORA), q: p.q, historico: p.historico || [], dias: p.dias || {},
      conquistas: p.conquistas, cont: p.cont, placas: p.placas, glossarioVistos: p.glossarioVistos,
      naoEntendi: p.naoEntendi
    });
    const corpo = c.fim();
    const ck = soma(corpo);
    const tudo = new Uint8Array(corpo.length + 3);
    tudo[0] = VERSAO; tudo[1] = ck & 255; tudo[2] = ck >> 8;
    tudo.set(corpo, 3);
    return paraBase64url(tudo);
  };

  SIM.lerPacote = function (txt) {
    let bytes;
    try { bytes = deBase64url(String(txt).trim()); } catch (e) { bytes = null; }
    if (!bytes || bytes[0] !== VERSAO) throw new Error('Link de progresso inválido ou de uma versão antiga.');
    const corpo = bytes.subarray(3);
    if (soma(corpo) !== (bytes[1] | (bytes[2] << 8))) throw new Error('O link chegou cortado ou alterado. Envie de novo.');
    const o = esquema(new Decodificador(corpo), null);
    o.enviado = o.agora * HORA;
    return o;
  };
})();
