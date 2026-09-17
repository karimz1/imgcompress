# ImgCompress backend

The Python backend for [ImgCompress](../ReadMe.md). It handles image conversion, compression, resizing, cropping, PDF processing, background removal, file storage, and the web API used by the frontend.

For the full local setup, testing workflow, and Dev Container instructions, see the [developer guide](https://imgcompress.karimzouine.com/docs/developers).

## Backend development

After setting up the project environment, start the backend from the repository root:

```bash
./scripts/runStartLocalBackend.sh
```

The server runs at <http://localhost:5000>.

Useful checks:

```bash
make lint          # Run the Python linter
make unit          # Run unit tests
make integration   # Run integration tests
```
