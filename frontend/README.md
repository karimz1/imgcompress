# ImgCompress frontend

The web interface for [ImgCompress](../ReadMe.md), a self-hosted tool for converting, compressing, cropping, and removing backgrounds from images.

For the full local setup, testing workflow, and Dev Container instructions, see the [developer guide](https://imgcompress.karimzouine.com/docs/developers).

## Frontend development

With the backend running on port `5000`:

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. API requests are forwarded to the local backend.

Other useful commands:

```bash
pnpm lint       # Type-check the project
pnpm build      # Create the production build
pnpm test:e2e   # Run the Playwright tests
```

Run these commands from this directory. The project uses the pnpm version declared in [`package.json`](package.json).
