# AK-Motion

Web-App für ein Schul-Technikteam: Kalender, QR-Anfragen, Verfuegbarkeit, Einsatzplanung und Statistik.

## Lokaler Start

```bash
npm install
npm run dev
```

Danach im Browser `http://localhost:3000` oeffnen.

Demo-Logins:

- Admin: `admin@ak-motion.local` / `admin123`
- Techniker: `mara@ak-motion.local` / `technik123`

Ohne Supabase-Konfiguration laeuft die App im Demo-Modus mit `localStorage`. Dadurch koennen UI und Workflows sofort getestet werden.

## Supabase verbinden

1. Neues Supabase-Projekt erstellen.
2. `supabase/schema.sql` im SQL Editor ausfuehren.
3. `.env.example` nach `.env.local` kopieren und Werte setzen:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

4. Auth-Benutzer in Supabase anlegen und passende Datensaetze in `profiles` erstellen.

Fuer Supabase Cloud Free siehe `supabase/cloud-setup.md`.

## Enthaltene Version-1-Workflows

- `/login`: E-Mail/Passwort Login.
- `/calendar`: Monats- und Listenansicht, Rueckmeldungen, Admin-Einteilung und Anwesenheit.
- `/requests`: Admin-Inbox fuer QR-Anfragen.
- `/team`: Admin-Teamverwaltung.
- `/analytics`: Jahresdiagramme fuer echte Anwesenheit und Veranstaltungen pro Monat.
- `/request/default`: oeffentliches Anfrageformular fuer QR-Codes.

## Naechste sinnvolle Ausbaustufen

- Supabase-Datenzugriffe vollstaendig fuer alle CRUD-Aktionen aktivieren.
- Echte Admin-Erstellung von Auth-Accounts per Supabase Edge Function.
- Dokumentenbereich und Equipment-Datenbank als Version 2.
- QR-Code-Download fuer `/request/default`.
