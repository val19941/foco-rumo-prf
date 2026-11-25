# Foco Rumo Prf

PROMPT — FocusStudy: Gerenciador Inteligente de Estudos e Acompanhamento da Medicação



Desenvolva um aplicativo web chamado FocusStudy, utilizando Lovable, para planejamento inteligente de estudos, acompanhamento dos períodos estimados de efeito do metilfenidato (Ritalina) e análise de desempenho cognitivo.



O aplicativo deve ser responsivo, em português brasileiro, com prioridade para smartphones Android e possibilidade de instalação como PWA.



Manter todas as funcionalidades descritas anteriormente e acrescentar os seguintes módulos:



13. ANÁLISE INTELIGENTE DE DESEMPENHO



Criar um módulo chamado "Meu Desempenho", responsável por identificar os horários e condições em que o usuário apresenta melhores resultados nos estudos.



Registrar diariamente:



- Horário de início dos estudos.

- Tempo necessário para começar uma atividade.

- Tempo efetivamente estudado.

- Quantidade de interrupções.

- Quantidade de questões resolvidas.

- Percentual de acertos.

- Capacidade percebida de concentração.

- Facilidade de memorização.

- Nível de cansaço mental.

- Qualidade do sono.

- Nível de ansiedade ou inquietação.



Utilizar escalas de 0 a 10 para os indicadores subjetivos.



Criar gráficos que permitam visualizar:



- Desempenho por horário.

- Desempenho por disciplina.

- Evolução da concentração.

- Evolução dos acertos.

- Relação entre qualidade do sono e produtividade.

- Comparação entre sessões de estudo.



O sistema deverá identificar padrões e apresentar observações como:



"Seu percentual de acertos em Português foi maior nas sessões realizadas pela manhã."



"Você apresentou maior dificuldade para iniciar os estudos nos dias em que dormiu menos."



Não atribuir automaticamente essas diferenças ao medicamento. Apresentar correlações como observações, não como causalidade.



14. DIÁRIO DE CONCENTRAÇÃO



Criar um módulo chamado "Diário de Concentração".



O objetivo é identificar qual é a principal dificuldade enfrentada pelo usuário durante os estudos.



Ao final de cada sessão, apresentar perguntas rápidas:



1. Foi fácil começar a estudar?

2. Você conseguiu manter a atenção?

3. Quantas vezes se distraiu?

4. Conseguiu compreender o conteúdo?

5. Conseguiu lembrar o que estudou sem consultar o material?

6. Teve dificuldade para concluir a atividade?

7. Como estava seu nível de energia?

8. Como estava sua qualidade de concentração?



Criar indicadores específicos:



- Dificuldade de iniciar tarefas.

- Dificuldade de manter a atenção.

- Distração por estímulos externos.

- Distração por pensamentos.

- Dificuldade de memorização.

- Dificuldade de compreensão.

- Cansaço mental.



Apresentar um relatório semanal identificando os principais obstáculos.



O aplicativo deverá sugerir estratégias educacionais conforme as dificuldades identificadas.



Exemplos:



Dificuldade para começar:

Dividir a tarefa em etapas menores e utilizar uma meta inicial de cinco minutos.



Distração por estímulos externos:

Recomendar ambiente silencioso, celular afastado e redução de interrupções.



Dificuldade de memorização:

Priorizar Active Recall e revisão espaçada.



Dificuldade de manter a atenção:

Utilizar blocos de estudo menores e pausas programadas.



15. MÓDULO DE PREPARAÇÃO PARA PRF



Criar uma área específica chamada "Preparação PRF".



Permitir cadastrar disciplinas, tópicos e subtópicos do edital.



Incluir inicialmente as seguintes disciplinas:



- Língua Portuguesa.

- Legislação de Trânsito.

- Direito Constitucional.

- Direito Administrativo.

- Direito Penal.

- Direito Processual Penal.

- Direitos Humanos.

- Legislação Especial.

- Raciocínio Lógico-Matemático.

- Informática.

- Física.

- Ética no Serviço Público.



Permitir editar e adicionar disciplinas conforme o edital vigente.



Cada disciplina deverá possuir:



- Lista de conteúdos.

- Grau de domínio.

- Quantidade de questões resolvidas.

