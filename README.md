# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/545303ca-d585-4275-9cfc-60293d9010d2

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/545303ca-d585-4275-9cfc-60293d9010d2) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/545303ca-d585-4275-9cfc-60293d9010d2) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Supabase

> 🇧🇷 O projeto já está conectado ao Supabase (`project_id = qwjfimrqpomeqlsrquej`). Siga os passos abaixo para configurar sua máquina e criar novas tabelas com migrações versionadas.

1. Copie `.env.example` para `.env`. O arquivo já vem preenchido com o `project_ref` informado (`qwjfimrqpomeqlsrquej`).
2. Instale o [Supabase CLI](https://supabase.com/docs/guides/cli) e faça login (`supabase login`), ou use `npx supabase@latest` se não quiser instalar globalmente.
3. Vincule o diretório local ao projeto remoto (executa uma única vez):
   ```bash
   supabase link --project-ref qwjfimrqpomeqlsrquej
   ```
4. Crie uma nova migração sempre que quiser adicionar/alterar tabelas:
   ```bash
   supabase migration new minha_nova_tabela
   # edite o arquivo gerado em supabase/migrations/<timestamp>_minha_nova_tabela.sql
   supabase db push
   ```
5. Gere os tipos TypeScript atualizados após aplicar migrações (mantém `src/integrations/supabase/types.ts` em sincronia):
   ```bash
   supabase gen types typescript --linked --schema public \
     > src/integrations/supabase/types.ts
   ```
   - Ou execute `npm run supabase:types` para rodar o comando acima automaticamente.
6. Para aplicar migrações pendentes ao banco remoto/local, execute `npm run supabase:push`.

Depois disso, importe o cliente com tipagem completa através de `import { supabase } from "@/integrations/supabase/client";` e use `Tables<"nome_da_tabela">` das types geradas para trabalhar com os dados.

### Realtime, segurança e Edge Functions

- As migrações `20251102000100_enable_realtime.sql` e `20251102000200_validate_transaction.sql` configuram o `REPLICA IDENTITY` para todas as tabelas usadas em tempo real e adicionam a trigger `validate_transaction()` (incluindo `SET search_path`) para validar valores negativos antes de inserir novas transações. Execute `npm run supabase:push` para aplicar.
- O Edge Function `supabase/functions/rate-limit` implementa um limitador de 60 transações por minuto por usuário. Para publicar:
  ```bash
  supabase functions deploy rate-limit
  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
  ```
  Utilize-o antes de criar novas transações (ex.: do front-end, faça um `fetch` para o endpoint da função e bloqueie o envio caso retorne HTTP `429`).
- **Proteção contra senhas vazadas:** no painel do Supabase acesse `Authentication > Providers > Email` e habilite a opção “Enforce password breach detection”. Isso garante que novas senhas sejam verificadas em bases públicas de vazamentos.
