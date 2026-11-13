# استقرار بک‌اند BatGram روی لینوکس

نمونه‌ها برای Ubuntu 24.04، Node.js 22، PostgreSQL محلی، PM2، Nginx و شاخهٔ `main` نوشته شده‌اند. فرانت و بک‌اند در این چیدمان از دامنهٔ `chat.example.com` استفاده می‌کنند. [راهنمای فرانت](deploy-frontend.md) نصب Node.js و PM2، فایل سایت Nginx و TLS را پوشش می‌دهد.

جست‌وجوی عنوان و خواننده با build و انتشار معمول بک‌اند در استقرار دستی یا CI/CD فعال می‌شود. از ستون‌ها و ایندکس‌های موجود استفاده می‌کند و migration یا تنظیم تازه‌ای ندارد. پس از انتشار با یک حساب عضو گفتگو، عنوان و خوانندهٔ یک آهنگ بدون کپشن را جداگانه جست‌وجو کنید و پاسخ `music` و شناسهٔ پیام را بررسی کنید. در صورت خطا، نسخهٔ قبلی بک‌اند را طبق بخش بازگشت بازیابی کنید.

## ۱. پیش‌نیازها و کاربران

```bash
sudo apt update
sudo apt install git curl ca-certificates postgresql postgresql-contrib ffmpeg
sudo systemctl enable --now postgresql
/opt/batgram-node/bin/node --version
PATH=/opt/batgram-node/bin:/usr/bin:/bin pm2 --version
psql --version
/usr/bin/ffmpeg -version
/usr/bin/ffprobe -version

sudo adduser --disabled-password --gecos '' bat-deploy
sudo install -d -o bat-deploy -g bat-deploy -m 0755 /srv/batgram-api
sudo -u bat-deploy -H mkdir -p /srv/batgram-api/releases
sudo install -d -o bat-deploy -g bat-deploy -m 0700 /srv/batgram-api/backups
sudo install -d -o bat-deploy -g bat-deploy -m 0750 /var/lib/batgram/uploads
sudo install -d -o root -g bat-deploy -m 0750 /etc/batgram
sudo -u bat-deploy -H git clone --bare https://github.com/OWNER/REPO.git /srv/batgram-api/repo.git
```

برای مخزن خصوصی، URL را با آدرس SSH مخزن و یک GitHub deploy key فقط‌خواندنی تنظیم کنید. کاربر `bat-deploy` کد را می‌گیرد، migration را اجرا می‌کند و مالک فرایند PM2 و مسیر آپلود است. فایروال ورودی `3333/tcp` و `5432/tcp` را عمومی نکند. کد فعلی Nest آدرس bind را با env محدود نمی‌کند. پس از راه‌اندازی با `ss -ltnp` و از یک میزبان بیرونی بررسی کنید که دسترسی مستقیم به این پورت‌ها بسته باشد.

## ۲. ساخت PostgreSQL

برای دیتابیس خالی، ابتدا نقش و دیتابیس را بسازید. برای انتقال دادهٔ موجود، در دیتابیس مقصد از backup تأییدشده بازیابی کنید و جدول `_prisma_migrations` را هم حفظ کنید.

```bash
sudo -u postgres psql -v ON_ERROR_STOP=1
```

```sql
CREATE ROLE batgram LOGIN;
\password batgram
CREATE DATABASE batgram OWNER batgram;
\connect batgram
CREATE EXTENSION IF NOT EXISTS pg_trgm;
\quit
```

`pg_trgm` برای migration جست‌وجوی پیام لازم است. نقش برنامه مالک دیتابیس اختصاصی است تا Prisma بتواند اشیای schema را بسازد و تغییر دهد. به این نقش دسترسی superuser یا مالکیت دیتابیس‌های دیگر ندهید. اتصال TCP و extension را با کاربر برنامه بررسی کنید:

```bash
psql -h 127.0.0.1 -U batgram -d batgram -W -v ON_ERROR_STOP=1 \
  -c "SELECT current_database(), current_user;" \
  -c "SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';"
```

## ۳. تنظیم محیط تولید

