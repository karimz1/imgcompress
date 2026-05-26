import type { TranslationSchema } from "../types";

export const hu: TranslationSchema = {
  page: {
    subtitle: "Képtömörítő Eszköz",
    adminTools: "Adminisztrációs Eszközök",
    toast: {
      unsupportedFormat: "Nem támogatott fájlformátum: {{fileName}}",
      filesRejected: "{{count}} fájl el lett utasítva nem támogatott formátum miatt.",
      noFilesError: "Kérlek, először adj hozzá fájlokat.",
      noFormatError: "Kérlek, először válassz kimeneti formátumot.",
      qualityRangeError: "A minőségnek 1 és 100 közötti számnak kell lennie.",
      widthPositiveError: "A szélességnek pozitív számnak kell lennie.",
      icoWidthClamped:
        "Az ICO formátum maximum 256px szélességet támogat. A bevitt érték 256-ra lett korlátozva.",
      targetSizeError: "Kérlek, adj meg egy pozitív maximális fájlméretet (MB-ban).",
      compressedSuccess_one: "{{count}} kép sikeresen tömörítve!",
      compressedSuccess_other: "{{count}} kép sikeresen tömörítve!",
      cleanupSuccess:
        "Törlés kész. A feldolgozott fájlok véglegesen eltávolítva. 🧹🧹🧹",
      cleanupFailed: "A kényszer-törlés sikertelen.",
      cleanupError: "🚨 A törlés sikertelen.",
      compressionCancelled: "A tömörítés megszakítva.",
      unexpectedError: "Váratlan hiba. Kérlek, próbáld újra.",
      selectionCleared_one: "{{count}} kép kijelölése törölve! 🧹",
      selectionCleared_other: "{{count}} kép kijelölése törölve! 🧹",
    },
  },

  splash: {
    dialogTitle: "Fájlok tömörítése",
    dialogDescription: "Kérlek, várj, amíg a fájlok tömörítése befejeződik.",
    tipLabel: "Tipp",
    cancelButton: "Mégse",
    steps: {
      starting: "Indítás",
      compressing: "Tömörítés",
      packaging: "Csomagolás",
    },
    tip: "Dolgozhatsz tovább – hagyd nyitva ezt az ablakot, és ide teszem a tömörített fájlokat, amint elkészültek.",
    messages: [
      "Fájlok tömörítése folyamatban…",
      "Minőség és méret optimalizálása.",
      "Képek újrakódolása, kérlek, várj.",
      "Nagy feltöltések eltarthatnak egy ideig.",
      "Még dolgozom – köszönöm a türelmed.",
      "Takarítás és letöltések előkészítése.",
      "Sebesség és minőség egyensúlyának megteremtése.",
      "Utolsó simítások a kimeneti fájlokon.",
      "Pixelek kisebb csomagokba tömörítése.",
      "Majdnem kész – utolsó bájtok írása.",
      "Fájlintegritás ellenőrzése.",
      "Konverziós feladatok befejezése.",
      "Minden rendben van-e – ellenőrzés.",
    ],
  },

  form: {
    outputFormat: {
      label: "Kimeneti formátum",
      placeholder: "Formátum kiválasztása",
      hint: "Válassz kimeneti formátumot a konverzió engedélyezéséhez.",
      options: {
        jpeg: "JPEG (kisebb fájlméret)",
        png: "PNG (átlátszóság megőrzése)",
        avif: "AVIF (legjobb tömörítés & minőség)",
        pdf: "PDF (egyoldalas dokumentum)",
        ico: "ICO (átlátszóság megőrzése)",
      },
      tooltip:
        "PNG: Megőrzi az átlátszóságot (alfa), legjobb átlátszó hátterű képekhez.\nJPEG: Átlátszóság nélküli képekhez ideális, kisebb fájlméretet eredményez.\nAVIF: Modern formátum kiváló tömörítéssel és minőséggel, támogatja az átlátszóságot.\nPDF: Képek exportálása PDF-be opcionális oldalbeállításokkal, margókkal és többoldalas felosztással.\nICO: Favicon és alkalmazásikonok esetén használatos, támogatja az átlátszóságot (alfa). ICO konverzióhoz PNG forrás ajánlott.",
    },
    pdfPreset: {
      label: "PDF oldalbeállítás",
      disabledHint: "A szélességátméretezés le van tiltva, amíg PDF-beállítás aktív.",
      tooltip:
        "Az A4/Letter beállítások a képet az oldalra méretezik, konfigurálható nyomtatási margóval. Az automatikus beállítások a kép tájolása alapján forgatják az oldalt.",
      options: {
        original: "Eredeti (arányok megtartása)",
        a4Auto: "A4 Automatikus",
        a4Portrait: "A4 Álló",
        a4Landscape: "A4 Fekvő",
        letterAuto: "Letter Automatikus",
        letterPortrait: "Letter Álló",
        letterLandscape: "Letter Fekvő",
        mobilePortrait: "Mobil Álló (1080x1920)",
        mobileLandscape: "Mobil Fekvő (1920x1080)",
      },
    },
    pdfScale: {
      label: "PDF méretezési mód",
      paginationHint: "Oldalazás esetén Illesztés módot használ a teljes szélesség megőrzéséhez.",
      tooltip:
        "Az Illesztés megőrzi a teljes képet esetleges fehér sávokkal. A Kitöltés az oldalt lefedő kivágást alkalmaz.",
      options: {
        fit: "Illesztés (teljes kép megőrzése)",
        fill: "Kitöltés (levágás az oldalra)",
      },
    },
    pdfMargin: {
      label: "PDF margó",
      hint: "10mm ajánlott és ez az alapértelmezett érték.",
      tooltip: "A nyomtatási margó beállítása milliméterben. 10mm ajánlott.",
    },
    pdfPaginate: {
      label: "Hosszú képek felosztása több oldalra",
      tooltip: "Hosszú képeket több oldalra oszt, ha PDF-beállítás aktív.",
    },
    compressionMode: {
      label: "{{format}} beállítási mód",
      byQuality: "Minőség alapján",
      bySize: "Fájlméret alapján",
    },
    rembg: {
      label: "Háttér eltávolítása helyi AI-val ({{model}})",
      tooltip:
        "A helyi AI eltávolítja a hátteret (internet nem szükséges).\nLassabb feldolgozás, esetleges kis él-artefaktumok.",
    },
    quality: {
      label: "Minőség",
      tooltip:
        "A minőség beállítása (100 a legjobb minőség, alacsonyabb értékek csökkentik a fájlméretet). JPEG és AVIF esetén érvényes.",
      presets: {
        smaller: "Kisebb (60)",
        balanced: "Kiegyensúlyozott (75)",
        high: "Magas (85)",
        max: "Maximum (100)",
      },
    },
    targetSize: {
      label: "Maximális fájlméret",
      hint: "Megpróbálja az egyes {{format}} fájlokat ezen a határon belül tartani a minőség automatikus beállításával.",
      tooltip:
        "Opcionális maximális kimeneti méret (MB-ban). JPEG és AVIF kimenethez érvényes.",
    },
    resizeWidth: {
      label: "Szélesség átméretezése",
      tooltip:
        "A kép(ek) átméretezése a kívánt szélességre, az eredeti képarány megtartásával.",
    },
    dropzone: {
      dragActive: "Ejtsd ide a képeket vagy PDF-eket...",
      processing: "Feldolgozás közben nem lehet fájlokat húzni...",
      idle: "Húzd ide a képeket vagy PDF-eket, vagy kattints a kiválasztáshoz",
    },
    filesList: {
      label: "Konvertálandó fájlok:",
      removeButton: "Eltávolítás",
    },
    error: {
      label: "Hiba:",
      detailsLabel: "Részletek:",
    },
    buttons: {
      convert: "Konverzió indítása",
      processing: "Feldolgozás...",
      clear: "Törlés",
    },
  },

  drawer: {
    trigger_one: "🗃️ Tömörített kép megjelenítése",
    trigger_other: "🗃️ Tömörített képek megjelenítése",
    title_one: "Tömörített kép",
    title_other: "Tömörített képek",
    description_one: "Töltsd le a tömörített képedet.",
    description_other: "Töltsd le a tömörített képeidet egyenként vagy egyszerre.",
    downloadAll: "Összes letöltése ZIP-ben",
    close: "Bezárás",
    downloadingFile: "{{fileName}} letöltése...",
  },

  storage: {
    title: "Tárhely-kezelés",
    used: "Használt:",
    available: "Szabad:",
    files: "Fájlok",
    clearButton: "Feldolgozott fájlok törlése",
    totalFiles: "Összes fájl:",
    totalSpace: "Felhasznált tárhely:",
    noFiles: "Nem található konvertált fájl.",
    confirmTitle: "Fájltörlés megerősítése",
    confirmDescription:
      "Ez a művelet véglegesen törli az összes feldolgozott fájlt. Győződj meg róla, hogy letöltötted a szükséges fájlokat, mivel ez a művelet nem vonható vissza.",
    confirmCancel: "Mégse",
    confirmDelete: "Igen, törlöm a fájlokat",
    fetchError: "Nem sikerült lekérni a tároló fájljait.",
    storageError: "Nem sikerült lekérni a tárhelyinformációkat.",
    zipLabel: "(ZIP)",
  },

  statusBanner: {
    warning: "Figyelem: A háttérrendszer jelenleg nem elérhető.",
  },

  statusFloating: {
    title: "Rendszer- és kapcsolatstátusz",
    backend: "Tároló háttérrendszer:",
    network: "Hálózati hozzáférés:",
    mode: "Mód:",
    modeRunning: "fut",
    backendDown: "Nem elérhető ❌",
    backendUp: "Működik",
    internetYes: "Van internet-hozzáférés",
    internetNo: "Nincs internet 🚫",
    internetUnknown: "Nem ellenőrzött",
    checkButton: "Internet ellenőrzése",
    checking: "Ellenőrzés...",
    whyTitle: "Miért van ez itt?",
    whyDesc:
      "Ellenőrzi a tároló állapotát és a hálózati izoláltságot a biztonság érdekében. Semmilyen kép vagy metaadat nem hagyja el a gépedet.",
    learnMore: "Tudj meg többet az offline használatról →",
    backendLastCheck: "Háttérrendszer utolsó ellenőrzése:",
    internetLastCheck: "Internet utolsó ellenőrzése:",
  },

  errorModal: {
    title: "Hiba történt",
    notifyDeveloper:
      "Kérlek, nyiss egy hibajegyet, és értesítsd a fejlesztőt, hogy minél hamarabb megoldhassuk.",
    copyError: "Hiba másolása",
    copied: "Másolva!",
    openTicket: "Hibajegy megnyitása",
    close: "Bezárás",
  },

  formatsDialog: {
    triggerButton: "Mit tudok megnyitni?",
    title: "Támogatott fájlok",
    descriptionStart:
      "Íme egy összefoglaló arról, mit tudok megnyitni. A kimeneti formátumot a",
    descriptionBold: "Kimeneti formátum",
    descriptionEnd: "menüben választhatod meg a főképernyőn, miután bezárod ezt.",
    searchLabel: "Listakeresés",
    searchHint: "Csak kezdj el gépelni a formátum megkereséséhez",
    searchPlaceholder: "Keresés (pl. psd, tiff)...",
    verifiedTitle: "Tesztelt és működő",
    unverifiedTitle: "Egyéb lehetséges formátumok",
    unverifiedHint: "Ezeket még nem teszteltük teljesen, de előfordulhat, hogy működnek!",
    footerText: "Az ImgCompress segít képeid konvertálásában!",
    reportBug: "Hibát jelentek",
  },

  starBanner: {
    message: "Hasznosnak találtad az ImgCompress-t?",
    linkText: "Egy csillag a GitHubon",
    suffix: "segít másoknak megtalálni.",
    dismiss: "Ne mutasd többet",
  },

  help: {
    label: "Használati útmutató",
  },

  footer: {
    updateAvailable: "Frissítés elérhető: {{version}}",
    whatsNew: "Mi újság?",
    version: "Verzió: {{version}}",
    releaseNotes: "Kiadási megjegyzések",
    links: {
      docs: "Dokumentáció",
      github: "GitHub",
      reportBug: "Hiba bejelentése",
      author: "Szerző",
      sponsor: "Támogatás",
    },
  },

  releaseNotes: {
    buttonLabel: "Kiadási megjegyzések",
    title: "Kiadási megjegyzések",
    infoBoxText: "Tekintsd meg a",
    infoBoxLink: "teljes kiadási megjegyzéseket",
    infoBoxSuffix: "az összes verzióhoz és részlethez.",
    loading: "Betöltés…",
    loadError: "Nem sikerült betölteni a kiadási megjegyzéseket",
    empty: "Nincsenek elérhető kiadási megjegyzések.",
    tabLatest: "Legújabb",
    tabArchive: "Archívum",
    noArchive: "Még nincs archivált kiadás.",
  },

  langSwitcher: {
    ariaLabel: "Nyelv váltása",
  },
};
