# Dooko Reader

A self-hosted, web-only fork of [Koodo Reader](https://github.com/koodo-reader/koodo-reader), an ebook reader with support for EPUB, PDF, MOBI, AZW3, TXT, FB2, CBR/CBZ/CBT/CB7, MD, DOCX, HTML and more.

## What's different from upstream

- **数据存在服务器，而不是浏览器本地** — the web frontend is bound to the Go backend bundled in the same container. Books, notes, highlights, reading progress and settings are stored on the server, not in localStorage/IndexedDB. Open the same deployment from any device or browser and you get the exact same library and reading state — a seamless, stateless reading experience with no manual sync, no data source binding, and nothing to reconfigure.
- **Web only** — the Electron desktop client and its build toolchain are removed. Deploy it yourself and open it from any browser on any device.
- **No Koodo cloud dependency** — login, account, Pro features, update checks, plugin registry, Koodo Sync and all other connections to the official Koodo services are removed.
- **Password gate** — the web UI is protected by a simple password (the same `SERVER_PASSWORD` used by the backend). Logged in for 30 days via cookie.
- **Two ports, one container**:
  - `7661` — the web frontend. Its backend API calls are proxied to the Go server inside the container.
  - `8080` — the Go file server (Basic auth), exposed directly so external clients (e.g. the official Koodo mobile app) can connect to it.

## Deployment

### Docker Compose (recommended)

```yaml
services:
  dooko-reader:
    image: ghcr.io/hustyanzu/dooko-reader:latest
    container_name: dooko-reader
    restart: unless-stopped
    ports:
      - "7661:7661"
      - "8080:8080"
    environment:
      - SERVER_USERNAME=admin
      - SERVER_PASSWORD=your-password-here
    volumes:
      - /opt/uploads:/app/uploads
```

Then open `http://<your-host>:7661` and log in with `SERVER_PASSWORD`.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_USERNAME` | `admin` | Backend Basic auth username (used by the API on :8080 and external clients) |
| `SERVER_PASSWORD` | `securePass123` | Backend password — also the web password gate password |
| `SERVER_PASSWORD_FILE` | `my_secret` | Docker secret file to read the password from (overrides `SERVER_PASSWORD`) |
| `ENABLE_HTTP_SERVER` | `true` | Set to `false` to disable the file server |
| `ENABLE_KOREADER_SERVER` | `false` | Enable the KOReader sync server (:7200) |
| `ENABLE_OPDS` | `false` | Enable the OPDS catalog on the file server |

### Accessing the backend API externally

The Go server on `:8080` serves the raw file storage with Basic auth:

- `POST /upload?dir=` — upload a file
- `GET /download?dir=&filename=` — download a file
- `DELETE /delete?dir=&filename=` — delete a file
- `GET /list?dir=` — list files
- `GET /opds` — OPDS catalog (when enabled)

Files are stored under `/app/uploads`. The web frontend reaches these same endpoints through the Caddy proxy on `:7661`.

### Build from source

```bash
yarn build                                  # build the React app into build/
cd httpserver && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o httpserver-linux-amd64 .
docker build -t dooko-reader:dev .          # expects build/ and httpserver-linux-<arch>
```

Publishing to `ghcr.io/hustyanzu/dooko-reader` (amd64 + arm64) is automated via `.github/workflows/docker-publish.yml` on pushes to `dev` and `v*` tags.

## License

AGPL-3.0, same as the upstream [Koodo Reader](https://github.com/koodo-reader/koodo-reader).
