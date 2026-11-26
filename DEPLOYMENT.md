# Mobileum Sales Demo Portal — Deployment & Operations Guide

This guide covers complete installation, configuration, and operations for deploying the **Mobileum Sales Demo Portal** (`/sales-demo/`), **Admin CMS** (`/sales-demo-admin/`), **Backend API** (`/api/`), **PostgreSQL**, and **Persistent Media Storage** on an internal company VM.

---

## 1. Required Software & Versions

* **Node.js:** v20.x LTS or v24.x (verified locally on v24.16.0)
* **npm:** v10.x or v11.x
* **PostgreSQL:** v15 or v16+ (separate database service; local VM or dedicated company DB host)
* **Reverse Proxy:** Nginx (Linux) or IIS with URL Rewrite 2.1 + ARR 3.0 (Windows Server)
* **Process Manager (optional):** `systemd`, `PM2`, or Docker Compose

---

## 2. Supported Deployment Architectures

1. **Direct VM Deployment (Non-Docker — Recommended for Internal VMs):**
   * Nginx or IIS serves static production bundles (`apps/portal/dist` and `apps/admin/dist`) and proxies `/api/` and `/media/` to the Node.js API (`127.0.0.1:4000`).
   * PostgreSQL runs as a standalone OS service or on an internal DB server.
2. **Docker Compose Deployment (Optional):**
   * Uses `deploy/docker/docker-compose.prod.yml` with persistent volumes `pg_data` and `media_storage` paired with Nginx/reverse proxy.

---

## 3. PostgreSQL Installation

### Windows (Local Development or Windows Server)
1. Download the official PostgreSQL 16 installer or run via `winget`:
   ```powershell
   winget install PostgreSQL.PostgreSQL.16
   ```
2. Add `C:\Program Files\PostgreSQL\16\bin` to your system `PATH` so `psql`, `pg_dump`, and `pg_restore` are available.
3. Verify the service and CLI:
   ```powershell
   psql --version
   ```

### Linux (Ubuntu / Debian / RHEL)
```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

---

## 4. Database Creation

Connect as the `postgres` superuser and create the dedicated application role and database:

```sql
CREATE USER mobileum_demo WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
CREATE DATABASE mobileum_sales_demo OWNER mobileum_demo;
GRANT ALL PRIVILEGES ON DATABASE mobileum_sales_demo TO mobileum_demo;
```

---

## 5. Environment Configuration

Copy `.env.example` to `.env` in the repository root and configure all values:

```bash
cp .env.example .env
```

Generate a cryptographically strong `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Required production variables:
* `NODE_ENV=production`
* `PORT=4000`
* `DATABASE_URL=postgresql://mobileum_demo:<password>@<db-host>:5432/mobileum_sales_demo`
* `MEDIA_STORAGE_DIR=/var/lib/mobileum-sales-demo/storage` (or `D:\MobileumData\storage` on Windows; **must be outside `dist/`**)
* `SESSION_SECRET=<96-hex-char-secret>`
* `COOKIE_SECURE=true` (set `false` only if internal VM uses plain HTTP without TLS)
* `COOKIE_SAME_SITE=lax`
* `CORS_ORIGIN=https://company-vm.mobileum.internal` (match exact scheme + host)
* `ADMIN_SEED_NAME`, `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` (used only during Step 7)

---

## 6. Database Migrations

Install dependencies, build `@mobileum/shared`, and execute version-controlled SQL migrations:

```bash
npm ci
npm run build:shared
npm run db:migrate
```

Expected output:
* Applies `001_initial_schema.sql`, `002_seed_reference_data.sql`, and `003_portal_settings_and_resets.sql`.
* Records SHA-256 checksums in `schema_migrations` so reruns are safe and idempotent.

---

## 7. Initial Super Admin Initialization & Credential Rotation

Set `ADMIN_SEED_NAME`, `ADMIN_SEED_EMAIL`, and `ADMIN_SEED_PASSWORD` (minimum 12 characters) in `.env` or shell environment, then run:

```bash
npm run db:seed
```

**Security rules:**
* Immediately remove `ADMIN_SEED_PASSWORD` from `.env` after seeding completes.
* To rotate a Super Admin password later, change it via the Admin Portal (`Administrators -> Reset Password`) or via `POST /api/admin/users/:id/reset-password`, which hashes with Argon2id and revokes all active sessions.

---

## 8. Frontend & Backend Production Build

```bash
npm run build
```

