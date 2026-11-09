<div align="center">
  <img src="./images/logo-mini-2.webp" alt="ImgCompress logo" height="80px" />
  <h1>ImgCompress</h1>
  <p><strong>Every image format. Zero cloud.</strong></p>
  <p>Make images smaller, convert 70+ formats, edit them, upscale with AI and remove backgrounds.<br/>Everything runs in your container — files never leave your server.</p>

  <p>
    <a href="https://imgcompress.karimzouine.com/">
      <img src="https://img.shields.io/badge/Features%20%26%20Capabilities-%E2%86%92-0f172a?style=for-the-badge&logo=gitbook&logoColor=white" alt="Features and Capabilities" />
    </a>
    <a href="https://imgcompress.karimzouine.com/docs/installation">
      <img src="https://img.shields.io/badge/Setup%20Guide-%E2%86%92-1e40af?style=for-the-badge&logo=gnubash&logoColor=white" alt="Setup Guide" />
    </a>
  </p>

  <p>
    <a href="https://hub.docker.com/r/karimz1/imgcompress">
      <img src="https://img.shields.io/docker/pulls/karimz1/imgcompress?style=flat-square&color=0db7ed&label=Docker%20Pulls&logo=docker&logoColor=white" alt="Docker Pulls" />
    </a>
    <a href="https://github.com/karimz1/imgcompress">
      <img src="https://img.shields.io/github/stars/karimz1/imgcompress?style=flat-square&color=f4d03f&label=Stars&logo=github&logoColor=black" alt="GitHub Stars" />
    </a>
    <a href="https://github.com/sponsors/karimz1">
      <img src="https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?style=flat-square&logo=githubsponsors&logoColor=white" alt="Sponsor on GitHub" />
    </a>
    <a href="./TRANSLATIONS.md">
      <img src="https://img.shields.io/badge/Multi--language-12%20locales-16a34a?style=flat-square&logo=googletranslate&logoColor=white" alt="Multi-language support: 12 locales" />
    </a>
  </p>

  <p>
    <a href="https://imgcompress.karimzouine.com/">Website</a> ·
    <a href="https://imgcompress.karimzouine.com/docs">Docs</a> ·
    <a href="https://imgcompress.karimzouine.com/docs/installation">Installation</a> ·
    <a href="https://hub.docker.com/r/karimz1/imgcompress">Docker Hub</a> ·
    <a href="https://github.com/karimz1/imgcompress/issues">Issues</a>
  </p>

  <br />

  <img src="./images/web-ui/web-ui-upload-configure.webp" alt="ImgCompress Web UI, upload and configure dashboard" width="100%" />

  <br /><br />

  <p><strong>Featured & Listed On</strong></p>

  <p>
    <a href="https://github.com/awesome-selfhosted/awesome-selfhosted#readme">
      <img src="https://awesome.re/mentioned-badge-flat.svg" alt="Mentioned in Awesome Self-Hosted" />
    </a>
    <a href="https://coolify.io/docs/services/imgcompress?utm_source=github.com">
      <img src="https://img.shields.io/badge/Coolify-Official%20Service-8b5cf6?style=flat-square&logoColor=white" alt="Available as an official Coolify service" />
    </a>
    <a href="https://selfhostedworld.com/software/imgcompress">
      <img src="https://img.shields.io/badge/SelfHostedWorld-Featured-1e40af?style=flat-square" alt="Featured on SelfHostedWorld" />
    </a>
    <a href="https://selfh.st/apps/?search=imgcompress">
      <img src="https://img.shields.io/badge/selfh.st-Featured-1e40af?style=flat-square" alt="Featured on selfh.st" />
    </a>
    <a href="https://alternativeto.net/software/imgcompress/about">
      <img src="https://img.shields.io/badge/AlternativeTo-Listed-1e40af?style=flat-square" alt="Listed on AlternativeTo" />
    </a>
    <a href="https://www.pitchhut.com/project/imgcompress-toolbox">
      <img src="https://img.shields.io/badge/PitchHut-Listed-1e40af?style=flat-square" alt="Listed on PitchHut" />
    </a>
  </p>
</div>

---

## Features

- **70+ formats** — HEIC, PSD, SVG, AVIF, PDF, WebP and more
- **Compress & convert** — bulk jobs in the web UI or CLI
- **Image editor** — crop, exact sizes, backgrounds, text and logos ([guide](https://imgcompress.karimzouine.com/docs/image-editor))
- **AI upscaling** — sharper enlargements up to 16K, on your CPU ([guide](https://imgcompress.karimzouine.com/docs/ai-upscaling))
- **Background removal** — local AI, no account
- **One container** — works offline after the first pull
- **12 languages**

What's new in v1.0: [release notes](https://imgcompress.karimzouine.com/docs/release-notes).

---

## Quick Start

You need [Docker](https://docs.docker.com/get-started/get-docker/). Run once, then open `http://localhost:3001`:

```bash
docker run -d \
  --name imgcompress \
  -p 3001:5000 \
  karimz1/imgcompress:latest
```

Compose examples in [`docker/compose/`](docker/compose/):

- **[advanced.docker-compose.yaml](docker/compose/advanced.docker-compose.yaml)** — home / LAN
- **[proxied.docker-compose.yaml](docker/compose/proxied.docker-compose.yaml)** — HTTPS with Traefik
- **[ntfy.docker-compose.yaml](docker/compose/ntfy.docker-compose.yaml)** — phone notifications
- **[compose guide](docker/compose/README.md)** — step by step

Settings (upload limit, workers, notify, update check): [Installation](https://imgcompress.karimzouine.com/docs/installation) · [Configuration](https://imgcompress.karimzouine.com/docs/configuration)

---

## Docs

- [Installation](https://imgcompress.karimzouine.com/docs/installation)
- [Configuration](https://imgcompress.karimzouine.com/docs/configuration)
- [Notifications](https://imgcompress.karimzouine.com/docs/notifications)
- [AI upscaling](https://imgcompress.karimzouine.com/docs/ai-upscaling)
- [Image editor](https://imgcompress.karimzouine.com/docs/image-editor)
- [CLI](https://imgcompress.karimzouine.com/docs/cli)
- [FAQ](https://imgcompress.karimzouine.com/docs/faq)
- Full index: [imgcompress.karimzouine.com/docs](https://imgcompress.karimzouine.com/docs)

---

## Privacy

Files stay in your container. No cloud APIs. Optional notify messages never include file names. Details: [Privacy](https://imgcompress.karimzouine.com/docs/privacy).

---

## Contributing

Bug reports and PRs welcome. See [contributing.md](contributing.md) and the [Developer Guide](https://imgcompress.karimzouine.com/docs/developers). Architecture notes live in [docs/architecture.md](docs/architecture.md).

---

## Support the Project

<p align="center">
  <a href="https://github.com/sponsors/karimz1">
    <img src="https://img.shields.io/badge/Sponsor%20on-GitHub-ea4aaa?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Sponsor on GitHub" />
  </a>
  <a href="https://buymeacoffee.com/karimz1">
    <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee" />
  </a>
  <a href="https://www.paypal.com/paypalme/KarimZouine972">
    <img src="https://img.shields.io/badge/Donate-PayPal-00457c?style=for-the-badge&logo=paypal&logoColor=white" alt="Donate via PayPal" />
  </a>
</p>

---

## License & Author

**Author**: [Karim Zouine](https://www.karimzouine.com)  
**License**: [GPL-3.0](LICENSE)  
**Docker Image**: [hub.docker.com/r/karimz1/imgcompress](https://hub.docker.com/r/karimz1/imgcompress)
