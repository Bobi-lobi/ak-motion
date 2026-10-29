# Sicherheitsprüfung vom 29. Oktober 2026

## Umfang und Ergebnis

Geprüft wurden die Paketabhängigkeiten, gespeicherte HTML-Ausgaben, zentrale Uploads,
Storage-Regeln im Repository und die verwendete Laufzeit. Dies ist eine Codeprüfung,
kein vollständiger Penetrationstest des laufenden NAS oder seiner Container.

- Motion verwendet Next.js/Node.js (auch im Dockerfile), kein PHP. Die PHP-Meldungen
  CVE-2026-109618 / CVE-2026-109619 und CVE-2026-115560 betreffen diesen App-Code
  nicht direkt. Andere NAS-Anwendungen wurden nicht auf installierte PHP-Versionen geprüft.
- Next.js wurde auf 15.5.28 aktualisiert; source-map-js auf 1.2.2.
- `npm audit` meldete nach den Updates keine bekannten Schwachstellen, einschließlich
  Entwicklungsabhängigkeiten. Das ist keine Zusicherung, dass keine weiteren Lücken existieren.
- Gespeichertes HTML wird beim Anzeigen und beim Einlesen in den Seiteneditor mit
  DOMPurify bereinigt. Fremde Iframes werden entfernt, Speicher-Vorschauen erhalten
  eine Sandbox ohne Skriptfreigabe. Sicherheitsheader wurden ergänzt.
- Die neuen direkten Uploads verwenden ausschließlich die vorhandene Nutzersitzung
  und denselben Supabase-Storage-Zugriff. Dienstrollenschlüssel werden nicht verwendet.
- Nach den im Repository vorhandenen Regeln konnten angemeldete Nutzer auch fremde
  App-Medien verändern/löschen. Die folgende Migration begrenzt das auf Eigentümer
  beziehungsweise Administratoren. Sie muss noch auf dem NAS ausgeführt werden.

## Noch auf dem NAS ausführen

Auf dem Mac im Projektverzeichnis:

```sh
scp supabase/migrations/20261029120000_media_owner_permissions.sql truenas_admin@192.168.254.152:~/media-owner-permissions.sql
ssh -t truenas_admin@192.168.254.152 'sudo docker cp ~/media-owner-permissions.sql supabase-db:/tmp/media-owner-permissions.sql && sudo docker exec supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f /tmp/media-owner-permissions.sql'
```

Über Tailscale kann stattdessen die bisher verwendete Adresse `100.65.201.37`
eingesetzt werden. Die Migration läuft in einer Transaktion und kann erneut
ausgeführt werden. Vor einer Anwendung auf einer abweichenden Storage-Version
muss die dortige Spalte `storage.objects.owner` geprüft werden.

## Offener Datenschutzpunkt

Der bestehende Bucket `app-media` ist öffentlich. Wer die genaue Datei-URL erhält,
kann Anhänge auch ohne Chatmitgliedschaft abrufen. UUID-Dateinamen ersetzen keine
Zugriffskontrolle. Das wird durch die Eigentümer-Migration nicht behoben.
Eine vollständige Umstellung benötigt einen privaten Bucket, Zugriffsregeln pro
Chat/Seite und zeitlich begrenzte Links sowie eine Migration bestehender Inhalte.
Ein pauschales Umschalten würde bestehende Bilder und Dokumente unzugänglich machen.

## Quellen

- PHP: https://www.php.net/archive/2026.php
- Next.js: https://github.com/advisories/GHSA-2464-fhr4-w9xw
