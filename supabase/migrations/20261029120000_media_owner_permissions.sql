begin;

-- Existing files keep their URLs. Authenticated members must not overwrite or
-- delete another member's uploads simply by knowing the storage object path.
drop policy if exists "members update app media" on storage.objects;
drop policy if exists "members delete app media" on storage.objects;

create policy "members update app media"
on storage.objects for update to authenticated
using (bucket_id = 'app-media' and (
  owner = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
))
with check (bucket_id = 'app-media' and (
  owner = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
));

create policy "members delete app media"
on storage.objects for delete to authenticated
using (bucket_id = 'app-media' and (
  owner = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
));

commit;
