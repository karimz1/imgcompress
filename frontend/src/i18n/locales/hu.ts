import type { TranslationSchema } from "../types";

export const hu: TranslationSchema = {
  page: {
    subtitle: "Képtömörítő és -átméretező eszköz",
    adminTools: "Adminisztrációs eszközök",
    toast: {
      unsupportedFormat: "Nem támogatott fájlformátum: {{fileName}}",
      filesRejected: "{{count}} fájlt nem támogatott formátum miatt kihagytam.",
      noFilesError: "Kérlek, először adj hozzá fájlokat.",
      noFormatError: "Kérlek, először válassz kimeneti formátumot.",
      qualityRangeError: "A minőségnek 1 és 100 közötti számnak kell lennie.",
      widthPositiveError: "A szélességnek pozitív számnak kell lennie.",
      icoWidthClamped:
        "Az ICO formátum legfeljebb 256 px szélességet támogat. A megadott értéket 256-ra állítottam.",
      targetSizeError: "Kérlek, adj meg egy pozitív maximális fájlméretet (MB-ban).",
      compressedSuccess_one: "{{count}} kép sikeresen elkészült!",
      compressedSuccess_other: "{{count}} kép sikeresen elkészült!",
      cleanupSuccess:
        "Törlés kész. A feldolgozott fájlokat véglegesen eltávolítottam. 🧹🧹🧹",
      cleanupFailed: "A kényszerített törlés sikertelen.",
      cleanupError: "🚨 A törlés sikertelen.",
      compressionCancelled: "A tömörítés megszakítva.",
      unexpectedError: "Váratlan hiba. Kérlek, próbáld újra.",
      selectionCleared_one: "{{count}} kép eltávolítva a listából! 🧹",
      selectionCleared_other: "{{count}} kép eltávolítva a listából! 🧹",
    },
  },

  splash: {
    dialogTitle: "Fájlok feldolgozása",
    dialogDescription: "Kérlek, várj, amíg elkészülnek a fájlok.",
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
      "A nagyobb feltöltések feldolgozása eltarthat egy ideig.",
      "Még dolgozom – köszönöm a türelmed.",
      "Takarítás és letöltések előkészítése.",
      "Sebesség és minőség finomhangolása.",
      "Utolsó simítások a kimeneti fájlokon.",
      "Pixelek kisebb csomagokba tömörítése.",
      "Majdnem kész – utolsó bájtok írása.",
      "Fájlintegritás ellenőrzése.",
      "Átalakítási feladatok befejezése.",
      "Utolsó ellenőrzés, hogy minden rendben legyen.",
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
        avif: "AVIF (kiváló tömörítés és minőség)",
        pdf: "PDF (egyoldalas dokumentum)",
        ico: "ICO (átlátszóság megőrzése)",
      },
      tooltip:
        "PNG: Megőrzi az átlátszóságot (alfa), ezért átlátszó hátterű képekhez ideális.\nJPEG: Átlátszóság nélküli képekhez ajánlott, általában kisebb fájlméretet ad.\nAVIF: Modern formátum kiváló tömörítéssel és minőséggel, átlátszóságot is támogat.\nPDF: Képek exportálása PDF-be opcionális oldalbeállításokkal, margókkal és többoldalas felosztással.\nICO: Faviconokhoz és alkalmazásikonokhoz használatos, támogatja az átlátszóságot (alfa). ICO készítéséhez PNG forrás ajánlott.",
    },
    pdfPreset: {
      label: "PDF oldalbeállítás",
      disabledHint: "A szélesség szerinti átméretezés nem érhető el, amíg PDF-oldalbeállítás aktív.",
      tooltip:
        "Az A4/Letter beállítások a képet az oldalra méretezik, konfigurálható nyomtatási margóval. Az automatikus beállítások a kép tájolása alapján forgatják az oldalt.",
      options: {
        original: "Eredeti (arányok megtartása)",
        a4Auto: "A4 automatikus",
        a4Portrait: "A4 álló",
        a4Landscape: "A4 fekvő",
        letterAuto: "Letter automatikus",
        letterPortrait: "Letter álló",
        letterLandscape: "Letter fekvő",
        mobilePortrait: "Mobil álló (1080x1920)",
        mobileLandscape: "Mobil fekvő (1920x1080)",
      },
    },
    pdfScale: {
      label: "PDF méretezési mód",
      paginationHint: "Oldalazáskor az Illesztés mód marad aktív, hogy a teljes szélesség megmaradjon.",
      tooltip:
        "Az Illesztés a teljes képet megtartja, szükség esetén fehér sávokkal. A Kitöltés levágja a széleket, hogy a kép kitöltse az oldalt.",
      options: {
        fit: "Illesztés (teljes kép megőrzése)",
        fill: "Kitöltés (levágás az oldalra)",
      },
    },
    pdfMargin: {
      label: "PDF-margó",
      hint: "Az ajánlott és alapértelmezett érték 10 mm.",
      tooltip: "A nyomtatási margó beállítása milliméterben. 10 mm ajánlott.",
    },
    pdfPaginate: {
      label: "Hosszú képek felosztása több oldalra",
      tooltip: "A hosszú képeket több oldalra osztja, ha PDF-oldalbeállítás aktív.",
    },
    compressionMode: {
      label: "{{format}} beállítási módja",
      byQuality: "Minőség alapján",
      bySize: "Fájlméret alapján",
    },
    rembg: {
      label: "Háttér eltávolítása helyi AI-val ({{model}})",
      tooltip:
        "A helyi AI eltávolítja a hátteret (internet nem szükséges).\nLassabb feldolgozás, és kisebb élhibák előfordulhatnak.",
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
      label: "Cél fájlméret",
      placeholder: "pl. 0,50",
      hint: "Megpróbálja az egyes {{format}} fájlokat ezen a határon belül tartani a minőség automatikus állításával.",
      tooltip:
        "Opcionális maximális kimeneti méret (MB-ban). JPEG és AVIF kimenethez érvényes.",
    },
    resizeWidth: {
      label: "Átméretezés szélesség alapján",
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
      removeSavedCropAria: "Mentett kivágás eltávolítása",
      croppedBadge: "kivágva {{w}} × {{h}}",
      cropTooltip: "Ehhez a fájlhoz mentett kivágás tartozik. Az x-re kattintva eltávolíthatod.",
      editCropTooltip: "A fájl mentett kivágásának szerkesztése.",
      addCropTooltip: "Válaszd ki a kép látható részét az átalakítás előtt.",
      cropNotSupportedPdf: "A PDF-ek kivágása még nem támogatott. Mivel a PDF több oldalt is tartalmazhat, ehhez előbb külön oldalválasztó folyamatra van szükség.",
      cropNotSupported: "Ennél a formátumnál jelenleg nem érhető el a kivágás.",
      cropButton: "Kivágás",
      editButton: "Szerkesztés",
    },
    error: {
      label: "Hiba:",
      detailsLabel: "Részletek:",
    },
    buttons: {
      convert: "Átalakítás indítása",
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
    downloadingZip: "Mappa letöltése...",
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
    systemStatusTitle: "Rendszerállapot",
    title: "Rendszer- és kapcsolatstátusz",
    backend: "Konténeres háttérrendszer:",
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
      "Ellenőrzi a konténer állapotát és a hálózati izolációt a biztonság érdekében. Semmilyen kép vagy metaadat nem hagyja el a gépedet.",
    learnMore: "Tudj meg többet az offline használatról →",
    backendLastCheck: "Háttérrendszer utolsó ellenőrzése:",
    internetLastCheck: "Internet utolsó ellenőrzése:",
  },

  errorModal: {
    title: "Hiba történt",
    subtitle: "A művelet nem fejeződött be. Másold ki a nyomkövetést, és nyiss hibajegyet, hogy javítani lehessen.",
    detailsLabel: "Technikai részletek",
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

  theme: {
    switchToLight: "Váltás világos témára",
    switchToDark: "Váltás sötét témára",
    lightTitle: "Világos",
    darkTitle: "Sötét",
    toggle: "Téma váltása",
  },

  runtimeError: {
    title: "Futási hiba",
    errorFallback: "Hiba",
    unknownError: "Ismeretlen hiba",
    subtitle: "Hiba történt a felület megjelenítése közben. Másold ki a nyomkövetést, és nyiss hibajegyet, hogy javítani lehessen.",
    stackTrace: "Hívási verem",
    tryAgain: "Újrapróbálom",
    includeTitle: "Ezt csatold a hibajegyhez",
    includeDescription: "Csatold a diagnosztikai fájlt a hibajegyhez. Tartalmazza a hiba nyomkövetését, a böngésző környezetét, a frontend naplóit, és ha az aktív háttérrendszer elérhetővé teszi, a backend naplóit is.",
    downloadDiagnostics: "Diagnosztika letöltése",
    copied: "Másolva!",
    copyError: "Hiba másolása",
    openTicket: "Hibajegy megnyitása",
  },

  devMode: {
    toggleTitle: "Fejlesztői eszközök (csak DEV_MODE=true esetén látható)",
    title: "Fejlesztői eszközök",
    description: "Felületi állapotok indítása a hibamegjelenítők ellenőrzéséhez. Ezek egyike sem hívja a valódi háttérrendszert.",
    apiSection: "API-hiba widget",
    triggerApiError: "API-hiba indítása",
    triggerApiErrorLong: "API-hiba indítása (hosszú verem)",
    runtimeSection: "Futási hibahatár",
    triggerRuntimeError: "Futási hiba indítása",
    triggerRuntimeErrorLong: "Futási hiba indítása (hosszú verem)",
    footerPrefix: "A panelt a",
    footerMiddle: " beállítással kapcsolhatod be itt: ",
    footerSuffix: ". Nem jelenik meg, ha a jelző ki van kapcsolva.",
  },

  crop: {
    aspectRatio: "Képarány",
    adjust: "Beállítás",
    zoom: "Nagyítás",
    zoomOut: "Kicsinyítés",
    zoomIn: "Nagyítás",
    resetZoom: "Nagyítás visszaállítása",
    resetZoomFull: "Nagyítás és pásztázás visszaállítása",
    dimensions: "Méretek",
    resetSelection: "Kijelölés visszaállítása",
    width: "Szélesség",
    height: "Magasság",
    original: "Eredeti: {{w}} × {{h}} px",
    removeSavedCrop: "Mentett kivágás eltávolítása",
    discard: "Elvetés",
    saveCrop: "Mentés",
    switchToLight: "Váltás világos témára",
    switchToDark: "Váltás sötét témára",
    confirmDialog: {
      title: "Elveted a kivágás módosításait?",
      description: "A nem mentett kivágási beállítások elvesznek. A korábban mentett kivágás, ha volt, változatlan marad.",
      keepEditing: "Folytatom a szerkesztést",
      discardChanges: "Módosítások elvetése",
    },
    loading: {
      serverWords: ["Kérlek,", "várj", "egy", "kicsit,", "hamarosan", "kész", "vagyok"],
      localWords: ["Kivágó", "szerkesztő", "megnyitása"],
      serverMessage: "A {{label}} fájl kivágásához a szervernek előbb bittérképet kell készítenie. Előkészítés folyamatban.",
      localMessage: "{{label}} megnyitása a kivágó szerkesztőben.",
    },
    failure: {
      header: "Nem sikerült előkészíteni ezt a {{label}} fájlt a kivágáshoz.",
      whyTitle: "Mi történt?",
      technicalDetails: "Technikai részletek",
      stillConvert: "A fájlt kivágás nélkül is átalakíthatod.",
      closeButton: "Bezárás",
      reportButton: "Hiba bejelentése",
      causes: {
        backendNotReachable: "A háttérszolgáltatás még nem érhető el. Ha éppen újraépítetted a konténert, várj néhány másodpercet, majd próbáld újra.",
        networkDropped: "A feltöltés közben megszakadt a kapcsolat a háttérrendszerrel. Ellenőrizd, hogy fut-e a konténer, majd próbáld újra.",
        variantNotSupported: "Ez a fájl olyan {{label}} változat lehet, amelyet a dekóder nem tud olvasni (többrétegű, nem szabványos színmód, titkosított stb.). Próbáld meg a forrásalkalmazásból lapított {{label}} vagy sima PNG / JPG formátumban exportálni.",
        missingLibraries: "A {{label}} fájlok mindig a háttér dekóderén mennek át. Ha a dekóderből hiányoznak a natív könyvtárak (pl. libheif HEIC esetén), az opcionális kodekekkel való újraépítés általában megoldja a problémát.",
        reportIssue: "Ha egyik sem illik az esetre, másold ki az alábbi technikai részleteket, és nyiss egy hibajegyet – a nyomkövetés pontosan megmutatja, hol a hiba.",
      },
    },
    freeRatio: "Szabad",
    editorTitle: "Kép kivágása",
    editorDescription: "Állítsd be a kivágási területet, az arányt és a nagyítást, majd kattints a Kivágás mentése vagy az Elvetés gombra.",
    removeDialog: {
      title: "Eltávolítod a mentett kivágást?",
      description: "Ez törli a fájlhoz mentett kivágást. Az eredeti fájl az átalakítási listában marad.",
      keepCrop: "Megtartom",
      removeCrop: "Eltávolítás",
    },
    shortcuts: {
      title: "Gyors műveletek",
      items: [
        { keys: ["Húzás"],                desc: "Kivágás mozgatása" },
        { keys: ["Sarok húzása"],         desc: "Átméretezés" },
        { keys: ["Alt", "+ méretezőpont"],       desc: "Átméretezés középpontból" },
        { keys: ["Görgő"],                desc: "Nagyítás kurzoron" },
        { keys: ["Szóköz", "+ Húzás"],    desc: "Pásztázás" },
        { keys: ["Esc"],                  desc: "Bezárás" },
      ],
    },
  },
};
