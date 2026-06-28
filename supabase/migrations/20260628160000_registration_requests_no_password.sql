alter table public.registration_requests
alter column password drop not null;

update public.registration_requests
set password = null
where password is not null;
