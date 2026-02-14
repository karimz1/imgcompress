---
title: "Self-Hosted Bulk Image Converter & Optimizer for Docker | ImgCompress"
description: "Open-source Docker image toolkit supporting 70+ formats. Convert HEIC, PSD, WebP, AVIF to any format. Compress images and remove backgrounds with local AI. Privacy-first, self-hosted."
hero: true
hide:
  - navigation
hero_image: "images/web-ui-workflow/web-ui-upload-configure-no-mascot.webp"
hero_image_compare: "images/web-ui-workflow/web-ui-upload-configure.webp"
hero_title: "ImgCompress"
hero_subtitle_gradient: "Universal Self-Hosted Image Toolkit"
hero_description: "The ultimate batch converter and optimizer for Docker. Process 70+ formats, compress, and remove backgrounds with private local AI—100% offline."
hero_phrases:
  - "Convert 70+ formats (HEIC, PSD, & more)."
  - "Remove image backgrounds instantly."
  - "Compress, Resize, & Make PDFs from images."
  - "100% Private. No Cloud Uploads."
hero_button_text: "Start Setup Guide"
hero_button_link: "installation/"
hero_secondary_button_text: "What is this?"
hero_secondary_button_link: "#why-imgcompress"
---

<!-- Hide the auto-generated H1 page title since we have a Hero section -->
<style>
  .md-typeset h1, 
  .md-content__inner h1:first-child {
    display: none !important;
  }
  /* Ensure local TOC headers are hidden visually but detectable by scroll spy */
  h2.toc-hide {
    display: block !important;
    height: 0;
    overflow: hidden;
    visibility: hidden;
    margin: 0;
    padding: 0;
    pointer-events: none;
    /* Optional: precise anchor positioning offset if needed, 
       but standard Material theme handles h2 offsets well */
  }
  
  /* Hide 'Edit this page' button on homepage */
  .md-content__button {
    display: none !important;
  }
</style>

## AI Magic {: .toc-hide }

<div class="product-section" style="text-align: center;">
  <div class="section-label">AI Magic</div>
  <h2 class="section-title">Instant AI Background Removal (100% Private)</h2>
  <p style="font-size: 1.1rem; line-height: 1.6; color: var(--md-default-fg-color--light); max-width: 700px; margin: 0 auto 3rem;">
    Instantly remove backgrounds with our powerful <strong>local AI</strong>—no cloud processing, no subscriptions, no tracking. Everything runs <strong>offline on your machine</strong> for total privacy.
  </p>
  
  <div class="comparison-slider-wrapper">
    <div class="comparison-slider comparison-slider--transparency" data-start-pos="50">
      <div class="comparison-img original">
        <img src="images/image-remover-examples/landscape-with-sunset-yixing-original.avif" alt="Original photo of a landscape with sunset before background removal">
      </div>
      <div class="comparison-img modified">
        <img src="images/image-remover-examples/landscape-with-sunset-yixing-ai-transparency.avif" alt="AI-Processed image with background transparently removed">
      </div>
      <div class="slider-handle">
        <div class="handle-line"></div>
        <div class="handle-circle">
          <i class="fa-solid fa-arrows-left-right"></i>
        </div>
        <div class="handle-line"></div>
      </div>
    </div>
    <div class="comparison-switch-controls">
      <button class="comparison-switch-btn" data-pos="0">Original</button>
      <button class="comparison-switch-btn" data-pos="100">AI Background Removed</button>
    </div>
    <p class="comparison-hint">Slide to watch the background <strong>vanish instantly</strong>.</p>
  </div>
</div>

## Toolkit {: .toc-hide }

<div class="product-section product-section--wide">
<div class="product-section__inner">
<div class="section-label">Toolkit</div>
<h2 class="section-title">The Universal Docker Image Toolkit</h2>

<div class="feature-grid feature-grid--three">
  <div class="feature-card">
    <div class="feature-icon"><i class="fa-solid fa-file-export"></i></div>
    <h3>70+ Universal Formats</h3>
    <p>Convert between <strong>HEIC, PSD, WebP, AVIF, PDF, PNG, JPG</strong> and 60+ more formats with ease.</p>
  </div>
  <div class="feature-card">
    <div class="feature-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
    <h3>Local AI Background Removal</h3>
    <p>Remove backgrounds with powerful AI. No cloud, no tracking. Everything runs <strong>100% on your hardware</strong>.</p>
  </div>
  <div class="feature-card">
    <div class="feature-icon"><i class="fa-solid fa-shield-halved"></i></div>
    <h3>Privacy First</h3>
    <p>100% Offline. Designed for private networks. No images or data ever leave your server, NAS, or homelab.</p>
  </div>
  <div class="feature-card">
    <div class="feature-icon"><i class="fa-solid fa-file-pdf"></i></div>
    <h3>Smart PDF Creator</h3>
    <p>Turn images into structured PDFs with intelligent A4 pagination and "Smart Splitting" for long captures.</p>
  </div>
  <div class="feature-card">
    <div class="feature-icon"><i class="fa-solid fa-bolt-lightning"></i></div>
    <h3>High Performance</h3>
    <p>Multi-core batch processing for lightning-fast optimization of entire photo libraries.</p>
  </div>
  <div class="feature-card">
    <div class="feature-icon"><i class="fa-brands fa-docker"></i></div>
    <h3>Ready-to-Go Docker Box</h3>
    <p>Clean installation via Docker. No messy libraries on your system, just one command to run anywhere.</p>
  </div>
