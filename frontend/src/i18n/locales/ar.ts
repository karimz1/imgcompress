import type { TranslationSchema } from "../types";

export const ar: TranslationSchema = {
  page: {
    subtitle: "أداة لضغط الصور",
    adminTools: "أدوات الإدارة",
    toast: {
      unsupportedFormat: "تنسيق ملف غير مدعوم: {{fileName}}",
      filesRejected: "تم رفض {{count}} ملف/ملفات بسبب أنواع ملفات غير مدعومة.",
      noFilesError: "يرجى إسقاط أو تحديد بعض الملفات أولاً.",
      noFormatError: "يرجى تحديد تنسيق إخراج أولاً.",
      qualityRangeError: "يجب أن تكون الجودة رقماً بين 1 و100.",
      widthPositiveError: "يجب أن يكون العرض رقماً موجباً.",
      icoWidthClamped:
        "تنسيق ICO محدود بعرض أقصى قدره 256 بكسل. تم ضبط الإدخال إلى 256.",
      targetSizeError: "يرجى تعيين حجم ملف أقصى موجب (بالميغابايت).",
      compressedSuccess_one: "تم ضغط {{count}} صورة بنجاح!",
      compressedSuccess_other: "تم ضغط {{count}} صورة بنجاح!",
      cleanupSuccess:
        "اكتمل الحذف. تمت إزالة ملفاتك المعالجة نهائياً. 🧹🧹🧹",
      cleanupFailed: "فشلت عملية التنظيف القسري.",
      cleanupError: "🚨 فشلت عملية التنظيف.",
      compressionCancelled: "تم إلغاء الضغط.",
      unexpectedError: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
      selectionCleared_one: "تم مسح اختيار {{count}} صورة! 🧹",
      selectionCleared_other: "تم مسح اختيار {{count}} صورة! 🧹",
    },
  },

  splash: {
    dialogTitle: "جارٍ ضغط الملفات",
    dialogDescription: "يرجى الانتظار أثناء ضغط ملفاتك.",
    tipLabel: "نصيحة",
    cancelButton: "إلغاء",
    steps: {
      starting: "بدء",
      compressing: "ضغط",
      packaging: "تجهيز الحزمة",
    },
    tip: "يمكنك متابعة العمل - اترك هذه النافذة مفتوحة، وسأضع ملفاتك المضغوطة هنا عندما تصبح جاهزة.",
    messages: [
      "جارٍ ضغط ملفاتك…",
      "تحسين الجودة والحجم.",
      "إعادة ترميز الصور، يرجى الانتظار.",
      "قد تستغرق الملفات الكبيرة بعض الوقت.",
      "ما زلت أعمل - شكراً لصبرك.",
      "تنظيف وتجهيز التنزيلات.",
      "موازنة السرعة والجودة الآن.",
      "اللمسات الأخيرة على ملفات الإخراج.",
      "ضغط البكسلات في حزم أصغر.",
      "أوشكنا على الانتهاء - تتم كتابة البايتات الأخيرة.",
      "التحقق من سلامة الملفات.",
      "إنهاء مهام التحويل.",
      "التأكد من أن كل شيء يبدو جيداً.",
    ],
  },

  form: {
    outputFormat: {
      label: "تنسيق الإخراج",
      placeholder: "حدد التنسيق",
      hint: "حدد تنسيق إخراج لتفعيل التحويل.",
      options: {
        jpeg: "JPEG (حجم ملف أصغر)",
        png: "PNG (يحافظ على الشفافية)",
        avif: "AVIF (أفضل ضغط وجودة)",
        pdf: "PDF (مستند من صفحة واحدة)",
        ico: "ICO (يحافظ على الشفافية)",
      },
      tooltip:
        "PNG: يحافظ على الشفافية (ألفا) وهو الأفضل للصور ذات الخلفيات الشفافة.\nJPEG: مثالي للصور من دون شفافية وينتج أحجام ملفات أصغر.\nAVIF: تنسيق حديث بضغط وجودة أفضل، ويدعم الشفافية.\nPDF: تصدير الصور إلى ملفات PDF مع إعدادات صفحات وهوامش وتقسيم متعدد الصفحات اختيارية.\nICO: يستخدم عادةً للأيقونات المفضلة وأيقونات التطبيقات، ويدعم الشفافية (ألفا). يُنصح باستخدام PNG كمصدر عند التحويل إلى ICO.",
    },
    pdfPreset: {
      label: "إعداد صفحة PDF",
      disabledHint: "تغيير العرض معطل أثناء تحديد إعداد صفحة PDF.",
      tooltip:
        "إعدادات A4/Letter تضبط الصورة على الصفحة مع هامش آمن للطباعة قابل للتكوين. الإعدادات التلقائية تدوّر الصفحة بناءً على اتجاه الصورة.",
      options: {
        original: "الأصلي (الحفاظ على النسب)",
        a4Auto: "A4 تلقائي",
        a4Portrait: "A4 عمودي",
        a4Landscape: "A4 أفقي",
        letterAuto: "Letter تلقائي",
        letterPortrait: "Letter عمودي",
        letterLandscape: "Letter أفقي",
        mobilePortrait: "هاتف عمودي (1080x1920)",
        mobileLandscape: "هاتف أفقي (1920x1080)",
      },
    },
    pdfScale: {
      label: "وضع مقياس PDF",
      paginationHint: "يستخدم التقسيم إلى صفحات وضع الملاءمة للحفاظ على العرض الكامل.",
      tooltip:
        "الملاءمة تحافظ على الصورة كاملة مع احتمال ظهور أشرطة بيضاء. التعبئة تقص الصورة لتغطية الصفحة.",
      options: {
        fit: "ملاءمة (الحفاظ على الصورة كاملة)",
        fill: "تعبئة (قص لتناسب الصفحة)",
      },
    },
    pdfMargin: {
      label: "هامش PDF",
      hint: "يوصى بـ 10 مم وهو الإعداد الافتراضي.",
      tooltip: "اضبط هامش الطباعة الآمن بالميليمتر. يوصى بـ 10 مم.",
    },
    pdfPaginate: {
      label: "تقسيم الصور الطويلة إلى عدة صفحات",
      tooltip: "يقسم الصور الطويلة إلى عدة صفحات عند تحديد إعداد صفحة PDF.",
    },
    compressionMode: {
      label: "وضع إعدادات {{format}}",
      byQuality: "التعيين حسب الجودة",
      bySize: "التعيين حسب حجم الملف",
    },
    rembg: {
      label: "إزالة الخلفية بذكاء اصطناعي محلي",
      tooltip:
        "يزيل الذكاء الاصطناعي المحلي الخلفية (لا يلزم إنترنت).\nالمعالجة أبطأ، وقد تظهر عيوب صغيرة عند الحواف.",
    },
    rembgModel: {
      label: "نموذج الذكاء الاصطناعي",
      placeholder: "اختر نموذجًا",
      tooltip:
        "اختر نموذج الذكاء الاصطناعي المحلي الذي يزيل الخلفية.\nالعام يناسب معظم الصور، والأنمي مُهيأ للرسومات، والصور للتصوير الفوتوغرافي الواقعي.",
      options: {
        "u2net": "عام",
        "isnet-anime": "أنمي",
        "isnet-general-use": "الصور",
        "u2net_human_seg": "الصور الشخصية",
        "birefnet-general-lite": "جودة عالية",
      },
      descriptions: {
        "u2net": "لمعظم الصور",
        "isnet-anime": "رسومات ورسوم توضيحية",
        "isnet-general-use": "تصوير واقعي",
        "u2net_human_seg": "أشخاص وقصاصات",
        "birefnet-general-lite": "أحدّ الحواف، أبطأ",
      },
    },
    quality: {
      label: "الجودة",
      tooltip:
        "اضبط الجودة (100 تعطي أفضل جودة، والقيم الأقل تقلل حجم الملف). ينطبق على JPEG وAVIF.",
      presets: {
        smaller: "أصغر (60)",
        balanced: "متوازن (75)",
        high: "عالية (85)",
        max: "قصوى (100)",
      },
    },
    targetSize: {
      label: "حجم الملف الأقصى",
      placeholder: "مثلاً، 0.50",
      hint: "سيحاول إبقاء كل ملف {{format}} عند هذا الحجم أو دونه عبر ضبط الجودة تلقائياً.",
      tooltip:
        "عيّن حجماً أقصى اختيارياً للإخراج (بالميغابايت). ينطبق على إخراج JPEG وAVIF.",
    },
    resizeWidth: {
      label: "تغيير العرض",
      tooltip:
        "يغيّر حجم الصورة/الصور إلى العرض المطلوب مع الحفاظ على نسبة الأبعاد الأصلية.",
    },
    dropzone: {
      dragActive: "أسقط الصور أو ملفات PDF هنا...",
      processing: "لا يمكن إسقاط الملفات أثناء المعالجة...",
      idle: "اسحب وأفلت الصور أو ملفات PDF هنا، أو انقر للتحديد",
    },
    filesList: {
      label: "الملفات المراد تحويلها:",
      removeButton: "إزالة",
      removeSavedCropAria: "إزالة القص المحفوظ",
      croppedBadge: "مقصوص {{w}} × {{h}}",
      cropTooltip: "يوجد قص محفوظ لهذا الملف. انقر على x لإزالة هذا القص.",
      editCropTooltip: "تحرير القص المحفوظ لهذا الملف.",
      addCropTooltip: "اختر المنطقة المرئية قبل تحويل هذا الملف.",
      cropNotSupportedPdf: "قص PDF غير مدعوم بعد. قد تحتوي ملفات PDF على عدة صفحات، لذلك يحتاج القص أولاً إلى سير عمل مخصص لاختيار الصفحات.",
      cropNotSupported: "القص غير مدعوم لهذا التنسيق حالياً.",
      cropButton: "قص",
      editButton: "تحرير",
    },
    error: {
      label: "خطأ:",
      detailsLabel: "التفاصيل:",
    },
    buttons: {
      convert: "بدء التحويل",
      processing: "جارٍ المعالجة...",
      clear: "مسح",
    },
  },

  drawer: {
    trigger_one: "🗃️ عرض الصورة المضغوطة",
    trigger_other: "🗃️ عرض الصور المضغوطة",
    title_one: "صورة مضغوطة",
    title_other: "صور مضغوطة",
    description_one: "نزّل صورتك المضغوطة منفردة أو مع الجميع مرة واحدة.",
    description_other: "نزّل صورك المضغوطة منفردة أو كلها مرة واحدة.",
    downloadAll: "تنزيل الكل كملف ZIP",
    close: "إغلاق",
    downloadingFile: "جارٍ التنزيل: {{fileName}}...",
    downloadingZip: "جارٍ تنزيل المجلد...",
  },

  downloadError: {
    title: "لم يعد هذا الملف موجودًا",
    description: "ربما تم حذفه أو انتهت صلاحيته. حاول ضغطه من جديد.",
    close: "حسنًا",
  },

  storage: {
    title: "إدارة التخزين",
    used: "المستخدم:",
    available: "المتاح:",
    files: "الملفات",
    clearButton: "مسح الملفات المعالجة",
    totalFiles: "إجمالي الملفات:",
    totalSpace: "إجمالي المساحة المستخدمة:",
    noFiles: "لم يتم العثور على ملفات محولة.",
    confirmTitle: "تأكيد حذف الملفات",
    confirmDescription:
      "سيؤدي هذا الإجراء إلى حذف جميع الملفات المعالجة نهائياً. يرجى التأكد من تنزيل أي ملفات ضرورية قبل المتابعة، لأن هذا الإجراء لا يمكن التراجع عنه.",
    confirmCancel: "إلغاء",
    confirmDelete: "نعم، احذف الملفات",
    fetchError: "فشل جلب ملفات الحاوية.",
    storageError: "فشل جلب معلومات التخزين.",
    zipLabel: "(ZIP)",
  },

  statusBanner: {
    warning: "تحذير: الواجهة الخلفية غير متاحة حالياً.",
  },

  statusFloating: {
    systemStatusTitle: "حالة النظام",
    title: "حالة النظام والاتصال",
    backend: "الواجهة الخلفية للحاوية:",
    network: "الوصول إلى الشبكة:",
    mode: "الوضع:",
    modeRunning: "قيد التشغيل",
    backendDown: "متوقفة ❌",
    backendUp: "تعمل",
    internetYes: "يوجد اتصال بالإنترنت",
    internetNo: "لم يتم اكتشاف إنترنت 🚫",
    internetUnknown: "لم يتم الفحص",
    checkButton: "فحص اتصال الإنترنت",
    checking: "جارٍ الفحص...",
    whyTitle: "لماذا يوجد هذا؟",
    whyDesc:
      "يتحقق من صحة الحاوية وعزل الشبكة للأمان. لا تغادر أي صور أو بيانات وصفية جهازك أبداً.",
    learnMore: "اعرف المزيد عن الاستخدام دون اتصال →",
    backendLastCheck: "آخر فحص للواجهة الخلفية:",
    internetLastCheck: "آخر فحص للإنترنت:",
  },

  errorModal: {
    title: "حدث خطأ",
    subtitle: "تعذر إكمال الإجراء. انسخ التتبع أدناه وافتح تذكرة حتى يمكن إصلاحه.",
    detailsLabel: "التفاصيل التقنية",
    notifyDeveloper:
      "يرجى فتح تذكرة وإبلاغ المطور حتى يمكن إصلاح هذا في أسرع وقت.",
    copyError: "نسخ الخطأ",
    copied: "تم النسخ!",
    openTicket: "فتح تذكرة",
    close: "إغلاق",
  },

  formatsDialog: {
    triggerButton: "ما الذي يمكنني فتحه؟",
    title: "الملفات المدعومة",
    descriptionStart: "إليك ملخصاً سريعاً لما يمكنني فتحه لك. يمكنك اختيار تنسيق النتيجة باستخدام قائمة",
    descriptionBold: "تنسيق الإخراج",
    descriptionEnd: "على الشاشة الرئيسية بعد إغلاق هذا.",
    searchLabel: "البحث في القائمة",
    searchHint: "اكتب فقط للعثور على تنسيق",
    searchPlaceholder: "بحث (مثل psd، tiff)...",
    verifiedTitle: "تم اختباره ويعمل",
    unverifiedTitle: "تنسيقات أخرى محتملة",
    unverifiedHint: "لم يتم اختبار هذه بالكامل بعد، لكنها قد تعمل!",
    footerText: "ImgCompress هنا لمساعدتك في تحويل صورك!",
    reportBug: "الإبلاغ عن خطأ",
  },

  starBanner: {
    message: "هل وجدت ImgCompress مفيداً؟",
    linkText: "نجمة على GitHub",
    suffix: "تساعد الآخرين على اكتشافه.",
    dismiss: "لا تظهر مرة أخرى",
  },

  help: {
    label: "طريقة الاستخدام",
  },

  footer: {
    updateAvailable: "يتوفر تحديث: {{version}}",
    whatsNew: "ما الجديد",
    version: "الإصدار {{version}}",
    releaseNotes: "ملاحظات الإصدار",
    links: {
      docs: "المستندات",
      github: "GitHub",
      reportBug: "الإبلاغ عن خطأ",
      author: "المؤلف",
      sponsor: "الدعم",
    },
  },

  releaseNotes: {
    buttonLabel: "ملاحظات الإصدار",
    title: "ملاحظات الإصدار",
    infoBoxText: "عرض",
    infoBoxLink: "ملاحظات الإصدار الكاملة",
    infoBoxSuffix: "لكل الإصدارات والتفاصيل.",
    loading: "جارٍ التحميل…",
    loadError: "فشل تحميل ملاحظات الإصدار",
    empty: "لا توجد ملاحظات إصدار متاحة.",
    tabLatest: "الأحدث",
    tabArchive: "الأرشيف",
    noArchive: "لا توجد إصدارات مؤرشفة بعد.",
  },

  langSwitcher: {
    ariaLabel: "تبديل اللغة",
  },

  theme: {
    switchToLight: "التبديل إلى السمة الفاتحة",
    switchToDark: "التبديل إلى السمة الداكنة",
    lightTitle: "فاتح",
    darkTitle: "داكن",
    toggle: "تبديل السمة",
  },

  runtimeError: {
    title: "خطأ وقت التشغيل",
    errorFallback: "خطأ",
    unknownError: "خطأ غير معروف",
    subtitle: "حدث خلل أثناء العرض. انسخ التتبع أدناه وافتح تذكرة حتى يمكن إصلاحه.",
    stackTrace: "تتبع المكدس",
    tryAgain: "حاول مرة أخرى",
    includeTitle: "أدرج هذا في التذكرة",
    includeDescription: "أرفق ملف التشخيص بالتذكرة. يتضمن تتبع الخطأ، وسياق المتصفح، وسجلات الواجهة الأمامية، وسجلات الواجهة الخلفية عندما تتيحها الواجهة الخلفية العاملة.",
    downloadDiagnostics: "تنزيل التشخيصات",
    copied: "تم النسخ!",
    copyError: "نسخ الخطأ",
    openTicket: "فتح تذكرة",
  },

  devMode: {
    toggleTitle: "أدوات وضع التطوير (تظهر فقط عندما تكون DEV_MODE=true)",
    title: "أدوات المطور",
    description: "تشغيل حالات واجهة المستخدم للتحقق من أسطح الأخطاء. لا يستدعي أي منها الواجهة الخلفية الحقيقية.",
    apiSection: "عنصر خطأ API",
    triggerApiError: "تشغيل خطأ API",
    triggerApiErrorLong: "تشغيل خطأ API (مكدس طويل)",
    runtimeSection: "حد خطأ وقت التشغيل",
    triggerRuntimeError: "تشغيل خطأ وقت التشغيل",
    triggerRuntimeErrorLong: "تشغيل خطأ وقت التشغيل (مكدس طويل)",
    footerPrefix: "بدّل هذا اللوح عبر",
    footerMiddle: " في ",
    footerSuffix: ". لا يظهر أبداً عندما يكون العلم متوقفاً.",
  },

  crop: {
    aspectRatio: "نسبة الأبعاد",
    adjust: "ضبط",
    zoom: "تكبير",
    zoomOut: "تصغير",
    zoomIn: "تكبير",
    resetZoom: "إعادة ضبط التكبير",
    resetZoomFull: "إعادة ضبط التكبير والتحريك",
    dimensions: "الأبعاد",
    resetSelection: "إعادة ضبط التحديد",
    width: "العرض",
    height: "الارتفاع",
    original: "الأصلي: {{w}} × {{h}} بكسل",
    removeSavedCrop: "إزالة القص المحفوظ",
    discard: "تجاهل",
    saveCrop: "حفظ القص",
    switchToLight: "التبديل إلى السمة الفاتحة",
    switchToDark: "التبديل إلى السمة الداكنة",
    confirmDialog: {
      title: "تجاهل تغييرات القص؟",
      description: "ستفقد تعديلات القص غير المحفوظة. سيبقى القص المحفوظ سابقاً، إن وجد، دون تغيير.",
      keepEditing: "متابعة التحرير",
      discardChanges: "تجاهل التغييرات",
    },
    loading: {
      serverWords: ["يرجى", "الانتظار", "قليلاً،", "أنا", "على", "وشك", "الاستعداد"],
      localWords: ["فتح", "محرر", "القص"],
      serverMessage: "يحتاج {{label}} إلى صورة نقطية مرسومة على الخادم قبل القص. جارٍ تحضيرها الآن.",
      localMessage: "فتح {{label}} في محرر القص.",
    },
    failure: {
      header: "تعذر تحضير {{label}} هذا للقص.",
      whyTitle: "لماذا حدث هذا؟",
      technicalDetails: "التفاصيل التقنية",
      stillConvert: "لا يزال بإمكانك تحويل هذا الملف كما هو. لن يتم تطبيق أي قص فقط.",
      closeButton: "إغلاق",
      reportButton: "الإبلاغ عن هذه المشكلة",
      causes: {
        backendNotReachable: "خدمة الواجهة الخلفية غير قابلة للوصول بعد. إذا كنت قد أعدت بناء الحاوية للتو، فامنحها بضع ثوانٍ لتعمل ثم حاول مرة أخرى.",
        networkDropped: "انقطع الاتصال بالواجهة الخلفية أثناء الرفع. تحقق من أن الحاوية ما زالت تعمل ثم حاول مرة أخرى.",
        variantNotSupported: "قد يكون هذا الملف متغير {{label}} لا يستطيع مفكك الترميز قراءته (متعدد الطبقات، وضع ألوان غير قياسي، مشفر، إلخ). عادةً ما تؤدي إعادة تصديره من التطبيق المصدر كملف {{label}} مسطح أو PNG/JPG عادي إلى حل ذلك.",
        missingLibraries: "تمر ملفات {{label}} دائماً عبر مفكك الترميز في الواجهة الخلفية. إذا كانت تنقصه مكتبات أصلية (مثل libheif لملفات HEIC)، فعادةً ما يحل إعادة البناء مع تمكين برامج الترميز الاختيارية المشكلة.",
        reportIssue: "إذا لم ينطبق أي مما سبق، انسخ التفاصيل التقنية أدناه وافتح تذكرة - يوضح التتبع بالضبط أي خطوة فشلت.",
      },
    },
    freeRatio: "حر",
    editorTitle: "محرر القص",
    editorDescription: "اضبط منطقة القص والنسبة والتكبير لهذه الصورة، ثم انقر على حفظ القص أو تجاهل.",
    removeDialog: {
      title: "إزالة القص المحفوظ؟",
      description: "يمسح هذا القص المحفوظ لهذا الملف. سيبقى الملف الأصلي في قائمة التحويل.",
      keepCrop: "الاحتفاظ بالقص",
      removeCrop: "إزالة القص",
    },
    shortcuts: {
      title: "الاختصارات",
      items: [
        { keys: ["سحب"],                  desc: "تحريك القص" },
        { keys: ["سحب الزاوية"],          desc: "تغيير الحجم" },
        { keys: ["Alt", "+ سحب المقبض"],  desc: "تغيير الحجم من المركز" },
        { keys: ["العجلة"],               desc: "تكبير عند المؤشر" },
        { keys: ["مسافة", "+ سحب"],       desc: "تحريك العرض" },
        { keys: ["Esc"],                  desc: "إغلاق" },
      ],
    },
  },
};
