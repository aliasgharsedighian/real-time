# استقرار فرانت‌اند BatGram روی لینوکس

این راهنما برای فرانت فعال `frontend/` است. نمونه‌ها برای Ubuntu 24.04، PM2، Nginx، شاخهٔ `main` و دامنهٔ `chat.example.com` نوشته شده‌اند. نام دامنه و URL مخزن را با مقادیر واقعی جایگزین کنید. در این چیدمان، PM2 فرانت را روی پورت ۳۰۰۳ و بک‌اند را روی پورت ۳۳۳۳ اجرا می‌کند. Nginx دسترسی HTTPS به هر دو را از یک دامنه فراهم می‌کند. تنظیم مسیرهای بک‌اند در [راهنمای استقرار بک‌اند](deploy-backend.md#nginx-و-ارتباط-با-فرانت) آمده است.

## آماده‌سازی سرور

1. رکورد DNS دامنه را به سرور وصل کنید. برای SSH، HTTP و HTTPS دسترسی فایروال را فراهم کنید. اگر فایروال را از راه دور فعال می‌کنید، ابتدا دسترسی SSH را در نشست دوم بررسی کنید.
2. بسته‌ها و Node.js را نصب کنید. هر دو راهنما از نصب سراسری Node.js 22.12 یا جدیدتر از شاخهٔ 22 در `/opt/batgram-node` استفاده می‌کنند.

```bash
sudo apt update
sudo apt install git nginx certbot python3-certbot-nginx rsync curl ca-certificates xz-utils
```

از [آرشیو رسمی Node.js 22](https://nodejs.org/en/download/archive/v22) نسخهٔ اصلاحی موردنظر و فایل checksum امضاشده را بگیرید. با دستورالعمل همان صفحه امضا و SHA-256 فایل معماری سرور (`x64` برای `x86_64` یا `arm64` برای `aarch64`) را بررسی کنید. سپس در پوشه‌ای که آرشیو بررسی‌شده قرار دارد اجرا کنید:

```bash
archive=node-v22.X.Y-linux-x64.tar.xz  # با نام فایل بررسی‌شده جایگزین شود
sudo install -d -m 0755 /opt/batgram-node
sudo tar -xJf "$archive" --strip-components=1 -C /opt/batgram-node
/opt/batgram-node/bin/node --version
PATH=/opt/batgram-node/bin:$PATH npm --version
```

PM2 را یک بار روی سرور، کنار همان نصب Node.js، نصب کنید:

```bash
sudo env PATH=/opt/batgram-node/bin:/usr/bin:/bin \
  npm install --global --prefix /opt/batgram-node pm2
```

3. کاربر انتشار و مسیرهای ثابت را بسازید. برای مخزن خصوصی، در حساب `bat-web` یک کلید Ed25519 برای دریافت کد بسازید، کلید عمومی را در بخش Deploy keys مخزن بدون دسترسی نوشتن ثبت کنید، host key رسمی GitHub را تأیید کنید و در دستور clone از `git@github.com:OWNER/REPO.git` استفاده کنید. کلید ورود CI به سرور کار دیگری انجام می‌دهد و جداگانه ساخته می‌شود.

```bash
sudo adduser --disabled-password --gecos '' bat-web
sudo install -d -o bat-web -g bat-web -m 0755 /srv/batgram-web
sudo -u bat-web -H mkdir -p /srv/batgram-web/{releases,assets}
sudo -u bat-web -H git clone --bare https://github.com/OWNER/REPO.git /srv/batgram-web/repo.git
```

4. ابتدا دایرکتوری تنظیمات را بسازید و سپس با `sudoedit /etc/batgram-web/build.env` تنظیمات build را ثبت کنید. مقادیر با shell syntax خوانده می‌شوند، پس فقط مدیر سرور باید بتواند فایل را ویرایش کند.

```bash
sudo install -d -o root -g root -m 0755 /etc/batgram-web
```

```dotenv
VITE_API_URL=https://chat.example.com
VITE_SOCKET_URL=https://chat.example.com/chat
```

با `sudo chown root:root /etc/batgram-web/build.env` و `sudo chmod 0644 /etc/batgram-web/build.env` مالکیت و مجوز فایل را تثبیت کنید.

`VITE_API_URL` مبنای API است و کلاینت `/api/v1/` را اضافه می‌کند. `/chat` namespace سوکت است و مسیر انتقال شبکه `/socket.io/` است. برای اعلان مرورگر، مقادیر عمومی `VITE_FIREBASE_*` را از [نمونهٔ محیط](../frontend/.env.example) و [راهنمای اعلان‌ها](notifications.md) تکمیل کنید و همان پروژهٔ Firebase را سمت بک‌اند تنظیم کنید. Vite این مقادیر را داخل فایل‌های عمومی bundle می‌گذارد. با هر تغییر در آن‌ها دوباره build بگیرید.

## تنظیم فرایند فرانت در PM2

با `sudoedit /etc/batgram-web/ecosystem.config.js` فایل زیر را بسازید. سرور استاتیک داخلی PM2 روی loopback از خروجی build سرو می‌کند و حالت SPA برای لینک مستقیم به مسیرهای React فعال است. [مستندات PM2 برای فایل‌های استاتیک](https://pm2.keymetrics.io/docs/usage/expose/)

```javascript
module.exports = {
  apps: [{
    name: 'batgram-web',
    script: 'serve',
    interpreter: '/opt/batgram-node/bin/node',
    cwd: '/srv/batgram-web',
    env: {
      PM2_SERVE_PATH: '/srv/batgram-web/current',
      PM2_SERVE_HOST: '127.0.0.1',
      PM2_SERVE_PORT: '3003',
      PM2_SERVE_SPA: 'true',
    },
  }],
};
```

اگر از قبل فرانت را با PM2 اجرا کرده‌اید، پیش از اولین انتشار نام فرایند، کاربر PM2، مسیر فایل‌ها و پورت فعلی را با `pm2 list` و `pm2 describe APP_NAME` بررسی کنید. می‌توانید مقادیر نمونه را با تنظیم فعلی خود هماهنگ کنید. هنگام جابه‌جایی، فرایند قدیمیِ روی پورت ۳۰۰۳ را متوقف کنید تا پورت برای فرایند جدید آزاد شود.

## انتشار دستی

اسکریپت زیر را با مالک `root` و mode `0755` در `/usr/local/bin/batgram-deploy-frontend` ذخیره کنید. خروجی هر build در مسیر جدا آماده می‌شود و symlink فقط پس از موفقیت build تغییر می‌کند. فایل‌های هش‌دار buildهای قبلی در `assets/` مشترک می‌مانند تا تب‌های باز بتوانند chunkهای lazy نسخهٔ قبلی را بگیرند.

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 022
export PATH=/opt/batgram-node/bin:/usr/bin:/bin

base=/srv/batgram-web
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
git --git-dir="$base/repo.git" archive "$sha" frontend | tar -x -C "$release"
cd "$release/frontend"
(
  set -a
  source /etc/batgram-web/build.env
  set +a
  : "${VITE_API_URL:?set VITE_API_URL}" "${VITE_SOCKET_URL:?set VITE_SOCKET_URL}"
  npm ci --include=dev
  npm run test:pwa
)

rsync -a --ignore-existing dist/assets/ "$base/assets/"
ln -s "$PWD/dist" "$release/current-link"
mv -Tf "$release/current-link" "$base/current"
pm2 startOrRestart /etc/batgram-web/ecosystem.config.js --only batgram-web
curl --retry 12 --retry-connrefused --retry-delay 1 --max-time 5 \
  -fsS -o /dev/null http://127.0.0.1:3003/dashboard/profile
pm2 save
printf 'Published %s from %s\n' "$sha" "$release"
```

بار اول و بعد از هر تغییر، SHA دقیق نسخهٔ تأییدشده روی `main` را از GitHub یا checkout محلی بگیرید. پیش از اجرا در انتشارهای بعدی، خروجی `readlink /srv/batgram-web/current` را برای rollback ثبت کنید.

```bash
sudo -u bat-web -H /usr/local/bin/batgram-deploy-frontend 'FULL_COMMIT_SHA'
```

## اجرای خودکار PM2 بعد از reboot

پس از موفقیت اولین انتشار، دستور زیر را اجرا کنید و سپس فرمانی را که PM2 برای ثبت startup چاپ می‌کند، یک بار با حساب مدیر اجرا کنید. اسکریپت انتشار پس از بررسی HTTP با `pm2 save` فهرست فرایندها را ذخیره می‌کند. همهٔ فرمان‌های PM2 فرانت را با همان کاربر `bat-web` اجرا کنید. [مستندات startup در PM2](https://pm2.keymetrics.io/docs/usage/startup/)

```bash
sudo -u bat-web -H env PATH=/opt/batgram-node/bin:/usr/bin:/bin pm2 startup systemd
sudo -u bat-web -H env PATH=/opt/batgram-node/bin:/usr/bin:/bin pm2 status
sudo -u bat-web -H env PATH=/opt/batgram-node/bin:/usr/bin:/bin pm2 logs batgram-web --lines 50 --nostream
```

## Nginx و HTTPS

فایل `/etc/nginx/sites-available/batgram` را بسازید. این نمونه برای سایتی در ریشهٔ دامنه است. اگر بک‌اند نیز روی همین دامنه است، snippet راهنمای بک‌اند را بسازید و خط `include` را فعال کنید. تنظیم CDN نیز باید همین قواعد cache را رعایت کند.

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name chat.example.com;

    root /srv/batgram-web/current;

    # include /etc/nginx/snippets/batgram-backend.conf;

    location ^~ /assets/ {
        alias /srv/batgram-web/assets/;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location = /sw.js {
        add_header Cache-Control "no-cache" always;
        try_files $uri =404;
    }

    location / {
        add_header Cache-Control "no-cache" always;
        proxy_pass http://127.0.0.1:3003;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/batgram /etc/nginx/sites-enabled/batgram
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d chat.example.com
sudo certbot renew --dry-run
```

بعد از صدور گواهی بررسی کنید HTTP به HTTPS هدایت می‌شود. سرویس‌ورکر، push، نصب PWA و دسترسی مرورگر به میکروفن و دوربین روی دامنه به HTTPS نیاز دارند. تنظیم تمدید را با `systemctl list-timers --all | grep certbot` بررسی کنید.

## کنترل نسخهٔ منتشرشده و بازگشت

```bash
curl -fsSI https://chat.example.com/
curl -fsSI https://chat.example.com/dashboard/profile
curl -fsSI https://chat.example.com/sw.js
curl -fsS 'https://chat.example.com/socket.io/?EIO=4&transport=polling'
```

برای مسیر مستقیم داشبورد باید HTML برگردد و در مرورگر، مهمان به ورود هدایت شود. با حساب آزمایشی، ورود، اعتبارسنجی نشست با API، reload مسیر خصوصی، ارسال پیام و reconnect را بررسی کنید. در DevTools مطمئن شوید درخواست API یا سوکت به `localhost` یا HTTP نمی‌رود. اگر سرویس‌ورکر جدید در حالت waiting است، همهٔ پنجره‌های سایت و PWA را ببندید و دوباره باز کنید.

برای بازگشت، در حساب `bat-web` همان قفل انتشار را بگیرید و مسیر ثبت‌شدهٔ قبلی را به `current` برگردانید. سازگاری آن build با API جاری را بررسی کنید.

```bash
(
  set -e
  export PATH=/opt/batgram-node/bin:/usr/bin:/bin
  base=/srv/batgram-web
  exec 9>"$base/deploy.lock"
  flock 9
  previous='/srv/batgram-web/releases/REPLACE/frontend/dist'
  test -f "$previous/index.html"
  linkdir=$(mktemp -d "$base/.rollback.XXXXXX")
  ln -s "$previous" "$linkdir/current"
  mv -Tf "$linkdir/current" "$base/current"
  rmdir "$linkdir"
  pm2 startOrRestart /etc/batgram-web/ecosystem.config.js --only batgram-web
  curl --retry 12 --retry-connrefused --retry-delay 1 --max-time 5 \
    -fsS -o /dev/null http://127.0.0.1:3003/dashboard/profile
  pm2 save
)
```

برای نگهداری، چند نسخهٔ سالم و فایل‌های هش‌دار موردنیاز آن‌ها را نگه دارید. پیش از حذف نسخه‌های قدیمی، به کاربران فرصت خروج از تب‌ها و به‌روزرسانی PWA بدهید و مصرف دیسک `releases/` و `assets/` را بررسی کنید.

## CI/CD با GitHub Actions

- از دستگاه مدیر یک کلید اختصاصی با `ssh-keygen -t ed25519 -f ./batgram-ci-frontend` بسازید. برای اجرای غیرتعاملی این نمونه، passphrase را خالی بگذارید و کلید خصوصی را در محل امن نگه دارید. fingerprint کلید میزبان SSH را از کنسول سرور با `sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` بخوانید و با خطی که برای `known_hosts` ذخیره می‌کنید تطبیق دهید.
- پس از موفقیت اولین استقرار دستی، محیط `production-frontend` را در GitHub بسازید و انتشار را به `main` محدود کنید. در صورت پشتیبانی پلن، تأیید انتشار را فعال کنید. [راهنمای محیط‌های انتشار GitHub](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)
- متغیر `DEPLOY_HOST` را برابر hostname سرور SSH روی پورت ۲۲ بگذارید. کلید خصوصی مخصوص CI را در secret به نام `DEPLOY_SSH_KEY` و کلید عمومی متناظر را در `authorized_keys` کاربر `bat-web` قرار دهید. `DEPLOY_KNOWN_HOSTS` باید خط `known_hosts` همان سرور باشد که fingerprint آن را از کنسول سرور تأیید کرده‌اید. برای کلید CI از گزینهٔ `restrict` در `authorized_keys` استفاده کنید و به این کاربر sudo ندهید.
- runner باید بتواند به SSH سرور برسد. اگر SSH در شبکهٔ خصوصی است، job انتشار را روی runner مورداعتماد دارای دسترسی به آن شبکه اجرا کنید. فایل `/etc/batgram-web/build.env` روی سرور می‌ماند و build نهایی همان‌جا با مقادیر تولید ساخته می‌شود.
- قفل سرور اجرای دستی و CI را سری می‌کند و بررسی SHA جلوی انتشار نسخهٔ قدیمی پس از نسخهٔ جدیدتر را می‌گیرد. نمونه را در `.github/workflows/frontend-deploy.yml` بگذارید. Pull request فقط lint، تست و PWA را بررسی می‌کند. push به `main` یا اجرای دستی از همان شاخه، پس از بررسی، همان SHA را منتشر می‌کند و فرایند `batgram-web` را با PM2 راه‌اندازی یا restart می‌کند. برای تغییرات مشترک قرارداد، ترتیب انتشار را در محیط‌های GitHub کنترل کنید و ابتدا بک‌اند سازگار با هر دو نسخه را منتشر کنید.

```yaml
name: frontend production
on:
  pull_request:
    branches: [main]
    paths: ['frontend/**', '.github/workflows/frontend-deploy.yml']
  push:
    branches: [main]
    paths: ['frontend/**', '.github/workflows/frontend-deploy.yml']
  workflow_dispatch:
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v6
        with:
          persist-credentials: false
      - uses: actions/setup-node@v6
        with:
          node-version: '22'
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run test:pwa
  deploy:
    if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
    needs: verify
    runs-on: ubuntu-latest
    environment: production-frontend
    concurrency:
      group: production-frontend
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
            "bat-web@$DEPLOY_HOST" "/usr/local/bin/batgram-deploy-frontend $GITHUB_SHA"
```

## به‌روزرسانی این راهنما

هر PR که build، متغیرهای `VITE_*`، دامنه یا مسیر عمومی، cache، PWA یا ترتیب انتشار را عوض می‌کند باید فرمان و بررسی مربوط را همین‌جا به‌روز کند. برای بررسی معماری و اجرای محلی، [README فرانت](../frontend/README.md) و [مرجع فرانت](frontend-context.md) را ببینید.
