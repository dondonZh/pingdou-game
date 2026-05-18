# Tar Deploy Guide

This guide is for the image-based deployment flow:

1. Build images locally
2. Export images as `.tar`
3. Upload the tar files to the server
4. Load the images on the server
5. Start the stack with `docker compose`

## Files

- Local development compose: `docker-compose.yml`
- Server release compose: `docker-compose.release.yml`

## Local Build

Use Node 20 before building frontend assets if needed:

```powershell
nvm use 20.18.0
```

Build the two business images:

```powershell
docker build -t pingdou-web:latest .
docker build -t pingdou-api:latest ./api
```

Export them as tar files:

```powershell
docker save -o pingdou-web.tar pingdou-web:latest
docker save -o pingdou-api.tar pingdou-api:latest
```

After that you should have:

- `pingdou-web.tar`
- `pingdou-api.tar`
- `docker-compose.release.yml`

## Upload To Server

Upload these files to the server, for example:

- `/opt/pingdou-game/pingdou-web.tar`
- `/opt/pingdou-game/pingdou-api.tar`
- `/opt/pingdou-game/docker-compose.yml`

You can rename `docker-compose.release.yml` to `docker-compose.yml` before uploading, or keep the filename and use `-f`.

## Server Prepare

Create a working directory:

```bash
mkdir -p /opt/pingdou-game
cd /opt/pingdou-game
```

If you uploaded `docker-compose.release.yml`, run with:

```bash
docker compose -f docker-compose.release.yml up -d
```

If you renamed it to `docker-compose.yml`, then use:

```bash
docker compose up -d
```

## Load Images On Server

Import the uploaded tar files:

```bash
docker load -i pingdou-web.tar
docker load -i pingdou-api.tar
```

Check that the images exist:

```bash
docker images
```

You should see:

- `pingdou-web:latest`
- `pingdou-api:latest`
- `redis:7-alpine` will be pulled automatically by compose when missing

## Start Services

If the compose file is named `docker-compose.yml`:

```bash
docker compose up -d
```

If the compose file is named `docker-compose.release.yml`:

```bash
docker compose -f docker-compose.release.yml up -d
```

Check status:

```bash
docker compose ps
```

Or with explicit file:

```bash
docker compose -f docker-compose.release.yml ps
```

## Logs

View all logs:

```bash
docker compose logs -f
```

View one service:

```bash
docker compose logs -f web
docker compose logs -f api
docker compose logs -f redis
```

## Access

Open:

```text
http://<server-ip>:8080
```

## Update Later

When code changes:

1. Rebuild locally
2. Re-export the new tar files
3. Upload the new tar files
4. Reload images on the server
5. Restart the stack

Commands on the server:

```bash
docker load -i pingdou-web.tar
docker load -i pingdou-api.tar
docker compose up -d
```

If the release file is used:

```bash
docker load -i pingdou-web.tar
docker load -i pingdou-api.tar
docker compose -f docker-compose.release.yml up -d
```

## Clean Restart

If you think old containers are dirty:

```bash
docker compose down
docker compose up -d
```

Or with the release file:

```bash
docker compose -f docker-compose.release.yml down
docker compose -f docker-compose.release.yml up -d
```

## Notes

- Only the `web` service is exposed to the public on port `8080`
- `api` and `redis` are kept inside the compose network
- Redis data is persisted in the `redis-data` volume