This compiles:
* `packages/shared/dist`
* `apps/portal/dist` (configured for base path `/sales-demo/`)
* `apps/admin/dist` (configured for base path `/sales-demo-admin/`)
* `apps/api/dist` (including copied SQL migrations in `apps/api/dist/db/migrations`)

---

## 9. Backend Startup

### Linux (`systemd`)
1. Copy `deploy/systemd/mobileum-sales-demo-api.service` to `/etc/systemd/system/`.
2. Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now mobileum-sales-demo-api
   ```

### Cross-Platform (`PM2`)
```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

### Health Verification
```bash
curl http://127.0.0.1:4000/api/health
```
Confirm `"status": "ok"`, `"database": { "connected": true }`, and `"storage": { "writable": true }`.

---

## 10. Reverse Proxy Configuration

* **Linux Nginx:** Use `deploy/nginx/mobileum-sales-portal.conf` (routes `/sales-demo/`, `/sales-demo-admin/`, `/api/`, and `/media/`, enables `client_max_body_size 550M`, and disables proxy buffering for HTTP 206 video streaming).
* **Windows Server IIS:** Use `deploy/windows/web.config` with URL Rewrite 2.1 and Application Request Routing (ARR 3.0).

---

## 11. Firewall & Port Requirements

* **Exposed to Internal Network:** `80` (HTTP) / `443` (HTTPS TLS recommended) on the reverse proxy.
* **Internal Loopback Only:** `4000` (Express API), `5432` (PostgreSQL — restrict to API host IP if separate DB server).

---

## 12. Media Storage Setup

Create the persistent storage root outside the application build folder and grant read/write permissions to the Node.js service account:

```bash
sudo mkdir -p /var/lib/mobileum-sales-demo/storage/{products,categories,shared}
sudo chown -R mobileum:mobileum /var/lib/mobileum-sales-demo/storage
```

Media is stored under immutable UUID paths (`products/{product-uuid}/{images,videos,thumbnails}/`), so renaming products or slugs never breaks existing media URLs.

---

## 13. Database Backup

### Linux
```bash
DATABASE_URL="postgresql://..." ./deploy/scripts/backup-db.sh /var/backups/mobileum-demo
```

### Windows
```powershell
.\deploy\scripts\backup-db.ps1 -BackupDir D:\Backups\MobileumDemo -DatabaseUrl $env:DATABASE_URL
```

---

## 14. Media Backup

```bash
MEDIA_STORAGE_DIR="/var/lib/mobileum-sales-demo/storage" ./deploy/scripts/backup-media.sh /var/backups/mobileum-demo
```

**Consistency Recommendation:** Schedule nightly backups (`cron` / Windows Task Scheduler) running the database backup immediately followed by the media directory snapshot so DB file paths and stored files stay synchronized.

---

## 15. Restore Procedure

1. Stop the backend API service (`systemctl stop mobileum-sales-demo-api` or `pm2 stop mobileum-sales-demo-api`).
2. Restore PostgreSQL:
   ```bash
   DATABASE_URL="postgresql://..." ./deploy/scripts/restore-db.sh /var/backups/mobileum-demo/<file>.dump
   ```
3. Extract media backup into `MEDIA_STORAGE_DIR`:
   ```bash
   tar -xzf /var/backups/mobileum-demo/<media>.tar.gz -C /var/lib/mobileum-sales-demo/storage
   ```
4. Start the backend API service and verify `GET /api/health`.

---

## 16. Updating & Redeploying

1. Pull updated source code (`git pull`).
2. Run `npm ci && npm run build`.
3. Run `npm run db:migrate` (safe & idempotent).
4. Restart the backend service (`systemctl restart mobileum-sales-demo-api` or `pm2 reload mobileum-sales-demo-api`).
5. Reload Nginx if reverse proxy config changed. Existing media in `MEDIA_STORAGE_DIR` and records in PostgreSQL remain untouched.

---

## 17. Troubleshooting

* **`503 DATABASE_URL is not configured`:** Ensure `.env` exists in the working directory and `DATABASE_URL` points to a running PostgreSQL service.
* **Login cookie rejected over HTTP:** Set `COOKIE_SECURE=false` in `.env` when testing over internal HTTP, and `COOKIE_SECURE=true` once HTTPS is terminated on the reverse proxy.
* **Large MP4 upload returns `413`:** Verify both `MAX_VIDEO_SIZE_MB` in `.env` and `client_max_body_size` (Nginx) / `maxAllowedContentLength` (IIS).
* **Video seeking stalls:** Confirm `proxy_buffering off;` is configured in Nginx so HTTP `206 Partial Content` byte ranges stream directly.
