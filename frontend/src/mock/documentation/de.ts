import type { DocumentationSection } from '../../types';

export const deDocumentationSections: DocumentationSection[] = [
  // ─── 1. Overview ──────────────────────────────────────────────────
  {
    id: 'overview',
    title: 'SatQuery AI Übersicht',
    shortDescription: 'Multimodale Plattform für Satellitenaufklärung, die natürlichsprachige Anfragen in evidenzbasierte visuelle Beobachtungen übersetzt.',
    category: 'core',
    icon: 'Compass',
    isDemo: true,
    flowDiagram: [
      'Benutzerabfrage',
      'Query Agent',
      'Analyse-Workflow',
      'Dualer Bildbetrachter',
      'Räumliche Evidenz',
      'Konfidenzbewertung',
      'Aufklärungsbericht',
    ],
    content: [
      'SatQuery AI ist eine interaktive Aufklärungsschnittstelle für die Fernerkundung (Remote Sensing), die entwickelt wurde, um die Komplexität der Gewinnung von Geodaten aus multitemporalen und multimodalen Satellitenbildern zu beseitigen.',
      'Anstelle manueller GIS-Bandalgebra, mühsamer visueller Fotointerpretation oder isolierter Geodaten-Tools stellen Operateure natürlichsprachige Fragen direkt an den Arbeitsbereich. SatQuery AI leitet Anfragen über spezialisierte analytische Arbeitsabläufe weiter, verknüpft Beobachtungen mit Pixelregionen (Grounding), korreliert Multisensor-Schichten und erstellt herunterladbare Verifizierungsberichte.',
      'Die aktuelle Plattform stellt eine hochpräzise Frontend-Demonstration für die SIH26167-Evaluierung dar, die vorkalibrierte Fernerkundungs-Schlussfolgerungsworkflows auf echten Satellitenszenen ausführt.',
    ],
    subsections: [
      {
        id: 'core-workflow',
        title: 'End-to-End-Abfragelebenszyklus',
        content: [
          '1. Natürlichsprachige Erfassung: Der Benutzer gibt eine Abfrage ein oder wählt aus vordefinierten Szenarien.',
          '2. Query Agent Verständnis: Semantisches Intent-Routing weist die Abfrage dem richtigen Analysemodus und Werkzeug zu.',
          '3. Arbeitsbereich-Aktivierung: Die interaktive Bildleinwand konfiguriert Einzel-, bitemporale oder Multisensor-Ansichten.',
          '4. Evidenz & Grounding: Visuelle Bounding-Boxen, räumliche Masken und Mehrfaktor-Konfidenzindizes verknüpfen Erkenntnisse mit der Realität.',
          '5. Synthese & Export: Beobachtungen werden im Ergebnis-Panel zusammengefasst und können in Berichte in Publikationsqualität exportiert werden.',
        ],
        callout: {
          type: 'note',
          text: 'Die vorliegende Anwendung ist eine Frontend-Demonstrations-Sandbox. Abfragen und Workflows laufen auf kuratierten Benchmarkszenen mit simulierter Backend-Ausführung.',
        },
      },
    ],
  },

  // ─── 2. System Architecture ───────────────────────────────────────
  {
    id: 'architecture',
    title: 'Systemarchitektur',
    shortDescription: 'Überblick über die Frontend-Architektur und saubere Trennungsgrenzen für zukünftige Backend- und Modellintegrationen.',
    category: 'core',
    icon: 'Network',
    flowDiagram: [
      'Benutzeroberfläche (React 19)',
      'Query-Agent-Overlay',
      'Duale Bildleinwand',
      'Ebenen- & Grounding-Engines',
      'Serviceschicht (api.ts)',
      'Zentraler Datenspeicher',
      'Zukünftige Backend-API',
    ],
    content: [
      'SatQuery AI wurde mit einer strikten Trennung zwischen Präsentationskomponenten, Zustandsorchestrierung und Datenzugriffsdiensten entwickelt. Dies stellt sicher, dass der Übergang von Demonstrations-Mockdaten zu cloudbasierten VLM-Endpunkten keine Umschreibung von Komponenten erfordert.',
      'Der Arbeitsbereich basiert auf einem erweiterbaren Layout: eine Anwendungshülle für Design- und Benachrichtigungskontexte, eine sekundäre Seitenleiste zur Werkzeugauswahl, eine interaktive Hochleistungs-Doppelleinwand, ein AI-Ausführungsüberwachungs-Drawer und eine Aufklärungsinspektorspalte.',
    ],
    subsections: [
      {
        id: 'arch-separation',
        title: 'Aktuelles Frontend vs. Geplantes Backend',
        content: [
          '• Aktuelle Demonstrationsumgebung: Der React-Client kommuniziert mit einer asynchronen Service-Abstraktionsschicht (`src/services/api.ts`), die zentralisierte Mock-Datensätze, vorberechnete Evidenzgraphen und Demonstrations-Metadaten zurückgibt.',
          '• Zukünftige Produktionsarchitektur (Geplant): Dieselbe Serviceschicht wird REST/WebSocket-Anfragen an ein containerisiertes Python-Backend senden, das Vision-Language-Model (VLM) Routing, räumliches Kacheln mit GDAL/Rasterio und Vektorsuch-Embeddings ausführt.',
        ],
        codeBlock: {
          language: 'typescript',
          code: `// Saubere Service-Grenze in src/services/api.ts:
// AKTUELL: Delegiert an zentralisierte Mock-Datensätze
export async function submitAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
  return executeMockAnalysis(request);
}

// ZUKUNFT (Geplant): Direkter Backend-Proxy-Ersatz
export async function submitAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
  const response = await fetch('/api/v1/analysis', {
    method: 'POST',
    body: JSON.stringify(request)
  });
  return response.json();
}`,
        },
        callout: {
          type: 'info',
          text: 'Keine UI-Komponente importiert Mock-Dateien direkt. Alle Komponenten nutzen typisierte Domänenverträge über die Serviceabstraktion.',
        },
      },
    ],
  },

  // ─── 3. Query Agent ───────────────────────────────────────────────
  {
    id: 'query-agent',
    title: 'Query Agent Pipeline',
    shortDescription: 'Natürlichsprachige Orchestrierungsschicht, die Bedieneranweisungen an spezialisierte analytische Fernerkundungsfunktionen weiterleitet.',
    category: 'agent',
    icon: 'Bot',
    flowDiagram: [
      'Abfrage-Erfassung',
      'Semantische Intent-Analyse',
      'Funktionsklassifizierung',
      'Werkzeugmodusauswahl',
      'Leinwand-Rekonfiguration',
      'Arbeitsbereich-Ausführung',
    ],
    content: [
      'Der Query Agent dient als intelligenter Einstiegspunkt in natürlicher Sprache für das SatQuery AI-System. Anstatt den Analysten zur manuellen Auswahl von Rasteralgorithmen oder Bandkombinationen zu zwingen, interpretiert der Query Agent die Benutzerabsicht und aktiviert den geeigneten Spezialistenmodus.',
      'Das über den oberen Starter oder die dedizierte sekundäre Seitenleiste zugängliche Query-Agent-Overlay bietet eine fokussierte Eingabe mit automatischen Vorschlägen und Funktionsempfehlungen.',
    ],
    subsections: [
      {
        id: 'agent-routing',
        title: 'Fähigkeits-Routing-Logik',
        content: [
          'Der Query Agent klassifiziert eingehende Abfragen basierend auf sprachlichen Hinweisen und Sensoranforderungen in eines der sechs spezialisierten Analysewerkzeuge:',
          '• Grounding-Absicht: Anfragen nach Zählungen, Gebäudestandorten oder räumlicher Identifizierung aktivieren das Object Grounding-Tool.',
          '• Temporale Absicht: Anfragen, die Unterschiede, Erweiterungen oder Jahresvergleiche erwähnen, lösen Change Analysis oder Change VQA aus.',
          '• Multimodale Absicht: Anfragen, die sich auf Radarrückstreuung, Feuchtigkeit oder sensorübergreifende Verifizierung beziehen, aktivieren das Optical + SAR-Tool.',
          '• Interpretative Absicht: Offene Kompositionsanfragen lösen Scene Captioning oder Single Image VQA aus.',
        ],
        callout: {
          type: 'tip',
          text: 'Der Query Agent arbeitet unabhängig von der Bildkategorie, sodass Analysten zwischen Single-, Compare- und Fusion-Ansichten wechseln können, ohne ihren aktiven Abfragezustand zu verlieren.',
        },
      },
    ],
  },

  // ─── 4. Analysis Capabilities ─────────────────────────────────────
  {
    id: 'capabilities',
    title: 'Analysefunktionen',
    shortDescription: 'Detaillierte Aufschlüsselung der sechs zentralen analytischen Fernerkundungsfunktionen im Arbeitsbereich.',
    category: 'agent',
    icon: 'Layers',
    content: [
      'SatQuery AI implementiert sechs spezialisierte Funktionen, die das gesamte Spektrum der Satellitenbildinterpretation abdecken.',
      'Jede Funktion ist mit kalibrierten Prompt-Vorlagen, kontextbezogenen Vorschlägen und verknüpften Evidenz-Visualisierungs-Overlays ausgestattet.',
    ],
    subsections: [
      {
        id: 'cap-vqa',
        title: '1. Single Image VQA (Visual Question Answering)',
        content: [
          '• Zweck: Beantwortung offener Fragen in natürlicher Sprache zu Merkmalen in einer einzelnen Szene.',
          '• Typische Abfragen: „Welche Infrastruktur- und landwirtschaftlichen Landnutzungsmuster sind in dieser Szene vorhanden?“',
          '• Demonstrationsausgabe: Synthetisierte Beschreibung ländlicher Siedlungen, Parzellengrenzen und unbefestigter Hauptstraßen mit 88% Demonstrations-Konfidenz.',
        ],
      },
      {
        id: 'cap-captioning',
        title: '2. Fernerkundungs-Szenenbeschreibung (Scene Captioning)',
        content: [
          '• Zweck: Erstellung detaillierter Beschreibungen auf Absatzebene über Topografie, Bodenbedeckung und menschliche Aktivitäten.',
          '• Typische Abfragen: „Erstelle eine umfassende Fernerkundungsbeschreibung von Topografie, Landbedeckung und menschlicher Aktivität.“',
          '• Demonstrationsausgabe: Mehrsätzige Szenenanalyse mit Details zu Höhengradienten, Vegetationsgesundheit und Industriezonen.',
        ],
      },
      {
        id: 'cap-grounding',
        title: '3. Objekterkennung & Lokalisierung (Object Grounding)',
        content: [
          '• Zweck: Erkennen, Lokalisieren und Eingrenzen abgefragter Objekte oder Gebäudestrukturen.',
          '• Typische Abfragen: „Lokalisiere alle Lagerhausstrukturen, Gebäudeumrisse und Verkehrskorridore.“',
          '• Demonstrationsausgabe: 47 diskrete Bounding-Box-Koordinaten, die mit Kategorien-Tagging und räumlichen Konsistenzprüfungen über das Bild gelegt werden.',
        ],
      },
      {
        id: 'cap-change-detection',
        title: '4. Bitemporale Veränderungserkennung (Bi-Temporal Change Detection)',
        content: [
          '• Zweck: Identifizierung struktureller und oberflächlicher Bodenbedeckungsunterschiede zwischen zwei zeitlichen Aufnahmen.',
          '• Typische Abfragen: „Identifiziere die Hauptveränderungen zwischen diesen beiden Bildern.“',
          '• Demonstrationsausgabe: Hervorhebung von Differenzregionen, Polygonmasken und kategorische Übergangsanalysen zwischen T0 (2025) und T1 (2026).',
        ],
      },
      {
        id: 'cap-change-vqa',
        title: '5. Veränderungsbezogene Fragen & Antworten (Change VQA)',
        content: [
          '• Zweck: Beantwortung quantitativer Fragen bezüglich zeitlicher Landnutzungsumwandlungen.',
          '• Typische Abfragen: „Wie viel landwirtschaftliche Fläche wurde zwischen 2025 und 2026 in bebaute Strukturen umgewandelt?“',
          '• Demonstrationsausgabe: Metrische Schätzung (14,8 Hektar umgewandelt, 8 neue Fundamente) mit Subpixel-Registrierungsfehlerüberprüfung.',
        ],
      },
      {
        id: 'cap-multimodal',
        title: '6. Optical + SAR Multimodale Analyse',
        content: [
          '• Zweck: Korrelation der optischen multispektralen Reflexion mit der Rückstreuintensität des Synthetic Aperture Radars (SAR).',
          '• Typische Abfragen: „Analysiere komplementäre Struktur- und Oberflächenreflexion zwischen optischer und Radarrückstreuung.“',
          '• Demonstrationsausgabe: Zweikanaliges visuelles Komposit zur Hervorhebung von Oberflächenmerkmalen und metallischen Strukturen mit hohem dielektrischem Kontrast.',
        ],
      },
    ],
  },

  // ─── 5. Object Grounding & Evidence ───────────────────────────────
  {
    id: 'grounding',
    title: 'Object Grounding & Räumliche Evidenz',
    shortDescription: 'Räumliche Bounding-Box-Erkennung, Regionshervorhebung und bidirektionale Evidenzverknüpfung.',
    category: 'workspace',
    icon: 'ScanSearch',
    flowDiagram: [
      'Benutzer-Prompt',
      'Grounding-Inferenz',
      'Bounding-Boxen (47 Regionen)',
      'Evidenzgraphen-Verknüpfung',
      'Leinwand-Hervorhebung',
    ],
    content: [
      'Ein zentrales Alleinstellungsmerkmal von SatQuery AI ist die Fähigkeit, KI-Antworten direkt an Pixelkoordinaten im Bild zu verankern (Grounding), anstatt unbegründete Texthalluzinationen zu liefern.',
      'Im Modus Object Grounding rendert die Leinwand normalisierte Bounding-Box-Overlays über erkannten Strukturen. Durch Auswählen einer Bounding-Box wird das entsprechende Evidenzelement im Evidenz-Drawer hervorgehoben, und ein Klick auf eine Evidenzkarte zentriert und pulsiert die zugehörige Box auf der Leinwand.',
    ],
    subsections: [
      {
        id: 'grounding-linking',
        title: 'Bidirektionale Verknüpfungsarchitektur',
        content: [
          '• Leinwand zu Evidenz: Das Anklicken einer der 47 Bounding-Boxen wählt automatisch die passende Evidenzkarte in `EvidenceModal` aus und aktualisiert `selectedGroundingId`.',
          '• Evidenz zu Leinwand: Ein Klick auf „Auf Karte inspizieren“ löst eine 2,5 Sekunden lange pulsierende Hervorhebung der Zielregion aus.',
          '• Kategorie-Tagging: Bounding-Boxen werden mit Metadaten-Tags (`building`, `infrastructure`, `corridor`) und Konfidenzwerten versehen.',
        ],
        callout: {
          type: 'tip',
          text: 'Die Koordinaten der Bounding-Boxen sind normalisiert ([0, 1]-Raum), sodass Vektor-Overlays bei Zoombewegungen ohne Pixelverzerrung flüssig skalieren.',
        },
      },
    ],
  },

  // ─── 6. Before / After Comparison ─────────────────────────────────
  {
    id: 'comparison',
    title: 'Vorher- / Nachher-Vergleichsworkflow',
    shortDescription: 'Bitemporale Satellitenanalyse mit interaktiven Wischreglern und synchronisierter Gegenüberstellung.',
    category: 'workspace',
    icon: 'GitCompare',
    content: [
      'Die Fernerkundungs-Veränderungsanalyse basiert auf dem präzisen Vergleich koregistrierter temporaler Aufnahmen. SatQuery AI bietet mehrere Interaktionsmodelle zur Untersuchung von Landnutzungsübergängen zwischen Basislinie (T0: 2025-03-12) und Beobachtung (T1: 2026-03-12).',
    ],
    subsections: [
      {
        id: 'comparison-modes',
        title: 'Interaktive Betrachtermodi',
        content: [
          '1. Wischvergleichsmodus: Nutzt einen verschiebbaren vertikalen Teiler mit CSS-Clip-Path-Maskierung, um Vorher-Bilder links und Nachher-Bilder rechts mit Subpixel-Ausrichtung anzuzeigen.',
          '2. Side-by-Side-Modus: Rendert zwei synchronisierte Ansichtsfenster, die T0 und T1 gleichzeitig mit einheitlicher Schwenk- und Zoomverfolgung darstellen.',
          '3. Einzelschicht-Umschaltung: Ermöglicht das sofortige Umschalten zwischen temporalen Basislinien mit Deckkraftreglern im Ebenen-Bedienfeld.',
        ],
        callout: {
          type: 'note',
          text: 'Die Bildaufnahmen in der Demo weisen eine identische Bodenauflösung (GSD) von 10 m und EPSG:4326-Projektionsparameter auf, um ideale koregistrierte Vergleiche zu demonstrieren.',
        },
      },
    ],
  },

  // ─── 7. Optical + SAR Workspace ───────────────────────────────────
  {
    id: 'optical-sar',
    title: 'Optical + SAR Arbeitsbereich',
    shortDescription: 'Multisensor-Visualisierung, die sichtbare optische Reflexion mit simulierter Radarrückstreuung kombiniert.',
    category: 'workspace',
    icon: 'Binary',
    isDemo: true,
    content: [
      'Optische Sensoren erfassen die spektrale Reflexion der Oberfläche in sichtbaren und nahinfraroten Bändern, sind jedoch durch Sonnenlicht und Bewölkung eingeschränkt. Synthetic Aperture Radar (SAR) sendet Mikrowellenimpulse aus, die Wolken durchdringen und Struktur- sowie Rauheitsdaten liefern.',
      'SatQuery AI enthält einen Optical + SAR-Arbeitsbereich, um zu demonstrieren, wie Multisensordaten in einem einheitlichen Ansichtsfenster synthetisiert werden können.',
    ],
    subsections: [
      {
        id: 'sar-demo-notice',
        title: 'Hinweis zur Simulationsdemonstration',
        content: [
          '• Aktuelle Implementierung: Die SAR-Ebene in der aktuellen Version ist eine simulierte Demonstrationsvisualisierung, die für die UI-Bewertung kalibriert wurde.',
          '• Sensorparameter: Die Demonstration modelliert eine sichtbare optische Sentinel-2 MSI-Basis kombiniert mit einer Sentinel-1 C-Band-SAR-Kreuzpolarisationssimulation (VV/VH).',
          '• Einschränkungen: Das aktuelle Frontend führt kein Live-Doppler-Beam-Sharpening, keine Speckle-Filterung und keine dielektrische Permittivitätsberechnung in Echtzeit durch. Diese Datenpipelines sind für die Backend-Integration geplant.',
        ],
        callout: {
          type: 'warning',
          text: 'SAR-Darstellungen und Rückstreuungs-Overlays in dieser Version sind zu Demonstrationszwecken simuliert. Eine echte Sensorfusion wird durch die Backend-Verarbeitungspipeline gehandhabt.',
        },
      },
    ],
  },

  // ─── 8. AI Execution Workflow ─────────────────────────────────────
  {
    id: 'execution',
    title: 'AI Ausführungs-Workflow',
    shortDescription: 'Die 11-stufige sichere Ausführungspipeline, die die Fernerkundungsanalyse von der Prompt-Erfassung bis zur Antwortlieferung nachverfolgt.',
    category: 'agent',
    icon: 'Activity',
    flowDiagram: [
      '1. Anfrage erhalten',
      '2. Eingabe validiert',
      '3. Abfrage verstanden',
      '4. Aufgabe identifiziert',
      '5. Workflow ausgewählt',
      '6. Spezialistenfähigkeit gewählt',
      '7. Bilddaten verarbeitet',
      '8. Ergebnis validiert',
      '9. Evidenz extrahiert',
      '10. Konfidenz geschätzt',
      '11. Antwort generiert',
    ],
    content: [
      'Um vollständige Transparenz darüber zu bieten, wie analytische Schlussfolgerungen zustande kommen, implementiert SatQuery AI einen 11-stufigen Ausführungs-Trace, der dem Echtzeit-Fortschrittsmonitor im AI Execution Panel entspricht.',
      'Jede Stufe validiert Vorbedingungen, verhindert unbegründete Halluzinationen und stellt sicher, dass Evidenz- und Konfidenzwerte berechnet werden, bevor eine endgültige Beobachtung synthetisiert wird.',
    ],
    subsections: [
      {
        id: 'execution-stages',
        title: 'Die 11 genehmigten sicheren Pipelinestufen',
        content: [
          '• Schritt 1 — Anfrage erhalten: Erfasst die natürlichsprachige Abfrage und den aktiven Bildkontext aus der Sitzung.',
          '• Schritt 2 — Eingabe validiert: Überprüft Rastergrenzen, Spektralbandverfügbarkeit und räumliche Koordinatenregistrierung.',
          '• Schritt 3 — Abfrage verstanden: Parst semantische Entitäten, Zielmerkmale und räumliche Randbedingungen.',
          '• Schritt 4 — Aufgabe identifiziert: Kategorisiert den Abfragetyp (Grounding, VQA, Change Detection, Multimodal).',
          '• Schritt 5 — Workflow ausgewählt: Konfiguriert Einzel-, bitemporale oder Multisensor-Verarbeitungspipelines.',
          '• Schritt 6 — Spezialistenfähigkeit gewählt: Bindet spezialisierte Modell-Prompts und Erkennungsheuristiken ein.',
          '• Schritt 7 — Bilddaten verarbeitet: Führt räumliche Filterung, radiometrische Normalisierung und Differenzmaskierung durch.',
          '• Schritt 8 — Ergebnis validiert: Wendet Konsistenzprüfungen gegen Referenz-Landnutzungssignaturen an.',
          '• Schritt 9 — Evidenz extrahiert: Generiert räumliche Bounding-Boxen und numerische Beobachtungsstatistiken.',
          '• Schritt 10 — Konfidenz geschätzt: Berechnet Mehrfaktor-Konfidenzindizes über räumliche, spektrale und temporale Dimensionen.',
          '• Schritt 11 — Antwort generiert: Kompiliert den Abschlussbericht, aktualisiert Inspektionspanels und schaltet Report-Exporte frei.',
        ],
        callout: {
          type: 'info',
          text: 'Diese 11-stufige Pipeline entspricht exakt der im Arbeitsbereich QueryAndExecutionPanel angezeigten Ausführungssequenz.',
        },
      },
    ],
  },

  // ─── 9. Evidence & Confidence ─────────────────────────────────────
  {
    id: 'evidence',
    title: 'Evidenz & Konfidenzbewertung',
    shortDescription: 'Mehrfaktor-Konfidenzaufschlüsselung, räumliche Konsistenzprüfung und Evidenzinspektion.',
    category: 'intelligence',
    icon: 'ShieldCheck',
    content: [
      'Satellitenaufklärung verlangt strenge Verifizierung. SatQuery AI ersetzt undurchsichtige Einzelpunktwerte durch ein vier-Säulen-Mehrfaktor-Konfidenzmodell und überprüfbare Evidenzkarten.',
    ],
    subsections: [
      {
        id: 'confidence-breakdown',
        title: 'Säulen der Konfidenzaufschlüsselung',
        content: [
          '• Räumliche Konsistenz (93% Demo): Überprüft geometrische Kohärenz, Grenzkonformität und erwartete Gebäudestrukturen.',
          '• Spektrale Übereinstimmung (88% Demo): Misst die multispektrale Reflexionsausrichtung an standardisierten Vegetations- und Bebauungssignaturen.',
          '• Temporale Kohärenz (91% Demo): Validiert, dass beobachtete Veränderungen plausiblen physischen und zeitlichen Wachstumsraten folgen.',
          '• Modellübereinstimmung (86% Demo): Vergleicht heuristische Übereinstimmungen verschiedener Erkennungspipelines.',
        ],
        callout: {
          type: 'note',
          text: 'Konfidenzwerte sind kalibrierte Demonstrationswerte, die Modellübereinstimmungsheuristiken darstellen. Sie stellen keinen formalen statistischen Beweis dar.',
        },
      },
      {
        id: 'evidence-modal',
        title: 'Evidenz-Modal-Drawer',
        content: [
          'Ein Klick auf „Evidenz anzeigen“ öffnet das Evidenz-Modal, das detaillierte Verifizierungspunkte für jede erkannte Region darstellt, einschließlich Erkennungsmethodik, Spektralbandbestätigung und direkter Leinwandhervorhebung.',
        ],
      },
    ],
  },

  // ─── 10. Reports & Data Export ────────────────────────────────────
  {
    id: 'reports',
    title: 'Aufklärungsberichte & Datenexport',
    shortDescription: 'Publikationsfertige Berichtsformate einschließlich formatiertem PDF, strukturiertem JSON und sauberem Text-Export.',
    category: 'intelligence',
    icon: 'FileSpreadsheet',
    content: [
      'Analytische Workflows münden in exportierbare Aufklärungsartefakte, die an Entscheidungsträger verteilt, in Planungsunterlagen aufgenommen oder in nachgelagerte GIS-Systeme eingespeist werden können.',
      'Das Final Answer Panel enthält einen Export-Dispatcher, der drei verschiedene Formate unterstützt, die direkt im Browser mittels clientseitiger Blob-Verpackung generiert werden.',
    ],
    subsections: [
      {
        id: 'report-formats',
        title: 'Unterstützte Exportformate',
        content: [
          '• PDF-Publikationsbericht: Mehrseitiges formatiertes Führungsbriefing generiert mit jsPDF, inklusive Titelmetadaten, Problemstellung, Antwortzusammenfassung, Evidenztabellen, Sensorspezifikationen und formellen Demonstrationshinweisen.',
          '• JSON-Strukturierte Daten: Maschinenlesbares JSON-Artefakt mit vollständigen Raumkoordinatengrenzen, Konfidenzaufschlüsselungen, Kategorieanteilen und Verarbeitungsschritten für automatisierte Datenpipelines.',
          '• TXT-Klartextbericht: Sauberes, formatiertes ASCII-Briefing, optimiert für schnelle Durchsicht und bandbreitenarme Übertragung.',
        ],
        callout: {
          type: 'tip',
          text: 'Dateigrößen von Berichten werden beim Download dynamisch aus dem erzeugten Blob-Puffer berechnet, wodurch ungenaue Platzhalterschätzungen vermieden werden.',
        },
      },
    ],
  },

  // ─── 11. Frontend Architecture ────────────────────────────────────
  {
    id: 'frontend',
    title: 'Frontend-Architektur & Design-System',
    shortDescription: 'Moderne React 19 Single-Page-Anwendung, entwickelt mit TypeScript, Tailwind CSS und maßgeschneiderten Geodaten-Design-Tokens.',
    category: 'engineering',
    icon: 'Code2',
    content: [
      'Das Frontend von SatQuery AI ist nach Spezifikationen der Luft- und Raumfahrtindustrie entwickelt und vereint hohe Informationsdichte mit intuitiver visueller Hierarchie und schnellen Reaktionszeiten.',
      'Die Benutzeroberfläche ist vollständig responsiv und unterstützt Desktop-Workstations, Tablet-Displays und mobile Ansichten mit maßgeschneiderten Layouts.',
    ],
    subsections: [
      {
        id: 'tech-stack',
        title: 'Technologie-Stack & Architektur',
        content: [
          '• Framework: React 19 mit TypeScript für typsichere Komponentenverträge und strenge Schnittstellendurchsetzung.',
          '• Styling: Tailwind CSS konfiguriert mit einer Raumfahrt-Farbpalette, benutzerdefinierten CSS-Variablen und vollständiger Hell-/Dunkel-Themenumschaltung.',
          '• Routing: React Router DOM mit URL-Hash-Synchronisation für die Dokumentation und zustandsbereinigter Navigation für die Wiederherstellung von Analysen.',
          '• Icons: Lucide React für konsistente Geodaten- und Systemikonografie.',
          '• Resilienz: Globale Error Boundary-Komponenten, die Routenansichten umschließen, um Renderfehler zu isolieren und gleichzeitig die Navigation aufrechtzuerhalten.',
        ],
      },
    ],
  },

  // ─── 12. Backend Integration Roadmap ──────────────────────────────
  {
    id: 'backend-roadmap',
    title: 'Backend-Integrations-Roadmap',
    shortDescription: 'Geplante Architektur und API-Verträge zur Anbindung des Frontends an Live-VLM-Modelle und Rasterverarbeitungs-Engines.',
    category: 'engineering',
    icon: 'Milestone',
    isPlanned: true,
    content: [
      'Das Frontend von SatQuery AI ist bewusst von Mock-Implementierungen entkoppelt. Jede Dateninteraktion fließt durch `src/services/api.ts`, wodurch saubere Grenzen für zukünftige Backend-Konnektivität geschaffen werden.',
      'Diese Roadmap beschreibt den geplanten Übergang von Demonstrationsdaten zu einer cloudnativen Fernerkundungs-Inferenz-Engine für die Produktion.',
    ],
    subsections: [
      {
        id: 'roadmap-phases',
        title: 'Geplante Architektur-Integrationsstufen',
        content: [
          '• Stufe 1 — API-Gateway: REST-Endpunkte für Analyseübermittlungen (`POST /api/v1/analysis`), Szenarioabruf (`GET /api/v1/scenarios`) und Sitzungsverlaufsabruf (`GET /api/v1/history`) anbinden.',
          '• Stufe 2 — VLM-Modell-Routing: Spezialisierte Vision-Language-Modelle für Zero-Shot-Satelliten-VQA, Szenenbeschreibung und räumliches Grounding mit offenem Vokabular integrieren.',
          '• Stufe 3 — Raster-Tiling & GIS-Engine: Cloud-optimierte GeoTIFF (COG) Kachel-Mikrodienste mit GDAL/Rasterio für Ad-hoc-Bandverhältnisberechnungen (NDVI, NDWI) bereitstellen.',
          '• Stufe 4 — Live-SAR-Verarbeitung: Radar-Vorverarbeitungspipelines für echten Sentinel-1 GRD-Import, Geländekorrektur und Speckle-Filterung implementieren.',
        ],
        callout: {
          type: 'info',
          text: 'Status: GEPLANT (PLANNED). Die aktuelle Version ist ein eigenständiger Frontend-Prototyp. Es sind keine Live-Backend-Server oder externe API-Zugangsdaten erforderlich.',
        },
      },
    ],
  },

  // ─── 13. Demo Limitations ─────────────────────────────────────────
  {
    id: 'limitations',
    title: 'Plattform-Demo-Einschränkungen',
    shortDescription: 'Transparente Offenlegung von Sandbox-Parametern, simulierten Funktionen und Prototyp-Betriebsbedingungen.',
    category: 'core',
    icon: 'AlertTriangle',
    isDemo: true,
    content: [
      'SatQuery AI wird derzeit als Demonstrationsprototyp zur Evaluierung im Rahmen des Smart India Hackathon (SIH26167) bereitgestellt. Um vollständige Transparenz zu gewährleisten, sollten Anwender und Evaluatoren folgende Einschränkungen beachten:',
    ],
    subsections: [
      {
        id: 'limitations-list',
        title: 'Aktuelle Sandbox-Einschränkungen',
        content: [
          '1. Simuliertes Schlussfolgern: Abfrageantworten, Merkmalszählungen und Landnutzungs-Übergangsstatistiken sind vorberechnete Demonstrationsartefakte.',
          '2. Kuratierte Testumgebungen: Die Analyse ist auf Sentinel-2-Beispielszenen und simulierte SAR-Komposite kalibriert und nicht auf eine weltweite Live-Satellitenbeauftragung.',
          '3. Offline-Betrieb: Die Anwendung läuft vollständig clientseitig, ohne externe Netzwerkaufrufe an Modell-Inferenzserver zu tätigen.',
          '4. Visuelle SAR-Darstellung: Radarrückstreuungs-Overlays stellen visuelle Demonstrationsbehandlungen dar und keine physikalischen Wellenrückstreumessungen.',
          '5. Nicht-persistenter Speicher: Analysehistorie und Benutzersitzungen verbleiben im Client-Status und bleiben nach dem Zurücksetzen des Browser-Caches nicht erhalten.',
        ],
        callout: {
          type: 'warning',
          text: 'Dieses System dient der UI/UX-Demonstration und Evaluierung von Fernerkundungs-KI-Konzepten. Es sollte nicht für operative Live-Navigation oder Notfallplanung verwendet werden.',
        },
      },
    ],
  },
];
