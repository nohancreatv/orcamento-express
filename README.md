# Orçamento Express

**Saiba quanto sobra antes de fechar.**

Ferramenta para autônomos e pequenos negócios criarem propostas, avaliarem lucro, simularem descontos e planejarem o sinal.

Site: https://orcamento-express-facil.netlify.app/

## O que está incluído

- Página pública com planilha vazia e totais zerados.
- Cadastro por e-mail, confirmação, login, recuperação de senha e saída.
- Integrações de login Google, Microsoft, Facebook e GitHub, com vinculação explícita de acessos à mesma conta.
- Backend PHP e armazenamento MySQL por usuário.
- Salvamento automático com confirmação do servidor e proteção contra conflitos entre abas/aparelhos.
- Propostas com itens, opcionais, logo, escopo, custos internos e condições.
- PDF via impressão, resumo para WhatsApp, versões, backup e restauração JSON.

**Status de implantação:** o código PHP/MySQL está preparado. A ativação online depende de hospedar o backend, importar o esquema, configurar SMTP e cadastrar os aplicativos OAuth. Sem backend configurado, os cadastros aparecem indisponíveis e a página pública continua acessível. Veja [a instalação completa](backend/README.md).

## Executar

```sh
npm ci
npm run build
npm test
```

O build gera os arquivos do frontend na pasta `dist`. `API_ORIGIN` configura o proxy para a hospedagem PHP no Netlify; `API_LOCAL=true` permite executar tudo na mesma origem. Para servir a versão pública estática:

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

## Estrutura

| Caminho | Responsabilidade |
| --- | --- |
| `dist/` | HTML, CSS, cálculos e interface |
| `src/auth.js` | Login, cadastro, recuperação e vinculação OAuth |
| `src/workspace-store.js` | Salvamento online, repetição de tentativas e conflitos |
| `backend/public/` | Único diretório público do servidor PHP |
| `backend/src/` | Sessões, banco, e-mails, OAuth e autorização |
| `backend/database/schema.sql` | Tabelas MySQL |
| `backend/.env.example` | Modelo de configuração, sem credenciais |
| `tests/` | Cálculos, acesso público, sincronização e integração PHP/MySQL |

## Dados e limites

O servidor identifica o usuário pela sessão e nunca aceita um ID do corpo da requisição como autorização. Cada conta tem um rascunho e até 100 versões, com limite de 12 MB por envio. Aguarde **Salvo na sua conta** antes de fechar a página. Falhas de conexão e conflitos deixam as alterações pendentes para tentar novamente ou baixar um backup; não são apresentadas como sucesso.

Os dados antigos do navegador (`oe-workspace-v2`, `oe-workspace-v3:*`, `oe-draft`) são preservados e não são importados automaticamente para uma conta. Um backup JSON compatível pode ser restaurado explicitamente. Os backups incluem custos internos.

Os status de aprovação são registros manuais e não constituem assinatura eletrônica. O WhatsApp abre a mensagem para revisão e envio pelo usuário. Fontes são carregadas do Google Fonts, com alternativa de sistema.
