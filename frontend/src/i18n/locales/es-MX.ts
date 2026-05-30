import type { TranslationSchema } from "../types";

export const esMX: TranslationSchema = {
  page: {
    subtitle: "Una herramienta para comprimir imágenes",
    adminTools: "Herramientas de administración",
    toast: {
      unsupportedFormat: "Formato de archivo no compatible: {{fileName}}",
      filesRejected: "{{count}} archivo(s) fueron rechazados por tipos de archivo no compatibles.",
      noFilesError: "Primero arrastra o selecciona algunos archivos.",
      noFormatError: "Primero selecciona un formato de salida.",
      qualityRangeError: "La calidad debe ser un número entre 1 y 100.",
      widthPositiveError: "El ancho debe ser un número positivo.",
      icoWidthClamped:
        "El formato ICO está limitado a un ancho máximo de 256 px. Tu entrada se ajustó a 256.",
      targetSizeError: "Define un tamaño máximo de archivo positivo (en MB).",
      compressedSuccess_one: "¡{{count}} imagen comprimida correctamente!",
      compressedSuccess_other: "¡{{count}} imágenes comprimidas correctamente!",
      cleanupSuccess:
        "Eliminación completa. Tus archivos procesados se eliminaron permanentemente. 🧹🧹🧹",
      cleanupFailed: "Falló la limpieza forzada.",
      cleanupError: "🚨 Falló la limpieza.",
      compressionCancelled: "Compresión cancelada.",
      unexpectedError: "Algo salió mal. Inténtalo de nuevo.",
      selectionCleared_one: "¡Se limpió la selección de {{count}} imagen! 🧹",
      selectionCleared_other: "¡Se limpió la selección de {{count}} imágenes! 🧹",
    },
  },

  splash: {
    dialogTitle: "Comprimiendo archivos",
    dialogDescription: "Espera mientras se comprimen tus archivos.",
    tipLabel: "Consejo",
    cancelButton: "Cancelar",
    steps: {
      starting: "Iniciando",
      compressing: "Comprimiendo",
      packaging: "Empaquetando",
    },
    tip: "Puedes seguir trabajando: deja esta ventana abierta y pondré aquí tus archivos comprimidos cuando estén listos.",
    messages: [
      "Comprimiendo tus archivos…",
      "Optimizando calidad y tamaño.",
      "Recodificando imágenes, espera un momento.",
      "Las cargas grandes pueden tardar un poco.",
      "Sigo trabajando, gracias por tu paciencia.",
      "Limpiando y preparando tus descargas.",
      "Equilibrando velocidad y calidad ahora mismo.",
      "Dando los últimos ajustes a los archivos de salida.",
      "Compactando pixeles en paquetes más pequeños.",
      "Ya casi está: escribiendo los bytes finales.",
      "Verificando la integridad de los archivos.",
      "Terminando las tareas de conversión.",
      "Asegurando que todo se vea bien.",
    ],
  },

  form: {
    outputFormat: {
      label: "Formato de salida",
      placeholder: "Selecciona formato",
      hint: "Selecciona un formato de salida para habilitar la conversión.",
      options: {
        jpeg: "JPEG (menor tamaño de archivo)",
        png: "PNG (conserva transparencia)",
        avif: "AVIF (mejor compresión y calidad)",
        pdf: "PDF (documento de una página)",
        ico: "ICO (conserva transparencia)",
      },
      tooltip:
        "PNG: Conserva la transparencia (alfa) y es ideal para imágenes con fondos transparentes.\nJPEG: Ideal para imágenes sin transparencia y produce archivos más pequeños.\nAVIF: Formato moderno con compresión y calidad superiores; admite transparencia.\nPDF: Exporta imágenes a PDF con ajustes opcionales de página, márgenes y división en varias páginas.\nICO: Se usa comúnmente para favicons e iconos de aplicaciones; admite transparencia (alfa). Se recomienda usar PNG como origen al convertir a ICO.",
    },
    pdfPreset: {
      label: "Preajuste de página PDF",
      disabledHint: "Cambiar ancho está deshabilitado mientras haya un preajuste PDF seleccionado.",
      tooltip:
        "Los preajustes A4/Letter escalan la imagen a la página con un margen seguro para impresión configurable. Los preajustes automáticos giran la página según la orientación de la imagen.",
      options: {
        original: "Original (mantener proporciones)",
        a4Auto: "A4 automático",
        a4Portrait: "A4 vertical",
        a4Landscape: "A4 horizontal",
        letterAuto: "Letter automático",
        letterPortrait: "Letter vertical",
        letterLandscape: "Letter horizontal",
        mobilePortrait: "Móvil vertical (1080x1920)",
        mobileLandscape: "Móvil horizontal (1920x1080)",
      },
    },
    pdfScale: {
      label: "Modo de escala PDF",
      paginationHint: "La paginación usa el modo Ajustar para conservar todo el ancho.",
      tooltip:
        "Ajustar conserva toda la imagen con posibles barras blancas. Rellenar recorta para cubrir la página.",
      options: {
        fit: "Ajustar (conservar imagen completa)",
        fill: "Rellenar (recortar a la página)",
      },
    },
    pdfMargin: {
      label: "Margen PDF",
      hint: "Se recomienda 10 mm y es el valor predeterminado.",
      tooltip: "Define el borde seguro para impresión en milímetros. Se recomienda 10 mm.",
    },
    pdfPaginate: {
      label: "Dividir imágenes largas en varias páginas",
      tooltip: "Divide imágenes largas en varias páginas cuando se selecciona un preajuste PDF.",
    },
    compressionMode: {
      label: "Modo de ajustes de {{format}}",
      byQuality: "Definir por calidad",
      bySize: "Definir por tamaño de archivo",
    },
    rembg: {
      label: "Eliminar fondo con IA local ({{model}})",
      tooltip:
        "La IA local elimina el fondo (no requiere internet).\nProcesamiento más lento; puede mostrar pequeños artefactos en los bordes.",
    },
    quality: {
      label: "Calidad",
      tooltip:
        "Ajusta la calidad (100 da la mejor calidad; valores menores reducen el tamaño del archivo). Aplica a JPEG y AVIF.",
      presets: {
        smaller: "Más pequeño (60)",
        balanced: "Equilibrado (75)",
        high: "Alta (85)",
        max: "Máxima (100)",
      },
    },
    targetSize: {
      label: "Tamaño máximo",
      placeholder: "p. ej., 0.50",
      hint: "Intentará mantener cada {{format}} en este tamaño o por debajo ajustando la calidad automáticamente.",
      tooltip:
        "Define un tamaño máximo opcional de salida (en MB). Aplica a salidas JPEG y AVIF.",
    },
    resizeWidth: {
      label: "Cambiar ancho",
      tooltip:
        "Cambia el tamaño de la(s) imagen(es) al ancho deseado conservando la relación de aspecto original.",
    },
    dropzone: {
      dragActive: "Arrastra imágenes o PDF aquí...",
      processing: "No puedes arrastrar archivos mientras se procesan...",
      idle: "Arrastra y suelta imágenes o PDF aquí, o haz clic para seleccionar",
    },
    filesList: {
      label: "Archivos para convertir:",
      removeButton: "Eliminar",
      removeSavedCropAria: "Eliminar recorte guardado",
      croppedBadge: "recortado {{w}} × {{h}}",
      cropTooltip: "Este archivo tiene un recorte guardado. Haz clic en la x para eliminarlo.",
      editCropTooltip: "Editar el recorte guardado para este archivo.",
      addCropTooltip: "Elige el área visible antes de convertir este archivo.",
      cropNotSupportedPdf: "El recorte de PDF aún no está disponible. Los PDF pueden contener varias páginas, así que el recorte necesita primero un flujo dedicado para seleccionar páginas.",
      cropNotSupported: "El recorte no es compatible con este formato por ahora.",
      cropButton: "Recortar",
      editButton: "Editar",
    },
    error: {
      label: "Error detectado:",
      detailsLabel: "Detalles:",
    },
    buttons: {
      convert: "Iniciar conversión",
      processing: "Procesando...",
      clear: "Limpiar",
    },
  },

  drawer: {
    trigger_one: "🗃️ Mostrar imagen comprimida",
    trigger_other: "🗃️ Mostrar imágenes comprimidas",
    title_one: "Imagen comprimida",
    title_other: "Imágenes comprimidas",
    description_one: "Descarga tu imagen comprimida individualmente o junto con todas.",
    description_other: "Descarga tus imágenes comprimidas individualmente o todas a la vez.",
    downloadAll: "Descargar todo como ZIP",
    close: "Cerrar",
    downloadingFile: "Descargando: {{fileName}}...",
    downloadingZip: "Descargando carpeta...",
  },

  storage: {
    title: "Administración de almacenamiento",
    used: "Usado:",
    available: "Disponible:",
    files: "Archivos",
    clearButton: "Limpiar archivos procesados",
    totalFiles: "Archivos totales:",
    totalSpace: "Espacio total usado:",
    noFiles: "No se encontraron archivos convertidos.",
    confirmTitle: "Confirmar eliminación de archivos",
    confirmDescription:
      "Esta acción eliminará permanentemente todos los archivos procesados. Asegúrate de haber descargado los archivos necesarios antes de continuar, ya que esta acción no se puede deshacer.",
    confirmCancel: "Cancelar",
    confirmDelete: "Sí, eliminar archivos",
    fetchError: "No se pudieron obtener los archivos del contenedor.",
    storageError: "No se pudo obtener la información de almacenamiento.",
    zipLabel: "(ZIP)",
  },

  statusBanner: {
    warning: "Advertencia: el backend no está disponible actualmente.",
  },

  statusFloating: {
    systemStatusTitle: "Estado del sistema",
    title: "Estado del sistema y conectividad",
    backend: "Backend del contenedor:",
    network: "Acceso a red:",
    mode: "Modo:",
    modeRunning: "ejecutándose",
    backendDown: "Está caído ❌",
    backendUp: "Funciona",
    internetYes: "Tiene acceso a internet",
    internetNo: "No se detectó internet 🚫",
    internetUnknown: "No verificado",
    checkButton: "Verificar conexión a internet",
    checking: "Verificando...",
    whyTitle: "¿Por qué existe esto?",
    whyDesc:
      "Verifica la salud del contenedor y el aislamiento de red por seguridad. Ninguna imagen ni metadato sale jamás de tu máquina.",
    learnMore: "Conoce más sobre el uso sin conexión →",
    backendLastCheck: "Última verificación del backend:",
    internetLastCheck: "Última verificación de internet:",
  },

  errorModal: {
    title: "Ocurrió un error",
    subtitle: "La acción no se pudo completar. Copia el rastro de abajo y abre un ticket para que se pueda corregir.",
    detailsLabel: "Detalles técnicos",
    notifyDeveloper:
      "Abre un ticket y avisa al desarrollador para que esto se pueda corregir lo antes posible.",
    copyError: "Copiar error",
    copied: "¡Copiado!",
    openTicket: "Abrir ticket",
    close: "Cerrar",
  },

  formatsDialog: {
    triggerButton: "¿Qué puedo abrir?",
    title: "Archivos compatibles",
    descriptionStart: "Aquí tienes una guía rápida de lo que puedo abrir por ti. Puedes elegir el formato de resultado usando el menú",
    descriptionBold: "Formato de salida",
    descriptionEnd: "en la pantalla principal después de cerrar esto.",
    searchLabel: "Buscar en la lista",
    searchHint: "Solo escribe para encontrar un formato",
    searchPlaceholder: "Buscar (p. ej., psd, tiff)...",
    verifiedTitle: "Probados y funcionando",
    unverifiedTitle: "Otros formatos posibles",
    unverifiedHint: "Todavía no se han probado completamente, pero podrían funcionar.",
    footerText: "ImgCompress está aquí para ayudarte a convertir tus imágenes.",
    reportBug: "Reportar un error",
  },

  starBanner: {
    message: "¿ImgCompress te resultó útil?",
    linkText: "Una estrella en GitHub",
    suffix: "ayuda a que otros lo descubran.",
    dismiss: "No volver a mostrar",
  },

  help: {
    label: "Cómo usar",
  },

  footer: {
    updateAvailable: "Actualización disponible: {{version}}",
    whatsNew: "Novedades",
    version: "Versión {{version}}",
    releaseNotes: "Notas de la versión",
    links: {
      docs: "Documentación",
      github: "GitHub",
      reportBug: "Reportar un error",
      author: "Autor",
      sponsor: "Patrocinar",
    },
  },

  releaseNotes: {
    buttonLabel: "Notas de la versión",
    title: "Notas de la versión",
    infoBoxText: "Ver",
    infoBoxLink: "notas completas de la versión",
    infoBoxSuffix: "para todas las versiones y detalles.",
    loading: "Cargando…",
    loadError: "No se pudieron cargar las notas de la versión",
    empty: "No hay notas de la versión disponibles.",
    tabLatest: "Más reciente",
    tabArchive: "Archivo",
    noArchive: "Todavía no hay versiones archivadas.",
  },

  langSwitcher: {
    ariaLabel: "Cambiar idioma",
  },

  theme: {
    switchToLight: "Cambiar a tema claro",
    switchToDark: "Cambiar a tema oscuro",
    lightTitle: "Claro",
    darkTitle: "Oscuro",
    toggle: "Cambiar tema",
  },

  runtimeError: {
    title: "Error de ejecución",
    errorFallback: "Fallo",
    unknownError: "Error desconocido",
    subtitle: "Algo falló al renderizar. Copia el rastro de abajo y abre un ticket para que se pueda corregir.",
    stackTrace: "Rastro de pila",
    tryAgain: "Intentar de nuevo",
    includeTitle: "Incluye esto en el ticket",
    includeDescription: "Adjunta el archivo de diagnóstico al ticket. Incluye el rastro del error, el contexto del navegador, los logs del frontend y los logs del backend cuando el backend en ejecución los expone.",
    downloadDiagnostics: "Descargar diagnóstico",
    copied: "¡Copiado!",
    copyError: "Copiar error",
    openTicket: "Abrir ticket",
  },

  devMode: {
    toggleTitle: "Herramientas de desarrollo (solo se muestran cuando DEV_MODE=true)",
    title: "Herramientas para desarrollador",
    description: "Activa estados de la interfaz para verificar superficies de error. Ninguno llama al backend real.",
    apiSection: "Widget de error API",
    triggerApiError: "Activar error API",
    triggerApiErrorLong: "Activar error API (pila larga)",
    runtimeSection: "Límite de error de ejecución",
    triggerRuntimeError: "Activar error de ejecución",
    triggerRuntimeErrorLong: "Activar error de ejecución (pila larga)",
    footerPrefix: "Activa este panel con",
    footerMiddle: " en ",
    footerSuffix: ". Nunca se muestra cuando la bandera está apagada.",
  },

  crop: {
    aspectRatio: "Relación de aspecto",
    zoom: "Acercamiento",
    zoomOut: "Alejar",
    zoomIn: "Acercar",
    resetZoom: "Restablecer zoom",
    resetZoomFull: "Restablecer zoom y desplazamiento",
    dimensions: "Dimensiones",
    resetSelection: "Restablecer selección",
    width: "Ancho",
    height: "Alto",
    original: "Imagen original: {{w}} × {{h}} px",
    removeSavedCrop: "Eliminar recorte guardado",
    discard: "Descartar",
    saveCrop: "Guardar recorte",
    switchToLight: "Cambiar a tema claro",
    switchToDark: "Cambiar a tema oscuro",
    confirmDialog: {
      title: "¿Descartar cambios de recorte?",
      description: "Se perderán los ajustes de recorte no guardados. El recorte guardado previamente, si existe, se mantendrá sin cambios.",
      keepEditing: "Seguir editando",
      discardChanges: "Descartar cambios",
    },
    loading: {
      serverWords: ["Espera", "un", "momento,", "ya", "casi", "estoy", "listo"],
      localWords: ["Abriendo", "editor", "recorte"],
      serverMessage: "{{label}} necesita un mapa de bits renderizado por el servidor antes de recortar. Preparándolo ahora.",
      localMessage: "Abriendo {{label}} en el editor de recorte.",
    },
    failure: {
      header: "No se pudo preparar este {{label}} para recortar.",
      whyTitle: "¿Por qué pasó esto?",
      technicalDetails: "Detalles técnicos",
      stillConvert: "Aún puedes convertir este archivo tal como está. Solo no se aplicará ningún recorte.",
      closeButton: "Cerrar",
      reportButton: "Reportar este problema",
      causes: {
        backendNotReachable: "El servicio backend aún no está disponible. Si acabas de reconstruir el contenedor, dale unos segundos para iniciar e inténtalo de nuevo.",
        networkDropped: "La conexión con el backend se perdió durante la carga. Revisa que el contenedor siga ejecutándose e inténtalo de nuevo.",
        variantNotSupported: "Este archivo puede ser una variante de {{label}} que el decodificador no puede leer (multicapa, modo de color no estándar, cifrado, etc.). Reexportarlo desde la app de origen como {{label}} plano o PNG/JPG normal suele corregirlo.",
        missingLibraries: "Los archivos {{label}} siempre pasan por el decodificador del backend. Si al decodificador le faltan bibliotecas nativas (por ejemplo libheif para HEIC), reconstruir con los códecs opcionales habilitados suele resolverlo.",
        reportIssue: "Si nada de lo anterior aplica, copia los detalles técnicos de abajo y abre un ticket: el rastro muestra exactamente qué paso falló.",
      },
    },
    freeRatio: "Libre",
    editorTitle: "Editor de recorte",
    editorDescription: "Ajusta la región de recorte, la proporción y el zoom de esta imagen, luego haz clic en Guardar recorte o Descartar.",
    removeDialog: {
      title: "¿Eliminar recorte guardado?",
      description: "Esto borra el recorte guardado para este archivo. El archivo original permanecerá en tu lista de conversión.",
      keepCrop: "Conservar recorte",
      removeCrop: "Eliminar recorte",
    },
    shortcuts: {
      title: "Atajos",
      items: [
        { keys: ["Arrastrar"],             desc: "Mover recorte" },
        { keys: ["Arrastrar esquina"],     desc: "Cambiar tamaño" },
        { keys: ["Alt", "+ arrastrar control"], desc: "Cambiar tamaño desde el centro" },
        { keys: ["Rueda"],                 desc: "Zoom en el cursor" },
        { keys: ["Espacio", "+ arrastrar"], desc: "Desplazar" },
        { keys: ["Esc"],                   desc: "Cerrar" },
      ],
    },
  },
};
