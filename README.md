# ClassPing

Apna class timetable ek jagah, 30-min-before push reminder, aur ek-tap Teams join. Free hosting pe (Vercel + Supabase + GitHub Actions).

## Ye kaam kaise karta hai

- **Frontend**: ek installable PWA (`public/`) — home screen pe icon banta hai, app jaisa khulta hai.
- **Backend**: Vercel serverless functions (`api/`) jo Supabase mein courses aur push-subscriptions store karte hain.
- **Reminder engine**: GitHub Actions har 5 minute mein `/api/cron-check` ko call karta hai (Vercel ka free "Hobby" cron sirf din mein ek baar chalta hai, isliye GitHub Actions use kiya — ye bilkul free hai).
- Jab koi class start hone wali hoti hai (tumhare set kiye gaye minutes pehle), server **Web Push** notification bhejta hai — phone lock ho ya app band ho, notification phir bhi aayega.

Abhi ke liye login Microsoft se nahi hai — har phone apna ek chhota random ID (`device token`) khud banata hai, jo silently save ho jaata hai. Matlab tumhara data sirf tumhare phone se juda hai, bina kisi password/login ke. **Phase 2 mein Microsoft college-ID login add kar sakte hain** — uske liye tumhare college IT admin se Azure AD app registration approve karwani padegi (ye main abhi nahi kar sakta, permission college ke paas hoti hai).

---

## Setup (ek baar karna hai, ~20 minute)

### 1. Supabase project banao (free)
1. [supabase.com](https://supabase.com) pe sign up karo, **New Project** banao.
2. Project ke andar **SQL Editor** kholo → `sql/schema.sql` ka pura content paste karo → **Run**.
3. **Project Settings → API** mein jaake `Project URL` aur `service_role` key copy kar lo — ye baad mein chahiye honge.

### 2. Code GitHub pe push karo
```bash
cd classping
git init
git add .
git commit -m "classping setup"
git remote add origin https://github.com/<your-username>/classping.git
git push -u origin main
```

### 3. Vercel pe deploy karo
1. [vercel.com](https://vercel.com) → **Add New Project** → apna `classping` repo import karo.
2. Deploy se pehle **Environment Variables** mein ye sab daalo (`.env.example` dekho):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `VAPID_PUBLIC_KEY` (already generated hai, wahi use kar sakte ho)
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` → apna email daal do, e.g. `mailto:dhiraj@example.com`
   - `CRON_SECRET` → koi bhi random lambi string bana lo (password generator se)
3. **Deploy** dabao. 1-2 minute mein live ho jayega — URL milega jaisे `https://classping.vercel.app`.

### 4. GitHub Actions cron connect karo
Repo ke **Settings → Secrets and variables → Actions** mein 2 secrets add karo:
- `CLASSPING_URL` → tumhara Vercel URL, bina trailing slash (e.g. `https://classping.vercel.app`)
- `CRON_SECRET` → wahi value jo Vercel mein daali thi

Bas — **Actions** tab mein workflow apne aap har 5 min mein chalne lagega. Test karne ke liye Actions tab se **Run workflow** manually bhi chala sakte ho.

### 5. Phone pe install karo
1. Vercel wala URL apne phone ke browser (Edge/Chrome) mein kholo.
2. Top-right status pill pe tap karo → **notifications allow** karo.
3. Browser menu → **Add to Home Screen** / **Install app**.
4. Home screen se app kholo, **+ add class** se apna pura timetable daal do (course name, din, time, aur Moodle wala Teams "Join Session" link copy-paste kar do).

Bas ho gaya — ab har class se pehle (jo minutes tumne set kiye) notification aayega, tap karte hi seedha Teams meeting khulega.

---

## Important notes

- **Reminder timing ±10 min tak thoda flexible hai** kyunki GitHub Actions ka schedule exact-to-the-minute guarantee nahi karta (free tier mein normal hai). Class se 30 min pehle set karoge to notification kabhi 20–30 min pehle ke beech aayega.
- Har course ek din/hafta ke liye set hota hai (e.g. "Saturday 8:00 AM") — semester bhar automatically repeat hoga, dobara add karne ki zaroorat nahi.
- iPhone pe Safari mein push notifications sirf tab kaam karte hain jab app **Add to Home Screen** se install ho (plain browser tab mein nahi) — Android pe Chrome mein dono tarike se chal jaata hai.
- Agar kabhi Teams link change ho (naya semester), us course ko delete karke naya add kar dena.

## Files ka structure
```
classping/
├── api/                  → serverless backend (Vercel functions)
│   ├── subscribe.js      → push subscription save karta hai
│   ├── courses.js        → courses add/list/delete
│   └── cron-check.js     → reminder-checking engine (GitHub Actions isko call karta hai)
├── public/                → the actual PWA
│   ├── index.html, style.css, app.js
│   ├── sw.js              → service worker (push handle karta hai)
│   └── manifest.json      → installable app config
├── sql/schema.sql         → Supabase tables
└── .github/workflows/     → free cron scheduler
```
# classping
