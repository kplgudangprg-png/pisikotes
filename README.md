# 🧠 PsikoTest Pro — WebRTC Real-Time

Platform psikotes online dengan pemantauan kamera WebRTC live antar device.

## Arsitektur

```
Peserta (Browser) ──WebSocket──► Node.js Server ◄──WebSocket── Admin (Browser)
        │                              │                              │
        └──────────── WebRTC (P2P Video Stream) ───────────────────►│
```

- **WebSocket** = signaling (pertukaran SDP offer/answer dan ICE candidates)
- **WebRTC** = streaming video kamera langsung P2P antar browser
- **STUN server** = Google STUN (gratis) untuk NAT traversal

---

## 🚀 Deploy ke Railway (Gratis)

### Langkah 1 — Buat akun Railway
1. Buka https://railway.app
2. Sign up dengan GitHub

### Langkah 2 — Upload project
**Opsi A: via GitHub (Rekomendasi)**
1. Buat repo baru di GitHub
2. Upload semua file ini ke repo tersebut
3. Di Railway → New Project → Deploy from GitHub repo
4. Pilih repo kamu → Railway otomatis deploy!

**Opsi B: via Railway CLI**
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Langkah 3 — Dapat URL
Setelah deploy, Railway memberi URL seperti:
```
https://psikotes-webrtc-production.up.railway.app
```

### Langkah 4 — Buka di browser
- **Pengawas**: buka URL → klik "Pengawas/Admin"
- **Peserta**: buka URL yang sama → klik "Peserta Tes"

---

## 🔧 Konfigurasi

| Setting | Default | Cara Ubah |
|---------|---------|-----------|
| Password admin | `admin123` | Edit di `server.js` baris 15 |
| Kode akses tes | `TES2024` | Edit di `public/index.html` |
| Durasi tes | 45 menit | Edit `timerSec = 45*60` |

---

## 📋 Cara Pakai

### Pengawas:
1. Buka URL → Admin Panel
2. Masukkan Room ID (contoh: `ROOM-001`) dan password (`admin123`)
3. Bagikan ke peserta: **URL + Room ID + Kode Akses**
4. Feed kamera peserta muncul otomatis saat peserta bergabung

### Peserta:
1. Buka URL yang sama → Peserta Tes
2. Isi nama, kode peserta, Room ID, dan kode akses (`TES2024`)
3. Izinkan akses kamera saat browser meminta
4. Mulai tes — kamera otomatis streaming ke pengawas

---

## ⚠️ Catatan Penting

- Butuh **HTTPS** agar kamera bekerja (Railway otomatis HTTPS ✓)
- Untuk skala besar (>10 peserta), tambahkan TURN server
- Data tes tidak disimpan ke database (stateless) — tambahkan MongoDB/PostgreSQL jika perlu persistensi
