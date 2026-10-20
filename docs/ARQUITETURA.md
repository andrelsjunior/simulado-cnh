# Arquitetura e ganchos dos módulos

Site estático (sem build, sem dependências) para estudar a prova teórica do Detran com as 1.478
questões do Banco Nacional de Questões. Usuário: brasileiro, estuda no computador E no celular,
quer tudo usável por teclado "como menu de jogo" e também por toque. Textos da interface em
português do Brasil, com acentuação correta, tom direto e sem enrolação.

## Arquitetura (leia antes: js/nucleo.js, js/app.js, js/teclado.js, estilo.css, index.html)
- `index.html` já carrega TODOS os módulos: `js/glossario-dados.js, js/glossario.js, js/explorador.js,
  js/placas.js, js/voz.js, js/conquistas.js, js/config.js` e `css/<modulo>.css`. Cada módulo é um IIFE
  que só mexe no próprio arquivo JS e no próprio CSS. NÃO edite index.html, nucleo.js, app.js,
  teclado.js, estilo.css nem arquivos de outro módulo. Se precisar de um gancho que não existe,
  NÃO crie editando o núcleo: descreva o gancho na resposta final (eu integro) e contorne por eventos.
- Telas: crie uma `<section class="tela" hidden>` via JS, faça `el('app').appendChild(sec)` e
  `SIM.registrarTela(nome, { elemento, aoMostrar(dado), atalhos: { acao: fn }, voltar() })`.
  `SIM.mostrar(nome, dado)` troca de tela; `SIM.irInicio()`.
- Tela inicial (menu de jogo): nível/XP, HUD (chance, meta, sequência, conquistas), botão
  "Próximo passo", modos, ajustes do treino, fases (módulos), ferramentas, histórico e "Sobre"
  recolhido. `SIM.adicionarModo({ id, ordem, cor, icone, titulo, texto: () => str,
  disponivel: () => bool, iniciar, tecla: '<idDaAcao>', badge: () => str | {texto, alerta} | null,
  progresso: () => 0..1 | null, largo: bool })` cria um cartão de modo (badge = selo de status;
  progresso = barra; largo = ocupa a linha toda) e `SIM.adicionarMenu({ id, ordem, icone, titulo,
  texto, acao, tecla })` um item em "Ferramentas".
- XP e nível: `SIM.xp()` → `{ total, nivel, nome, dentro, faixa, proximo }`, calculado do progresso
  (10 por acerto, 5 por acerto com dúvida, 2 por erro, 25 por questão dominada, 100 por conquista);
  níveis em `SIM.NIVEIS`. Nada novo é salvo além de `cont.nivel` (para o aviso de subida).
- Nas telas de menu (início e resultado) as setas movem o cursor pela posição na tela (grade).
- Sessão de questões: `SIM.iniciarSessao({ modo, titulo, questoes, tamanho, minutos, corte, revelar,
  embaralhar, refazer })` — revelar=true é treino (correção na hora).
- Teclado: `SIM.registrarAcao({ id, grupo: 'prova'|'geral'|'menus', rotulo, padrao: [tecla1, tecla2] })`
  cria uma ação remapeável (aparece sozinha na tela Controles e na ajuda `?`). Teclas são `e.key`
  minúsculo para caracteres, 'Space', 'Enter', 'Escape', 'ArrowUp'... `SIM.registrarGlobal(acao, fn)`
  trata a ação em qualquer tela (retorne false para "não tratei"); `atalhos` da tela têm prioridade.
  JÁ USADAS (não repita): a b c d 1 2 3 4 k j l h m f i n s t r u x , ? Enter Space Escape setas.
  Reservadas por módulo: explorador = e e /; glossário = g; voz = v e o; placas = p; conquistas = y;
  config = . (ponto).
  Cursor genérico: qualquer elemento com atributo `data-nav` visível na tela atual entra no ciclo
  ↑/↓; Enter/Espaço clicam nele; em <select>, ←/→ trocam a opção. Em <input> de texto as teclas não
  disparam ações (só Esc tira o foco); pôr `data-nav-sair` no input faz ↓/Enter saírem para a lista.
  `SIM.teclaDe(acao)` dá o nome da tecla atual para mostrar na interface.
