-- ============================================================
-- BLOCO 1 — LOGIN, PRÉ-CADASTRO E PERFIS
-- Cole tudo no Supabase: SQL Editor → New query → Run.
-- Pode rodar de novo sem problema (é idempotente).
-- ============================================================

-- ---------- 1. Pré-cadastro (feito pela professora) ----------
-- E-mail + data de nascimento que liberam o primeiro acesso.
create table if not exists public.pre_cadastro (
  id              bigint generated always as identity primary key,
  email           text not null,
  data_nascimento date not null,
  papel           text not null default 'aluno' check (papel in ('aluno', 'professora')),
  nivel           text,                -- opcional: já define o nível do aluno
  usado_em        timestamptz,         -- preenchido quando o aluno cria a conta
  criado_em       timestamptz not null default now()
);
create unique index if not exists pre_cadastro_email_idx on public.pre_cadastro (lower(email));
alter table public.pre_cadastro enable row level security;

-- ---------- 2. Perfis (criados automaticamente no cadastro) ----------
create table if not exists public.perfis (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  nome            text not null,
  telefone        text,
  data_nascimento date not null,
  papel           text not null check (papel in ('aluno', 'professora')),
  nivel           text,                -- Básico, Intermediário, Avançado...
  avatar_url      text,
  criado_em       timestamptz not null default now()
);
alter table public.perfis enable row level security;

-- É professora? (usada nas regras de acesso)
create or replace function public.is_professora()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'professora');
$$;

drop policy if exists "ver o próprio perfil ou professora vê todos" on public.perfis;
create policy "ver o próprio perfil ou professora vê todos" on public.perfis
  for select to authenticated
  using (id = auth.uid() or public.is_professora());

drop policy if exists "editar o próprio perfil ou professora edita" on public.perfis;
create policy "editar o próprio perfil ou professora edita" on public.perfis
  for update to authenticated
  using (id = auth.uid() or public.is_professora())
  with check (id = auth.uid() or public.is_professora());

-- Pelo site só dá para mudar estas colunas (papel e e-mail nunca)
grant select on public.perfis to authenticated;
revoke update on public.perfis from authenticated, anon;
grant update (nome, telefone, avatar_url, nivel) on public.perfis to authenticated;

-- Aluno não pode mudar o próprio nível
create or replace function public.proteger_nivel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.nivel is distinct from old.nivel and not public.is_professora() then
    raise exception 'Só a professora pode alterar o nível.';
  end if;
  return new;
end $$;
drop trigger if exists perfis_proteger_nivel on public.perfis;
create trigger perfis_proteger_nivel before update on public.perfis
  for each row execute function public.proteger_nivel();

-- ---------- 3. Conferência do primeiro acesso ----------
-- Retorna: 'ok' | 'nao_encontrado' | 'ja_cadastrado'
create or replace function public.verificar_pre_cadastro(p_email text, p_nascimento date)
returns text language plpgsql security definer set search_path = public as $$
declare r public.pre_cadastro;
begin
  select * into r from public.pre_cadastro
   where lower(email) = lower(trim(p_email)) and data_nascimento = p_nascimento;
  if not found then return 'nao_encontrado'; end if;
  if r.usado_em is not null then return 'ja_cadastrado'; end if;
  return 'ok';
end $$;
revoke all on function public.verificar_pre_cadastro(text, date) from public;
grant execute on function public.verificar_pre_cadastro(text, date) to anon, authenticated;

-- ---------- 4. Trava de segurança no cadastro ----------
-- Toda conta nova é conferida AQUI, no banco. Se e-mail + nascimento
-- não baterem com um pré-cadastro livre, a conta NÃO é criada.
create or replace function public.criar_perfil_novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.pre_cadastro;
begin
  select * into r from public.pre_cadastro
   where lower(email) = lower(new.email)
     and data_nascimento = nullif(new.raw_user_meta_data ->> 'data_nascimento', '')::date
     and usado_em is null
   for update;

  if not found then
    raise exception 'Cadastro não autorizado para %', new.email;
  end if;

  insert into public.perfis (id, email, nome, telefone, data_nascimento, papel, nivel)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data ->> 'telefone'), ''),
    r.data_nascimento,
    r.papel,
    r.nivel
  );

  update public.pre_cadastro set usado_em = now() where id = r.id;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- ---------- 5. A professora faz o pré-cadastro pelo site ----------
-- E-mail sempre guardado em minúsculas e sem espaços
create or replace function public.normalizar_pre_cadastro()
returns trigger language plpgsql as $$
begin
  new.email := lower(trim(new.email));
  return new;
end $$;
drop trigger if exists pre_cadastro_normalizar on public.pre_cadastro;
create trigger pre_cadastro_normalizar before insert or update on public.pre_cadastro
  for each row execute function public.normalizar_pre_cadastro();

-- Só a professora vê a lista de convites (aluno não vê nada)
drop policy if exists "professora vê convites" on public.pre_cadastro;
create policy "professora vê convites" on public.pre_cadastro
  for select to authenticated
  using (public.is_professora());

-- Só a professora cria convites, e apenas de ALUNOS
drop policy if exists "professora cria convites de aluno" on public.pre_cadastro;
create policy "professora cria convites de aluno" on public.pre_cadastro
  for insert to authenticated
  with check (public.is_professora() and papel = 'aluno' and usado_em is null);

-- Pode corrigir ou apagar só convites ainda não usados
drop policy if exists "professora corrige convite pendente" on public.pre_cadastro;
create policy "professora corrige convite pendente" on public.pre_cadastro
  for update to authenticated
  using (public.is_professora() and usado_em is null and papel = 'aluno')
  with check (public.is_professora() and usado_em is null and papel = 'aluno');

drop policy if exists "professora apaga convite pendente" on public.pre_cadastro;
create policy "professora apaga convite pendente" on public.pre_cadastro
  for delete to authenticated
  using (public.is_professora() and usado_em is null and papel = 'aluno');

revoke all on public.pre_cadastro from anon;
grant select, insert, delete on public.pre_cadastro to authenticated;
revoke update on public.pre_cadastro from authenticated;
grant update (email, data_nascimento, nivel) on public.pre_cadastro to authenticated;

-- ============================================================
-- 6. CADASTRO DA PROFESSORA  ✏️  EDITE A LINHA MARCADA ABAIXO
-- Troque o e-mail e a data de nascimento (AAAA-MM-DD) pelos dela.
-- Depois ela entra no site → "Primeiro acesso".
-- ============================================================
with dados (email, nascimento) as (
  values ('email-da-professora@gmail.com', date '1990-05-20')   -- ✏️ edite aqui
)
insert into public.pre_cadastro (email, data_nascimento, papel)
select email, nascimento, 'professora' from dados
where not exists (
  select 1 from public.pre_cadastro p, dados d where lower(p.email) = lower(d.email)
);
