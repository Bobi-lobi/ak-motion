alter table public.registration_requests
add column if not exists auth_user_id uuid;
