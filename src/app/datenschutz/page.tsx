export default function DatenschutzPage() {
  return (
    <main className="legal-page">
      <article className="legal-document">
        <a className="legal-back-link" href="/">
          Zur Startseite
        </a>
        <span className="eyebrow">Rechtliches</span>
        <h1>Datenschutzerklärung</h1>

        <section className="legal-warning">
          <strong>Wichtiger Hinweis vor Veröffentlichung</strong>
          <p>
            Diese Datenschutzerklärung beschreibt die aktuelle technische Umsetzung der App. Die Kontaktdaten der oder des
            Datenschutzbeauftragten der Schule müssen vor einer öffentlichen Veröffentlichung durch die Schule ergänzt und geprüft werden.
          </p>
        </section>

        <section>
          <h2>Verantwortlicher</h2>
          <p>
            Karlsgymnasium Bad Reichenhall
            <br />
            Salzburger Straße 28
            <br />
            83435 Bad Reichenhall
            <br />
            Telefon: +49 (0) 8651 7167 - 0
            <br />
            Fax: +49 (0) 8651 7167 - 128
            <br />
            E-Mail: <a href="mailto:info@karlsgymnasium-bgl.de">info@karlsgymnasium-bgl.de</a>
          </p>
          <p>Vertreten durch: OStD Rainer Dieckmann, Schulleiter</p>
        </section>

        <section>
          <h2>Datenschutzbeauftragte Stelle</h2>
          <p>
            Die Kontaktdaten der zuständigen Datenschutzbeauftragten oder des zuständigen Datenschutzbeauftragten werden vor Veröffentlichung
            durch die Schule ergänzt. Bis dahin können Datenschutzanfragen an die oben genannte E-Mail-Adresse gerichtet werden.
          </p>
        </section>

        <section>
          <h2>Zwecke der Verarbeitung</h2>
          <p>Die App wird zur Organisation des AK-Technik und zur Planung schulischer Veranstaltungen genutzt. Verarbeitet werden Daten für:</p>
          <ul>
            <li>Login, Rollenverwaltung und Profile von Teammitgliedern.</li>
            <li>Bewerbungen neuer Mitglieder und Freischaltung durch Admins.</li>
            <li>Anfragen für Veranstaltungen über das öffentliche Formular.</li>
            <li>Kalender, technische Aufgabenverteilung, Verfügbarkeit und Anwesenheit.</li>
            <li>Interne Wissensseiten, Vorschläge, Equipment-Verwaltung und Startseiteninhalte.</li>
            <li>Technische Sicherheit, Fehleranalyse und Betrieb der Web-App.</li>
          </ul>
        </section>

        <section>
          <h2>Verarbeitete Daten</h2>
          <ul>
            <li>Accountdaten: Name, E-Mail-Adresse, Rolle, optional Telefonnummer und Profilbild.</li>
            <li>Bewerbungen: Name, E-Mail-Adresse, optional Telefonnummer, Status und Zeitstempel. Bewerbungs-Passwörter werden nicht gespeichert.</li>
            <li>
              Veranstaltungsdaten: Titel, Zeitraum, Ort, Art, Status, Kontaktperson, Kontakt-E-Mail, technische Hinweise, Notizen und optionale
              Präsentationsdateien.
            </li>
            <li>Teamplanung: zugewiesene Personen, Bereiche wie Ton, Licht, Umbau oder Kleine, Verfügbarkeit und Teilnahme.</li>
            <li>Inhalte: Wissensseiten, Vorschläge, Equipment-Einträge, Kommentare, Startseitentexte, Bilder und Teamnamen.</li>
            <li>Browserdaten: Session-Informationen, lokale Einstellungen wie Seitenleistenbreite und technische Zwischenspeicher im Browser.</li>
            <li>Server- und Logdaten: IP-Adresse, Zeitpunkt, User-Agent, angefragte URLs und technische Fehlerdaten beim Hostinganbieter.</li>
          </ul>
        </section>

        <section>
          <h2>Rechtsgrundlagen</h2>
          <p>
            Soweit die App für schulische Organisation und Veranstaltungsvorbereitung genutzt wird, erfolgt die Verarbeitung grundsätzlich auf
            Basis von Art. 6 Abs. 1 lit. e DSGVO in Verbindung mit den schulischen Aufgaben. Für freiwillige Angaben, Bilder, öffentlich
            sichtbare Inhalte und hochgeladene Dateien kann zusätzlich eine Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO erforderlich sein.
            Technisch notwendige Verarbeitungen zur Sicherheit und Bereitstellung der App können auf Art. 6 Abs. 1 lit. e oder lit. f DSGVO
            gestützt werden, soweit dies im konkreten Betrieb zulässig ist.
          </p>
        </section>

        <section>
          <h2>Empfänger und Dienstleister</h2>
          <p>
            Zugriff auf interne Daten erhalten nur berechtigte Teammitglieder und Admins entsprechend ihrer Rolle. Für Betrieb und Speicherung
            können folgende Dienstleister eingesetzt werden:
          </p>
          <ul>
            <li>Supabase für Authentifizierung, Datenbank und gespeicherte Inhalte.</li>
            <li>Vercel für Hosting, Auslieferung der Web-App und technische Logs.</li>
            <li>Optional Cloudflare, falls die App später über eine eigene Domain oder einen Tunnel erreichbar gemacht wird.</li>
          </ul>
          <p>
            Mit eingesetzten Dienstleistern sind vor Veröffentlichung passende Verträge zur Auftragsverarbeitung und ein geeigneter
            Projektstandort zu prüfen.
          </p>
        </section>

        <section>
          <h2>Speicherdauer</h2>
          <p>
            Personenbezogene Daten werden nur so lange gespeichert, wie sie für die Organisation des AK-Technik, die Bearbeitung von Anfragen
            oder gesetzliche und schulische Dokumentationspflichten erforderlich sind. Bewerbungen werden nach Entscheidung gelöscht oder nur
            solange gespeichert, wie dies für die Freischaltung notwendig ist. Veranstaltungs- und Anwesenheitsdaten sollten spätestens nach
            Ende des jeweiligen Schuljahres geprüft und gelöscht oder archiviert werden, wenn sie nicht mehr benötigt werden. Hochgeladene
            Dateien und Bilder werden gelöscht, sobald sie nicht mehr erforderlich sind oder eine Einwilligung widerrufen wird.
          </p>
        </section>

        <section>
          <h2>Veröffentlichte Bilder und Inhalte</h2>
          <p>
            Admins dürfen auf der Startseite nur Bilder, Namen, Texte und sonstige Inhalte veröffentlichen, für die die erforderlichen Rechte
            und Einwilligungen vorliegen. Das gilt besonders für Fotos, auf denen Schülerinnen, Schüler oder Lehrkräfte erkennbar sind.
          </p>
        </section>

        <section>
          <h2>Cookies und lokale Speicherung</h2>
          <p>
            Die App verwendet keine Werbe- oder Tracking-Cookies. Für Login, Betrieb und Bedienkomfort können technisch notwendige
            Informationen im Browser gespeichert werden, zum Beispiel Session-Daten, Ansichtsoptionen und lokale Zwischenspeicher. Diese Daten
            können im Browser gelöscht werden; dadurch kann eine erneute Anmeldung erforderlich werden.
          </p>
        </section>

        <section>
          <h2>Betroffenenrechte</h2>
          <p>
            Betroffene Personen haben nach Maßgabe der DSGVO Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
            Widerspruch und Datenübertragbarkeit. Soweit eine Verarbeitung auf Einwilligung beruht, kann diese Einwilligung jederzeit mit
            Wirkung für die Zukunft widerrufen werden.
          </p>
          <p>
            Außerdem besteht das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren. Für öffentliche Schulen in Bayern ist in der
            Regel der Bayerische Landesbeauftragte für den Datenschutz zuständig.
          </p>
        </section>

        <section>
          <h2>Stand</h2>
          <p>28. Juni 2026</p>
        </section>
      </article>
    </main>
  );
}
