# Hybrid-Hosting: Vercel + Supabase auf TrueNAS

Die öffentliche Next.js-App läuft auf Vercel. Auth, Datenbank, Realtime und Storage laufen auf dem TrueNAS.

## Öffentliche Dienste

- `https://motion.example.de` -> Vercel
- `https://supabase.example.de` -> Cloudflare Tunnel -> Supabase Kong/API auf dem NAS
- Supabase Studio und PostgreSQL werden nicht öffentlich freigegeben.

Der Cloudflare-Tunnel muss HTTP und WebSockets unterstützen. Eine Router-Portfreigabe ist nicht erforderlich.

## Supabase vorbereiten

1. Datenbank sichern.
2. Alle Dateien aus `supabase/migrations/` in zeitlicher Reihenfolge anwenden.
3. Insbesondere `20260831100000_landing_image_storage.sql` ausführen.
4. Prüfen, dass der Bucket `landing-images` öffentlich lesbar ist.
5. In der Supabase-Auth-Konfiguration setzen:
   - `SITE_URL=https://motion.example.de`
   - erlaubte Redirect-URL: `https://motion.example.de/**`
6. In Kong/Reverse-Proxy die öffentliche externe URL auf `https://supabase.example.de` setzen.

## Vercel-Variablen

Für Production, Preview und Development setzen:

```text
NEXT_PUBLIC_SUPABASE_URL=https://supabase.example.de
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY DES NAS>
NEXT_PUBLIC_FORCE_DEMO_MODE=false
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY DES NAS>
```

`SUPABASE_SERVICE_ROLE_KEY` ist geheim. Der Anon-Key darf im Browser vorkommen; die Sicherheit entsteht durch RLS.

Nach einer Änderung an `NEXT_PUBLIC_*` muss die App neu gebaut und deployed werden.

## Abnahme

- Landingpage und öffentliche Bilder ohne Login laden.
- Login funktioniert über die öffentliche Domain.
- Zwei Browser sehen Kalender-/Dokumentänderungen live.
- Admin kann ein Bild hochladen; die Datenbank enthält danach nur eine URL, kein `data:image/...`.
- Registrierung und Freigabe funktionieren.
- NAS-Neustart und anschließende Wiederherstellung testen.
- Regelmäßige Backups von PostgreSQL und dem Storage-Volume einrichten.
