# Comunicador de falhas

Portal estático integrado ao Supabase para centralizar falhas e chamados. Os dados não dependem do `localStorage`: o histórico e os relatórios consultam a mesma base remota, identificam administradores e preservam o anonimato das inserções da Equipe Madrugada.

## Arquitetura

- GitHub Pages (ou qualquer servidor estático) hospeda `index.html`, `css/` e `js/`.
- Supabase Auth autentica cada usuário por e-mail e senha.
- Um projeto Supabase gratuito e dedicado ao Comunicador armazena `failure_portal_reports`, `failure_portal_tickets` e `failure_portal_profiles`.
- Supabase Storage mantém imagens de falhas em bucket privado, limitado a 5 MB e acessível somente por membros autenticados do Comunicador.
- Uma Edge Function executada diariamente exclui imagens com mais de 30 dias e remove do histórico apenas a referência ao anexo; o registro da falha é preservado.
- RLS permite leitura compartilhada somente entre membros do Comunicador, inserção em nome próprio e exclusão somente para administradores.
- A `service_role`/secret key nunca é enviada ao navegador.

## Configuração

1. Crie ou selecione um projeto Supabase.
2. Aplique a migration em `supabase/migrations`.
3. Copie a URL do projeto e uma **publishable key** ativa para `js/config.js`.
4. O cadastro público foi desativado. As contas são provisionadas no servidor e a autorização é registrada em `failure_portal_memberships`, nunca em metadados editáveis do usuário.
5. Existem apenas dois papéis: `admin` e `team`. Kelly e Nelson pertencem a `admin`; a conta compartilhada Madrugada pertence a `team`. Marley deve ser incluído assim que seu e-mail exato for informado.
6. Contas administrativas devem ser criadas pela Admin API do Supabase com `email_confirm: true`, dispensando confirmação por link sem reduzir a segurança global do projeto.
7. O identificador real do autor permanece apenas no banco para auditoria. Consultas do navegador recebem somente o nome do administrador ou `EQUIPE MADRUGADA (ANÔNIMO)`.
8. No GitHub, configure **Settings > Pages > Deploy from a branch**, usando `main` e a pasta `/ (root)`. Esse modo hospeda o site gratuitamente sem depender de runners do GitHub Actions.

Exemplo de configuração pública:

```js
window.APP_CONFIG = Object.freeze({
    supabaseUrl: 'https://SEU-PROJETO.supabase.co',
    supabasePublishableKey: 'sb_publishable_...'
});
```

## Desenvolvimento local

Sirva a pasta por HTTP; abrir diretamente via `file://` pode bloquear dependências externas:

```powershell
npx http-server . -p 4173 -a 127.0.0.1 -c-1
```

Acesse `http://127.0.0.1:4173`.

## Segurança

O antigo login fixo no JavaScript foi removido. A publishable key é pública por definição e seu acesso é limitado pelas políticas RLS. Nunca coloque `sb_secret_...`, `service_role` ou senha do banco em arquivos versionados.
