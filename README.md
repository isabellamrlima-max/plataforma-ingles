# ISpeak by Isabella

Plataforma de inglês da professora Isabella: site responsivo (celular e computador), instalável como app (PWA), hospedado no GitHub Pages, com banco de dados no Supabase.

## Organização das pastas

```
plataforma-ingles/
├── index.html                  Login · primeiro acesso · esqueci a senha
├── redefinir-senha.html        Tela aberta pelo link de nova senha
├── perfil.html                 Meu perfil (aluno e professora)
│
├── aluno.html                  Área do aluno (início)
├── aluno-homework.html         Escolher homework por nível e conteúdo
├── aluno-homework-fazer.html   Fazer o homework e ver a nota
│
├── professora.html             Área da professora (início)
├── prof-convites.html          Pré-cadastro de alunos
├── prof-homework.html          Banco de homework (lista)
├── prof-homework-editor.html   Criar / editar homework e questões
│
├── assets/
│   ├── css/
│   │   ├── brand.css           ← cores e fontes da marca (mude a marca só aqui)
│   │   └── app.css             estilos das telas
│   ├── fonts/                  Bodoni Moda e Jost (hospedadas no site)
│   ├── icons/
│   │   ├── sprite.svg          todos os ícones do site
│   │   └── *.png               ícone do app (monograma IS)
│   └── js/
│       ├── config.js           ← URL e chave do Supabase
│       ├── lib/
│       │   ├── core.js         login, perfil, avisos (todas as páginas)
│       │   ├── questoes.js     motor dos 7 tipos de questão
│       │   └── homework-api.js leitura e gravação de homework
│       └── pages/              um arquivo por página (mesmo nome do .html)
│
├── supabase/                   scripts do banco — rodar EM ORDEM
│   ├── 01_login.sql            login, pré-cadastro e perfis
│   ├── 02_perfil.sql           fotos de perfil
│   └── 03_homework.sql         homework, questões, correção automática
│
├── manifest.webmanifest        dados do app (nome, ícone, cores)
├── sw.js                       faz o site funcionar como app / offline
└── .nojekyll                   avisa o GitHub Pages para publicar tudo como está
```

**Regras para manter organizado**
- Cada página nova = um `.html` na raiz + um `.js` com o mesmo nome em `assets/js/pages/`.
- Páginas só da professora começam com `prof-`; só do aluno, com `aluno-`.
- Cores e fontes só em `brand.css`. Ícones novos só em `sprite.svg`.
- Cada bloco novo do banco = um script numerado em `supabase/` (`02_…sql`, `03_…sql`).
- Ao publicar mudanças, aumente a versão em `sw.js` (ex.: `ispeak-v4` → `ispeak-v5`) para os celulares pegarem a versão nova.

## Configuração (resumo)

1. **Supabase:** criar projeto → SQL Editor → rodar os scripts de `supabase/` **em ordem** (01, 02…). No 01, editar antes a linha ✏️ com e-mail e nascimento da professora.
2. **Chaves:** Project Settings → API Keys → colar URL e chave *publishable* em `assets/js/config.js`. Nunca usar a chave *secret* / *service_role*.
3. **Login:** Authentication → URL Configuration
   - Site URL: `https://isabellamrlima-max.github.io/plataforma-ingles/`
   - Redirect URLs: `https://isabellamrlima-max.github.io/plataforma-ingles/**`
4. **GitHub Pages:** repositório público → Settings → Pages → Deploy from a branch → `main` / `(root)`.

## Homework

- **Tipos de questão:** múltipla escolha, completar frase, marcar figura, associar, verdadeiro ou falso, ordenar palavras e resposta escrita.
- **Completar frase:** a resposta vai entre colchetes — `I [wake up] at 7.` Mais de uma resposta aceita: `[don't|do not]`.
- **Correção:** feita no banco de dados. O aluno nunca recebe o gabarito antes de enviar. Maiúsculas, espaços extras e pontuação final não contam como erro.
- **Nota:** de 0 a 10, só com as questões automáticas (completar e associar valem pontos parciais). Resposta escrita fica "aguardando correção da professora".
- O aluno pode refazer quantas vezes quiser; todas as tentativas ficam salvas.

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
