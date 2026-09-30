# 📸 Dynamic Screenshot Service

Service berbasis Node.js yang berfungsi sebagai API internal untuk mengambil tangkapan layar (screenshot) dari halaman web mana pun secara dinamis. Service ini dirancang khusus untuk berjalan di lingkungan Docker (Alpine) dengan jejak memori yang kecil dan dapat diintegrasikan dengan n8n atau tool automation lainnya.

## ✨ Fitur Utama

- **Dinamis & Agnostik**: Tidak hanya untuk Grafana, bisa digunakan untuk screenshot website mana saja melalui payload JSON.
- **Autentikasi Pintar**: Mendukung injeksi header `Basic Auth` maupun custom token, sehingga dapat menembus halaman yang dikunci (misal: sistem monitoring) tanpa harus melewati *form login* manual.
- **Strategi Tunggu Fleksibel (Wait Strategy)**:
  - `waitUntil`: Bisa diatur ke `networkidle0`, `networkidle2`, atau `domcontentloaded`.
  - `delayAfterLoad`: Menambahkan jeda waktu statis untuk memberi kesempatan pada panel grafik (seperti Grafana) agar selesai me-render sebelum diproses.
  - `waitForSelector`: Menunggu elemen CSS tertentu ter-render di halaman.
- **Ukuran Docker Sangat Ringan**: Berbasis `node:18-alpine` dengan instalasi Chromium secara mandiri. Memangkas ukuran base image dari ~1.2 GB menjadi hanya ~300 MB.
- **Logging Terstruktur JSON**: Dilengkapi dengan utilitas `logger.js` yang mencetak log secara mendetail beserta `requestId`. Sangat bersahabat untuk dibaca oleh sistem sentralisasi log (ELK, Loki, Datadog).

## 🛠 Teknologi Utama

- **Express.js**: Menjalankan web server HTTP.
- **Puppeteer**: Mengontrol browser Chromium secara *headless*.
- **Alpine Linux**: Sistem operasi bawaan Docker.

## 🚀 API Referensi

**Endpoint:** `POST /screenshot`

**Contoh Payload Request via cURL:**
```bash
curl -X POST "http://localhost:8081/screenshot" \
-H "Content-Type: application/json" \
-d '{
  "url": "http://172.24.81.99:3000/d/42f0ea49-de00-46b9-8a97-e3730e3e027e/cc-autodebet-autopayment-monitoring?orgId=1&from=now-24h&to=now&kiosk=tv",
  "auth": { 
    "type": "basic", 
    "username": "rpt_bot", 
    "password": "secret123" 
  }, 
  "waitOptions": { 
    "waitUntil": "domcontentloaded", 
    "delayAfterLoad": 8000 
  }
}' --output hasil-screenshot.png
```

## 🏗 Tabel Konfigurasi Payload JSON

| Parameter | Tipe | Deskripsi | Default |
|---|---|---|---|
| `url` | *string* | (Wajib) Target URL yang akan di-screenshot. | - |
| `viewport.width` | *int* | Lebar resolusi layar simulasi browser. | `1920` |
| `viewport.height` | *int* | Tinggi resolusi layar simulasi browser. | `1080` |
| `auth.type` | *string* | Jenis autentikasi (`basic` / `header` / `none`). | `none` |
| `auth.username` | *string* | Username untuk Basic Auth (Wajib jika auth.type = basic). | - |
| `auth.password` | *string* | Password untuk Basic Auth (Wajib jika auth.type = basic). | - |
| `waitOptions.waitUntil` | *string* | Event load Puppeteer (`networkidle0`, `networkidle2`, `domcontentloaded`). | `networkidle0` |
| `waitOptions.delayAfterLoad`| *int* | Waktu tunggu ekstra mutlak dalam milidetik (ms). | `0` |
| `screenshotOptions.type`| *string* | Format gambar yang diinginkan (`png` / `jpeg`). | `png` |
| `screenshotOptions.fullPage`| *boolean* | Mengambil screenshot memanjang dari atas ke bawah. | `false` |

## 📦 Deployment ke Server Production

Aplikasi ini ditujukan untuk berjalan sebagai *Docker Daemon*. Langkah kerjanya:

**1. Membangun Image:**
```bash
docker build -t custom-grafana-renderer:v2 .
```

**2. Kompresi Image untuk Transfer Server:**
```bash
docker save custom-grafana-renderer:v2 | gzip > custom-grafana-renderer-v2.tar.gz
```

**3. Mengaktifkan Container di Server:**
```bash
docker load -i custom-grafana-renderer-v2.tar.gz
docker run -d --name grafana-screenshot -p 8081:8081 --restart unless-stopped custom-grafana-renderer:v2
```