</div>
</div>
</div>

## Workflow {: .toc-hide }

<div class="product-section">
<div class="section-label">Workflow</div>
<h2 class="section-title">How to use it</h2>

<div class="step-grid">
  <div class="step-card">
    <div class="step-number">01</div>
    <h3>Drag & Drop</h3>
    <p>Drag <strong>1 or 1,000 photos</strong> straight into your browser.</p>
  </div>
  <div class="step-card">
    <div class="step-number">02</div>
    <h3>One-Click Magic</h3>
    <p><strong>Compress, Convert, or Clean</strong> backgrounds instantly.</p>
  </div>
  <div class="step-card">
    <div class="step-number">03</div>
    <h3>Instant Export</h3>
    <p>Grab your <strong>optimized files</strong> back in seconds. Done.</p>
  </div>
</div>
</div>

## Story {: .toc-hide }

<div class="product-section story-section" id="why-imgcompress">
  <div class="section-label">Origin Story</div>
  <h2 class="section-title">Why I built ImgCompress</h2>
  
  <div class="story-content">
    <p class="story-intro">I was tired of the <strong>"Software Loop."</strong> Every time I encountered a format I couldn't open, like a batch of <strong>iPhone HEIC photos</strong>, a <strong>TIFF</strong>, or a <strong>PSD file</strong>, I had to hunt for a specific converter. And if I simply wanted to <strong>turn those into a PDF</strong> or a <strong>simple JPEG</strong>? That required installing <em>yet another</em> app:</p>
    
    <div class="pain-points-grid">
      <div class="pain-point">
        <div class="pain-icon">📄</div>
        <h3>PSD files</h3>
        <p>Needed specialized software just to convert them to an image file.</p>
      </div>
      <div class="pain-point">
        <div class="pain-icon">📸</div>
        <h3>HEIC files</h3>
        <p>Needed a converter for my iPhone (HEIC) photos so ordinary devices could actually open them.</p>
      </div>
      <div class="pain-point">
        <div class="pain-icon">📋</div>
        <h3>Image to PDF</h3>
        <p>Needed to turn long screenshots into structured A4 PDFs that split across pages automatically, because in a professional setting, people prefer PDFs.</p>
      </div>
      <div class="pain-point">
        <div class="pain-icon">✨</div>
        <h3>AI Backgrounds</h3>
        <p>Wanted to remove backgrounds for quick edits without launching heavy software. So I added a private, local AI to do it instantly.</p>
      </div>
    </div>
    
    <blockquote class="story-quote">
      "Why can't one tool just do it all?"
      <span class="quote-subtext">Plus, uploading personal photos to random online converters never felt right to me.</span>
    </blockquote>
    
    <div class="solution-section">
      <h3 class="solution-title">One Toolbox for Everything</h3>
      <p class="solution-text">So I built a single toolbox that accepts <strong>over 70+ input formats</strong>—even <strong>vector graphics</strong> or complex <strong>design projects</strong>—and converts them into usable images instantly. Whether you need to turn a <strong>PSD design</strong> into a PNG, convert <strong>HEIC photos</strong>, or shrink a massive 4K image, this tool does it automatically.</p>
      <p class="solution-text">The community has now pulled the image <strong>tens of thousands of times</strong>, which shows the pain is real.</p>
    </div>
    
    <div class="docker-why-section">
      <h3 class="docker-why-title">Why Docker?</h3>
      <p class="docker-why-text">I chose Docker because it keeps your computer clean. Instead of you having to install 70 different messy libraries on your system, I packed everything into one <strong>Ready-to-go Box</strong> that you can run anywhere called <strong>imgcompress</strong>. It just works.</p>
    </div>
  </div>
</div>

## Get Started {: .toc-hide }

<div class="product-section" style="text-align: center;">
<div class="section-label">Get Started</div>
<h2 class="section-title">Ready to optimize?</h2>
<p style="font-size: 1.2rem; margin-bottom: 2.5rem; color: var(--md-default-fg-color--light);">Join the community and shrink your images today.</p>

<div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
  <a href="installation/" class="md-button md-button--primary" style="font-size: 1.1rem; padding: 0.75rem 2.4rem; border-radius: 999px;">
    Start the Setup Guide
  </a>
  <div class="imgcompress-stats" style="margin: 0;">
    <span class="docker-pull-count">Loading...</span>
  </div>
  <span style="font-size: 0.95rem; color: var(--md-default-fg-color--light); margin-top: 0.5rem;">Trusted by People around the world.</span>
</div>
</div>
