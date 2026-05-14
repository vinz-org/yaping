# Yaping 
  
 Yaping adalah platform jejaring sosial berbasis web (gaya Facebook 2008) yang dibuat dengan HTML, CSS, dan JavaScript murni — tanpa framework, tanpa build step. Backend menggunakan **Supabase** untuk database, autentikasi, dan realtime. 
  
 --- 
  
 ## Tech Stack 
  
 | Layer | Teknologi | 
 |-------|-----------| 
 | Frontend | HTML5, CSS3, Vanilla JavaScript | 
 | Database | Supabase (PostgreSQL) via REST API | 
 | Auth | Supabase Auth (email + password) | 
 | Realtime | Supabase Realtime WebSocket | 
 | P2P | PeerJS v1.5.4 (CDN) | 
 | Storage | Browser `localStorage` (cache lokal) | 
  
 --- 
  
 ## Fitur 
  
 - **Feed** — buat postingan teks, foto, MP3, atau MP4; like dan komentar 
 - **Komunitas** — buat dan ikuti komunitas dengan kategori (Gaming, Teknologi, Musik, dll.) 
 - **Profil** — avatar, banner, bio, username, statistik (post, like, pengikut) 
 - **Pencarian** — cari user, postingan, hashtag, dan komunitas 
 - **Notifikasi** — notifikasi in-app + browser push notification 
 - **Updates** — tab changelog dari developer 
 - **Pengaturan** — dark mode, ukuran font, privasi, hapus data, logout 
 - **Official Badge** — daftar akun resmi di `badge.js` 
 - **Sistem Ban** — ban server-side (by username atau client ID) tidak bisa dihindari dengan hapus localStorage atau VPN 
 - **Admin Panel** — ban / unban user (khusus akun bercentang di `badge.js`) 
 - **Realtime Sync** — postingan dan komunitas baru muncul otomatis via WebSocket 
  
 --- 
  
 ## Cara Menjalankan 
  
 Tidak perlu install apapun. Cukup: 
  
 1. Clone atau download repository ini 
 2. Buka file `index.html` di browser 
  
 ```bash 
 git clone <repo-url> 
 cd yaping 
 # Buka index.html di browser (double-click atau drag ke browser) 
 ``` 
  
 Untuk akses lewat local server (opsional, menghindari CORS di beberapa browser): 
  
 ```bash 
 # Python 3 
 python3 -m http.server 8000 
 # Lalu buka http://localhost:8000 
 ``` 
  
 --- 
  
 ## Setup Supabase 
  
 > Jika ingin deploy ke instance Supabase sendiri, ikuti langkah berikut.   
 > Jika pakai instance yang sudah ada, langkah ini bisa dilewati. 
  
 ### 1. Buat project di Supabase 
  
 Daftar di [supabase.com](https://supabase.com), buat project baru, lalu catat **Project URL** dan **anon key**. 
  
 ### 2. Buat tabel di Supabase SQL Editor 
  
 ```sql 
 -- Tabel postingan feed utama 
 create table feed_posts ( 
   id text primary key, 
   author text, 
   content text, 
   likes int default 0, 
   liked_by jsonb default '[]', 
   created_at bigint, 
   media text, 
   media_type text, 
   origin_peer_id text, 
   comments jsonb default '[]' 
 ); 
  
 -- Tabel postingan komunitas 
 create table community_posts ( 
   id text primary key, 
   community_id int, 
   author text, 
   content text, 
   likes int default 0, 
   liked_by jsonb default '[]', 
   created_at bigint, 
   media text, 
   media_type text, 
   origin_peer_id text, 
   comments jsonb default '[]' 
 ); 
  
 -- Tabel komunitas 
 create table communities ( 
   id int primary key, 
   name text, 
   description text, 
   category text, 
   members int default 1, 
   owner text, 
   banner text, 
   created_at bigint 
 ); 
  
 -- Tabel ban server-side 
 create table yaping_bans ( 
   id bigint generated always as identity primary key, 
   username text, 
   client_id text, 
   reason text, 
   created_at timestamptz, 
   expires_at timestamptz, 
   is_permanent boolean default false 
 ); 
  
 -- Tabel profil user 
 create table users_profile ( 
   id uuid primary key references auth.users(id), 
   username text unique, 
   email text, 
   full_name text, 
   avatar_url text, 
   bio text, 
   updated_at timestamptz 
 ); 
  
 -- Tabel log aktivitas (opsional) 
 create table activity_log ( 
   id bigint generated always as identity primary key, 
   user_id uuid, 
   username text, 
   action text, 
   target_type text, 
   target_id text, 
   details text, 
   created_at timestamptz default now() 
 ); 
 ``` 
  
 ### 3. Aktifkan Realtime 
  
 Di dashboard Supabase → **Database → Replication**, aktifkan realtime untuk tabel: 
 - `feed_posts` 
 - `community_posts` 
 - `communities` 
  
 ### 4. Ganti konfigurasi di `db.js` 
  
 Buka `db.js` dan ubah dua baris berikut: 
  
 ```js 
 var SUPABASE_URL = 'https://<project-id>.supabase.co'; 
 var SUPABASE_ANON_KEY = '<your-anon-key>'; 
 ``` 
  
 --- 
  
 ## Struktur File 
  
 ``` 
 yaping/ 
 ├── index.html          # Markup utama + semua tab (Home, Komunitas, Profil, Settings, dll.) 
 ├── favicon.ico 
 ├── README.md 
 ├── LICENSE 
 ├── assets/ 
 │   ├── style.css       # Seluruh styling (Facebook 2008 theme + dark mode) 
 │   └── badge.png       # Ikon centang biru untuk akun resmi 
 └── js/ 
     ├── badge.js        # Daftar username akun resmi (official badge) 
     ├── db.js           # Supabase REST client + Realtime WebSocket + ban system 
     ├── auth.js         # Supabase Auth (signup, login, session, logout, profile sync) 
     ├── features.js     # Handler login/signup form, sort, updates, edit postingan 
     ├── script.js       # Logic utama: feed, komunitas, P2P, localStorage, render 
     └── db-patch.js     # Runtime patch: auth guard untuk aksi yang butuh login 
 ``` 
  
 --- 
  
 ## Menambah Akun Resmi (Badge) 
  
 Edit `js/badge.js`, tambahkan username ke array: 
  
 ```js 
 var YAPING_BADGE_USERS = [ 
     '@hexaa', 
     '@yourUsername',  // tambah di sini 
 ]; 
 ``` 
  
 Akun di list ini mendapat centang biru dan akses panel admin di Settings. 
  
 --- 
  
 ## Catatan Pengembangan 
  
 - Semua data di-cache di `localStorage` dan disinkronkan ke Supabase. 
 - Input postingan diproteksi dari XSS — karakter HTML di-escape sebelum render. 
 - Ban server-side dicatat di tabel `yaping_bans` dan dicek saat halaman dibuka; tidak bisa dihindari dengan clear localStorage. 
 - PeerJS digunakan untuk koneksi P2P antar browser (penemuan peer otomatis via bootstrap slot). 
 - Aplikasi berjalan 100% di sisi klien — tidak ada server Node.js atau backend custom.