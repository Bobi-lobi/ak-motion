insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'landing-images',
  'landing-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "landing images are public" on storage.objects;
drop policy if exists "admins upload landing images" on storage.objects;
drop policy if exists "admins update landing images" on storage.objects;
drop policy if exists "admins delete landing images" on storage.objects;

create policy "landing images are public"
on storage.objects for select
to public
using (bucket_id = 'landing-images');

create policy "admins upload landing images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'landing-images' and public.is_admin());

create policy "admins update landing images"
on storage.objects for update
to authenticated
using (bucket_id = 'landing-images' and public.is_admin())
with check (bucket_id = 'landing-images' and public.is_admin());

create policy "admins delete landing images"
on storage.objects for delete
to authenticated
using (bucket_id = 'landing-images' and public.is_admin());
