import type { TranslationSchema } from "../types";

export const de: TranslationSchema = {
  page: {
    subtitle: "Ein Tool zur Bildkomprimierung",
    adminTools: "Admin-Werkzeuge",
    toast: {
      unsupportedFormat: "Nicht unterstütztes Dateiformat: {{fileName}}",
      filesRejected: "{{count}} Datei(en) wurden wegen nicht unterstützter Dateitypen abgelehnt.",
      noFilesError: "Bitte lege oder wähle zuerst einige Dateien aus.",
      noFormatError: "Bitte wähle zuerst ein Ausgabeformat aus.",
      qualityRangeError: "Die Qualität muss eine Zahl zwischen 1 und 100 sein.",
      widthPositiveError: "Die Breite muss eine positive Zahl sein.",
      icoWidthClamped:
        "Das ICO-Format ist auf eine maximale Breite von 256 px beschränkt. Deine Eingabe wurde auf 256 gesetzt.",
      targetSizeError: "Bitte lege eine positive maximale Dateigröße (in MB) fest.",
      compressedSuccess_one: "{{count}} Bild erfolgreich komprimiert!",
      compressedSuccess_other: "{{count}} Bilder erfolgreich komprimiert!",
      cleanupSuccess:
        "Die Löschung ist abgeschlossen. Deine verarbeiteten Dateien wurden dauerhaft entfernt. 🧹🧹🧹",
      cleanupFailed: "Erzwungene Bereinigung fehlgeschlagen.",
      cleanupError: "🚨 Bereinigung fehlgeschlagen.",
      compressionCancelled: "Komprimierung abgebrochen.",
      unexpectedError: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
      selectionCleared_one: "{{count}} Bildauswahl gelöscht! 🧹",
      selectionCleared_other: "{{count}} ausgewählte Bilder gelöscht! 🧹"
    },
  },

  splash: {
    dialogTitle: "Dateien werden komprimiert",
    dialogDescription: "Bitte warte, während deine Dateien komprimiert werden.",
    tipLabel: "Tipp",
    cancelButton: "Abbrechen",
    steps: {
      starting: "Starten",
      compressing: "Komprimieren",
      packaging: "Paketieren",
    },
    tip: "Du kannst weiterarbeiten - lass dieses Fenster offen, und ich lege deine komprimierten Dateien hier ab, sobald sie fertig sind.",
    messages: [
      "Deine Dateien werden komprimiert…",
      "Qualität und Größe werden optimiert.",
      "Bilder werden neu codiert, bitte warte.",
      "Große Uploads können einen Moment dauern.",
      "Ich arbeite noch - danke für deine Geduld.",
      "Aufräumen und Downloads vorbereiten.",
      "Geschwindigkeit und Qualität werden gerade ausbalanciert.",
      "Letzte Feinheiten an den Ausgabedateien.",
      "Pixel werden in kleinere Pakete gepackt.",
      "Fast fertig - letzte Bytes werden geschrieben.",
      "Dateiintegrität wird geprüft.",
      "Konvertierungsaufgaben werden abgeschlossen.",
      "Es wird geprüft, ob alles gut aussieht.",
    ],
  },

  form: {
    outputFormat: {
      label: "Ausgabeformat",
      placeholder: "Format auswählen",
      hint: "Wähle ein Ausgabeformat, um die Konvertierung zu aktivieren.",
      options: {
        jpeg: "JPEG (kleinere Dateigröße)",
        png: "PNG (erhält Transparenz)",
        avif: "AVIF (beste Komprimierung und Qualität)",
        pdf: "PDF (einseitiges Dokument)",
        ico: "ICO (erhält Transparenz)",
      },
      tooltip:
        "PNG: Erhält Transparenz (Alpha) und ist ideal für Bilder mit transparentem Hintergrund.\nJPEG: Ideal für Bilder ohne Transparenz und erzeugt kleinere Dateien.\nAVIF: Modernes Format mit hervorragender Komprimierung und Qualität, unterstützt Transparenz.\nPDF: Exportiert Bilder in PDFs mit optionalen Seitenvorgaben, Rändern und Aufteilung auf mehrere Seiten.\nICO: Wird häufig für Favicons und Anwendungssymbole verwendet, unterstützt Transparenz (Alpha). Für die Konvertierung zu ICO wird PNG als Quelle empfohlen.",
    },
    pdfPreset: {
      label: "PDF-Seitenvorgabe",
      disabledHint: "Breite ändern ist deaktiviert, solange eine PDF-Vorgabe ausgewählt ist.",
      tooltip:
        "A4-/Letter-Vorgaben skalieren das Bild mit konfigurierbarem drucksicheren Rand auf die Seite. Automatische Vorgaben drehen die Seite anhand der Bildausrichtung.",
      options: {
        original: "Original (Proportionen behalten)",
        a4Auto: "A4 automatisch",
        a4Portrait: "A4 Hochformat",
        a4Landscape: "A4 Querformat",
        letterAuto: "Letter automatisch",
        letterPortrait: "Letter Hochformat",
        letterLandscape: "Letter Querformat",
        mobilePortrait: "Mobil Hochformat (1080x1920)",
        mobileLandscape: "Mobil Querformat (1920x1080)",
      },
    },
    pdfScale: {
      label: "PDF-Skalierungsmodus",
      paginationHint: "Die Seitenteilung verwendet den Modus Einpassen, damit die volle Breite erhalten bleibt.",
      tooltip:
        "Einpassen erhält das gesamte Bild, eventuell mit weißen Balken. Füllen beschneidet das Bild, damit die Seite bedeckt wird.",
      options: {
        fit: "Einpassen (vollständiges Bild erhalten)",
        fill: "Füllen (auf Seite zuschneiden)",
      },
    },
    pdfMargin: {
      label: "PDF-Rand",
      hint: "10 mm wird empfohlen und ist die Standardeinstellung.",
      tooltip: "Lege den drucksicheren Rand in Millimetern fest. 10 mm wird empfohlen.",
    },
    pdfPaginate: {
      label: "Lange Bilder auf mehrere Seiten aufteilen",
      tooltip: "Teilt lange Bilder auf mehrere Seiten auf, wenn eine PDF-Vorgabe ausgewählt ist.",
    },
    compressionMode: {
      label: "{{format}}-Einstellungsmodus",
      byQuality: "Nach Qualität festlegen",
      bySize: "Nach Dateigröße festlegen",
    },
    rembg: {
      label: "Hintergrund mit lokaler KI entfernen",
      tooltip:
        "Lokale KI entfernt den Hintergrund (kein Internet erforderlich).\nLangsamere Verarbeitung, kleine Kantenartefakte können auftreten.",
    },
    rembgModel: {
      label: "KI-Modell",
      placeholder: "Modell auswählen",
      tooltip:
        "Wähle, welches lokale KI-Modell den Hintergrund entfernt.\nAllgemein passt für die meisten Bilder, Anime ist auf Zeichnungen abgestimmt, Fotos für reale Fotografie.",
      options: {
        "u2net": "Allgemein",
        "isnet-anime": "Anime",
        "isnet-general-use": "Fotos",
        "birefnet-portrait": "Porträts",
        "birefnet-general": "Maximale Qualität",
        "birefnet-general-lite": "Hohe Qualität",
      },
      descriptions: {
        "u2net": "Für die meisten Bilder",
        "isnet-anime": "Saubere Anime-Charaktermasken",
        "isnet-general-use": "Reale Fotografie",
        "birefnet-portrait": "Personen- und Porträtfreisteller",
        "birefnet-general": "Beste Details und Kanten, am langsamsten",
        "birefnet-general-lite": "Detaillierte Kanten, schneller als Maximum",
      },
    },
    quality: {
      label: "Qualität",
      tooltip:
        "Passe die Qualität an (100 ist die beste Qualität, niedrigere Werte reduzieren die Dateigröße). Gilt für JPEG und AVIF.",
      presets: {
        smaller: "Kleiner (60)",
        balanced: "Ausgewogen (75)",
        high: "Hoch (85)",
        max: "Maximal (100)",
      },
    },
    targetSize: {
      label: "Max. Dateigröße",
      placeholder: "z. B. 0,50",
      hint: "Es wird versucht, jede {{format}}-Datei durch automatische Qualitätsanpassung auf oder unter dieser Größe zu halten.",
      tooltip:
        "Lege eine optionale maximale Ausgabegröße (in MB) fest. Gilt für JPEG- und AVIF-Ausgaben.",
    },
    resizeWidth: {
      label: "Breite ändern",
      tooltip:
        "Ändert die Größe der Bilder auf die gewünschte Breite und behält dabei das ursprüngliche Seitenverhältnis bei.",
    },
    dropzone: {
      dragActive: "Bilder oder PDFs hier ablegen...",
      processing: "Während der Verarbeitung können keine Dateien abgelegt werden...",
      idle: "Bilder oder PDFs hierher ziehen oder klicken, um sie auszuwählen",
    },
    filesList: {
      label: "Zu konvertierende Dateien:",
      removeButton: "Entfernen",
      removeSavedCropAria: "Gespeicherten Zuschnitt entfernen",
      croppedBadge: "zugeschnitten {{w}} × {{h}}",
      cropTooltip: "Für diese Datei ist ein Zuschnitt gespeichert. Klicke auf das x, um ihn zu entfernen.",
      editCropTooltip: "Gespeicherten Zuschnitt für diese Datei bearbeiten.",
      addCropTooltip: "Wähle den sichtbaren Bereich aus, bevor diese Datei konvertiert wird.",
      cropNotSupportedPdf: "PDF-Zuschnitt wird noch nicht unterstützt. PDFs können mehrere Seiten enthalten, daher braucht der Zuschnitt zuerst einen eigenen Ablauf zur Seitenauswahl.",
      cropNotSupported: "Zuschnitt wird für dieses Format derzeit nicht unterstützt.",
      cropButton: "Zuschneiden",
      editButton: "Bearbeiten",
    },
    error: {
      label: "Fehler:",
      detailsLabel: "Einzelheiten:",
    },
    buttons: {
      convert: "Konvertierung starten",
      processing: "Wird verarbeitet...",
      clear: "Leeren",
    },
  },

  rembgCompare: {
    editorTitle: "KI-Editor",
    editorDescription: "Vergleiche lokale KI-Modelle für dieses Bild.",
    openButton: "KI vergleichen",
    editButton: "KI bearbeiten",
    selectedBadge: "KI: {{model}}",
    loadingTitle: "KI-Modelle werden verglichen",
    loadingDescription: "Der Vergleich aller KI-Modelle kann einen Moment dauern.",
    useModel: "Dieses Modell verwenden",
    downloadSelected: "Auswahl herunterladen",
    downloadAll: "Alles als ZIP herunterladen",
    close: "Schließen",
    errorTitle: "KI-Vergleich fehlgeschlagen",
    empty: "Keine Vorschau verfügbar.",
    previewAlt: "Vorschau der Hintergrundentfernung mit {{model}}",
  },
  drawer: {
    trigger_one: "🗃️ Konvertiertes Bild anzeigen",
    trigger_other: "🗃️ Konvertierte Bilder anzeigen",
    title_one: "Konvertiertes Bild",
    title_other: "Konvertierte Bilder",
    description_one: "Lade dein konvertiertes Bild einzeln oder zusammen mit allen Dateien herunter.",
    description_other: "Lade deine konvertierten Bilder einzeln oder alle auf einmal herunter.",
    downloadAll: "Alle als ZIP herunterladen",
    close: "Schließen",
    downloadingFile: "Wird heruntergeladen: {{fileName}}...",
    downloadingZip: "Ordner wird heruntergeladen...",
  },

  downloadError: {
    title: "Diese Datei ist nicht mehr da",
    description:
      "Sie wurde möglicherweise gelöscht oder ist abgelaufen. Komprimiere sie einfach erneut.",
    close: "Verstanden",
  },

  storage: {
    title: "Speicherverwaltung",
    used: "Verwendet:",
    available: "Verfügbar:",
    files: "Dateien",
    clearButton: "Verarbeitete Dateien löschen",
    totalFiles: "Dateien gesamt:",
    totalSpace: "Verwendeter Speicher gesamt:",
    noFiles: "Keine konvertierten Dateien gefunden.",
    confirmTitle: "Dateilöschung bestätigen",
    confirmDescription:
      "Diese Aktion löscht alle verarbeiteten Dateien dauerhaft. Bitte stelle sicher, dass du alle benötigten Dateien heruntergeladen hast, bevor du fortfährst, da diese Aktion nicht rückgängig gemacht werden kann.",
    confirmCancel: "Abbrechen",
    confirmDelete: "Ja, Dateien löschen",
    fetchError: "Containerdateien konnten nicht abgerufen werden.",
    storageError: "Speicherinformationen konnten nicht abgerufen werden.",
    zipLabel: "(ZIP)",
  },

  statusBanner: {
    warning: "Warnung: Das Backend ist derzeit nicht verfügbar.",
  },

  statusFloating: {
    systemStatusTitle: "Systemstatus",
    title: "System- und Verbindungsstatus",
    backend: "Container-Backend:",
    network: "Netzwerkzugriff:",
    mode: "Modus:",
    modeRunning: "läuft",
    backendDown: "Ist nicht erreichbar ❌",
    backendUp: "Funktioniert",
    internetYes: "Hat Internetzugriff",
    internetNo: "Kein Internet erkannt 🚫",
    internetUnknown: "Nicht geprüft",
    checkButton: "Internetverbindung prüfen",
    checking: "Wird geprüft...",
    whyTitle: "Warum gibt es das?",
    whyDesc:
      "Prüft Containerzustand und Netzwerkisolierung zur Sicherheit. Keine Bilder oder Metadaten verlassen jemals deinen Rechner.",
    learnMore: "Mehr über Offline-Nutzung erfahren →",
    backendLastCheck: "Letzte Backend-Prüfung:",
    internetLastCheck: "Letzte Internetprüfung:",
  },

  errorModal: {
    title: "Fehler aufgetreten",
    subtitle: "Die Aktion konnte nicht abgeschlossen werden. Kopiere den Trace unten und öffne ein Ticket, damit der Fehler behoben werden kann.",
    detailsLabel: "Technische Details",
    notifyDeveloper:
      "Bitte öffne ein Ticket und benachrichtige den Entwickler, damit dies schnell behoben werden kann.",
    copyError: "Fehler kopieren",
    copied: "Kopiert!",
    openTicket: "Ticket öffnen",
    close: "Schließen",
  },

  formatsDialog: {
    triggerButton: "Was kann ich öffnen?",
    title: "Unterstützte Dateien",
    descriptionStart: "Hier ist ein Spickzettel dazu, was ich für dich öffnen kann. Du kannst dein Ergebnisformat über das",
    descriptionBold: "Ausgabeformat",
    descriptionEnd: "Menü auf dem Hauptbildschirm auswählen, nachdem du dies geschlossen hast.",
    searchLabel: "Liste durchsuchen",
    searchHint: "Tippe einfach, um ein Format zu finden",
    searchPlaceholder: "Suchen (z. B. psd, tiff)...",
    verifiedTitle: "Getestet und funktionsfähig",
    unverifiedTitle: "Weitere mögliche Formate",
    unverifiedHint: "Diese wurden noch nicht vollständig getestet, könnten aber funktionieren!",
    footerText: "ImgCompress hilft dir beim Konvertieren deiner Bilder!",
    reportBug: "Fehler melden",
  },

  starBanner: {
    message: "Findest du ImgCompress nützlich?",
    linkText: "Ein Stern auf GitHub",
    suffix: "hilft anderen, es zu entdecken.",
    dismiss: "Nicht mehr anzeigen",
  },

  help: {
    label: "Anleitung",
  },

  footer: {
    updateAvailable: "Update verfügbar: {{version}}",
    whatsNew: "Was ist neu?",
    version: "Version: {{version}}",
    releaseNotes: "Versionshinweise",
    links: {
      docs: "Dokumentation",
      github: "GitHub",
      reportBug: "Fehler melden",
      author: "Autor",
      sponsor: "Unterstützen",
    },
  },

  releaseNotes: {
    buttonLabel: "Versionshinweise",
    title: "Versionshinweise",
    infoBoxText: "Vollständige",
    infoBoxLink: "Versionshinweise anzeigen",
    infoBoxSuffix: "für alle Versionen und Details.",
    loading: "Wird geladen…",
    loadError: "Versionshinweise konnten nicht geladen werden",
    empty: "Keine Versionshinweise verfügbar.",
    tabLatest: "Neueste",
    tabArchive: "Archiv",
    noArchive: "Noch keine archivierten Versionen.",
  },

  langSwitcher: {
    ariaLabel: "Sprache wechseln",
  },

  theme: {
    switchToLight: "Zum hellen Design wechseln",
    switchToDark: "Zum dunklen Design wechseln",
    lightTitle: "Hell",
    darkTitle: "Dunkel",
    toggle: "Design umschalten",
  },

  runtimeError: {
    title: "Laufzeitfehler",
    errorFallback: "Fehler",
    unknownError: "Unbekannter Fehler",
    subtitle: "Beim Rendern ist etwas kaputtgegangen. Kopiere den Trace unten und öffne ein Ticket, damit der Fehler behoben werden kann.",
    stackTrace: "Stacktrace",
    tryAgain: "Erneut versuchen",
    includeTitle: "Dies im Ticket angeben",
    includeDescription: "Hänge die Diagnosedatei an das Ticket an. Sie enthält den Fehlertrace, den Browserkontext, Frontend-Logs und Backend-Logs, wenn das laufende Backend sie bereitstellt.",
    downloadDiagnostics: "Diagnose herunterladen",
    copied: "Kopiert!",
    copyError: "Fehler kopieren",
    openTicket: "Ticket öffnen",
  },

  devMode: {
    toggleTitle: "Entwicklertools (nur sichtbar, wenn DEV_MODE=true)",
    title: "Entwicklertools",
    description: "UI-Zustände auslösen, um Fehleranzeigen zu prüfen. Keine dieser Aktionen ruft das echte Backend auf.",
    apiSection: "API-Fehler-Widget",
    triggerApiError: "API-Fehler auslösen",
    triggerApiErrorLong: "API-Fehler auslösen (langer Stack)",
    runtimeSection: "Laufzeit-Fehlergrenze",
    triggerRuntimeError: "Laufzeitfehler auslösen",
    triggerRuntimeErrorLong: "Laufzeitfehler auslösen (langer Stack)",
    footerPrefix: "Dieses Panel wird über",
    footerMiddle: " unter ",
    footerSuffix: " umgeschaltet. Es wird nie angezeigt, wenn das Flag deaktiviert ist.",
  },

  crop: {
    aspectRatio: "Seitenverhältnis",
    adjust: "Anpassen",
    zoom: "Vergrößerung",
    zoomOut: "Herauszoomen",
    zoomIn: "Hineinzoomen",
    resetZoom: "Zoom zurücksetzen",
    resetZoomFull: "Zoom und Verschiebung zurücksetzen",
    dimensions: "Abmessungen",
    resetSelection: "Auswahl zurücksetzen",
    width: "Breite",
    height: "Höhe",
    original: "Ursprünglich: {{w}} × {{h}} px",
    removeSavedCrop: "Gespeicherten Zuschnitt entfernen",
    discard: "Verwerfen",
    saveCrop: "Zuschnitt speichern",
    switchToLight: "Zum hellen Design wechseln",
    switchToDark: "Zum dunklen Design wechseln",
    confirmDialog: {
      title: "Zuschnittänderungen verwerfen?",
      description: "Deine ungespeicherten Zuschnittanpassungen gehen verloren. Ein zuvor gespeicherter Zuschnitt bleibt unverändert.",
      keepEditing: "Weiter bearbeiten",
      discardChanges: "Änderungen verwerfen",
    },
    loading: {
      serverWords: ["Bitte", "warte", "kurz,", "ich", "bin", "fast", "bereit"],
      localWords: ["Zuschnitt", "Editor", "öffnen"],
      serverMessage: "{{label}} benötigt vor dem Zuschneiden eine serverseitig gerenderte Bitmap. Sie wird jetzt vorbereitet.",
      localMessage: "{{label}} wird im Zuschnitt-Editor geöffnet.",
    },
    failure: {
      header: "{{label}} konnte nicht zum Zuschneiden vorbereitet werden.",
      whyTitle: "Warum ist das passiert?",
      technicalDetails: "Technische Details",
      stillConvert: "Du kannst diese Datei weiterhin unverändert konvertieren. Es wird nur kein Zuschnitt angewendet.",
      closeButton: "Schließen",
      reportButton: "Dieses Problem melden",
      causes: {
        backendNotReachable: "Der Backend-Dienst ist noch nicht erreichbar. Wenn du den Container gerade neu gebaut hast, warte ein paar Sekunden und versuche es erneut.",
        networkDropped: "Die Verbindung zum Backend ist während des Uploads abgebrochen. Prüfe, ob der Container noch läuft, und versuche es erneut.",
        variantNotSupported: "Diese Datei könnte eine {{label}}-Variante sein, die der Decoder nicht lesen kann (mehrschichtig, nicht standardisierter Farbmodus, verschlüsselt usw.). Ein Export aus der Quellanwendung als flaches {{label}} oder normales PNG/JPG behebt dies meist.",
        missingLibraries: "{{label}}-Dateien laufen immer durch den Decoder des Backends. Wenn dem Decoder native Bibliotheken fehlen (z. B. libheif für HEIC), löst ein erneuter Build mit aktivierten optionalen Codecs das Problem meist.",
        reportIssue: "Wenn nichts davon passt, kopiere die technischen Details unten und öffne ein Ticket - der Trace zeigt genau, welcher Schritt fehlgeschlagen ist.",
      },
    },
    freeRatio: "Frei",
    editorTitle: "Zuschnitt-Editor",
    editorDescription: "Passe Zuschnittbereich, Verhältnis und Zoom für dieses Bild an und klicke dann auf Zuschnitt speichern oder Verwerfen.",
    removeDialog: {
      title: "Gespeicherten Zuschnitt entfernen?",
      description: "Dadurch wird der gespeicherte Zuschnitt für diese Datei gelöscht. Die Originaldatei bleibt in deiner Konvertierungsliste.",
      keepCrop: "Zuschnitt behalten",
      removeCrop: "Zuschnitt entfernen",
    },
    shortcuts: {
      title: "Kurzbefehle",
      items: [
        { keys: ["Ziehen"],               desc: "Zuschnitt bewegen" },
        { keys: ["Ecke ziehen"],          desc: "Größe ändern" },
        { keys: ["Alt", "+ Griff ziehen"], desc: "Aus der Mitte ändern" },
        { keys: ["Mausrad"],              desc: "Am Cursor zoomen" },
        { keys: ["Leertaste", "+ Ziehen"], desc: "Verschieben" },
        { keys: ["Esc"],                  desc: "Schließen" },
      ],
    },
  },
};
