# Orçamento Express

**Saiba quanto sobra antes de fechar.**

Ferramenta em português para autônomos e pequenos negócios criarem propostas profissionais, avaliarem o lucro, simularem descontos e planejarem o sinal.

Site atual: https://orcamento-express-facil.netlify.app/

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

É um site em HTML, CSS e JavaScript. Execute `npm ci` e `npm run build` antes de servir a pasta `dist`.

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
```

## Dados e limites atuais

Os orçamentos ficam no armazenamento local do navegador, sem sincronização entre dispositivos. Faça um backup antes de limpar os dados do navegador ou mudar de aparelho. O backup inclui propostas e custos internos.

A aprovação é registrada manualmente. A comparação de versões não constitui assinatura ou aceite eletrônico. O WhatsApp abre com uma mensagem preparada para revisão e envio pelo usuário. O PDF usa a impressão do navegador.

As fontes Plus Jakarta Sans são carregadas pelo Google Fonts, com fonte de sistema como alternativa.

## Publicação

O arquivo `netlify.toml` configura o build e a pasta pública `dist`. A publicação depende da conexão do repositório no Netlify ou de um deploy manual após o build.

## Cadastro e login (Supabase Auth)

A abertura pública agora começa vazia, sem carregar dados locais antigos ou dados de uma conta. Criar orçamento, guardar versões e abrir o arquivo levam ao cadastro/entrada. A integração contempla Google, Microsoft (Azure), Facebook, GitHub, e-mail/senha, confirmação de e-mail, recuperação e saída. Opções ainda não configuradas aparecem desativadas, sem simular autenticação.

Instale com `npm ci`, compile com `npm run build` e valide com `npm test`. O Netlify usa esse mesmo build. Os arquivos `dist/auth.js` e `dist/auth-config.js` são gerados.

### Ativação necessária antes de receber cadastros

1. Crie um projeto Supabase e habilite o provedor Email em Authentication. Configure confirmação de e-mail e SMTP para entrega em produção.
2. Em Authentication → URL Configuration, use `https://orcamento-express-facil.netlify.app` como Site URL e permita exatamente `https://orcamento-express-facil.netlify.app/login.html` e `https://orcamento-express-facil.netlify.app/login.html?mode=recovery` nos redirecionamentos.
3. Habilite os provedores desejados no Supabase e cadastre seus aplicativos nos respectivos consoles. Use a URL de callback apresentada pelo Supabase. Microsoft deve aceitar as contas pessoais e/ou organizacionais pretendidas; o código solicita o escopo `email`. Facebook pode exigir publicação/revisão do aplicativo.
4. Configure no Netlify, escopo Builds: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (somente a chave pública `sb_publishable_...`) e `AUTH_PROVIDERS` (por exemplo `google,azure,facebook,github`, apenas os que já estiverem habilitados). Publique novamente. Nunca coloque `service_role`, chave secreta, senha ou segredo OAuth nessas variáveis públicas; os segredos dos provedores ficam no painel Supabase.
5. Teste cadastro, confirmação, entrada/saída, recuperação e cada provedor em produção, com duas contas diferentes. Uma tela pronta não confirma a ativação de um provedor.

Sem configuração, o site permanece público e o login informa que os cadastros estão sendo preparados. Nenhuma conta falsa é criada e nenhuma senha é armazenada pela aplicação.

### Dados locais

Os orçamentos continuam no navegador, agora separados pelo ID da conta (`oe-workspace-v3:<id>`). Isso não é armazenamento em nuvem, criptografia ou controle de acesso do sistema operacional: quem possui acesso ao perfil do navegador pode inspecionar seus dados locais. Para uso compartilhado, utilize perfis separados. Um backend futuro precisará validar a sessão e aplicar autorização por usuário.

Os dados antigos (`oe-workspace-v2` e `oe-draft`) são preservados, mas não são exibidos nem atribuídos automaticamente à primeira conta. Para recuperar um arquivo anterior, exporte a chave local correspondente com as ferramentas de desenvolvimento e restaure o JSON na conta correta. Nada foi apagado.

Documentação: https://supabase.com/docs/guides/auth/social-login e https://supabase.com/docs/guides/auth/passwords
