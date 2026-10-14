# Ativação gratuita: Firebase Authentication + Firestore

Esta integração está preparada, mas não está ativada em produção. O site permanece no Netlify. Firebase substitui o servidor PHP/MySQL nesta opção; o backend anterior foi preservado. Nenhuma conta ou orçamento foi migrado automaticamente.

## Plano e custos

Use um projeto Firebase **Spark**, sem vincular faturamento ou migrar para Blaze. Authentication por e-mail e provedores sociais e Firestore têm cotas gratuitas. Não configurar SMS, Cloud Functions, Cloud Storage ou outros serviços que exijam faturamento. A gratuidade tem limites: ao exceder as cotas, operações podem ser recusadas. O site também continua sujeito à cota do Netlify.

A integração guarda até 900 KB por conta (rascunho, versões e logos), com até 100 versões. Um documento por usuário mantém o salvamento atômico e evita gravações parciais. Logos grandes podem exceder o limite; exportação de backup continua disponível. Dados não são excluídos automaticamente para caber no limite.

## Configurar antes de ativar

1. Conectar o Firebase à conta proprietária e criar/selecionar um projeto Spark.
2. Registrar aplicativo Web. Usar apenas a configuração pública Web (apiKey, authDomain, projectId, appId); nunca uma chave de conta de serviço.
3. Criar Firestore Standard no modo produção. Publicar `firestore.rules` e `firestore.indexes.json` antes de habilitar o frontend: `firebase deploy --only firestore --project ID_DO_PROJETO`.
4. Authentication: habilitar Google e e-mail/senha; configurar nome público e e-mail de suporte. Autorizar `orcamento-express-facil.netlify.app`. Manter uma conta por endereço de e-mail, proteção contra enumeração de e-mails e política de senha com mínimo de 10 caracteres.
5. Habilitar somente os outros provedores concluídos. GitHub precisa de OAuth App, Microsoft de registro de aplicativo, Facebook de aplicativo Meta com permissões/publicação adequadas. Segredos ficam no console Firebase, jamais no Netlify ou no código. Copiar o callback mostrado no console (`https://ID_DO_PROJETO.firebaseapp.com/__/auth/handler`) para cada provedor.
6. Revisar os modelos padrão de verificação e recuperação de e-mail. Firebase hospeda as páginas de ação; confirmação de e-mail é obrigatória para contas de senha acessarem os dados.
7. No Netlify Builds: `AUTH_MODE=firebase`, `FIREBASE_WEB_CONFIG` com JSON público do aplicativo, `FIREBASE_EMAIL_ENABLED=true`, `AUTH_PROVIDERS=google` inicialmente; acrescentar microsoft,facebook,github somente após configurar e validar cada um. Remover API_ORIGIN se ainda configurado para PHP.
8. Publicar e testar com duas contas: login social, login e-mail, verificação, recuperação, saída, salvamento entre aparelhos, bloqueio de acesso a dados alheios. Conferir os limites no painel de uso.

A sessão é mantida apenas na sessão do navegador. Senhas são processadas pelo SDK Firebase; o código não as guarda. Acesso aos documentos é validado no servidor pelas regras Firestore. Nenhuma listagem pública de usuários ou orçamentos é permitida. Conectar provedores exige entrar primeiro na conta existente em Minha conta; não há mesclagem manual por coincidência de e-mail no aplicativo.

## Verificações locais

- `npm test`
- `node tests/firebase.test.mjs`
- `npx firebase emulators:exec --only firestore --project demo-orcamento-express 'node tests/firebase-rules.test.mjs'`
- Compilar com as variáveis públicas acima testa o bundle Firebase. Sem AUTH_MODE=firebase, o build original permanece.

Testes com emulador não substituem a validação dos provedores reais. Não anunciar um provedor como ativo antes do teste de ida e volta.

Referências: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans, https://firebase.google.com/docs/auth/web/microsoft-oauth, https://firebase.google.com/docs/auth/web/facebook-login, https://firebase.google.com/docs/firestore/security/get-started.
