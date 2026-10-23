-- ============================================================
-- BLOCO 3 — HOMEWORK (banco de atividades + correção)
-- Rode DEPOIS do 01 e do 02: SQL Editor → New query → Run.
-- Pode rodar de novo sem problema.
--
-- Como funciona a segurança do gabarito:
--   • O aluno lê as questões, mas NUNCA a coluna "gabarito".
--   • A correção acontece aqui no banco (função enviar_homework),
--     então não dá para descobrir as respostas pelo navegador.
-- ============================================================

-- ---------- 1. Homeworks (a atividade) ----------
create table if not exists public.homeworks (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  nivel         text not null,
  conteudo      text not null,          -- ex.: "Unit 4 – Daily Routine"
  instrucoes    text,
  publicado     boolean not null default false,
  criado_por    uuid references auth.users (id) default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists homeworks_nivel_idx on public.homeworks (nivel, conteudo);
alter table public.homeworks enable row level security;

-- ---------- 2. Questões ----------
-- tipo: multipla | completar | figura | associar | vf | ordenar | escrita
-- dados:    o que o aluno vê (opções, lacunas, imagens…)
-- gabarito: respostas certas — só a professora e a correção leem
create table if not exists public.questoes (
  id          uuid primary key default gen_random_uuid(),
  homework_id uuid not null references public.homeworks (id) on delete cascade,
  ordem       int  not null default 0,
  tipo        text not null check (tipo in ('multipla','completar','figura','associar','vf','ordenar','escrita')),
  enunciado   text not null default '',
  dados       jsonb not null default '{}'::jsonb,
  gabarito    jsonb not null default '{}'::jsonb,
  criado_em   timestamptz not null default now()
);
create index if not exists questoes_hw_idx on public.questoes (homework_id, ordem);
alter table public.questoes enable row level security;

-- ---------- 3. Entregas (respostas dos alunos) ----------
create table if not exists public.entregas (
  id                uuid primary key default gen_random_uuid(),
  homework_id       uuid not null references public.homeworks (id) on delete cascade,
  aluno_id          uuid not null references auth.users (id) on delete cascade,
  respostas         jsonb not null default '{}'::jsonb,
  detalhes          jsonb not null default '[]'::jsonb,   -- pontos por questão
  nota              numeric(4,1),                          -- 0 a 10 (questões automáticas)
  pendente_correcao boolean not null default false,        -- tem resposta escrita
  nota_professora   numeric(4,1),
  comentario        text,
  enviado_em        timestamptz not null default now()
);
create index if not exists entregas_aluno_idx on public.entregas (aluno_id, homework_id, enviado_em desc);
alter table public.entregas enable row level security;

-- ---------- 4. Regras de acesso ----------
-- Homeworks: aluno vê os publicados; professora vê e gerencia todos
drop policy if exists "ver homeworks" on public.homeworks;
create policy "ver homeworks" on public.homeworks for select to authenticated
  using (publicado or public.is_professora());
drop policy if exists "professora altera homework" on public.homeworks;
create policy "professora altera homework" on public.homeworks for update to authenticated
  using (public.is_professora()) with check (public.is_professora());
drop policy if exists "professora apaga homework" on public.homeworks;
create policy "professora apaga homework" on public.homeworks for delete to authenticated
  using (public.is_professora());

revoke all on public.homeworks from anon, authenticated;
grant select, delete on public.homeworks to authenticated;
grant update (titulo, nivel, conteudo, instrucoes, publicado, atualizado_em) on public.homeworks to authenticated;

-- Questões: visíveis se o homework estiver publicado (ou para a professora)
drop policy if exists "ver questoes" on public.questoes;
create policy "ver questoes" on public.questoes for select to authenticated
  using (public.is_professora() or exists (
    select 1 from public.homeworks h where h.id = homework_id and h.publicado));

revoke all on public.questoes from anon, authenticated;
-- ⚠️ sem a coluna "gabarito" de propósito
grant select (id, homework_id, ordem, tipo, enunciado, dados, criado_em) on public.questoes to authenticated;

-- Entregas: aluno vê as próprias; professora vê todas e pode dar nota/comentário
drop policy if exists "ver entregas" on public.entregas;
create policy "ver entregas" on public.entregas for select to authenticated
  using (aluno_id = auth.uid() or public.is_professora());
drop policy if exists "professora avalia entrega" on public.entregas;
create policy "professora avalia entrega" on public.entregas for update to authenticated
  using (public.is_professora()) with check (public.is_professora());

revoke all on public.entregas from anon, authenticated;
grant select on public.entregas to authenticated;
grant update (nota_professora, comentario, pendente_correcao) on public.entregas to authenticated;

-- ---------- 5. Professora: ler questões com gabarito (para editar) ----------
create or replace function public.questoes_com_gabarito(p_homework uuid)
returns setof public.questoes language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_professora() then raise exception 'Apenas a professora.'; end if;
  return query select * from public.questoes where homework_id = p_homework order by ordem;
end $$;
revoke all on function public.questoes_com_gabarito(uuid) from public;
grant execute on function public.questoes_com_gabarito(uuid) to authenticated;

-- ---------- 6. Professora: salvar homework + questões de uma vez ----------
-- p_homework: {id?, titulo, nivel, conteudo, instrucoes, publicado}
-- p_questoes: [{id?, tipo, enunciado, dados, gabarito}, ...] na ordem
create or replace function public.salvar_homework(p_homework jsonb, p_questoes jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_professora() then raise exception 'Apenas a professora.'; end if;
  if coalesce(trim(p_homework ->> 'titulo'), '') = '' then raise exception 'Informe o título.'; end if;

  v_id := nullif(p_homework ->> 'id', '')::uuid;
  if v_id is null then
    insert into public.homeworks (titulo, nivel, conteudo, instrucoes, publicado)
    values (trim(p_homework ->> 'titulo'), p_homework ->> 'nivel', trim(p_homework ->> 'conteudo'),
            nullif(trim(p_homework ->> 'instrucoes'), ''), coalesce((p_homework ->> 'publicado')::boolean, false))
    returning id into v_id;
  else
    update public.homeworks set
      titulo = trim(p_homework ->> 'titulo'),
      nivel = p_homework ->> 'nivel',
      conteudo = trim(p_homework ->> 'conteudo'),
      instrucoes = nullif(trim(p_homework ->> 'instrucoes'), ''),
      publicado = coalesce((p_homework ->> 'publicado')::boolean, false),
      atualizado_em = now()
    where id = v_id;
    if not found then raise exception 'Homework não encontrado.'; end if;
  end if;

  -- remove questões que saíram
  delete from public.questoes
   where homework_id = v_id
     and id not in (select (x ->> 'id')::uuid from jsonb_array_elements(coalesce(p_questoes, '[]')) x
                    where coalesce(x ->> 'id', '') <> '');

  -- cria/atualiza as questões na ordem enviada
  insert into public.questoes as q (id, homework_id, ordem, tipo, enunciado, dados, gabarito)
  select coalesce(nullif(x ->> 'id', '')::uuid, gen_random_uuid()), v_id, (t.ord - 1)::int,
         x ->> 'tipo', coalesce(x ->> 'enunciado', ''),
         coalesce(x -> 'dados', '{}'::jsonb), coalesce(x -> 'gabarito', '{}'::jsonb)
    from jsonb_array_elements(coalesce(p_questoes, '[]')) with ordinality as t(x, ord)
  on conflict (id) do update
    set ordem = excluded.ordem, tipo = excluded.tipo, enunciado = excluded.enunciado,
        dados = excluded.dados, gabarito = excluded.gabarito
    where q.homework_id = excluded.homework_id;

  return v_id;
end $$;
revoke all on function public.salvar_homework(jsonb, jsonb) from public;
grant execute on function public.salvar_homework(jsonb, jsonb) to authenticated;

-- ---------- 7. Correção automática ----------
-- Compara sem diferenciar maiúsculas, espaços extras, apóstrofos e pontuação final.
create or replace function public.normalizar_resposta(t text)
returns text language sql immutable as $$
  select regexp_replace(
           regexp_replace(lower(trim(translate(coalesce(t, ''), '’‘`´', ''''''''''))), '\s+', ' ', 'g'),
           '[\s.!?,;:]+$', '')
$$;

-- p_respostas: { "<id da questão>": resposta, ... }
create or replace function public.enviar_homework(p_homework uuid, p_respostas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  q record; r jsonb; pts numeric; n int; ok int; i int;
  total_auto int := 0; soma numeric := 0; pendente boolean := false;
  detalhes jsonb := '[]'::jsonb; v_nota numeric;
begin
  if auth.uid() is null then raise exception 'Faça login para enviar.'; end if;
  if not exists (select 1 from public.homeworks where id = p_homework and publicado) then
    raise exception 'Homework indisponível.';
  end if;

  for q in select id, tipo, gabarito from public.questoes where homework_id = p_homework order by ordem loop
    r := p_respostas -> (q.id::text);
    pts := null;

    case q.tipo
      when 'multipla', 'figura' then
        pts := case when jsonb_typeof(r) = 'number' and (r #>> '{}')::int = (q.gabarito ->> 'correta')::int then 1 else 0 end;

      when 'vf' then
        pts := case when jsonb_typeof(r) = 'boolean' and (r #>> '{}')::boolean = (q.gabarito ->> 'valor')::boolean then 1 else 0 end;

      when 'completar' then
        n := coalesce(jsonb_array_length(q.gabarito -> 'lacunas'), 0); ok := 0;
        for i in 0 .. n - 1 loop
          if jsonb_typeof(r) = 'array' and exists (
               select 1 from jsonb_array_elements_text(q.gabarito -> 'lacunas' -> i) alt
                where public.normalizar_resposta(alt) = public.normalizar_resposta(r ->> i)) then
            ok := ok + 1;
          end if;
        end loop;
        pts := case when n > 0 then ok::numeric / n else 0 end;

      when 'associar' then
        n := coalesce(jsonb_array_length(q.gabarito -> 'pares'), 0); ok := 0;
        for i in 0 .. n - 1 loop
          if jsonb_typeof(r) = 'array' and (r ->> i) is not null and (r ->> i) = (q.gabarito -> 'pares' ->> i) then
            ok := ok + 1;
          end if;
        end loop;
        pts := case when n > 0 then ok::numeric / n else 0 end;

      when 'ordenar' then
        pts := case when jsonb_typeof(r) = 'string'
                     and public.normalizar_resposta(r #>> '{}') = public.normalizar_resposta(q.gabarito ->> 'frase')
                    then 1 else 0 end;

      else -- 'escrita': a professora corrige depois
        pendente := true;
    end case;

    if pts is not null then total_auto := total_auto + 1; soma := soma + pts; end if;
    detalhes := detalhes || jsonb_build_object('id', q.id, 'pontos', pts, 'gabarito', q.gabarito - 'fonte');
  end loop;

  v_nota := case when total_auto > 0 then round(soma / total_auto * 10, 1) end;

  insert into public.entregas (homework_id, aluno_id, respostas, detalhes, nota, pendente_correcao)
  values (p_homework, auth.uid(), coalesce(p_respostas, '{}'::jsonb), detalhes, v_nota, pendente);

  return jsonb_build_object('nota', v_nota, 'pendente', pendente, 'detalhes', detalhes);
end $$;
revoke all on function public.enviar_homework(uuid, jsonb) from public;
grant execute on function public.enviar_homework(uuid, jsonb) to authenticated;

-- ---------- 8. Imagens das questões ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('homework', 'homework', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "homework img: professora envia" on storage.objects;
create policy "homework img: professora envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'homework' and public.is_professora());
drop policy if exists "homework img: professora vê" on storage.objects;
create policy "homework img: professora vê" on storage.objects for select to authenticated
  using (bucket_id = 'homework' and public.is_professora());
drop policy if exists "homework img: professora apaga" on storage.objects;
create policy "homework img: professora apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'homework' and public.is_professora());