فایل زیر را با `sudoedit /etc/batgram/backend.env` ایجاد کنید. دو مقدار JWT مستقل را با دو بار اجرای `openssl rand -hex 32` تولید کنید. برای رمز PostgreSQL هم می‌توانید مقدار hex مستقل بسازید تا نیازی به encode کردن نباشد.

```dotenv
NODE_ENV=production
PORT=3333
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=batgram
DB_USERNAME=batgram
DB_PASSWORD=REPLACE_DB_PASSWORD
POSTGRES_DATABASE_URL=postgresql://batgram:REPLACE_DB_PASSWORD@127.0.0.1:5432/batgram?schema=public
JWT_SECRET=REPLACE_ACCESS_SECRET
JWT_REFRESH_SECRET=REPLACE_REFRESH_SECRET
UPLOAD_DIR=/var/lib/batgram/uploads
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
FIREBASE_NOTIFICATIONS_ENABLED=false
```

```bash
sudo chown root:bat-deploy /etc/batgram/backend.env
sudo chmod 0640 /etc/batgram/backend.env
```

کد هم اعتبارسنجی `DB_*` را انجام می‌دهد و هم برای اتصال Prisma در زمان اجرا و migration از `POSTGRES_DATABASE_URL` استفاده می‌کند. مقادیر را هماهنگ نگه دارید. اگر رمز کاراکتر رزروشده مانند `@` یا `#` دارد، مقدار خام را در `DB_PASSWORD` داخل کوتیشن و نسخهٔ percent-encoded را در URL بگذارید. فایل را در Git، دایرکتوری وب یا خروجی CI قرار ندهید. تغییر JWT کاربران را وادار به ورود مجدد می‌کند. پس از تغییر env، با همان کاربر `bat-deploy` دستور `pm2 restart batgram-api` را اجرا کنید تا Node فایل محیط را دوباره بخواند.

- **رسانه** مسیر `UPLOAD_DIR` باید پس از انتشار، restart و بازیابی باقی بماند. عکس، ویدئو و صدا با API احراز هویت‌شده سرو می‌شوند. این مسیر را در Nginx به صورت فایل عمومی ارائه نکنید. جزئیات محدودیت و پردازش در [راهنمای رسانه](media-uploads.md) آمده است.
- **اعلان مرورگر** برای فعال‌سازی، `FIREBASE_NOTIFICATIONS_ENABLED=true`، شناسهٔ پروژه و `FIREBASE_SERVICE_ACCOUNT_PATH` را طبق [نمونهٔ بک‌اند](../backend/.env.notifications.example) تنظیم کنید. برای JSON یک مسیر مانند `/etc/batgram-firebase/service-account.json` بسازید. دایرکتوری والد را با مالکیت `root:bat-deploy` و mode `0750` تنظیم کنید. JSON را با مالکیت `root:bat-deploy` و mode `0640` نگه دارید. روی لینوکس `FIREBASE_TRANSPORT=direct` و دسترسی خروجی HTTPS به سرویس‌های Google لازم است. تنظیمات عمومی Firebase فرانت باید به همان پروژه اشاره کنند. [راهنمای اعلان‌ها](notifications.md)
- **تماس** برای کارکرد روی شبکه‌های محدود، coturn را روی میزبان دارای IP عمومی و DNS مثل `turn.example.com` تنظیم کنید. در coturn از `use-auth-secret`، `static-auth-secret`، `realm=turn.example.com` و گواهی TLS معتبر استفاده کنید. در بک‌اند `WEBRTC_TURN_SECRET` را با همان رمز و `WEBRTC_TURN_URLS` را با `turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349?transport=tcp` تنظیم کنید. پورت‌های ورودی listener و بازهٔ UDP رله را با تنظیم coturn در فایروال و NAT هماهنگ کنید. برای میزبان پشت NAT، نگاشت `external-ip` را هم تنظیم کنید و آزمون تماس را بین دو شبکه اجرا کنید. [راهنمای تماس](calls.md)

