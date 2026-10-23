-- ============================================================
-- BLOCO 2 — PÁGINA DE PERFIL (foto e atualização de cadastro)
-- Rode DEPOIS do 01_login.sql: SQL Editor → New query → Run.
-- Pode rodar de novo sem problema.
-- ============================================================

-- ---------- 1. O que o usuário pode alterar no próprio perfil ----------
-- E-mail e papel continuam bloqueados. Nível: só a professora (regra do bloco 1).
revoke update on public.perfis from authenticated, anon;
grant update (nome, telefone, data_nascimento, avatar_url, nivel) on public.perfis to authenticated;

-- ---------- 2. Pasta de fotos de perfil ----------
-- Pública para leitura (a foto aparece no site), até 2 MB, só imagens.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada usuário só mexe na própria pasta: avatars/<id-do-usuario>/...
drop policy if exists "avatar: ver a própria" on storage.objects;
create policy "avatar: ver a própria" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar: enviar a própria" on storage.objects;
create policy "avatar: enviar a própria" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar: trocar a própria" on storage.objects;
create policy "avatar: trocar a própria" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar: apagar a própria" on storage.objects;
create policy "avatar: apagar a própria" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
