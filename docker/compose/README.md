# ImgCompress Docker Compose Variants

## Why do they exist?

The default `docker-compose.yaml` in the project root is intentionally minimal - great for getting started, but it omits production hardening. Every real-world container deployment needs a baseline of best practices: proper MTU settings to avoid fragmented network packets, log rotation to prevent disk exhaustion, a reverse proxy for TLS termination, and so on. These variant files provide ready-made configurations that cover those concerns.

Furthermore, these comprehensive files serve as living documentation for future maintainers. They capture the operational decisions behind "how our container should behave on a user's machine" - decisions that are easy to forget when you spin up a ten-line compose file to test a shiny new container and then move on.

## Which one should I use?

**For local / internal use:** Start with `advanced.docker-compose.yaml`. It contains sensible defaults you can copy into your own setup.

**For public Internet exposure:** Use `proxied.docker-compose.yaml`. It is a battery-included with a Traefik reverse proxy that handles TLS termination, HTTPS redirection, and security headers.
