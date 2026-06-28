drop policy if exists "admins manage events" on public.events;
drop policy if exists "admins manage assignments" on public.event_assignments;
drop policy if exists "admins manage attendance" on public.event_attendance;

create policy "signed in users manage events"
on public.events for all
to authenticated
using (true)
with check (true);

create policy "signed in users manage assignments"
on public.event_assignments for all
to authenticated
using (true)
with check (true);

create policy "signed in users manage attendance"
on public.event_attendance for all
to authenticated
using (true)
with check (true);
