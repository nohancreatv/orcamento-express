# Orçamento Express

**Saiba quanto sobra antes de fechar.**

Ferramenta em português para autônomos e pequenos negócios criarem propostas profissionais, avaliarem o lucro, simularem descontos e planejarem o sinal.

Site atual: https://orcamento-express.blackcorgi4.chatgpt.site/ (acesso conforme as permissões do Sites).

## Recursos

- Proposta com itens, opcionais, logo, validade, escopo e condições.
- Custos internos, remuneração por hora, taxas, reserva e lucro desejado.
- Limite de desconto para manter o lucro desejado.
- Comparação do sinal com as despesas anteriores ao início do trabalho.
- Referência para comparar mudanças de preço, itens, escopo e condições.
- Impressão/Salvar como PDF e resumo para copiar ou revisar no WhatsApp.
- Rascunho e versões salvos no navegador; backup e restauração em JSON.
- Interface responsiva e navegação por teclado.

## Executar localmente

É um site estático em HTML, CSS e JavaScript, sem instalação de pacotes ou etapa de build.

Com Python 3 instalado, na pasta do repositório:

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Abra http://127.0.0.1:8000. Também pode usar qualquer servidor estático que sirva a pasta `dist`.

## Testar os cálculos

Com Node.js 18 ou superior:

```sh
node tests/core.test.cjs
```

Os testes verificam cálculo de custos, taxas, lucro, sinal, desconto, seleção de opcionais, arredondamento e separação entre informações internas e documento do cliente.

## Estrutura

```text
dist/
  index.html      Interface e conteúdo
  styles.css     Identidade visual e responsividade
  core.js        Cálculos e documento público
  app.js         Interações, persistência e backup
tests/
  core.test.cjs  Verificações dos cálculos
.openai/
  hosting.json   Identidade e configuração do site existente no Sites
```

## Dados e limites atuais

Os orçamentos ficam no armazenamento local do navegador, sem sincronização entre dispositivos. Faça um backup antes de limpar os dados do navegador ou mudar de aparelho. O backup inclui propostas e custos internos.

A aprovação é registrada manualmente. A comparação de versões não constitui assinatura ou aceite eletrônico. O WhatsApp abre com uma mensagem preparada para revisão e envio pelo usuário. O PDF usa a impressão do navegador.

As fontes Plus Jakarta Sans são carregadas pelo Google Fonts, com fonte de sistema como alternativa.

## Publicação

Para outro serviço de hospedagem estática, use a pasta `dist` como diretório público. A publicação atual permanece no Sites; atualizar este repositório não dispara automaticamente uma nova publicação no Sites. O arquivo `.openai/hosting.json` identifica o projeto existente e não contém credenciais.

Código exportado da versão publicada correspondente ao commit de origem `b6d8e2e438573346855d6fba9b3c1cb581b0e64d`.
