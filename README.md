# ✦ AI Chat Tool — OpenRouter

Aplikasi chat AI menggunakan model-model **gratis** dari [OpenRouter](https://openrouter.ai), dibangun dengan React + Vite. Support upload gambar, file teks, ZIP, drag & drop, dan system prompt kustom.

## 🚀 Deploy ke GitHub Pages

### Cara 1: Otomatis via GitHub Actions (Direkomendasikan)

1. **Push ke GitHub**
   ```bash
   git init
   git add .
   git commit -m "first commit"
   git branch -M main
   git remote add origin https://github.com/USERNAME/NAMA-REPO.git
   git push -u origin main
   ```

2. **Sesuaikan `vite.config.js`**
   Ganti `"/openrouter-chat/"` dengan nama repo kamu:
   ```js
   base: "/NAMA-REPO/",
   ```

3. **Aktifkan GitHub Pages**
   - Pergi ke `Settings` → `Pages`
   - Pilih **Source: GitHub Actions**
   - Setiap push ke branch `main` akan otomatis build & deploy

4. **Akses app kamu di:**
   `https://USERNAME.github.io/NAMA-REPO/`

---

### Cara 2: Manual via `gh-pages`

```bash
npm install
npm run deploy
```

Pastikan `package.json` sudah ada field `homepage`:
```json
"homepage": "https://USERNAME.github.io/NAMA-REPO"
```

---

## 🛠️ Development Lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`

---

## 📁 Struktur File

```
openrouter-chat/
├── .github/
│   └── workflows/
│       └── deploy.yml      ← GitHub Actions auto-deploy
├── src/
│   ├── App.jsx             ← Komponen utama
│   ├── main.jsx            ← Entry point React
│   └── index.css           ← Global styles
├── index.html
├── vite.config.js          ← ⚠️ Sesuaikan base path!
├── package.json
└── .gitignore
```

## 🔑 Cara Dapat API Key OpenRouter

1. Daftar di [openrouter.ai](https://openrouter.ai)
2. Pergi ke [openrouter.ai/keys](https://openrouter.ai/keys)
3. Buat key baru → copy key `sk-or-v1-...`
4. Tempel di sidebar aplikasi → Save

API key **tidak disimpan di server**, hanya di memory browser (tab aktif).
