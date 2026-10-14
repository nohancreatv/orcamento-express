# Instalação do backend PHP + MySQL

O frontend fica no Netlify. O backend roda em uma hospedagem com PHP 8.2+, Composer e MySQL 8.0+ (ou MariaDB 10.6+). **O banco e os logins só ficam ativos após instalar esse backend e configurar os provedores.** Não é necessário Supabase.

## 1. Preparar a hospedagem

- Extensões PHP: PDO MySQL, mbstring, OpenSSL e cURL.
- HTTPS e sessões PHP com armazenamento persistente e privado. Para múltiplos servidores, use um armazenamento de sessões compartilhado.
- Crie um banco vazio, um usuário para importar o esquema e um usuário da aplicação com SELECT, INSERT, UPDATE e DELETE apenas nesse banco. Ative backups automáticos da hospedagem.
- Envie `backend/` para o servidor e execute `composer install --no-dev --prefer-dist --optimize-autoloader`.
- Configure o document root do domínio do backend como **`backend/public`**. Os diretórios `src`, `vendor`, `database` e o arquivo `.env` precisam ficar fora do diretório público.
- Em Apache, habilite `mod_rewrite` e a leitura do `.htaccess`. Em Nginx, encaminhe `/api/...` a `index.php?route=...`, preservando os parâmetros da requisição. Não exponha arquivos PHP como downloads.

## 2. Banco e configuração

Copie `.env.example` para `.env` no backend, preencha os valores no servidor e restrinja suas permissões. Nunca envie o arquivo preenchido ao GitHub ou ao frontend.

| Variável | Finalidade |
| --- | --- |
| `APP_URL` | Origem pública exata: `https://orcamento-express-facil.netlify.app` (sem barra final) |
| `APP_KEY` | Segredo aleatório com pelo menos 32 caracteres; gere com `php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexão MySQL fornecida pela hospedagem |
| `DB_SSL_CA` | Caminho do certificado CA quando o banco remoto exigir TLS |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Serviço de envio de e-mails |
| `SMTP_ENCRYPTION` | `tls` para STARTTLS ou `ssl` para TLS implícito; `none` apenas para testes locais |
| `MAIL_FROM`, `MAIL_FROM_NAME` | Remetente verificado no serviço de e-mail |

Importe `database/schema.sql` pelo painel do MySQL, ou execute `php bin/migrate.php` com um usuário que tenha permissão para criar tabelas. Depois use as credenciais de acesso limitado na aplicação. A migração é aditiva e não apaga dados.

As tabelas são `users`, `oauth_identities`, `workspaces`, `email_tokens` e `rate_limits`. `workspaces.payload` contém o rascunho e as versões em JSON nativo do MySQL; cada linha pertence a uma conta. `revision` impede sobrescrever dados alterados por outra aba/aparelho.

Agende `php bin/cleanup.php` diariamente para remover tokens e contadores expirados. Configure o PHP com `display_errors=Off`, logs privados e limite de requisição de pelo menos 12 MB. Ative proteção contra abuso na hospedagem: os limites da aplicação usam `REMOTE_ADDR` (não confiam cegamente em cabeçalhos de IP enviados pelo cliente), além de limites por e-mail. Ajuste o IP real apenas por meio de proxies confiáveis do servidor.

## 3. Conectar ao Netlify

No Netlify, configure **somente `API_ORIGIN`**, no escopo **Builds**, com a origem HTTPS do backend (ex.: `https://api.seu-dominio.com`). Publique novamente.

O build gera `/api/* → API_ORIGIN/api/:splat` como proxy. O navegador acessa sempre `/api/` no domínio do site, e recebe um cookie de sessão HttpOnly, Secure e SameSite=Lax. Os segredos ficam exclusivamente no PHP. Não configure CORS com `*` ou conecte o navegador diretamente ao MySQL.

Teste `/api/session` no domínio do Netlify. A resposta deve ser JSON com `user: null`, `csrf`, `providers` e `emailEnabled`, sem credenciais. Verifique no navegador se o cookie é aceito e reutilizado pelo proxy. `Cache-Control: no-store` é obrigatório e emitido pelo PHP. Se o provedor de hospedagem não permitir encaminhar cookies pelo proxy, hospede frontend e backend na mesma origem e compile com `API_LOCAL=true`.