تغییر مسیریابی اعلان با build و راه‌اندازی مجدد معمول در انتشار دستی یا CI/CD اعمال می‌شود. پس از انتشار با دو حساب، کارت گفتگوی دیگر، سکوت گفتگوی mute و Push پس‌زمینه را بررسی کنید. اگر پس از انتشار تحویل اعلان دچار مشکل شد، نسخهٔ قبلی بک‌اند را طبق مسیر rollback بازیابی کنید.

## ۴. تنظیم فرایند بک‌اند در PM2

با `sudoedit /etc/batgram/ecosystem.config.js` فایل زیر را بسازید. Node در زمان شروع، secretها را از فایل محیط می‌خواند. مسیر کاری `current` به نسخهٔ منتشرشده اشاره می‌کند. یک instance در حالت fork اجرا می‌شود تا state درون‌حافظه‌ای تماس و حضور بین فرایندها جدا نشود. [مستندات پیکربندی PM2](https://pm2.keymetrics.io/docs/usage/application-declaration/)

```javascript
module.exports = {
  apps: [{
    name: 'batgram-api',
    cwd: '/srv/batgram-api/current',
    script: 'dist/main.js',
    interpreter: '/opt/batgram-node/bin/node',
    node_args: '--env-file=/etc/batgram/backend.env',
    instances: 1,
    exec_mode: 'fork',
    restart_delay: 3000,
    kill_timeout: 10000,
  }],
};
```

اگر بک‌اند از قبل روی PM2 است، نام، کاربر اجرا، پورت و مسیر آپلود فعلی را با `pm2 list` و `pm2 describe APP_NAME` بررسی کنید. در صورت استفاده از کاربر یا پورت دیگر، اسکریپت، SSH در CI، مالکیت فایل‌های محیط و آپلود، و Nginx را هماهنگ کنید. اگر فرایند قبلی با نام یا کاربر دیگری روی همان پورت اجرا می‌شود، در پنجرهٔ نگهداری آن را متوقف کنید و پس از جابه‌جایی، فهرست PM2 کاربر قبلی را هم به‌روز کنید تا نمونهٔ قبلی با reboot برنگردد.

## ۵. انتشار دستی و migration

در توسعه، برای تغییر schema از دیتابیس توسعه و `npx prisma migrate dev --name describe_change` استفاده کنید. `schema.prisma` و فایل‌های جدید `prisma/migrations/` را با هم commit کنید. روی staging هم نصب خالی و هم ارتقا از نسخهٔ فعلی با دادهٔ نماینده را بررسی کنید. migration اجراشده را در Git بازنویسی نکنید. روی production از `migrate deploy` استفاده کنید. `migrate dev`، `migrate reset` و `db push` بخشی از انتشار تولید نیستند. نصب خالی با migrationهای commit‌شده انجام می‌شود و seed تولید برای شروع لازم نیست.

اسکریپت را با مالک `root` و mode `0755` در `/usr/local/bin/batgram-deploy-backend` ذخیره کنید. build قبل از توقف سرویس انجام می‌شود. حذف موقت فرایند از PM2، گرفتن dump و اعمال migration باعث یک پنجرهٔ کوتاه قطع API و سوکت می‌شوند. اگر dump یا migration شکست بخورد، نسخهٔ جدید فعال نمی‌شود و فرایند برای بررسی خاموش می‌ماند. حذف آن از فهرست ذخیره‌شدهٔ PM2 هم مانع بالا آمدن بک‌اند در صورت reboot وسط migration می‌شود.

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 022
export PATH=/opt/batgram-node/bin:/usr/bin:/bin

base=/srv/batgram-api
envfile=/etc/batgram/backend.env
sha=${1:?pass the full commit SHA}
[[ $sha =~ ^[0-9a-f]{40}$ ]]

exec 9>"$base/deploy.lock"
flock 9
git --git-dir="$base/repo.git" fetch origin refs/heads/main:refs/heads/main
git --git-dir="$base/repo.git" merge-base --is-ancestor "$sha" refs/heads/main

if [[ -L "$base/current" ]]; then
  current=$(readlink "$base/current")
  current=${current#"$base/releases/"}
  current=${current%%.*}
  if ! git --git-dir="$base/repo.git" merge-base --is-ancestor "$current" "$sha"; then
    printf 'Refusing an older release. Use the documented rollback procedure.\n' >&2
    exit 1
  fi
fi

release=$(mktemp -d "$base/releases/$sha.XXXXXX")
chmod 0755 "$release"
git --git-dir="$base/repo.git" archive "$sha" backend | tar -x -C "$release"
cd "$release/backend"

npm ci --include=dev
node --env-file="$envfile" node_modules/prisma/build/index.js generate
npm run build
test -f dist/main.js
test -f dist/documentation/socket-io.md

if pm2 describe batgram-api >/dev/null 2>&1; then
  pm2 delete batgram-api
fi
pm2 save --force

# pg_dump از متغیرهای libpq استفاده می‌کند تا رمز در آرگومان پردازه نباشد.
dump=$(mktemp "$base/backups/$(date -u +%Y%m%dT%H%M%SZ)-$sha.XXXXXX")
node --env-file="$envfile" - "$dump" <<'NODE'
const { spawnSync } = require('node:child_process');
const url = new URL(process.env.POSTGRES_DATABASE_URL);
const result = spawnSync('/usr/bin/pg_dump', [
  '-Fc', '--no-password', '--file', process.argv[2],
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
  },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
NODE
pg_restore --list "$dump" >/dev/null
mv -- "$dump" "$dump.dump"
printf 'Database backup: %s.dump\n' "$dump"

node --env-file="$envfile" node_modules/prisma/build/index.js migrate deploy
node --env-file="$envfile" node_modules/prisma/build/index.js migrate status

ln -s "$PWD" "$release/current-link"
mv -Tf "$release/current-link" "$base/current"
pm2 start /etc/batgram/ecosystem.config.js --only batgram-api

curl --retry 12 --retry-connrefused --retry-delay 1 --max-time 5 \
  -fsS -o /dev/null http://127.0.0.1:3333/v1/documentations/openapi.json
pm2 save
printf 'Published %s from %s\n' "$sha" "$release"
```

این اسکریپت Prisma CLI قفل‌شده در lockfile را از همان release اجرا می‌کند و وابستگی‌های آن را برای بررسی migration نگه می‌دارد. dump برای PostgreSQL محلیِ همین نمونه تنظیم شده است. اگر از دیتابیس مدیریت‌شده استفاده می‌کنید، تنظیم TLS، اتصال مستقیم migration و تنظیمات backup آن سرویس را جداگانه با DBA تطبیق دهید.

برای اولین انتشار یا انتشارهای بعدی، SHA کامل نسخهٔ تأییدشدهٔ `main` را جایگزین کنید. پیش از تغییر، خروجی `readlink /srv/batgram-api/current` را ثبت کنید.

```bash
sudo -u bat-deploy -H /usr/local/bin/batgram-deploy-backend 'FULL_COMMIT_SHA'
sudo -u bat-deploy -H env PATH=/opt/batgram-node/bin:/usr/bin:/bin pm2 status
sudo -u bat-deploy -H env PATH=/opt/batgram-node/bin:/usr/bin:/bin pm2 logs batgram-api --lines 100 --nostream
```

### اجرای خودکار بک‌اند بعد از reboot

پس از اولین انتشار موفق، دستور زیر را اجرا کنید و فرمانی را که PM2 چاپ می‌کند یک بار با حساب مدیر اجرا کنید. فهرست فرایندها پس از موفقیت هر انتشار ذخیره می‌شود. اگر از قبل startup را برای همین کاربر و نصب Node تنظیم کرده‌اید، وضعیت آن را بررسی کنید. [مستندات startup در PM2](https://pm2.keymetrics.io/docs/usage/startup/)

```bash
sudo -u bat-deploy -H env PATH=/opt/batgram-node/bin:/usr/bin:/bin pm2 startup systemd
```

## Nginx و ارتباط با فرانت

برای سایت مشترک، این فایل را در `/etc/nginx/snippets/batgram-backend.conf` بسازید و آن را داخل بلوک `server` سایت فرانت include کنید. پیشوندها باید بدون بازنویسی به Nest برسند. برای یک دامنهٔ جدا همین snippet را در virtual host دامنهٔ API قرار دهید، TLS آن دامنه را فعال کنید و آدرس‌های build فرانت را به آن تغییر دهید.

```nginx
location ^~ /api/v1/ {
    client_max_body_size 110m;
    proxy_read_timeout 120s;
    proxy_pass http://127.0.0.1:3333;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location ^~ /socket.io/ {
    proxy_pass http://127.0.0.1:3333;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 75s;
    proxy_buffering off;
}
```

`110m` سربار multipart برای سقف ۱۰۰ MiB ویدئو را پوشش می‌دهد. `120s` مقدار اولیه است و برای ویدئوی واقعی باید اندازه‌گیری شود. Swagger از loopback برای بررسی سرویس استفاده می‌شود. اگر دسترسی تیم لازم است، مسیر `/v1/documentations` را با کنترل دسترسی مناسب جداگانه منتشر کنید.

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -fsS 'https://chat.example.com/socket.io/?EIO=4&transport=polling'
curl -sS -o /dev/null -w '%{http_code}\n' https://chat.example.com/api/v1/auth/user-info
```

handshake اولیه باید packet آغازین Engine.IO برگرداند و `user-info` بدون توکن باید `401` بدهد. بعد با حساب آزمایشی ورود، `user-info` با Bearer، refresh، اتصال namespace `/chat`، ارسال بین دو کاربر و بارگذاری/دریافت فایل را بررسی کنید. موفقیت Swagger فقط آماده‌شدن HTTP را بررسی می‌کند. برای `502` وضعیت فرایند و لاگ PM2 را ببینید. برای `413` محدودیت Nginx و برای قطع سوکت مسیر `/socket.io/`، هدر Upgrade و timeout را بررسی کنید.

HTTP فعلی origin را بازتاب می‌دهد و CORS سوکت باز است. اگر سیاست استقرار allowlist می‌خواهد، آن را در کد هماهنگ با دامنه‌ها اعمال و آزمایش کنید. در تنظیم فعلی throttler، Nginx ممکن است درخواست‌ها را از دید برنامه به یک IP تبدیل کند. قبل از بار واقعی، `429` را پایش کنید و در صورت نیاز اعتماد به proxy مشخص و استخراج IP را در کد همراه آزمون تنظیم کنید. نمونه با یک process اجرا می‌شود. برای چند instance باید state درون‌حافظه‌ای تماس/حضور، توزیع رویداد Socket.IO و ذخیرهٔ رسانه را بررسی کنید.

## ۶. backup، rollback و رفع خطای migration

- dump پیش از انتشار، جای backup زمان‌بندی‌شده را نمی‌گیرد. برای PostgreSQL و `UPLOAD_DIR` یک backup دوره‌ای رمزنگاری‌شده خارج از سرور و سیاست نگهداری بر اساس زمان بازیابی موردنیاز داشته باشید. برای backup جفت‌شده، نوشتن برنامه را متوقف کنید یا از snapshot هماهنگ استفاده کنید. env، اطلاعات دسترسی و پیکربندی PM2 و Nginx را در مخزن امن جدا نگه دارید.
- برای تمرین بازیابی، روی staging یک دیتابیس خالی با مالک برنامه و `pg_trgm` بسازید. با دسترسی staging و client سازگار اجرا کنید. رسانه را در مسیر staging همراه با مالکیت مناسب بازیابی و دانلود یک فایل را با حساب آزمایشی بررسی کنید.

```bash
pg_restore --exit-on-error --no-owner --no-privileges \
  -h STAGING_DB_HOST -U STAGING_APP_ROLE -W -d STAGING_EMPTY_DB /path/to/backup.dump
```

- اگر schema حاصل با نسخهٔ قبلی سازگار است، با کاربر `bat-deploy` و قفل زیر کد را برگردانید. این فرمان‌ها schema را تغییر نمی‌دهند. پیش از بازگشت، نسخهٔ قبلی و مسیر داده را تأیید کنید.

```bash
(
  set -e
  export PATH=/opt/batgram-node/bin:/usr/bin:/bin
  base=/srv/batgram-api
  exec 9>"$base/deploy.lock"
  flock 9
  previous='/srv/batgram-api/releases/REPLACE/backend'
  test -f "$previous/dist/main.js"
  if pm2 describe batgram-api >/dev/null 2>&1; then
    pm2 delete batgram-api
  fi
  pm2 save --force
  linkdir=$(mktemp -d "$base/.rollback.XXXXXX")
  ln -s "$previous" "$linkdir/current"
  mv -Tf "$linkdir/current" "$base/current"
  rmdir "$linkdir"
  pm2 start /etc/batgram/ecosystem.config.js --only batgram-api
  curl --retry 12 --retry-connrefused --retry-delay 1 --max-time 5 \
    -fsS -o /dev/null http://127.0.0.1:3333/v1/documentations/openapi.json
  pm2 save
)
```

- اگر migration شکست خورد، قبل از تلاش مجدد خروجی Prisma، `migrate status` و لاگ PostgreSQL را بررسی کنید. پس از بررسی تغییرات نیمه‌اعمال‌شده، در صورت امکان یک اصلاح رو‌به‌جلو انجام دهید. از `migrate resolve --rolled-back` فقط پس از پاک‌سازی یا معکوس‌کردن تغییرات همان migration، یا از `--applied` پس از تأیید اجرای کامل دستی استفاده کنید. [مرجع Prisma برای بازیابی migration](https://docs.prisma.io/docs/cli/migrate/resolve)
- اگر بازگرداندن schema نیاز به restore دارد، ابتدا dump را در دیتابیس جدا بازیابی و بررسی کنید. سپس در پنجرهٔ نگهداری، نسخهٔ سرویس، DB، env و رسانه را هماهنگ جابه‌جا کنید. دادهٔ نوشته‌شده پس از زمان backup در آن snapshot وجود ندارد. پیش از جابه‌جایی، وضعیت فعلی را هم جداگانه ذخیره کنید. dumpها و releaseهای ناموفق را پس از بررسی و طبق سیاست نگهداری پاک کنید.

## ۷. CI/CD با GitHub Actions

- از دستگاه مدیر یک کلید اختصاصی با `ssh-keygen -t ed25519 -f ./batgram-ci-backend` بسازید. برای اجرای غیرتعاملی این نمونه، passphrase را خالی بگذارید و کلید خصوصی را در محل امن نگه دارید. fingerprint کلید میزبان SSH را از کنسول سرور با `sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` بخوانید و با خطی که برای `known_hosts` ذخیره می‌کنید تطبیق دهید.
- پس از اولین استقرار دستی، محیط `production-backend` را بسازید، آن را به شاخهٔ `main` محدود کنید و در صورت پشتیبانی پلن برای migrationهای تولید تأیید انتشار بگذارید. [راهنمای GitHub](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)
- `DEPLOY_HOST` متغیر hostname سرور SSH روی پورت ۲۲ است. برای `DEPLOY_SSH_KEY` کلید مستقل CI بسازید، کلید عمومی را با گزینهٔ `restrict` در `authorized_keys` کاربر `bat-deploy` بگذارید و `DEPLOY_KNOWN_HOSTS` را از host key تأییدشده روی کنسول سرور پر کنید. runner انتشار باید به SSH دسترسی داشته باشد. اطلاعات دیتابیس تولید و JWT در `/etc/batgram/backend.env` روی سرور می‌مانند.
- قفل سرور اجرای دستی و CI را سری می‌کند و بررسی SHA جلوی انتشار نسخهٔ قدیمی پس از نسخهٔ جدیدتر را می‌گیرد. نمونه را در `.github/workflows/backend-deploy.yml` بگذارید. job بررسی روی PostgreSQL موقت migrationهای یک دیتابیس خالی، تست واحد و build را اجرا می‌کند. بررسی ارتقا روی دادهٔ موجود در staging انجام می‌شود. CD همان اسکریپت دستی را با SHA بررسی‌شده اجرا می‌کند تا پس از backup و migration، نسخهٔ جدید در PM2 بالا بیاید. برای تغییرات مشترک، بک‌اندی منتشر کنید که با فرانت قبلی و جدید سازگار باشد و تغییر حذفی schema یا قرارداد را به انتشار بعد موکول کنید.

```yaml
name: backend production
on:
  pull_request:
    branches: [main]
    paths: ['backend/**', '.github/workflows/backend-deploy.yml']
  push:
    branches: [main]
    paths: ['backend/**', '.github/workflows/backend-deploy.yml']
  workflow_dispatch:
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: ci
          POSTGRES_PASSWORD: ci
          POSTGRES_DB: batgram_ci
        ports: ['5432:5432']
        options: >-
          --health-cmd 'pg_isready -U ci -d batgram_ci'
          --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      POSTGRES_DATABASE_URL: postgresql://ci:ci@127.0.0.1:5432/batgram_ci?schema=public
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v6
        with:
          persist-credentials: false
      - uses: actions/setup-node@v6
        with:
          node-version: '22'
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npx --no-install prisma generate
      - run: npx --no-install prisma migrate deploy
      - run: npm test -- --runInBand
      - run: npm run build
  deploy:
    if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
    needs: verify
    runs-on: ubuntu-latest
    environment: production-backend
    concurrency:
      group: production-backend
      cancel-in-progress: false
    steps:
      - name: Deploy verified commit
        env:
          DEPLOY_HOST: ${{ vars.DEPLOY_HOST }}
          DEPLOY_SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
          DEPLOY_KNOWN_HOSTS: ${{ secrets.DEPLOY_KNOWN_HOSTS }}
        run: |
          umask 077
          ssh_dir=$(mktemp -d)
          trap 'rm -rf -- "$ssh_dir"' EXIT
          printf '%s\n' "$DEPLOY_SSH_KEY" > "$ssh_dir/key"
          printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
          ssh -i "$ssh_dir/key" -o BatchMode=yes -o IdentitiesOnly=yes \
            -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$ssh_dir/known_hosts" \
            "bat-deploy@$DEPLOY_HOST" "/usr/local/bin/batgram-deploy-backend $GITHUB_SHA"
```

## ۸. به‌روزرسانی این راهنما

هر PR که migration، extension، secret/env، بستهٔ سیستم، پورت، فضای ذخیره، job، backup یا ترتیب انتشار را عوض می‌کند باید پیش‌نیاز، فرمان اعمال، بررسی سلامت و مسیر بازیابی را در همین فایل به‌روز کند. برای تغییر عمومی HTTP یا Socket.IO، [راهنمای مستندسازی API](backend-api-documentation.md) هم در همان تغییر اعمال می‌شود.

### انتشار تاریخچهٔ عکس گروه

برای انتشار دستی و CI/CD، build بک‌اند باید Prisma Client را از schema همین نسخه بسازد و مرحلهٔ `prisma migrate deploy` باید پیش از راه‌اندازی PM2، migration `20261113100000_group_photo_activity` را اعمال کند. همان فضای آپلود و سطح دسترسی فعلی لازم است. نسخهٔ بک‌اند را پیش از فرانت جدید منتشر کنید.

بعد از انتشار، با دو حساب عضو گروه عکس را عوض کنید، به عکس در تاریخچه واکنش بدهید و سپس عکس گروه را پاک کنید. پس از بازخوانی چت، عکس قبلی و واکنش باید باقی بمانند. backup دیتابیس و فضای آپلود را با هم نگه دارید، چون عکس‌های تاریخچه در همان مسیر رسانه ذخیره می‌شوند.

پس از ثبت پیام با یکی از مقادیر enum جدید، نسخهٔ قبلی Prisma ممکن است نتواند آن پیام‌ها را بخواند. برای رفع مشکل نسخه‌ای با schema سازگار منتشر کنید. اگر بازگشت کامل لازم است، طبق بخش بازیابی، snapshot هماهنگ دیتابیس و رسانه را همراه با نسخهٔ قبلی برگردانید.
