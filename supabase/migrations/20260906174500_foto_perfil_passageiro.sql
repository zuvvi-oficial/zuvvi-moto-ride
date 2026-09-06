-- PPHOTO-1 — Foto de perfil do passageiro
-- Escopo aditivo: nova coluna opcional + bucket privado com acesso apenas ao próprio usuário.

alter table public.usuarios
  add column if not exists foto_perfil_path text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'fotos-perfil',
  'fotos-perfil',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Profile photos owner select'
  ) then
    create policy "Profile photos owner select"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'fotos-perfil'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Profile photos owner insert'
  ) then
    create policy "Profile photos owner insert"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'fotos-perfil'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Profile photos owner update'
  ) then
    create policy "Profile photos owner update"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'fotos-perfil'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
      with check (
        bucket_id = 'fotos-perfil'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Profile photos owner delete'
  ) then
    create policy "Profile photos owner delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'fotos-perfil'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end
$$;
