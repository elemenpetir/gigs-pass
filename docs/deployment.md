# Runbook Deployment — AWS EC2 (Fase 14)

Arsitektur: **Opsi B single port publik** — Nginx di EC2 host menjadi pintu masuk tunggal.

```
Browser ──► :80 Nginx (EC2 host)
              ├── /api/* ──► 127.0.0.1:5000 (backend container)
              └── /*     ──► 127.0.0.1:3000 (frontend container, static+SPA)
```

Frontend & API satu domain (same-origin) → CORS praktis non-isu di produksi.
Rate limiting dua lapis aktif otomatis: Nginx `limit_req` (benteng volumetrik,
lihat `deploy/nginx/gigspass.conf`) + `express-rate-limit` (presisi perilaku).

---

## 1. Prasyarat AWS

1. Akun AWS aktif + **AWS Budgets alert** terverifikasi masih menyala
   (cek sebelum dan sesudah deployment).
2. Region pilihan (mis. `ap-southeast-1` / `ap-southeast-3`).

### 1.1 Buat EC2 instance

| Setting | Nilai |
|---|---|
| AMI | Ubuntu Server 22.04 LTS (amd64) |
| Type | t2.micro atau t3.micro (free tier) |
| Key pair | Buat baru (`gigspass-key.pem`) — simpan aman |
| Storage | 20 GiB gp3 (image Docker butuh ruang) |

### 1.2 Security Group (`gigspass-sg`)

| Type | Port | Source | Catatan |
|---|---|---|---|
| HTTP | 80 | 0.0.0.0/0 | pintu publik |
| HTTPS | 443 | 0.0.0.0/0 | untuk TLS kelak |
| SSH | 22 | IP kamu saja | JANGAN 0.0.0.0/0 |

Opsional (tercatat di TASK_BREAKDOWN): domain di belakang Cloudflare free tier →
security group dikunci hanya ke [IP-range Cloudflare](https://www.cloudflare.com/ips/).

### 1.3 Elastic IP

Allocate Elastic IP + associate ke instance agar IP tidak berubah saat stop/start.
(Catat IP-nya — dipakai untuk GitHub Secrets.)

---

## 2. Setup Server

```bash
ssh -i gigspass-key.pem ubuntu@<EC2_IP>

# Update + install Docker Engine & compose plugin
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin nginx

# Izinkan docker tanpa sudo
sudo usermod -aG docker $USER
newgrp docker   # atau logout-login

# Nginx: matikan default site (akan diganti config Gigs Pass)
sudo rm -f /etc/nginx/sites-enabled/default
```

## 3. Clone Repo & Environment

```bash
sudo mkdir -p /opt/gigspass && sudo chown $USER /opt/gigspass
git clone https://github.com/elemenpetir/gigs-pass.git /opt/gigspass
cd /opt/gigspass
```

### 3.1 `backend/.env` (produksi)

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://...supabase/neon-prod...
DATABASE_SSL=true
REDIS_URL=rediss://...upstash-prod...
JWT_SECRET=<secret-kuat-acak>
JWT_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Wajib ON: aplikasi berdiri di belakang Nginx host
TRUST_PROXY=true

# Rate limiting (opsional — default titik emas sudah pas)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_LOGIN_MAX=10
RATE_LIMIT_REGISTER_MAX=10
RATE_LIMIT_JOIN_MAX=30
RATE_LIMIT_GLOBAL_MAX=600
```

Gunakan **database & Redis produksi yang terpisah** dari dev/test.
Jangan pakai `DATABASE_URL_TEST` di sini.

### 3.2 `frontend/.env`

```env
VITE_API_BASE_URL=/api
```

Relative path → browser memanggil API lewat domain yang sama (same-origin).

## 4. Pasang Config Nginx Host

```bash
sudo cp deploy/nginx/gigspass.conf /etc/nginx/sites-available/gigspass
sudo ln -sf /etc/nginx/sites-available/gigspass /etc/nginx/sites-enabled/gigspass
sudo nginx -t          # wajib: syntax OK
sudo systemctl reload nginx
```

## 5. Deploy Pertama

```bash
docker compose build
docker compose up -d
docker compose ps                  # kedua service Up (backend "healthy")
curl -f http://127.0.0.1:5000/api/health
curl -f http://127.0.0.1/api/health   # via Nginx
curl -I http://127.0.0.1/             # frontend 200
```

Dari luar: `http://<EC2_IP>/` harus menampilkan halaman frontend.

## 6. Aktifkan Deploy Otomatis (GitHub Actions)

1. GitHub repo → Settings → Environments → buat `production`.
2. Settings → Secrets → Actions:
   - `EC2_HOST` = IP/publik-hostname EC2
   - `EC2_USER` = `ubuntu`
   - `EC2_SSH_PRIVATE_KEY` = isi `gigspass-key.pem`
3. Actions tab → **Deploy to AWS EC2** → Run workflow → environment `production`.
4. (Opsional, nyalakan hanya jika sudah stabil) buka blok `workflow_run`
   di `.github/workflows/cd.yml` agar auto-deploy setelah CI hijau di main.

## 7. Verifikasi Bertahap

| Uji | Cara | Harapan |
|---|---|---|
| Health | `curl http://<IP>/api/health` | 200 envelope ok |
| Frontend | Buka `http://<IP>/` di browser | Halaman Discover render penuh |
| SPA fallback | Buka `http://<IP>/events` langsung | Tetap render (bukan 404) |
| Login/register | Alur UI normal | Berfungsi |
| SSE waiting room | Join event uji; atau `curl -N -H "Authorization: Bearer <jwt>" http://<IP>/api/queue/<id>/stream` | Event `position` mengalir tanpa putus |
| Rate limit login | Loop ≥11 login gagal 1 IP | Ke-11+ dapat **429** ber-envelope |
| CORS | Dev tools Network saat memakai situs | Tidak ada error CORS (same-origin) |

## 8. TLS (setelah domain siap)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <domain-kamu>
```
Certbot menambah blok 443 + redirect otomatis pada `gigspass.conf`.

---

## Troubleshooting

| Gejala | Penyebab umum | Perbaikan |
|---|---|---|
| Semua request kena 429 bersamaan | `TRUST_PROXY` belum true → semua dihitung sebagai 127.0.0.1 | Set `TRUST_PROXY=true`, restart backend |
| SSE putus tiap ±60s | Buffering proxy / timeout pendek | Pastikan `proxy_buffering off` + `proxy_read_timeout 3600s` di config |
| Upload poster gagal 413 | `client_max_body_size` kecil | Sudah 10m di config; naikkan bila perlu |
| 502 Bad Gateway | Container mati / port tidak bind | `docker compose ps` + `docker compose logs backend`; cek bind 127.0.0.1 |
| Frontend tampil tapi API gagal | `/api/*` tidak dirutekan host nginx | Pastikan location `/api/` ada dan backend healthy |
| Rate limit tak jalan sama sekali | Config nginx belum dimuat | `nginx -t` + reload; cek zona terpasang |

## Pengingat Biaya

Setelah stabil: cek AWS Budgets alert, matikan/hentikan instance jika tidak
dipakai dalam waktu lama (Elastic IP berbiaya saat instance stop).
