import type { TranslationSchema } from "../types";

export const ptBR: TranslationSchema = {
  page: {
    subtitle: "Ferramenta de compressão de imagens",
    adminTools: "Ferramentas administrativas",
    toast: {
      unsupportedFormat: "Formato de arquivo sem suporte: {{fileName}}",
      filesRejected: "{{count}} arquivo(s) foram rejeitados por tipos de arquivo sem suporte.",
      noFilesError: "Primeiro arraste ou selecione alguns arquivos.",
      noFormatError: "Primeiro selecione um formato de saída.",
      qualityRangeError: "A qualidade deve ser um número entre 1 e 100.",
      widthPositiveError: "A largura deve ser um número positivo.",
      fitSizeError: "Ajustar ao tamanho exato precisa de largura e altura entre 1 e 8192 pixels.",
      icoWidthClamped:
        "O formato ICO é limitado a uma largura máxima de 256 px. Sua entrada foi ajustada para 256.",
      targetSizeError: "Defina um tamanho máximo de arquivo positivo (em MB).",
      compressedSuccess_one: "{{count}} imagem comprimida com sucesso!",
      compressedSuccess_other: "{{count}} imagens comprimidas com sucesso!",
      cleanupSuccess:
        "Exclusão concluída. Seus arquivos processados foram removidos permanentemente. 🧹🧹🧹",
      cleanupFailed: "A limpeza forçada falhou.",
      cleanupError: "🚨 A limpeza falhou.",
      compressionCancelled: "Compressão cancelada.",
      unexpectedError: "Algo deu errado. Tente novamente.",
      selectionCleared_one: "Seleção de {{count}} imagem limpa! 🧹",
      selectionCleared_other: "Seleção de {{count}} imagens limpa! 🧹",
    },
  },

  splash: {
    dialogTitle: "Comprimindo arquivos",
    dialogDescription: "Aguarde enquanto seus arquivos são comprimidos.",
    tipLabel: "Dica",
    cancelButton: "Cancelar",
    steps: {
      starting: "Iniciando",
      compressing: "Comprimindo",
      packaging: "Empacotando",
    },
    tip: "Você pode continuar trabalhando: deixe esta janela aberta e colocarei seus arquivos comprimidos aqui quando estiverem prontos.",
    messages: [
      "Comprimindo seus arquivos…",
      "Otimizando qualidade e tamanho.",
      "Recodificando imagens, aguarde.",
      "Envios grandes podem levar um momento.",
      "Ainda estou trabalhando, obrigado pela paciência.",
      "Limpando e preparando seus downloads.",
      "Equilibrando velocidade e qualidade agora.",
      "Últimos ajustes nos arquivos de saída.",
      "Compactando pixels em pacotes menores.",
      "Quase lá: gravando os bytes finais.",
      "Verificando a integridade dos arquivos.",
      "Finalizando tarefas de conversão.",
      "Garantindo que tudo esteja correto.",
    ],
  },

  form: {
    outputFormat: {
      label: "Formato de saída",
      placeholder: "Selecionar formato",
      hint: "Selecione um formato de saída para habilitar a conversão.",
      options: {
        jpeg: "JPEG (menor tamanho de arquivo)",
        png: "PNG (preserva transparência)",
        avif: "AVIF (melhor compressão e qualidade)",
        webp: "WebP (arquivos pequenos, funciona em todo lugar)",
        pdf: "PDF (documento de uma página)",
        ico: "ICO (preserva transparência)",
      },
      tooltip:
        "PNG: preserva transparência (alfa) e é melhor para imagens com fundos transparentes.\nJPEG: ideal para imagens sem transparência e gera arquivos menores.\nAVIF: formato moderno com compressão e qualidade superiores, com suporte a transparência.\nWebP: Arquivos pequenos com amplo suporte nos navegadores, suporta transparência e um modo sem perdas opcional.\nPDF: exporta imagens para PDFs com predefinições de página, margens e divisão em várias páginas opcionais.\nICO: usado com frequência para favicons e ícones de aplicativos, com suporte a transparência (alfa). Recomenda-se usar PNG como origem ao converter para ICO.",
    },
    pdfPreset: {
      label: "Predefinição de página PDF",
      disabledHint: "Redimensionar largura fica desativado enquanto uma predefinição PDF estiver selecionada.",
      tooltip:
        "As predefinições A4/Letter ajustam a imagem à página com margem segura para impressão configurável. As opções automáticas giram a página conforme a orientação da imagem.",
      options: {
        original: "Original (manter proporções)",
        a4Auto: "A4 automático",
        a4Portrait: "A4 retrato",
        a4Landscape: "A4 paisagem",
        letterAuto: "Letter automático",
        letterPortrait: "Letter retrato",
        letterLandscape: "Letter paisagem",
        mobilePortrait: "Celular retrato (1080x1920)",
        mobileLandscape: "Celular paisagem (1920x1080)",
      },
    },
    pdfQuality: {
      label: "Qualidade do documento",
      tooltip:
        "Um DPI mais alto deixa as imagens mais nítidas, mas também aumenta o tamanho do PDF.\nEscolha um ajuste menor quando precisar de um arquivo pequeno para compartilhar e um maior quando for imprimir.",
      options: {
        small: "Baixa · 96 DPI",
        medium: "Padrão · 150 DPI",
        high: "Alta · 220 DPI",
        ultra: "Máxima · 300 DPI",
      },
      hints: {
        small: "Arquivo menor. Ideal para enviar rapidamente por e-mail.",
        medium: "Arquivo pequeno. Perfeita para leitura na tela.",
        high: "Arquivo maior. Para impressões nítidas.",
        ultra: "Arquivo maior de todos. Nitidez máxima para arquivamento e impressão profissional.",
      },
    },
    pdfScale: {
      label: "Modo de escala PDF",
      paginationHint: "A paginação usa o modo Ajustar para preservar a largura total.",
      tooltip:
        "Ajustar preserva a imagem inteira, com possíveis barras brancas. Preencher recorta para cobrir a página.",
      options: {
        fit: "Ajustar (preservar imagem inteira)",
        fill: "Preencher (recortar para a página)",
      },
    },
    pdfMargin: {
      label: "Margem PDF",
      hint: "10 mm é recomendado e é o padrão.",
      tooltip: "Defina a borda segura para impressão em milímetros. 10 mm é recomendado.",
    },
    pdfPaginate: {
      label: "Dividir imagens longas em várias páginas",
      tooltip: "Divide imagens longas em várias páginas quando uma predefinição PDF é selecionada.",
    },
    webpLossless: {
      label: "WebP sem perdas",
      tooltip:
        "Mantém cada pixel exatamente como no original. Os arquivos ficam maiores do que no WebP com perdas, por isso qualidade e tamanho máximo de arquivo não estão disponíveis.\nBom para capturas de tela, logotipos e gráficos com texto.",
    },
    compressionMode: {
      label: "Modo de configurações de {{format}}",
      byQuality: "Definir por qualidade",
      bySize: "Definir por tamanho de arquivo",
    },
    rembg: {
      label: "Remover fundo com IA local ({{model}})",
      tooltip:
        "A IA local remove o fundo (sem necessidade de internet).\nProcessamento mais lento, pode mostrar pequenos artefatos nas bordas.",
    },
    quality: {
      label: "Qualidade",
      tooltip:
        "Ajuste a qualidade (100 oferece a melhor qualidade; valores menores reduzem o tamanho do arquivo). Aplica-se a JPEG, AVIF e WebP.",
      presets: {
        smaller: "Menor (60)",
        balanced: "Equilibrada (75)",
        high: "Alta (85)",
        max: "Máxima (100)",
      },
    },
    targetSize: {
      label: "Tamanho máximo",
      placeholder: "ex.: 0,50",
      hint: "Tentará manter cada {{format}} nesse tamanho ou abaixo dele ajustando a qualidade automaticamente.",
      tooltip:
        "Defina um tamanho máximo opcional de saída (em MB). Aplica-se às saídas JPEG, AVIF e WebP.",
    },
    upscale: {
      modelLabel: "Modelo de IA",
      models: {
        general: "Geral (fotos)",
        anime: "Anime (ilustrações)",
      },
      label: "Ampliação com IA",
      tooltip:
        "A IA local ({{model}}) amplia as imagens e reconstrói bordas e detalhes finos. Não precisa de internet.\nO processamento na CPU é mais lento; podem aparecer pequenos artefatos, especialmente em rostos.",
      targetLabel: "Ampliar para",
      options: {
        "2x": "2× maior",
        "4x": "4× maior",
        "8x": "8× maior",
        "1080p": "Full HD (cabe em 1920 × 1080)",
        "4k": "4K (cabe em 3840 × 2160)",
        "6k": "6K (cabe em 5760 × 3240)",
        "8k": "8K (cabe em 7680 × 4320)",
        "16k": "16K (cabe em 15360 × 8640)",
      },
      hint:
        "Mantém as proporções. Imagens que já são grandes o bastante para a resolução escolhida ficam como estão. Imagens maiores e CPUs mais lentas levam mais tempo. Acima de 4×, a ampliação com IA é seguida por um redimensionamento convencional.",
      unavailableHint: "O modelo de ampliação não está instalado.",
      fitActiveHint: "Não é usado enquanto Ajustar ao tamanho exato estiver ativado.",
    },
    fitSize: {
      label: "Ajustar ao tamanho exato",
      tooltip:
        "Gera cada imagem exatamente neste tamanho, por exemplo para uma prévia social do GitHub. Se a proporção for diferente, a imagem é recortada ou colocada sobre uma cópia desfocada dela mesma.",
      preset: {
        label: "Tamanho",
        options: {
          githubSocial: "Prévia social do GitHub (1280 × 640)",
          openGraph: "Prévia de link Open Graph (1200 × 630)",
          custom: "Tamanho personalizado",
        },
      },
      widthLabel: "Largura (px)",
      heightLabel: "Altura (px)",
      mode: {
        label: "Se a proporção for diferente",
        crop: "Recortar para preencher",
        blur: "Fundo desfocado",
        cropHint: "Preenche todo o quadro. Partes da imagem são cortadas.",
        blurHint: "Mantém a imagem inteira. As laterais vazias mostram uma cópia desfocada e um pouco mais escura.",
      },
      anchor: {
        label: "Manter",
        tooltip:
          "O modo automático procura texto, rostos e outros detalhes e mantém o máximo possível sem cortá-los. Escolha um lado para decidir você mesmo.",
        options: {
          auto: "Conteúdo importante (automático)",
          center: "Centro",
          top: "Topo",
          bottom: "Base",
          left: "Esquerda",
          right: "Direita",
        },
      },
    },
    resizeWidth: {
      label: "Redimensionar largura",
      tooltip:
        "Redimensiona a(s) imagem(ns) para a largura desejada preservando a proporção original.",
      upscaleActiveHint: "Não é usado enquanto a ampliação com IA está ativada.",
      fitActiveHint: "Não é usado enquanto Ajustar ao tamanho exato estiver ativado.",
    },
    dropzone: {
      dragActive: "Solte imagens ou PDFs aqui...",
      processing: "Não é possível soltar arquivos durante o processamento...",
      idle: "Arraste e solte imagens ou PDFs aqui, ou clique para selecionar",
    },
    filesList: {
      label: "Arquivos para converter:",
      removeButton: "Remover",
      removeSavedCropAria: "Remover corte salvo",
      croppedBadge: "cortado {{w}} × {{h}}",
      cropTooltip: "Este arquivo tem um corte salvo. Clique no x para remover esse corte.",
      editCropTooltip: "Editar o corte salvo para este arquivo.",
      addCropTooltip: "Escolha a área visível antes de converter este arquivo.",
      cropNotSupportedPdf: "Corte de PDF ainda não tem suporte. PDFs podem conter várias páginas, então o corte precisa primeiro de um fluxo dedicado para seleção de páginas.",
      cropNotSupported: "Corte não tem suporte para este formato no momento.",
      cropButton: "Cortar",
      editButton: "Editar",
    },
    error: {
      label: "Erro encontrado:",
      detailsLabel: "Detalhes:",
    },
    buttons: {
      convert: "Iniciar conversão",
      processing: "Processando...",
      clear: "Limpar",
    },
  },

  drawer: {
    trigger_one: "🗃️ Mostrar imagem comprimida",
    trigger_other: "🗃️ Mostrar imagens comprimidas",
    title_one: "Imagem comprimida",
    title_other: "Imagens comprimidas",
    description_one: "Baixe sua imagem comprimida individualmente ou junto com todas.",
    description_other: "Baixe suas imagens comprimidas individualmente ou todas de uma vez.",
    downloadAll: "Baixar tudo como ZIP",
    close: "Fechar",
    downloadingFile: "Baixando: {{fileName}}...",
    downloadingZip: "Baixando pasta...",
  },

  downloadError: {
    title: "Este arquivo não está mais aqui",
    description:
      "Ele pode ter sido excluído ou expirado. Tente compactá-lo novamente.",
    close: "Entendi",
  },

  storage: {
    title: "Gerenciamento de armazenamento",
    used: "Usado:",
    available: "Disponível:",
    files: "Arquivos",
    clearButton: "Limpar arquivos processados",
    totalFiles: "Total de arquivos:",
    totalSpace: "Espaço total usado:",
    noFiles: "Nenhum arquivo convertido encontrado.",
    confirmTitle: "Confirmar exclusão de arquivos",
    confirmDescription:
      "Esta ação excluirá permanentemente todos os arquivos processados. Certifique-se de ter baixado todos os arquivos necessários antes de continuar, pois esta ação não pode ser desfeita.",
    confirmCancel: "Cancelar",
    confirmDelete: "Sim, excluir arquivos",
    fetchError: "Falha ao buscar arquivos do contêiner.",
    storageError: "Falha ao buscar informações de armazenamento.",
    zipLabel: "(ZIP)",
  },

  statusBanner: {
    warning: "Aviso: o backend está indisponível no momento.",
  },

  statusFloating: {
    systemStatusTitle: "Status do sistema",
    title: "Status do sistema e conectividade",
    backend: "Backend do contêiner:",
    network: "Acesso à rede:",
    mode: "Modo:",
    modeRunning: "em execução",
    backendDown: "Está fora do ar ❌",
    backendUp: "Funcionando",
    internetYes: "Tem acesso à internet",
    internetNo: "Nenhuma internet detectada 🚫",
    internetUnknown: "Não verificado",
    checkButton: "Verificar conexão com a internet",
    checking: "Verificando...",
    whyTitle: "Por que isso existe?",
    whyDesc:
      "Verifica a saúde do contêiner e o isolamento de rede por segurança. Nenhuma imagem ou metadado sai da sua máquina.",
    learnMore: "Saiba mais sobre uso offline →",
    backendLastCheck: "Última verificação do backend:",
    internetLastCheck: "Última verificação da internet:",
  },

  errorModal: {
    title: "Ocorreu um erro",
    subtitle: "A ação não pôde ser concluída. Copie o rastreamento abaixo e abra um chamado para que possa ser corrigido.",
    detailsLabel: "Detalhes técnicos",
    notifyDeveloper:
      "Abra um chamado e avise o desenvolvedor para que isso seja corrigido o quanto antes.",
    copyError: "Copiar erro",
    copied: "Copiado!",
    openTicket: "Abrir chamado",
    close: "Fechar",
  },

  formatsDialog: {
    triggerButton: "O que posso abrir?",
    title: "Arquivos compatíveis",
    descriptionStart: "Aqui está um resumo do que posso abrir para você. Você pode escolher o formato de resultado usando o menu",
    descriptionBold: "Formato de saída",
    descriptionEnd: "na tela principal depois de fechar isto.",
    searchLabel: "Pesquisar na lista",
    searchHint: "Basta digitar para encontrar um formato",
    searchPlaceholder: "Pesquisar (ex.: psd, tiff)...",
    verifiedTitle: "Testado e funcionando",
    unverifiedTitle: "Outros formatos possíveis",
    unverifiedHint: "Eles ainda não foram totalmente testados, mas podem funcionar!",
    footerText: "ImgCompress está aqui para ajudar você a converter suas imagens!",
    reportBug: "Relatar um bug",
  },

  starBanner: {
    message: "O ImgCompress foi útil?",
    linkText: "Uma estrela no GitHub",
    suffix: "ajuda outras pessoas a descobri-lo.",
    dismiss: "Não mostrar novamente",
  },

  help: {
    label: "Como usar",
  },

  footer: {
    updateAvailable: "Atualização disponível: {{version}}",
    whatsNew: "Novidades",
    version: "Versão {{version}}",
    releaseNotes: "Notas da versão",
    links: {
      docs: "Documentação",
      github: "GitHub",
      reportBug: "Relatar um bug",
      author: "Autor",
      sponsor: "Patrocinar",
    },
  },

  releaseNotes: {
    buttonLabel: "Notas da versão",
    title: "Notas da versão",
    infoBoxText: "Ver",
    infoBoxLink: "notas completas da versão",
    infoBoxSuffix: "para todas as versões e detalhes.",
    loading: "Carregando…",
    loadError: "Falha ao carregar notas da versão",
    empty: "Nenhuma nota da versão disponível.",
    tabLatest: "Mais recente",
    tabArchive: "Arquivo",
    noArchive: "Ainda não há versões arquivadas.",
  },

  langSwitcher: {
    ariaLabel: "Trocar idioma",
  },

  theme: {
    switchToLight: "Mudar para tema claro",
    switchToDark: "Mudar para tema escuro",
    lightTitle: "Claro",
    darkTitle: "Escuro",
    toggle: "Alternar tema",
  },

  runtimeError: {
    title: "Erro de execução",
    errorFallback: "Falha",
    unknownError: "Erro desconhecido",
    subtitle: "Algo quebrou durante a renderização. Copie o rastreamento abaixo e abra um chamado para que possa ser corrigido.",
    stackTrace: "Rastreamento de pilha",
    tryAgain: "Tentar novamente",
    includeTitle: "Inclua isto no chamado",
    includeDescription: "Anexe o arquivo de diagnóstico ao chamado. Ele inclui o rastreamento do erro, contexto do navegador, logs do frontend e logs do backend quando o backend em execução os expõe.",
    downloadDiagnostics: "Baixar diagnóstico",
    copied: "Copiado!",
    copyError: "Copiar erro",
    openTicket: "Abrir chamado",
  },

  devMode: {
    toggleTitle: "Ferramentas de modo dev (mostradas apenas quando DEV_MODE=true)",
    title: "Ferramentas de desenvolvedor",
    description: "Acione estados da interface para verificar superfícies de erro. Nenhum deles chama o backend real.",
    apiSection: "Widget de erro API",
    triggerApiError: "Acionar erro API",
    triggerApiErrorLong: "Acionar erro API (pilha longa)",
    runtimeSection: "Limite de erro de execução",
    triggerRuntimeError: "Acionar erro de execução",
    triggerRuntimeErrorLong: "Acionar erro de execução (pilha longa)",
    footerPrefix: "Alterne este painel por",
    footerMiddle: " em ",
    footerSuffix: ". Ele nunca aparece quando a flag está desligada.",
  },

  crop: {
    fit: {
      hint: "Escolha um tamanho e clique em Ajustar automaticamente para visualizar e editar o resultado.",
      autoFit: "Ajustar automaticamente",
      applyAll: "Ajustar todas as imagens",
      updateHint: "Clique em Ajustar automaticamente para atualizar a prévia.",
      output: "Saída: {{w}} × {{h}} px",
      preview: "Prévia da saída",
      updating: "Atualizando prévia…",
    },
    aspectRatio: "Proporção",
    adjust: "Ajustar",
    zoom: "Ampliação",
    zoomOut: "Diminuir zoom",
    zoomIn: "Aumentar zoom",
    resetZoom: "Redefinir zoom",
    resetZoomFull: "Redefinir zoom e deslocamento",
    dimensions: "Dimensões",
    resetSelection: "Redefinir seleção",
    width: "Largura",
    height: "Altura",
    original: "Imagem original: {{w}} × {{h}} px",
    removeSavedCrop: "Remover corte salvo",
    discard: "Descartar",
    saveCrop: "Salvar",
    switchToLight: "Mudar para tema claro",
    switchToDark: "Mudar para tema escuro",
    confirmDialog: {
      title: "Descartar alterações de corte?",
      description: "Seus ajustes de corte não salvos serão perdidos. O corte salvo anteriormente, se houver, continuará inalterado.",
      keepEditing: "Continuar editando",
      discardChanges: "Descartar alterações",
    },
    loading: {
      serverWords: ["Aguarde", "um", "pouco,", "estou", "quase", "tudo", "pronto"],
      localWords: ["Abrindo", "editor", "corte"],
      serverMessage: "{{label}} precisa de um bitmap renderizado pelo servidor antes do corte. Preparando agora.",
      localMessage: "Abrindo {{label}} no editor de corte.",
    },
    failure: {
      header: "Não foi possível preparar este {{label}} para corte.",
      whyTitle: "Por que isso aconteceu?",
      technicalDetails: "Detalhes técnicos",
      stillConvert: "Você ainda pode converter este arquivo como está. Só não será aplicado nenhum corte.",
      closeButton: "Fechar",
      reportButton: "Relatar este problema",
      causes: {
        backendNotReachable: "O serviço backend ainda não está acessível. Se você acabou de reconstruir o contêiner, aguarde alguns segundos para ele iniciar e tente novamente.",
        networkDropped: "A conexão com o backend caiu durante o envio. Verifique se o contêiner ainda está em execução e tente novamente.",
        variantNotSupported: "Este arquivo pode ser uma variante de {{label}} que o decodificador não consegue ler (múltiplas camadas, modo de cor não padrão, criptografado etc.). Reexportar no aplicativo de origem como {{label}} plano ou PNG/JPG comum geralmente resolve.",
        missingLibraries: "Arquivos {{label}} sempre passam pelo decodificador do backend. Se o decodificador estiver sem bibliotecas nativas (por exemplo, libheif para HEIC), reconstruir com os codecs opcionais habilitados geralmente resolve.",
        reportIssue: "Se nada disso se aplicar, copie os detalhes técnicos abaixo e abra um chamado: o rastreamento mostra exatamente qual etapa falhou.",
      },
    },
    freeRatio: "Livre",
    editorTitle: "Recortar e redimensionar",
    editorDescription: "Ajuste a região de corte, proporção e zoom desta imagem, depois clique em Salvar ou Descartar.",
    removeDialog: {
      title: "Remover corte salvo?",
      description: "Isso limpa o corte salvo para este arquivo. O arquivo original permanecerá na sua lista de conversão.",
      keepCrop: "Manter corte",
      removeCrop: "Remover corte",
    },
    shortcuts: {
      title: "Atalhos",
      items: [
        { keys: ["Arrastar"],              desc: "Mover corte" },
        { keys: ["Arrastar canto"],        desc: "Redimensionar" },
        { keys: ["Alt", "+ arrastar alça"], desc: "Redimensionar pelo centro" },
        { keys: ["Roda"],                  desc: "Zoom no cursor" },
        { keys: ["Espaço", "+ arrastar"],  desc: "Deslocar" },
        { keys: ["Esc"],                   desc: "Fechar" },
      ],
    },
  },
};
