# Sala de Inglês — Bloco 1 (Login)

Site responsivo (celular e computador), instalável como app (PWA), hospedado no GitHub Pages e com banco de dados no Supabase.

```
index.html            Login, primeiro acesso e "esqueci a senha"
aluno.html            Área do aluno
convites.html         Pré-cadastro de alunos (professora)
professora.html       Área da professora
redefinir-senha.html  Tela que abre pelo link de troca de senha
css/style.css         Visual (cores, fontes, layout)
js/config.js          ← ÚNICO arquivo que você edita com os dados do Supabase
js/*.js               Lógica de cada página
manifest.webmanifest  + sw.js + icons/  → fazem o site virar app (PWA)
supabase/01_login.sql Script do banco de dados
```

Sem configurar o Supabase o site abre em **modo demonstração** (botões para ver as duas áreas).

---

## Passo 1 — Criar o banco no Supabase

1. Acesse **supabase.com** → *Start your project* → entre com sua conta do GitHub.
2. **New project** → dê um nome, crie uma senha forte para o banco (guarde!) e escolha a região **South America (São Paulo)**.
3. Espere uns 2 minutos até o projeto ficar pronto.
4. Menu lateral → **SQL Editor** → **New query** → cole todo o conteúdo de `supabase/01_login.sql` → **Run**. Deve aparecer *Success*.
5. Menu → **Project Settings → API** (ou *Data API*). Copie:
   - **Project URL** (ex.: `https://abcd.supabase.co`)
   - **anon public key** (a chave longa marcada como *public* / *anon*)
6. Abra `js/config.js` e cole os dois valores. ⚠️ Nunca use a chave **service_role** no site.

## Passo 2 — Configurar o login no Supabase

Menu → **Authentication**:

- **Sign In / Providers → Email**: deixe ativado.
  *Confirm email* ligado = o aluno confirma pelo e-mail antes de entrar (mais seguro). Desligado = entra na hora.
- **URL Configuration**:
  - *Site URL*: o endereço do site no GitHub Pages (ex.: `https://seuusuario.github.io/sala-de-ingles/`)
  - *Redirect URLs*: adicione `https://seuusuario.github.io/sala-de-ingles/**`
- **Emails → Templates** (opcional): traduza os textos dos e-mails para português.

> O envio de e-mails do Supabase gratuito é limitado (poucos por hora). Para muitos alunos, configure depois um SMTP próprio (ex.: Resend, Brevo) em *Authentication → Emails → SMTP*.

## Passo 3 — Cadastro da professora e dos alunos

**Professora (uma vez só):** antes de rodar o script do Passo 1, procure no final dele a linha marcada com ✏️ e troque pelo e-mail e data de nascimento dela. (Se já rodou, edite a linha e rode o script de novo — não duplica nada.) Depois ela abre o site → **Primeiro acesso** → cria a senha.

**Alunos (pela professora, no site):** Área da professora → **Pré-cadastrar aluno** → e-mail, data de nascimento e nível (opcional). A lista mostra quem está *Aguardando* e quem já tem *Conta ativa*. Convites ainda não usados podem ser apagados.

Segurança: só quem tem papel *professora* vê e cria convites, e só de alunos. O aluno não vê a lista; o site apenas *pergunta* ao banco se o par e-mail + nascimento existe. E o banco recusa qualquer cadastro que não bata com um convite livre.

## Passo 4 — Publicar no GitHub Pages

1. **github.com → New repository** → nome (ex.: `sala-de-ingles`) → *Public* → Create.
2. *Add file → Upload files* → arraste **todo o conteúdo** desta pasta (os arquivos, não a pasta) → *Commit changes*.
3. **Settings → Pages** → *Source*: **Deploy from a branch** → Branch **main** / **(root)** → Save.
4. Em 1–2 minutos o site fica em `https://seuusuario.github.io/sala-de-ingles/`.
5. Volte ao Passo 2 e confira se a *Site URL* do Supabase está igual a esse endereço.

Quando tiver um domínio próprio, é só configurar em *Settings → Pages → Custom domain*.

## Instalar como app

- **Android (Chrome)**: menu ⋮ → *Instalar app* / *Adicionar à tela inicial*.
- **iPhone (Safari)**: botão Compartilhar → *Adicionar à Tela de Início*.

Ao publicar mudanças, aumente a versão em `sw.js` (`sala-ingles-v1` → `v2`) para os celulares pegarem a versão nova.

## Testar no computador antes de publicar

Na pasta do projeto: `python3 -m http.server 8000` e abra `http://localhost:8000`.
(Abrir o `index.html` com duplo clique não funciona por causa dos módulos JavaScript.)
