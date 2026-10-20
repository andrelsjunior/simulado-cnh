# Simulado CNH do Brasil

Simulado da prova teórica do Detran feito em cima do **Banco Nacional de Questões
da Senatran** — as 1.500 questões oficiais, com o gabarito e o comentário de cada
uma.

**Abrir (este fork):** https://andrelsjunior.github.io/simulado-cnh/ — original: https://roundeprigous.github.io/simulado-cnh/

## O que este fork acrescenta

- **Teclado como menu de jogo**: setas movem o cursor, Espaço/Enter confirmam, A–D ou 1–4
  respondem direto, M marca 🚩, ? lista tudo. Cada ação aceita duas teclas, remapeáveis na
  tela Controles.
- **Revisão espaçada** (caixas de Leitner, intervalos de 10 min, 1 dia e 3 dias) no lugar de
  "só o que errou". Acerto com 🚩 conta como dúvida e volta para revisão.
- **Pronto pra prova?**: chance estimada de tirar 20+ (simulação a partir do seu acerto por
  módulo, avisando quando a amostra é pequena), mapa de domínio por módulo, meta diária e
  sequência de dias.
- **Anti-chute**: em 81% das questões a certa é a alternativa mais longa. O modo anti-chute usa
  só as outras, e o painel compara o seu acerto nelas com o resto.
- **Marcar dúvida 🚩** e **tela de entrega** antes de fechar o simulado, como na prova digital.
- **Explorador** das questões com busca, filtros (situação, módulo, dificuldade, anti-chute,
  placa) e "treinar estas", com a resposta escondida até você pedir.
- **Glossário** com 217 termos que aparecem nas questões (56 com a definição oficial do CTB,
  Anexo I), sublinhados no texto, mais o botão "não entendi uma palavra".
- **Flashcards das 65 placas** que têm figura, com o nome oficial e revisão espaçada própria.
- **Voz**: botão para ouvir a questão e modo "Ouvir (mãos livres)" para estudar no trânsito.
- **Conquistas** (22, cinco secretas) que premiam aprendizado, e o **Simulado Chefão**
  (30 difíceis/anti-chute, 45 min, corte 25) liberado quando a chance chega a 80%.
- **Backup** do progresso (arquivo ou texto) para passar entre celular e computador.
- As 7 questões que o documento oficial repete palavra por palavra contam uma vez só (1.478).

Tudo continua estático, sem servidor e sem coleta: o progresso fica no `localStorage`.
Código em `js/` (um arquivo por módulo, ligados por `window.SIM`) e `css/`.

## Por que essas questões e não outras

Desde a **Resolução CONTRAN nº 1.020, de 1º/12/2025**, todos os Detrans sorteiam
a prova do mesmo banco nacional — antes disso cada estado tinha o seu:

> **Art. 33.** As questões que compõem os exames teóricos serão extraídas do Banco
> Nacional de Questões, organizado e mantido pelo órgão máximo executivo de
> trânsito da União.
>
> **§ 6º** O Banco Nacional de Questões estará disponível para a sociedade nos
> canais disponibilizados pelo órgão máximo executivo de trânsito da União.

É esse §6º que torna as questões públicas. A fonte é o documento **"Banco Nacional
de Questões — versão 1.0"** (Senatran / Ministério dos Transportes, programa CNH
do Brasil, Brasília, 2025, 313 páginas).

## A prova hoje

- **30 questões**, sorteadas do banco
- **20 acertos** para passar — mudou, antes eram 21 (art. 34)
- **60 minutos**, dobrado para dislexia, TDAH ou TEA (art. 33, §2º)
- Reprovando, **não há limite de tentativas**, e o art. 34, §1º diz que a segunda
  tentativa *poderá* ser feita sem cobrança de taxa adicional — vale perguntar no
  Detran do seu estado antes de pagar de novo

## O que este simulado não sabe

A resolução diz que as 30 questões são distribuídas "conforme critérios
estabelecidos pelo órgão máximo executivo de trânsito da União", e esses critérios
**não são publicados**. Aqui o sorteio segue a proporção do próprio banco, que não
é necessariamente a proporção da prova. Qualquer site que prometa "caem 12 de
legislação, 10 de direção defensiva" está repetindo a norma antiga.

## Privacidade

Não há servidor, conta nem coleta. Seu progresso fica no `localStorage` do próprio
navegador, só no seu aparelho.

---

Conteúdo das questões: documento público do Ministério dos Transportes / Senatran.
