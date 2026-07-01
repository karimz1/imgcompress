import type { TranslationSchema } from "../types";

export const fr: TranslationSchema = {
  page: {
    subtitle: "Outil de compression d'images",
    adminTools: "Outils d'administration",
    toast: {
      unsupportedFormat: "Format de fichier non pris en charge : {{fileName}}",
      filesRejected: "{{count}} fichier(s) ont été refusés à cause de types non pris en charge.",
      noFilesError: "Veuillez d'abord déposer ou sélectionner des fichiers.",
      noFormatError: "Veuillez d'abord choisir un format de sortie.",
      qualityRangeError: "La qualité doit être un nombre entre 1 et 100.",
      widthPositiveError: "La largeur doit être un nombre positif.",
      icoWidthClamped:
        "Le format ICO est limité à une largeur maximale de 256 px. Votre saisie a été limitée à 256.",
      targetSizeError: "Veuillez définir une taille maximale de fichier positive (en Mo).",
      compressedSuccess_one: "{{count}} image compressée avec succès !",
      compressedSuccess_other: "{{count}} images compressées avec succès !",
      cleanupSuccess:
        "Suppression terminée. Vos fichiers traités ont été supprimés définitivement. 🧹🧹🧹",
      cleanupFailed: "Le nettoyage forcé a échoué.",
      cleanupError: "🚨 Le nettoyage a échoué.",
      compressionCancelled: "Compression annulée.",
      unexpectedError: "Une erreur est survenue. Veuillez réessayer.",
      selectionCleared_one: "Sélection de {{count}} image effacée ! 🧹",
      selectionCleared_other: "Sélection de {{count}} images effacée ! 🧹",
    },
  },

  splash: {
    dialogTitle: "Compression des fichiers",
    dialogDescription: "Veuillez patienter pendant la compression de vos fichiers.",
    tipLabel: "Astuce",
    cancelButton: "Annuler",
    steps: {
      starting: "Démarrage",
      compressing: "Compression",
      packaging: "Emballage",
    },
    tip: "Vous pouvez continuer à travailler : gardez cette fenêtre ouverte et je déposerai vos fichiers compressés ici dès qu'ils seront prêts.",
    messages: [
      "Compression de vos fichiers…",
      "Optimisation de la qualité et de la taille.",
      "Réencodage des images, veuillez patienter.",
      "Les gros envois peuvent prendre un moment.",
      "Le traitement continue, merci pour votre patience.",
      "Nettoyage et préparation des téléchargements.",
      "Équilibrage de la vitesse et de la qualité.",
      "Dernières retouches sur les fichiers de sortie.",
      "Compression des pixels en paquets plus petits.",
      "Presque terminé : écriture des derniers octets.",
      "Vérification de l'intégrité des fichiers.",
      "Finalisation des tâches de conversion.",
      "Vérification que tout est correct.",
    ],
  },

  form: {
    outputFormat: {
      label: "Format de sortie",
      placeholder: "Choisir un format",
      hint: "Choisissez un format de sortie pour activer la conversion.",
      options: {
        jpeg: "JPEG (taille de fichier réduite)",
        png: "PNG (conserve la transparence)",
        avif: "AVIF (meilleure compression et qualité)",
        pdf: "PDF (document d'une page)",
        ico: "ICO (conserve la transparence)",
      },
      tooltip:
        "PNG : conserve la transparence (alpha) et convient aux images avec arrière-plan transparent.\nJPEG : idéal pour les images sans transparence et produit des fichiers plus petits.\nAVIF : format moderne avec une excellente compression et une bonne qualité, avec prise en charge de la transparence.\nPDF : exporte les images en PDF avec des préréglages de page, marges et découpe multipage optionnels.\nICO : souvent utilisé pour les favicons et les icônes d'application, avec prise en charge de la transparence (alpha). Utilisez de préférence un PNG comme source pour convertir en ICO.",
    },
    pdfPreset: {
      label: "Préréglage de page PDF",
      disabledHint: "La modification de la largeur est désactivée lorsqu'un préréglage PDF est sélectionné.",
      tooltip:
        "Les préréglages A4/Letter redimensionnent l'image sur la page avec une marge sûre pour l'impression. Les préréglages automatiques font pivoter la page selon l'orientation de l'image.",
      options: {
        original: "Original (conserver les proportions)",
        a4Auto: "A4 automatique",
        a4Portrait: "A4 portrait",
        a4Landscape: "A4 paysage",
        letterAuto: "Letter automatique",
        letterPortrait: "Letter portrait",
        letterLandscape: "Letter paysage",
        mobilePortrait: "Mobile portrait (1080x1920)",
        mobileLandscape: "Mobile paysage (1920x1080)",
      },
    },
    pdfScale: {
      label: "Mode de mise à l'échelle PDF",
      paginationHint: "La pagination utilise le mode Ajuster pour conserver toute la largeur.",
      tooltip:
        "Ajuster conserve l'image entière, avec de possibles bandes blanches. Remplir recadre l'image pour couvrir la page.",
      options: {
        fit: "Ajuster (conserver toute l'image)",
        fill: "Remplir (recadrer à la page)",
      },
    },
    pdfMargin: {
      label: "Marge PDF",
      hint: "10 mm est recommandé et défini par défaut.",
      tooltip: "Définissez la marge sûre d'impression en millimètres. 10 mm est recommandé.",
    },
    pdfPaginate: {
      label: "Diviser les images longues en plusieurs pages",
      tooltip: "Divise les images longues en plusieurs pages lorsqu'un préréglage PDF est sélectionné.",
    },
    compressionMode: {
      label: "Mode de réglage {{format}}",
      byQuality: "Régler par qualité",
      bySize: "Régler par taille de fichier",
    },
    rembg: {
      label: "Supprimer l'arrière-plan avec l'IA locale ({{model}})",
      tooltip:
        "L'IA locale supprime l'arrière-plan (aucun internet requis).\nTraitement plus lent, de petits artefacts de bord peuvent apparaître.",
    },
    quality: {
      label: "Qualité",
      tooltip:
        "Ajustez la qualité (100 donne la meilleure qualité, les valeurs plus basses réduisent la taille du fichier). S'applique à JPEG et AVIF.",
      presets: {
        smaller: "Plus petit (60)",
        balanced: "Équilibré (75)",
        high: "Élevé (85)",
        max: "Maximum (100)",
      },
    },
    targetSize: {
      label: "Taille maximale",
      placeholder: "p. ex. 0,50",
      hint: "Chaque fichier {{format}} sera maintenu à cette taille ou en dessous en ajustant automatiquement la qualité.",
      tooltip:
        "Définissez une taille maximale de sortie optionnelle (en Mo). S'applique aux sorties JPEG et AVIF.",
    },
    resizeWidth: {
      label: "Redimensionner la largeur",
      tooltip:
        "Redimensionne l'image ou les images à la largeur souhaitée en conservant le rapport d'aspect d'origine.",
    },
    dropzone: {
      dragActive: "Déposez des images ou des PDF ici...",
      processing: "Impossible de déposer des fichiers pendant le traitement...",
      idle: "Glissez-déposez des images ou des PDF ici, ou cliquez pour sélectionner",
    },
    filesList: {
      label: "Fichiers à convertir :",
      removeButton: "Retirer",
      removeSavedCropAria: "Retirer le recadrage enregistré",
      croppedBadge: "recadré {{w}} × {{h}}",
      cropTooltip: "Ce fichier a un recadrage enregistré. Cliquez sur x pour le retirer.",
      editCropTooltip: "Modifier le recadrage enregistré pour ce fichier.",
      addCropTooltip: "Choisir la zone visible avant de convertir ce fichier.",
      cropNotSupportedPdf: "Le recadrage PDF n'est pas encore pris en charge. Les PDF peuvent contenir plusieurs pages ; le recadrage nécessite donc d'abord un flux dédié au choix des pages.",
      cropNotSupported: "Le recadrage n'est pas pris en charge pour ce format pour le moment.",
      cropButton: "Recadrer",
      editButton: "Modifier",
    },
    error: {
      label: "Erreur détectée :",
      detailsLabel: "Détails techniques :",
    },
    buttons: {
      convert: "Lancer la conversion",
      processing: "Traitement...",
      clear: "Effacer",
    },
  },

  drawer: {
    trigger_one: "🗃️ Afficher l'image compressée",
    trigger_other: "🗃️ Afficher les images compressées",
    title_one: "Image compressée",
    title_other: "Images compressées",
    description_one: "Téléchargez votre image compressée seule ou avec toutes les autres.",
    description_other: "Téléchargez vos images compressées une par une ou toutes à la fois.",
    downloadAll: "Tout télécharger en ZIP",
    close: "Fermer",
    downloadingFile: "Téléchargement : {{fileName}}...",
    downloadingZip: "Téléchargement du dossier...",
  },

  downloadError: {
    title: "Ce fichier n'est plus disponible",
    description:
      "Il a peut-être été supprimé ou a expiré. Essayez de le compresser à nouveau.",
    close: "Compris",
  },

  storage: {
    title: "Gestion du stockage",
    used: "Utilisé :",
    available: "Disponible :",
    files: "Fichiers",
    clearButton: "Effacer les fichiers traités",
    totalFiles: "Nombre total de fichiers :",
    totalSpace: "Espace total utilisé :",
    noFiles: "Aucun fichier converti trouvé.",
    confirmTitle: "Confirmer la suppression des fichiers",
    confirmDescription:
      "Cette action supprimera définitivement tous les fichiers traités. Assurez-vous d'avoir téléchargé les fichiers nécessaires avant de continuer, car cette action est irréversible.",
    confirmCancel: "Annuler",
    confirmDelete: "Oui, supprimer les fichiers",
    fetchError: "Impossible de récupérer les fichiers du conteneur.",
    storageError: "Impossible de récupérer les informations de stockage.",
    zipLabel: "(ZIP)",
  },

  statusBanner: {
    warning: "Avertissement : le backend est actuellement indisponible.",
  },

  statusFloating: {
    systemStatusTitle: "État du système",
    title: "État du système et de la connectivité",
    backend: "Backend du conteneur :",
    network: "Accès réseau :",
    mode: "Mode :",
    modeRunning: "en cours",
    backendDown: "Est indisponible ❌",
    backendUp: "Fonctionne",
    internetYes: "Accès internet disponible",
    internetNo: "Aucun internet détecté 🚫",
    internetUnknown: "Non vérifié",
    checkButton: "Vérifier la connexion internet",
    checking: "Vérification...",
    whyTitle: "Pourquoi cela existe ?",
    whyDesc:
      "Vérifie la santé du conteneur et l'isolation réseau pour la sécurité. Aucune image ni métadonnée ne quitte jamais votre machine.",
    learnMore: "En savoir plus sur l'utilisation hors ligne →",
    backendLastCheck: "Dernière vérification du backend :",
    internetLastCheck: "Dernière vérification internet :",
  },

  errorModal: {
    title: "Erreur survenue",
    subtitle: "L'action n'a pas pu être terminée. Copiez la trace ci-dessous et ouvrez un ticket pour permettre la correction.",
    detailsLabel: "Détails techniques",
    notifyDeveloper:
      "Veuillez ouvrir un ticket et prévenir le développeur afin que cela soit corrigé au plus vite.",
    copyError: "Copier l'erreur",
    copied: "Copié !",
    openTicket: "Ouvrir un ticket",
    close: "Fermer",
  },

  formatsDialog: {
    triggerButton: "Que puis-je ouvrir ?",
    title: "Fichiers pris en charge",
    descriptionStart: "Voici un mémo des formats que je peux ouvrir pour vous. Vous pouvez choisir le format de résultat avec le menu",
    descriptionBold: "Format de sortie",
    descriptionEnd: "sur l'écran principal après avoir fermé ceci.",
    searchLabel: "Rechercher dans la liste",
    searchHint: "Tapez simplement pour trouver un format",
    searchPlaceholder: "Rechercher (p. ex. psd, tiff)...",
    verifiedTitle: "Testés et fonctionnels",
    unverifiedTitle: "Autres formats possibles",
    unverifiedHint: "Ils n'ont pas encore été entièrement testés, mais ils peuvent fonctionner !",
    footerText: "ImgCompress est là pour vous aider à convertir vos images !",
    reportBug: "Signaler un bug",
  },

  starBanner: {
    message: "ImgCompress vous a été utile ?",
    linkText: "Une étoile sur GitHub",
    suffix: "aide d'autres personnes à le découvrir.",
    dismiss: "Ne plus afficher",
  },

  help: {
    label: "Mode d'emploi",
  },

  footer: {
    updateAvailable: "Mise à jour disponible : {{version}}",
    whatsNew: "Nouveautés",
    version: "Version : {{version}}",
    releaseNotes: "Notes de version",
    links: {
      docs: "Documentation",
      github: "GitHub",
      reportBug: "Signaler un bug",
      author: "Auteur",
      sponsor: "Soutenir",
    },
  },

  releaseNotes: {
    buttonLabel: "Notes de version",
    title: "Notes de version",
    infoBoxText: "Voir les",
    infoBoxLink: "notes de version complètes",
    infoBoxSuffix: "pour toutes les versions et tous les détails.",
    loading: "Chargement…",
    loadError: "Échec du chargement des notes de version",
    empty: "Aucune note de version disponible.",
    tabLatest: "Dernière",
    tabArchive: "Archives",
    noArchive: "Aucune version archivée pour le moment.",
  },

  langSwitcher: {
    ariaLabel: "Changer de langue",
  },

  theme: {
    switchToLight: "Passer au thème clair",
    switchToDark: "Passer au thème sombre",
    lightTitle: "Clair",
    darkTitle: "Sombre",
    toggle: "Changer de thème",
  },

  runtimeError: {
    title: "Erreur d'exécution",
    errorFallback: "Défaillance",
    unknownError: "Erreur inconnue",
    subtitle: "Un problème est survenu pendant le rendu. Copiez la trace ci-dessous et ouvrez un ticket pour permettre la correction.",
    stackTrace: "Trace de pile",
    tryAgain: "Réessayer",
    includeTitle: "À inclure dans le ticket",
    includeDescription: "Joignez le fichier de diagnostic au ticket. Il contient la trace de l'erreur, le contexte du navigateur, les journaux frontend et les journaux backend lorsque le backend en cours les expose.",
    downloadDiagnostics: "Télécharger le diagnostic",
    copied: "Copié !",
    copyError: "Copier l'erreur",
    openTicket: "Ouvrir un ticket",
  },

  devMode: {
    toggleTitle: "Outils du mode développeur (affichés uniquement si DEV_MODE=true)",
    title: "Outils développeur",
    description: "Déclencher des états d'interface pour vérifier les surfaces d'erreur. Aucun n'appelle le vrai backend.",
    apiSection: "Widget d'erreur API",
    triggerApiError: "Déclencher une erreur API",
    triggerApiErrorLong: "Déclencher une erreur API (pile longue)",
    runtimeSection: "Limite d'erreur d'exécution",
    triggerRuntimeError: "Déclencher une erreur d'exécution",
    triggerRuntimeErrorLong: "Déclencher une erreur d'exécution (pile longue)",
    footerPrefix: "Activez ce panneau via",
    footerMiddle: " dans ",
    footerSuffix: ". Il n'est jamais affiché lorsque l'indicateur est désactivé.",
  },

  crop: {
    aspectRatio: "Rapport d'aspect",
    adjust: "Ajuster",
    zoom: "Agrandissement",
    zoomOut: "Réduire",
    zoomIn: "Agrandir",
    resetZoom: "Réinitialiser l'agrandissement",
    resetZoomFull: "Réinitialiser l'agrandissement et le déplacement",
    dimensions: "Dimensions de l'image",
    resetSelection: "Réinitialiser la sélection",
    width: "Largeur",
    height: "Hauteur",
    original: "Image d'origine : {{w}} × {{h}} px",
    removeSavedCrop: "Retirer le recadrage enregistré",
    discard: "Abandonner",
    saveCrop: "Enregistrer le recadrage",
    switchToLight: "Passer au thème clair",
    switchToDark: "Passer au thème sombre",
    confirmDialog: {
      title: "Abandonner les modifications de recadrage ?",
      description: "Vos ajustements de recadrage non enregistrés seront perdus. Le recadrage précédemment enregistré, s'il existe, restera inchangé.",
      keepEditing: "Continuer l'édition",
      discardChanges: "Abandonner les modifications",
    },
    loading: {
      serverWords: ["Merci", "de", "patienter,", "je", "suis", "presque", "prêt"],
      localWords: ["Ouverture", "éditeur", "recadrage"],
      serverMessage: "{{label}} nécessite une image bitmap rendue par le serveur avant le recadrage. Préparation en cours.",
      localMessage: "Ouverture de {{label}} dans l'éditeur de recadrage.",
    },
    failure: {
      header: "Impossible de préparer ce {{label}} pour le recadrage.",
      whyTitle: "Pourquoi cela s'est-il produit ?",
      technicalDetails: "Détails techniques",
      stillConvert: "Vous pouvez quand même convertir ce fichier tel quel. Aucun recadrage ne sera simplement appliqué.",
      closeButton: "Fermer",
      reportButton: "Signaler ce problème",
      causes: {
        backendNotReachable: "Le service backend n'est pas encore joignable. Si vous venez de reconstruire le conteneur, attendez quelques secondes puis réessayez.",
        networkDropped: "La connexion au backend a été interrompue pendant l'envoi. Vérifiez que le conteneur fonctionne encore puis réessayez.",
        variantNotSupported: "Ce fichier peut être une variante {{label}} que le décodeur ne peut pas lire (multicalque, mode couleur non standard, chiffré, etc.). Le réexporter depuis l'application source en {{label}} aplati ou en PNG/JPG classique résout souvent le problème.",
        missingLibraries: "Les fichiers {{label}} passent toujours par le décodeur du backend. Si le décodeur manque de bibliothèques natives (par exemple libheif pour HEIC), une reconstruction avec les codecs optionnels activés résout généralement le problème.",
        reportIssue: "Si aucun cas ne correspond, copiez les détails techniques ci-dessous et ouvrez un ticket : la trace indique exactement l'étape qui a échoué.",
      },
    },
    freeRatio: "Libre",
    editorTitle: "Éditeur de recadrage",
    editorDescription: "Ajustez la zone de recadrage, le ratio et l'agrandissement de cette image, puis cliquez sur Enregistrer le recadrage ou Abandonner.",
    removeDialog: {
      title: "Retirer le recadrage enregistré ?",
      description: "Cela efface le recadrage enregistré pour ce fichier. Le fichier d'origine restera dans votre liste de conversion.",
      keepCrop: "Conserver le recadrage",
      removeCrop: "Retirer le recadrage",
    },
    shortcuts: {
      title: "Raccourcis",
      items: [
        { keys: ["Glisser"],              desc: "Déplacer le recadrage" },
        { keys: ["Glisser un coin"],      desc: "Redimensionner" },
        { keys: ["Alt", "+ glisser poignée"], desc: "Redimensionner depuis le centre" },
        { keys: ["Molette"],              desc: "Agrandir au curseur" },
        { keys: ["Espace", "+ glisser"],  desc: "Déplacer la vue" },
        { keys: ["Esc"],                  desc: "Fermer" },
      ],
    },
  },
};
