# ISpeak by Isabella

Plataforma de inglês da professora Isabella: site responsivo (celular e computador), instalável como app (PWA), hospedado no GitHub Pages, com banco de dados no Supabase.

## Organização das pastas

```
plataforma-ingles/
├── index.html              Login · primeiro acesso · esqueci a senha
├── aluno.html              Área do aluno
├── professora.html         Área da professora
├── convites.html           Pré-cadastro de alunos (professora)
├── redefinir-senha.html    Tela aberta pelo link de nova senha
│
├── assets/
│   ├── css/
│   │   ├── brand.css       ← cores e fontes da marca (mude a marca só aqui)
│   │   └── app.css         estilos das telas
│   ├── fonts/              fontes Bodoni Moda e Jost (hospedadas no site)
│   ├── icons/
│   │   ├── sprite.svg      todos os ícones do site
│   │   └── *.png           ícone do app (monograma IS)
│   └── js/
│       ├── config.js       ← URL e chave do Supabase
│       ├── lib/core.js     funções usadas por todas as páginas
│       └── pages/          um arquivo por página (login.js, aluno.js…)
│
├── supabase/
│   └── 01_login.sql        script do banco (bloco 1)
│
├── manifest.webmanifest    dados do app (nome, ícone, cores)
├── sw.js                   faz o site funcionar como app / offline
└── .nojekyll               avisa o GitHub Pages para publicar tudo como está
```

**Regras para manter organizado**
- Cada página nova = um `.html` na raiz + um `.js` em `assets/js/pages/`.
- Cores e fontes só em `brand.css`. Ícones novos só em `sprite.svg`.
- Cada bloco novo do banco = um script numerado em `supabase/` (`02_…sql`, `03_…sql`).
- Ao publicar mudanças, aumente a versão em `sw.js` (`ispeak-v3` → `ispeak-v4`) para os celulares pegarem a versão nova.

## Configuração (resumo)

1. **Supabase:** criar projeto → SQL Editor → rodar `supabase/01_login.sql` (antes, editar a linha ✏️ com e-mail e nascimento da professora).
2. **Chaves:** Project Settings → API Keys → colar URL e chave *publishable* em `assets/js/config.js`. Nunca usar a chave *secret* / *service_role*.
3. **Login:** Authentication → URL Configuration
   - Site URL: `https://isabellamrlima-max.github.io/plataforma-ingles/`
   - Redirect URLs: `https://isabellamrlima-max.github.io/plataforma-ingles/**`
4. **GitHub Pages:** repositório público → Settings → Pages → Deploy from a branch → `main` / `(root)`.

## Como funciona o acesso

- A **professora** é cadastrada uma única vez pelo script SQL e ativa a conta em "Primeiro acesso".
- Ela cadastra os **alunos** em *Pré-cadastrar aluno* (e-mail + nascimento + nível).
- O aluno usa "Primeiro acesso", confirma esses dados e cria a senha.
- O banco recusa qualquer cadastro sem convite válido, e só a professora vê a lista de convites.

## Instalar como app

- **Android (Chrome):** menu ⋮ → *Instalar app*.
- **iPhone (Safari):** Compartilhar → *Adicionar à Tela de Início*.

## Testar no computador

Na pasta do projeto: `python3 -m http.server 8000` → abrir `http://localhost:8000`.
