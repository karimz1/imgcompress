# ImgCompress' Docker Compose variants

## Why do they exist?

Regarding the default `docker-compose.yaml`, it is a bit too... cute, and small. Every container deployment (Docker Compose, Helm Charts, .etc) always need a baseline of "how things should be" and "the goodies that all things want." Obviously, a container will want itself not to be chunked up network packets, have a log rotation, some kind of proxies that stand before it and handle TLS termination,.etc. So we prepare some variants that may suit your needs.

Futhermore, these comprehensive files will give all future maintainers a common sense about taking care of "how our container will behave on user's computer". The sense that many of us will forget if we just spin up a ten lines `compose file` to test a shiny new container, then drop it into the abyss.

## Which one should I use?

For detailed approach on deploying ImgCompress container, `docker/compose/advanced.docker-compose.yaml` is a good example. You may find some settings that you can reuse for your own docker compose setup.

If you deploy ImgCompress exposing on a untrusted network(the public Internet), use `docker/compose/proxied.docker-compose.yaml`. It will offer you a `Traefik` proxy with all configurations you need to secure and use ImgCompress safely.
