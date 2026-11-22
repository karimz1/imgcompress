# Security Policy

## Supported versions

The latest stable 1.x release receives security fixes. Release candidates are for testing only and are not a supported security baseline.

## Reporting a vulnerability

Please do not open a public GitHub issue for a security vulnerability.

The preferred way to report is GitHub private vulnerability reporting: open the Security tab on this repository and choose "Report a vulnerability".

You can also email mails.karimzouine@gmail.com.

Please include:

- A description of the issue and its impact
- Steps to reproduce, or a proof of concept if you have one
- The affected version or Docker tag, and your deployment setup if it is relevant

This project is maintained by one person. I will do my best to acknowledge reports within a few days.

## Deployment

If you host ImgCompress on the public internet, run it in `API_ONLY` mode with a `PUBLIC_API_KEY` (in Compose: `IMGCOMPRESS_API_ONLY` and `IMGCOMPRESS_PUBLIC_API_KEY`), or put the container behind an authentication proxy. Do not expose an unauthenticated public API together with the web UI.
