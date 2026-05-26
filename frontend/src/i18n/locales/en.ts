export const en = {
  page: {
    subtitle: "An Image Compression Tool",
    adminTools: "Admin Tools",
    toast: {
      unsupportedFormat: "Unsupported File Format: {{fileName}}",
      filesRejected: "{{count}} file(s) were rejected due to unsupported file types.",
      noFilesError: "Please drop or select some files first.",
      noFormatError: "Please select an output format first.",
      qualityRangeError: "Quality must be a number between 1 and 100.",
      widthPositiveError: "Width must be a positive number.",
      icoWidthClamped:
        "ICO format is limited to a max width of 256px. Your input has been clamped to 256.",
      targetSizeError: "Please set a positive Max file size (in MB).",
      compressedSuccess_one: "{{count}} Image compressed successfully!",
      compressedSuccess_other: "{{count}} Images compressed successfully!",
      cleanupSuccess:
        "Deletion Complete. Your processed files have been permanently removed. 🧹🧹🧹",
      cleanupFailed: "Force cleanup failed.",
      cleanupError: "🚨 Cleanup failed.",
      compressionCancelled: "Compression cancelled.",
      unexpectedError: "Something went wrong. Please try again.",
      selectionCleared_one: "{{count}} Image selection cleared! 🧹",
      selectionCleared_other: "{{count}} Images selection cleared! 🧹",
    },
  },

  splash: {
    dialogTitle: "Compressing Files",
    dialogDescription: "Please wait while your files are being compressed.",
    tipLabel: "Tip",
    cancelButton: "Cancel",
    steps: {
      starting: "Starting",
      compressing: "Compressing",
      packaging: "Packaging",
    },
    tip: "Keep working—leave this window open and I'll drop your compressed files here when they're ready.",
    messages: [
      "Compressing your files…",
      "Optimizing quality and size.",
      "Re-encoding images, please hold on.",
      "Large uploads can take a moment.",
      "Still working—thanks for your patience.",
      "Cleaning up and preparing your downloads.",
      "Balancing speed with quality right now.",
      "Finishing touches on the output files.",
      "Crunching pixels into smaller packages.",
      "Almost there—writing final bytes.",
      "Checking file integrity.",
      "Wrapping up conversion tasks.",
      "Making sure everything looks good.",
    ],
  },

  form: {
    outputFormat: {
      label: "Output Format",
      placeholder: "Select format",
      hint: "Select an output format to enable conversion.",
      options: {
        jpeg: "JPEG (smaller file size)",
        png: "PNG (preserves transparency)",
        avif: "AVIF (best compression & quality)",
        pdf: "PDF (single-page document)",
        ico: "ICO (preserves transparency)",
      },
      tooltip:
        "PNG: Preserves transparency (alpha) and is best for images with transparent backgrounds.\nJPEG: Ideal for images without transparency and produces smaller file sizes.\nAVIF: Modern format with superior compression and quality, supports transparency.\nPDF: Export images into PDFs with optional page presets, margins, and multi-page splitting.\nICO: Commonly used for favicons and application icons, supports transparency (alpha). Recommended to use PNG as the source when converting to ICO.",
    },
    pdfPreset: {
      label: "PDF Page Preset",
      disabledHint: "Resize Width is disabled while a PDF preset is selected.",
      tooltip:
        "A4/Letter presets scale the image to the page with a configurable print-safe margin. Auto presets rotate the page based on image orientation.",
      options: {
        original: "Original (keep proportions)",
        a4Auto: "A4 Auto",
        a4Portrait: "A4 Portrait",
        a4Landscape: "A4 Landscape",
        letterAuto: "Letter Auto",
        letterPortrait: "Letter Portrait",
        letterLandscape: "Letter Landscape",
        mobilePortrait: "Mobile Portrait (1080x1920)",
        mobileLandscape: "Mobile Landscape (1920x1080)",
      },
    },
    pdfScale: {
      label: "PDF Scale Mode",
      paginationHint: "Pagination uses Fit mode to preserve full width.",
      tooltip: "Fit preserves the entire image with possible white bars. Fill crops to cover the page.",
      options: {
        fit: "Fit (preserve full image)",
        fill: "Fill (crop to page)",
      },
    },
    pdfMargin: {
      label: "PDF Margin",
      hint: "10mm is recommended and the default.",
      tooltip: "Set the print-safe border in millimeters. 10mm is recommended.",
    },
    pdfPaginate: {
      label: "Split long images into multiple pages",
      tooltip: "Splits long images into multiple pages when a PDF preset is selected.",
    },
    compressionMode: {
      label: "{{format}} settings mode",
      byQuality: "Set by Quality",
      bySize: "Set by File Size",
    },
    rembg: {
      label: "Remove background with local AI ({{model}})",
      tooltip:
        "Local AI removes background (no internet required).\nSlower processing, may show small edge artifacts.",
    },
    quality: {
      label: "Quality",
      tooltip:
        "Adjust the quality (100 gives the best quality, lower values reduce file size). Applies to JPEG and AVIF.",
      presets: {
        smaller: "Smaller (60)",
        balanced: "Balanced (75)",
        high: "High (85)",
        max: "Max (100)",
      },
    },
    targetSize: {
      label: "Max file size",
      hint: "It will try to keep each {{format}} at or below this size by automatically adjusting quality.",
      tooltip:
        "Set an optional maximum output size (in MB). Applies to JPEG and AVIF output.",
    },
    resizeWidth: {
      label: "Resize Width",
      tooltip:
        "Resizes the image(s) to the desired width while preserving the original aspect ratio.",
    },
    dropzone: {
      dragActive: "Drop images or PDFs here...",
      processing: "Cannot drop files while processing...",
      idle: "Drag & drop images or PDFs here, or click to select",
    },
    filesList: {
      label: "Files to convert:",
      removeButton: "Remove",
    },
    error: {
      label: "Error:",
      detailsLabel: "Details:",
    },
    buttons: {
      convert: "Start Converting",
      processing: "Processing...",
      clear: "Clear",
    },
  },

  drawer: {
    trigger_one: "🗃️ Show Compressed Image",
    trigger_other: "🗃️ Show Compressed Images",
    title_one: "Compressed Image",
    title_other: "Compressed Images",
    description_one: "Download your compressed Image individually or all at once.",
    description_other: "Download your compressed Images individually or all at once.",
    downloadAll: "Download All as Zip",
    close: "Close",
    downloadingFile: "Downloading {{fileName}}...",
  },

  storage: {
    title: "Storage Management",
    used: "Used:",
    available: "Available:",
    files: "Files",
    clearButton: "Clear Processed Files",
    totalFiles: "Total Files:",
    totalSpace: "Total Space Used:",
    noFiles: "No converted files found.",
    confirmTitle: "Confirm File Deletion",
    confirmDescription:
      "This action will permanently delete all processed files. Please ensure you have downloaded any necessary files before proceeding, as this action cannot be undone.",
    confirmCancel: "Cancel",
    confirmDelete: "Yes, Delete Files",
    fetchError: "Failed to fetch container files.",
    storageError: "Failed to fetch storage info.",
    zipLabel: "(ZIP)",
  },

  statusBanner: {
    warning: "Warning: Backend is currently unavailable.",
  },

  statusFloating: {
    title: "System & Connectivity Status",
    backend: "Container Backend:",
    network: "Network Access:",
    mode: "Mode:",
    modeRunning: "running",
    backendDown: "Is Down ❌",
    backendUp: "Is Working",
    internetYes: "Has Internet Access",
    internetNo: "No Internet Detected 🚫",
    internetUnknown: "Not Checked",
    checkButton: "Check Internet Connection",
    checking: "Checking...",
    whyTitle: "Why this exists?",
    whyDesc:
      "Verifies container health and network isolation for security. No images or metadata ever leave your machine.",
    learnMore: "Learn more about offline usage →",
    backendLastCheck: "Backend Last Check:",
    internetLastCheck: "Internet Last Check:",
  },

  errorModal: {
    title: "Error Occurred",
    notifyDeveloper:
      "Please open a ticket and notify the developer so this can be fixed ASAP.",
    copyError: "Copy Error",
    copied: "Copied!",
    openTicket: "Open Ticket",
    close: "Close",
  },

  formatsDialog: {
    triggerButton: "What can I open?",
    title: "Supported files",
    descriptionStart: "Here is a cheat sheet of what I can open for you. You can pick your result format using the",
    descriptionBold: "Output Format",
    descriptionEnd: "menu on the main screen after you close this.",
    searchLabel: "Search list",
    searchHint: "Just type to find a format",
    searchPlaceholder: "Search (e.g. psd, tiff)...",
    verifiedTitle: "Tested & Working",
    unverifiedTitle: "Other possible formats",
    unverifiedHint: "These haven't been fully tested yet, but they might work!",
    footerText: "ImgCompress here to help you convert your images!",
    reportBug: "Report a bug",
  },

  starBanner: {
    message: "Found ImgCompress useful?",
    linkText: "A star on GitHub",
    suffix: "helps others discover it.",
    dismiss: "Don't show again",
  },

  help: {
    label: "How to Use",
  },

  footer: {
    updateAvailable: "Update available: {{version}}",
    whatsNew: "What's new",
    version: "Version {{version}}",
    releaseNotes: "Release Notes",
    links: {
      docs: "Docs",
      github: "GitHub",
      reportBug: "Report a Bug",
      author: "Author",
      sponsor: "Sponsor",
    },
  },

  releaseNotes: {
    buttonLabel: "Release Notes",
    title: "Release Notes",
    infoBoxText: "View",
    infoBoxLink: "complete release notes",
    infoBoxSuffix: "for all versions and details.",
    loading: "Loading…",
    loadError: "Failed to load release notes",
    empty: "No release notes available.",
    tabLatest: "Latest",
    tabArchive: "Archive",
    noArchive: "No archived releases yet.",
  },

  langSwitcher: {
    ariaLabel: "Switch language",
  },
} as const;

export type Translations = typeof en;
