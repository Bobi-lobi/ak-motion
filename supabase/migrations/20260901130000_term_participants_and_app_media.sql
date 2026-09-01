alter type public.assignment_role add value if not exists 'Teilnehmer';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-media',
  'app-media',
  true,
  104857600,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v',
    'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-m4a'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "app media is public" on storage.objects;
drop policy if exists "members upload app media" on storage.objects;
drop policy if exists "members update app media" on storage.objects;
drop policy if exists "members delete app media" on storage.objects;

create policy "app media is public"
on storage.objects for select
to public
using (bucket_id = 'app-media');

create policy "members upload app media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'app-media');

create policy "members update app media"
on storage.objects for update
to authenticated
using (bucket_id = 'app-media')
with check (bucket_id = 'app-media');

create policy "members delete app media"
on storage.objects for delete
to authenticated
using (bucket_id = 'app-media');
