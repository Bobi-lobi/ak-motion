# Supabase Cloud Setup

Diese Schritte richten AK-Motion auf Supabase Cloud Free ein.

## 1. Projekt erstellen

1. Auf https://supabase.com einloggen.
2. Neues Projekt erstellen.
3. Region moeglichst nah waehlen, z. B. Frankfurt/EU, falls verfuegbar.
4. Datenbankpasswort sicher speichern.

## 2. Schema einspielen

Im Supabase Dashboard:

1. SQL Editor oeffnen.
2. Inhalt von `supabase/cloud-init.sql` einfuegen.
3. Ausfuehren.

Das legt Tabellen, Enums, RLS-Policies und Startdaten an.

## 3. Ersten Admin anlegen

Im Supabase Dashboard:

1. Authentication -> Users oeffnen.
2. User erstellen, z. B. `simon@db.com`.
3. Die User-ID kopieren.
4. Im SQL Editor ausfuehren und die Platzhalter ersetzen:

```sql
insert into public.profiles (id, name, email, role)
values (
  'AUTH_USER_ID_HIER_EINSETZEN',
  'Simon',
  'simon@db.com',
  'admin'
)
on conflict (id) do update
set name = excluded.name,
    email = excluded.email,
    role = excluded.role;
```

## 4. App lokal verbinden

`.env.local` lokal setzen. Keine echten Keys committen.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=DEIN_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=DEIN_SERVICE_ROLE_KEY
NEXT_PUBLIC_FORCE_DEMO_MODE=false
```

Danach:

```bash
npm run dev
```

## 5. Deployment

Beim Hosting dieselben Variablen als Environment Variables setzen.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_FORCE_DEMO_MODE=false`
- `SUPABASE_SERVICE_ROLE_KEY` als Secret

Wichtig: `SUPABASE_SERVICE_ROLE_KEY` nie im Browser, GitHub oder Chat veroeffentlichen.