Sem `API_ORIGIN`/`API_LOCAL`, a página pública funciona e a tela de cadastro explica que o serviço está sendo preparado.

## 4. Logins sociais

Cadastre aplicativos nos painéis oficiais e salve os client secrets apenas no `.env` do servidor. As opções aparecem habilitadas somente quando suas credenciais estão presentes. Credenciais preenchidas não comprovam que o provedor está aprovado: teste cada fluxo após publicar.

| Plataforma | Variáveis no PHP | Callback a cadastrar |
| --- | --- | --- |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `https://orcamento-express-facil.netlify.app/api/auth/oauth/google/callback` |
| Microsoft | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT` | `https://orcamento-express-facil.netlify.app/api/auth/oauth/microsoft/callback` |
| Facebook | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`, `FACEBOOK_GRAPH_VERSION` | `https://orcamento-express-facil.netlify.app/api/auth/oauth/facebook/callback` |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | `https://orcamento-express-facil.netlify.app/api/auth/oauth/github/callback` |

- **Google:** aplicativo Web; configure consentimento, usuários de teste/publicação e o redirect URI exato.
- **Microsoft:** aplicativo Web; escolha tipos de conta compatíveis com seu público. `common` permite contas pessoais e corporativas quando o cadastro do aplicativo também permite. São usados `openid profile email` e o endpoint UserInfo do Microsoft Graph.
- **Facebook:** configure Facebook Login para Web, versão Graph suportada pelo painel, domínio e callback exatos. Complete requisitos de publicação/revisão e as páginas de privacidade/exclusão exigidas pela Meta antes de abrir a todos.
- **GitHub:** OAuth App com callback exato. São solicitados `read:user user:email`.

OAuth usa as bibliotecas League, proteção `state` de uso único e validade de dez minutos; Google/Microsoft/GitHub usam PKCE S256. Tokens dos provedores não são persistidos. **Contas não são unidas automaticamente pelo e-mail:** entre na conta existente, abra **Minha conta** e conecte outro provedor para compartilhar os mesmos orçamentos. Um acesso já ligado a outra conta é recusado.

Documentação: [Google](https://developers.google.com/identity/protocols/oauth2/web-server), [Microsoft](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc), [Facebook](https://developers.facebook.com/docs/facebook-login/), [GitHub](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [League](https://oauth2-client.thephpleague.com/usage/).

## 5. Validar em produção

1. Cadastre duas contas por e-mail, confirme as mensagens e entre; cada uma deve começar vazia.
2. Salve na primeira conta, saia e entre na segunda; os dados não podem aparecer nela.
3. Abra a primeira conta em outro aparelho e confirme que o orçamento foi carregado.
4. Edite em duas abas para verificar o aviso de conflito. Faça backup das alterações locais antes de recarregar.
5. Teste recuperação de senha, expiração de link e revogação das sessões anteriores.
6. Teste os quatro provedores e a vinculação pela página Minha conta.
7. Confirme HTTPS, cookies, e-mails entregues e recuperação do backup do banco.

Não declare os logins sociais ou o salvamento online como ativos antes dessas verificações. Os testes automatizados usam um banco descartável e um servidor SMTP local; não comprovam a configuração externa dos provedores.

## Desenvolvimento e testes

No repositório: `npm ci && npm run build && npm test`.
No backend: `composer install` e `php bin/migrate.php` com configuração de desenvolvimento.
Para servir o frontend e a API juntos: `API_LOCAL=true npm run build`, depois `php -S 127.0.0.1:8080 -t dist tests/router.php` na raiz; use `APP_ENV=development` e `APP_URL=http://127.0.0.1:8080` no ambiente local.

Teste de integração: crie um banco descartável cujo nome comece com `oe_test_`, exporte `TEST_DB_NAME`, `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER` e `TEST_DB_PASSWORD`; execute `python3 tests/integration.py`. O teste cria usuários de teste e usa SMTP local; não use um banco com dados reais.
