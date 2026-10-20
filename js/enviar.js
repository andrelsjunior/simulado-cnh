// Enviar o progresso para outro aparelho por um link (WhatsApp, e-mail...).
// O link leva o progresso comprimido depois do "#", que não sai do navegador
// para servidor nenhum. Ao abrir o link, o progresso é juntado ao do aparelho.
(function () {
  'use strict';

  const SIM = window.SIM;
  const { criar, br } = SIM;
  const PREFIXO = '#p=';

  function botao(texto, classe, fn) {
    const b = criar('button', 'btn ' + (classe || ''), texto);
    b.type = 'button';
    b.dataset.nav = '';
    b.addEventListener('click', fn);
    return b;
  }

  function respondidas() {
    return Object.keys(SIM.progresso.q).filter((id) => SIM.progresso.q[id].n > 0).length;
  }

  async function copiar(url) {
    try {
      await navigator.clipboard.writeText(url);
      SIM.aviso('Link copiado. Cole numa conversa com você mesmo e abra no outro aparelho.', { icone: '📋', ms: 5000 });
    } catch (e) {
      window.prompt('Copie o link abaixo:', url);
    }
  }

  const quando = (ms) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  // O link é montado ao abrir a janela: o compartilhar do celular precisa ser
  // chamado logo no toque, sem esperar nada.
  function abrir() {
    const corpo = criar('div', 'enviar');
    const n = respondidas();
    corpo.appendChild(criar('p', null, 'Mande o link para você mesmo e toque nele no outro aparelho. Lá, o progresso (' +
      br(n) + (n === 1 ? ' questão' : ' questões') + ', revisões, 🚩, conquistas e placas) se junta ao que já existir.'));
    const estado = criar('p', 'muted');
    corpo.appendChild(estado);
    const acoes = criar('div', 'acoes');
    corpo.appendChild(acoes);
    SIM.abrirDialogo('Enviar para outro aparelho', corpo);

    let url;
    try {
      url = location.origin + location.pathname + PREFIXO + SIM.pacoteTransferencia();
    } catch (e) {
      estado.textContent = 'Não consegui montar o link neste navegador. Use o backup em Configurações.';
      return;
    }
    estado.textContent = 'O link é uma foto de agora: estudou mais, envie de novo.';
    if (navigator.share) {
      acoes.appendChild(botao('Compartilhar…', '', () => {
        navigator.share({ title: 'Meu progresso — Simulado CNH', text: 'Toque para continuar o simulado de onde parei:', url })
          .then(() => SIM.fecharDialogo())
          .catch((e) => { if (e && e.name !== 'AbortError') copiar(url); });
      }));
    }
    acoes.appendChild(botao('Copiar link', navigator.share ? 'vazio' : '', () => copiar(url)));
    const primeiro = acoes.querySelector('button');
    if (primeiro && SIM.destacar) SIM.destacar(primeiro);
  }
  SIM.enviarProgresso = abrir;

  // Recebe um link (aberto no navegador ou colado no campo de restaurar).
  function receber(pacote) {
    let o;
    try {
      o = SIM.lerPacote(pacote);
    } catch (e) {
      SIM.aviso(e.message || 'Não consegui ler esse link.', { icone: '⚠️' });
      return;
    }
    const nq = Object.keys(o.q).filter((id) => o.q[id].n > 0).length;
    const corpo = criar('div', 'enviar');
    corpo.appendChild(criar('p', null, 'Este link traz ' + br(nq) + (nq === 1 ? ' questão respondida' : ' questões respondidas') +
      ', enviado em ' + quando(o.enviado) + '.'));
    corpo.appendChild(criar('p', 'muted', 'Juntar com o progresso deste aparelho (' + br(respondidas()) +
      ' respondidas aqui)? Em cada questão fica a resposta mais recente; nada daqui é apagado.'));
    const acoes = criar('div', 'acoes');
    const ok = botao('Juntar progresso', '', () => {
      const r = SIM.juntar(o);
      SIM.fecharDialogo();
      SIM.aviso(br(r.novas) + ' questões novas e ' + br(r.atualizadas) + ' atualizadas.', { titulo: 'Progresso juntado', icone: '📲', ms: 5000 });
    });
    acoes.appendChild(ok);
    corpo.appendChild(acoes);
    SIM.abrirDialogo('Progresso recebido', corpo);
    if (SIM.destacar) SIM.destacar(ok);
  }
  SIM.receberLink = function (texto) {
    const i = String(texto).indexOf(PREFIXO);
    if (i < 0) return false;
    receber(String(texto).slice(i + PREFIXO.length).trim());
    return true;
  };

  window.addEventListener('DOMContentLoaded', () => {
    if (location.hash.indexOf(PREFIXO) !== 0) return;
    const pacote = location.hash.slice(PREFIXO.length);
    // Tira o progresso da barra de endereço (e do histórico) logo de cara.
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(() => receber(pacote), 0);
  });

  SIM.registrarAcao({ id: 'enviar', grupo: 'menus', rotulo: 'Enviar progresso para outro aparelho', padrao: ['w'] });
  SIM.registrarGlobal('enviar', () => {
    if (SIM.sessaoAtivaComTempo()) return false;
    abrir();
  });
  SIM.adicionarMenu({
    id: 'enviar', ordem: 40, icone: '📲', titulo: 'Enviar progresso', tecla: 'enviar',
    texto: 'Continuar no celular ou no computador', acao: abrir
  });
})();