- Dados: `SIM.banco` = questões `{ i: id, n: número, m: módulo 1-4, d: dificuldade 0-2, e: enunciado,
  p: código da placa|undefined, g: 1 se há figura em placas/<p>.svg, c: correta, x: [3 erradas],
  k: comentário, ac: true se anti-chute }`. `SIM.porId[id]`, `SIM.modulos[m]`.
  Progresso: `SIM.reg(id)` → `{ n vistas, a acertos, e erros, ad acertos com dúvida, u último ts,
  cx caixa 0..4 (4 = dominada), pr próxima revisão ts, f 🚩 }` ou null. `SIM.situacao(q)` →
  'nova'|'dominada'|'errada'|'duvida'|'revisao'. `SIM.marcada(id)`, `SIM.alternarMarca(id)`.
  `SIM.estatisticas()`, `SIM.prontidao()` → `{ chance 0..1|null, media, fracos, est }`,
  `SIM.metaHoje()`, `SIM.sequencia()`, `SIM.pendentes()`, `SIM.emRevisao()`.
  Guarde estado do seu módulo em `SIM.progresso.cont` (contadores, via `SIM.contar(nome, n)`),
  `SIM.config(k, padrão)`/`SIM.definirConfig(k, v)` ou numa chave própria `SIM.progresso.<modulo>`
  (crie se não existir) e chame `SIM.salvar()`.
- Eventos `SIM.on(nome, fn)`: 'tela' {nome}, 'questao' {sessao, item} (questão pintada na prova),
  'resposta' {id, certa, duvida, nova, registro, contexto}, 'resposta-corrigida', 'marca' {id, marcada},
  'sessao-inicio' sessao, 'sessao-fim' sessao (tem modo, titulo, corte, acertos, itens, duracao,
  usouPonteiro, fim), 'contador' {nome, valor}, 'config', 'importado', 'entrega-revisou', 'tecla' {acao}.
- Utilidades: `SIM.el(id)`, `SIM.criar(tag, classe, texto)` (texto do banco SEMPRE por textContent ou
  `SIM.escreverTexto(no, texto)` — que o glossário sobrescreve para sublinhar termos), `SIM.br(n)`,
  `SIM.embaralhar`, `SIM.normalizar` (minúsculas sem acento), `SIM.aviso(texto, { icone, titulo,
  classe, ms })` (toast), `SIM.abrirDialogo(titulo, elementoCorpo)`, `SIM.fecharDialogo()`.
- Visual: use as variáveis CSS existentes (--bg, --surface, --surface-2, --ink, --muted, --line,
  --line-forte, --verde, --vermelho, --amarelo, --azul, --*-fraco, --sombra, --fonte-placa,
  --fonte-texto, --fonte-dado) e classes existentes (.secao, .btn, .btn.vazio, .chip, .pagina-cab,
  .pagina-titulo, .muted, .campo, .acoes, .quebra, kbd). Tem que funcionar no tema claro e escuro e
  no celular (largura 360px, alvos de toque ≥ 40px). Respeite prefers-reduced-motion.

## Como testar
`python3 -m http.server <porta-livre> --bind 127.0.0.1` dentro do SEU worktree e abrir no Chrome via as
ferramentas mcp__chrome-devtools (use `isolatedContext` com um nome seu, `background: true`, e feche a
página no fim). Verifique: zero erros no console, fluxo completo por teclado E por clique, tela estreita
(emulate/resize 375px). Use a porta que der, nunca 8731 (é a minha).

## Git
Trabalhe SÓ no seu worktree (caminho no seu prompt). Commits pequenos e descritivos em português,
SEM linha Co-Authored-By. Não faça push, merge nem rebase; não toque em main.