- Percentual de acertos.

- Data da última revisão.

- Próxima revisão programada.

- Tempo investido.



Criar um sistema de priorização que considere:



1. Importância da disciplina no edital.

2. Dificuldade do conteúdo.

3. Percentual de acertos.

4. Tempo desde a última revisão.

5. Grau de domínio declarado pelo usuário.



O sistema deverá distribuir automaticamente as matérias ao longo da semana, evitando concentração excessiva em uma única disciplina.



16. INTELIGÊNCIA ARTIFICIAL PARA REORGANIZAÇÃO DO CRONOGRAMA



Criar um módulo chamado "Orientador de Estudos".



Sua função será analisar os registros do usuário e propor ajustes no planejamento.



A inteligência artificial deverá considerar:



- Desempenho nas questões.

- Tempo de estudo.

- Dificuldades de concentração.

- Disciplinas com menor domínio.

- Conteúdos atrasados.

- Revisões pendentes.

- Disponibilidade diária.

- Histórico de produtividade.



Exemplos de recomendações:



"Seu desempenho em interpretação de texto caiu nesta semana. Recomendo aumentar a quantidade de exercícios dessa categoria."



"Você apresenta bom domínio de determinado assunto. Podemos reduzir o tempo dedicado à teoria e aumentar a prática."



"Você acumulou revisões pendentes de CTB. Vamos redistribuí-las nos próximos dias."



"Seu aproveitamento em questões de Direito Constitucional está abaixo da sua média. Priorize a revisão dos assuntos com maior índice de erros."



O sistema poderá reorganizar automaticamente o cronograma, mas deverá solicitar confirmação antes de substituir o planejamento existente.



A IA não poderá recomendar alteração de dose, horário de administração ou frequência do medicamento.



17. SISTEMA DE REVISÃO ESPAÇADA



Implementar um sistema de revisão automática baseado no desempenho.



Utilizar como referência inicial:



- Primeira revisão: 24 horas.

- Segunda revisão: 7 dias.

- Terceira revisão: 15 dias.

- Quarta revisão: 30 dias.



Permitir ajustar os intervalos de acordo com o desempenho.



Quando o usuário errar questões de determinado assunto, o sistema deverá priorizar sua revisão.



18. PAINEL DE EVOLUÇÃO



Criar um dashboard com os seguintes indicadores:



- Horas estudadas na semana.

- Horas estudadas no mês.

- Questões resolvidas.

- Percentual geral de acertos.

- Disciplina com melhor desempenho.

- Disciplina que necessita de mais atenção.

- Conteúdos dominados.

- Revisões pendentes.

- Evolução da concentração.

- Consistência semanal.



Criar um indicador visual de progresso até a meta de aprovação.



19. REGRAS DE FUNCIONAMENTO



O sistema deve funcionar prioritariamente de maneira local, armazenando os dados no dispositivo.



Permitir exportação e importação de backup em JSON.



Os dados pessoais e registros de saúde devem permanecer privados.



As análises de desempenho devem utilizar somente os dados registrados pelo usuário.



Os períodos estimados de efeito da medicação devem ser tratados exclusivamente como referências aproximadas para organização dos estudos, nunca como garantia de desempenho ou orientação médica.



20. RESULTADO FINAL



Entregar um aplicativo funcional, não apenas uma interface demonstrativa.



O aplicativo deve possuir:



- Dashboard principal.

- Cronômetro de medicação e linha do tempo estimada.

- Sistema de notificações.

- Planejador inteligente.

- Modo de estudo.

- Diário de concentração.

- Análise de desempenho.

- Preparação específica para PRF.

- Revisão espaçada.

- Orientador de estudos com IA.

- Gráficos e relatórios.

- Exportação de dados e PDF.

- Funcionamento responsivo e possibilidade de instalação como PWA.



Priorizar simplicidade, velocidade, facilidade de utilização e funcionamento em dispositivos Android.



Desenvolver primeiro uma versão funcional com armazenamento local. Evitar implementar funcionalidades fictícias ou botões sem ação.



Apresentar uma interface visualmente organizada, com navegação intuitiva e indicadores claros.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://foco-rumo-prf.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d1a9d259-5a04-4fb7-8d08-4c15f9093b53).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
