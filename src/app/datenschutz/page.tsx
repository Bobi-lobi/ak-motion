export default function DatenschutzPage() {
  return (
    <main className="legal-page">
      <article className="legal-document">
        <a className="legal-back-link" href="/">
          Zur Startseite
        </a>
        <span className="eyebrow">Rechtliches</span>
        <h1>Datenschutzerklärung</h1>

        <section>
          <h2>1. Verantwortlicher</h2>
          <p>Verantwortlich für die Verarbeitung personenbezogener Daten im Rahmen dieser Webanwendung ist:</p>
          <p>
            Hubert Moorheimer
            <br />
            Flachwinklweg 1
            <br />
            83999 Breixbrunn
          </p>
          <p>
            E-Mail: <a href="mailto:info@moorheimer.de">info@moorheimer.de</a>
          </p>
        </section>

        <section>
          <h2>2. Zweck der Verarbeitung</h2>
          <p>
            AK Motion ist eine Webanwendung zur Organisation des AK Technik am Karlsgymnasium Bad Reichenhall. Die Verarbeitung
            personenbezogener Daten erfolgt ausschließlich zur Durchführung und Organisation schulischer Veranstaltungen und der internen
            Zusammenarbeit des AK Technik.
          </p>
          <p>Insbesondere werden Daten verarbeitet für:</p>
          <ul>
            <li>Benutzerverwaltung und Anmeldung</li>
            <li>Rollen- und Rechteverwaltung</li>
            <li>Verwaltung von Teammitgliedern</li>
            <li>Bewerbungen neuer Mitglieder</li>
            <li>Planung und Organisation von Veranstaltungen</li>
            <li>Verwaltung von Verfügbarkeiten und Diensteinteilungen</li>
            <li>Equipmentverwaltung</li>
            <li>interne Wissensseiten</li>
            <li>Bearbeitung von Veranstaltungsanfragen</li>
            <li>Gewährleistung eines sicheren und stabilen Betriebs der Anwendung</li>
          </ul>
        </section>

        <section>
          <h2>3. Verarbeitete personenbezogene Daten</h2>

          <h3>Benutzerkonten</h3>
          <ul>
            <li>Vor- und Nachname</li>
            <li>E-Mail-Adresse</li>
            <li>Benutzerrolle</li>
            <li>optional Telefonnummer</li>
            <li>optional Profilbild</li>
          </ul>
          <p>Passwörter werden nicht im Klartext gespeichert. Die Authentifizierung erfolgt über Supabase Authentication.</p>

          <h3>Bewerbungen</h3>
          <ul>
            <li>Name</li>
            <li>E-Mail-Adresse</li>
            <li>optional Telefonnummer</li>
            <li>Zeitpunkt der Bewerbung</li>
            <li>Bewerbungsstatus</li>
          </ul>

          <h3>Veranstaltungsdaten</h3>
          <ul>
            <li>Veranstaltungstitel</li>
            <li>Ort</li>
            <li>Zeitraum</li>
            <li>Art der Veranstaltung</li>
            <li>Ansprechpartner</li>
            <li>Kontakt-E-Mail</li>
            <li>technische Anforderungen</li>
            <li>interne Notizen</li>
            <li>hochgeladene Dateien (optional)</li>
          </ul>

          <h3>Teamplanung</h3>
          <ul>
            <li>Verfügbarkeiten</li>
            <li>Anwesenheit</li>
            <li>Aufgabenbereiche</li>
            <li>Diensteinteilungen</li>
          </ul>

          <h3>Inhalte</h3>
          <ul>
            <li>Wissensseiten</li>
            <li>Vorschläge</li>
            <li>Kommentare</li>
            <li>Equipmenteinträge</li>
            <li>Startseitentexte</li>
            <li>Bilder</li>
          </ul>
        </section>

        <section>
          <h2>4. Server- und Protokolldaten</h2>
          <p>Beim Aufruf der Webanwendung werden technisch erforderliche Informationen verarbeitet. Hierzu gehören insbesondere:</p>
          <ul>
            <li>IP-Adresse</li>
            <li>Datum und Uhrzeit</li>
            <li>Browsertyp</li>
            <li>Betriebssystem</li>
            <li>aufgerufene Seiten</li>
            <li>technische Fehlermeldungen</li>
          </ul>
          <p>Diese Daten dienen ausschließlich dem sicheren Betrieb der Anwendung.</p>
        </section>

        <section>
          <h2>5. Rechtsgrundlagen</h2>
          <p>
            Soweit die Webanwendung zur Organisation schulischer Veranstaltungen genutzt wird, erfolgt die Verarbeitung personenbezogener Daten
            auf Grundlage der jeweils einschlägigen datenschutzrechtlichen Bestimmungen.
          </p>
          <p>Soweit erforderlich, erfolgt die Verarbeitung</p>
          <ul>
            <li>aufgrund einer Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO,</li>
            <li>zur Erfüllung berechtigter Interessen gemäß Art. 6 Abs. 1 lit. f DSGVO,</li>
            <li>oder auf Grundlage der für den schulischen Einsatz einschlägigen gesetzlichen Vorschriften.</li>
          </ul>
        </section>

        <section>
          <h2>6. Eingesetzte Dienstleister</h2>
          <p>Für den Betrieb der Webanwendung werden externe Dienstleister eingesetzt.</p>

          <h3>Supabase</h3>
          <p>Supabase wird für Authentifizierung, Datenbank und Dateispeicherung eingesetzt.</p>

          <h3>Vercel</h3>
          <p>
            Vercel wird für das Hosting der Webanwendung eingesetzt. Hierbei können technisch notwendige Server- und Protokolldaten verarbeitet
            werden.
          </p>
          <p>Soweit gesetzlich erforderlich, werden mit eingesetzten Dienstleistern geeignete Vereinbarungen zur Auftragsverarbeitung abgeschlossen.</p>
        </section>

        <section>
          <h2>7. Speicherdauer</h2>
          <p>
            Personenbezogene Daten werden nur so lange gespeichert, wie dies für den jeweiligen Zweck erforderlich ist. Nicht mehr benötigte
            personenbezogene Daten werden gelöscht oder anonymisiert, sofern keine gesetzlichen Aufbewahrungspflichten bestehen. Bewerbungen
            werden nach Abschluss des Bewerbungsverfahrens gelöscht, sofern keine weitere Speicherung erforderlich ist.
          </p>
        </section>

        <section>
          <h2>8. Cookies und lokale Speicherung</h2>
          <p>
            AK Motion verwendet keine Werbe- oder Marketing-Cookies. Für den Betrieb der Anwendung können technisch notwendige Cookies oder
            vergleichbare Speichertechnologien eingesetzt werden. Hierzu gehören insbesondere:
          </p>
          <ul>
            <li>Login-Sitzungen</li>
            <li>Sicherheitstoken</li>
            <li>lokale Benutzereinstellungen</li>
          </ul>
          <p>Diese sind für den Betrieb der Anwendung erforderlich.</p>
        </section>

        <section>
          <h2>9. Veröffentlichung von Bildern</h2>
          <p>
            Bilder sowie personenbezogene Inhalte werden nur veröffentlicht, sofern hierfür die erforderlichen Rechte beziehungsweise
            Einwilligungen vorliegen.
          </p>
        </section>

        <section>
          <h2>10. Rechte betroffener Personen</h2>
          <p>Betroffene Personen haben nach Maßgabe der Datenschutz-Grundverordnung insbesondere das Recht auf</p>
          <ul>
            <li>Auskunft,</li>
            <li>Berichtigung,</li>
            <li>Löschung,</li>
            <li>Einschränkung der Verarbeitung,</li>
            <li>Widerspruch,</li>
            <li>Datenübertragbarkeit.</li>
          </ul>
          <p>Erteilte Einwilligungen können jederzeit mit Wirkung für die Zukunft widerrufen werden.</p>
        </section>

        <section>
          <h2>11. Beschwerderecht</h2>
          <p>
            Betroffene Personen haben das Recht, sich bei einer zuständigen Datenschutzaufsichtsbehörde über die Verarbeitung ihrer
            personenbezogenen Daten zu beschweren.
          </p>
        </section>

        <section>
          <h2>12. Stand</h2>
          <p>Stand: Juni 2026</p>
        </section>
      </article>
    </main>
  );
}
