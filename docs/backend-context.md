# مرجع بررسی بک‌اند چت

تاریخ بررسی: ۲۰۲۶-۱۱-۰۳ — مبنای Git: `1785456` به‌علاوهٔ تغییرات موجود در working tree.

این سند برای ادامهٔ اصلاحات و توسعه نوشته شده است؛ هیچ اصلاحی را اجرا یا تصمیم معماری آینده را قطعی نمی‌کند. سند همراه: [فرانت‌اند](nextjs-frontend-context.md).

## دامنه و میزان اطمینان

- کدهای `backend/src`، schema و پنج migration، تنظیمات، scripts و تست موجود خوانده شدند. lockfile برای نسخه‌های قفل‌شده بررسی شد؛ خروجی‌های تولیدشده و `node_modules` بخشی از بررسی کد برنامه نیستند.
- یافته‌های زیر حاصل خواندن کد هستند، مگر اینکه صریحاً نتیجهٔ یک بررسی اجرایی معرفی شوند. تست نفوذ، اجرای کامل سرویس و آزمون چندکاربره انجام نشده است.
- فایل‌های محیط برای شناخت متغیرها بررسی شدند؛ هیچ رمز، JWT secret یا مقدار حساس در این سند ثبت نشده است.
- از ابتدای بررسی، چند فایل بک‌اند و فرانت تغییرات ثبت‌نشده داشتند. این سند وضعیت همان کدها را توصیف می‌کند؛ پیش از اصلاح بعدی، diff جدید بررسی شود.
- فولدر قدیمی `frontend/` خارج از دامنهٔ این درخواست است؛ فرانت موردنظر کاربر `nextjs-frontend/` است.

## هدف و وضعیت محصول

برنامهٔ چت با ورود ایمیل/رمز، مسیر ورود OTP، جست‌وجوی کاربر، ساخت گفت‌وگوی دونفره، تاریخچهٔ پیام، ارسال زنده، typing و دادهٔ رسید خواندن است. گروه در مدل وجود دارد ولی ساخت گروه کامل نشده است. تماس ویدئویی، فایل و رمزنگاری سرتاسری در مسیرهای بررسی‌شده پیاده‌سازی نشده‌اند.

## فناوری و اجرا

| مورد | وضعیت |
| --- | --- |
| API | NestJS 11؛ نسخهٔ core در lockfile برابر 11.1.3 |
| زبان | TypeScript؛ lockfile برابر 5.8.3، CommonJS و target ES2023 |
| دیتابیس | PostgreSQL با Prisma و client نسخهٔ 6.10.1 |
| زنده | Socket.IO 4.8.1 روی namespace `/chat` |
| احراز هویت | Passport JWT، Argon2، access/refresh JWT |
| اعتبارسنجی | Joi برای محیط؛ class-validator و class-transformer برای DTO |
| محدودسازی HTTP | ThrottlerGuard عمومی؛ ۱۰۰ درخواست در ۲ دقیقه |
| توسعه | `npm run start:dev`؛ build با `npm run build` |
| اجرا | `npm run start:prod` → `node dist/main` |

`src/main.ts`، CORS با بازتاب origin و credentials را فعال می‌کند؛ ValidationPipe با `transform`، `whitelist` و `forbidNonWhitelisted` دارد. پورت فایل محیط 3333 است؛ fallback کد و پیش‌فرض validation برابر 3334 هستند. prefix در خود controllerها از `routesV1.version = api/v1` می‌آید، نه از `setGlobalPrefix`.

در نشست بررسی، `node` در PATH نبود ولی `/home/aliasghar/.nvm/versions/node/v22.19.0/bin/node` کار کرد. dependencyها از قبل موجود بودند؛ نصب انجام نشد. script مربوط به `lint` دارای `--fix` است؛ برای بررسی بدون تغییر نباید آن script را اجرا کرد.

## نقشهٔ کد

| محل، نسبت به `backend/` | مسئولیت |
| --- | --- |
| `src/main.ts`, `src/app.module.ts` | bootstrap، config، modules، throttling و gateway |
| `src/config/app.routes.ts` | نام و prefix همهٔ مسیرهای HTTP |
| `src/config/database.config.ts`, `env.validation.ts` | آدرس دیتابیس و اعتبارسنجی محیط |
| `src/libs/db/prisma/` | PrismaService و ماژول global |
| `src/libs/guard/`, `decorators/` | JWT، نقش و استخراج request.user |
| `src/modules/auth/` | ثبت‌نام، ورود، refresh، خروج، OTP و صدور توکن |
| `src/modules/user/` | اطلاعات کاربر، جست‌وجو، پروفایل و ویرایش ادمین |
| `src/modules/polling/` | REST چت، پیام، تاریخچه و unread |
| `src/gateway/chat/` | gateway زنده و یک سرویس دیتابیس جداگانه برای آن |
| `prisma/schema.prisma`, `prisma/migrations/` | مدل و تاریخچهٔ ساخت دیتابیس |
| `test/app.e2e-spec.ts` | تست اولیهٔ قالب Nest؛ متناسب با محصول فعلی نیست |

تفکیک controller/service/repository وجود دارد، اما منطق چت میان polling و gateway تکرار شده است. وابستگی CQRS در polling وارد شده ولی command/query bus جریان اصلی نیست.

## مدل داده

| مدل | رابطه و نکته |
| --- | --- |
| `User` | شناسهٔ Int خودافزا؛ email و phoneNumber یکتا و nullable؛ password nullable؛ نقش USER/ADMIN |
| `Profile` | رابطهٔ اختیاری یک‌به‌یک از سمت User؛ userId یکتا؛ firstname/lastname/address nullable |
| `OTP` | شناسهٔ UUID متنی؛ userId، code، expiresAt و createdAt؛ index روی userId |
| `Chat` | شناسهٔ Int؛ isGroup و createdAt؛ نام، مدیر یا updatedAt ندارد |
| `ChatParticipant` | رابطهٔ کاربر/چت؛ unique روی `(userId, chatId)` |
| `Message` | content متنی، chatId، senderId، createdAt؛ بدون edit/delete/attachment/clientMessageId |
| `MessageReadStatus` | unique روی `(messageId, userId)`؛ readAt؛ حذف آبشاری برای پیام/کاربر |

پنج migration از ساخت اولیه با شناسهٔ متنی تا تبدیل شناسه‌ها به Int، اضافه‌شدن پروفایل، isGroup و read status را پوشش می‌دهند. migration تبدیل شناسه‌ها دارای drop/recreate است؛ این تاریخچه مجوز reset یا اجرای دوباره روی دیتای موجود نیست. migration آخر index تکی messageId نیز دارد که در schema فعلی صریحاً دیده نمی‌شود؛ وجود احتمالی drift باید بعداً با مقایسهٔ واقعی بررسی شود، صرف کامل‌بودن migrationها اثبات برابری schema نیست.

## قرارداد HTTP فعلی

همهٔ مسیرهای زیر زیرمجموعهٔ `/api/v1/` هستند.

| روش و مسیر | ورودی اصلی | دسترسی / خروجی مهم |
| --- | --- | --- |
| POST `auth/signup` | email, password, role | عمومی؛ `data.token.{accessToken,refreshToken}` |
| POST `auth/signin` | email, password | عمومی؛ `data.{accessToken,refreshToken}` و cookie به نام token |
| POST `auth/request-otp` | mobileNumber | عمومی؛ پیام و userId؛ ایجاد کاربر در صورت نبودن |
| POST `auth/verify-otp` | userId, code | عمومی؛ `data.token` |
| POST `auth/refresh-token` | refreshToken | عمومی؛ خروجی مستقیم `{accessToken}` |
| POST `auth/logout` | Bearer | JWT؛ پاک‌کردن cookie، بدون ابطال توکن |
| GET `auth/user-info` | Bearer | JWT؛ envelope حاوی data کاربر، statusCode داخلی 202 |
| PUT `auth/update-profile` | firstname?, lastname?, address? | JWT؛ خروجی با کلید `status` |
| PUT `auth/update-user/:id` | role?, email?, اطلاعات پروفایل | JWT + ADMIN |
| POST `realtime/search-user` | search | JWT؛ جست‌وجوی contains روی ایمیل، حذف خود کاربر از نتیجه |
| GET `realtime/user/:id` | id | JWT؛ بدون محدودیت رابطهٔ مخاطب؛ شامل اطلاعات پروفایل |
| GET `realtime/polling` | Bearer | JWT؛ چت‌ها، آخرین پیام، participants دیگر و _count.messages |
| POST `realtime/polling` | chatId, content | JWT و بررسی عضویت؛ ذخیرهٔ پیام بدون broadcast زنده |
| POST `realtime/polling/create-chat` | participant[], firstMessage | JWT؛ سازنده به اعضا افزوده می‌شود؛ خروجی existing/new chat |
| GET `realtime/polling/:id` | page?, limit? | JWT و بررسی عضویت؛ `{chats,unreadMessages,unreadCount,users}`؛ همزمان read status می‌نویسد |
| GET `realtime/polling/unread/:id` | id | JWT؛ پیام‌های نخوانده را می‌گیرد و read status می‌نویسد؛ کنترل عضویت در این مسیر دیده نشد |

`statusCode` داخل JSON همیشه برابر status واقعی HTTP نیست؛ controllerها اغلب HttpCode ندارند. بعضی خطاها با object معمولی برگشت داده می‌شوند و بعضی با `Error` عمومی به 500 تبدیل می‌شوند. در تغییرات بعدی قرارداد فرانت نیز همزمان بررسی شود.

## قرارداد Socket.IO

| رویداد ورودی | payload فعلی | خروجی |
| --- | --- | --- |
| `chat:list` | userId | emit همان نام به درخواست‌کننده و return لیست |
| `chat:join` | chatId, userId | بررسی عضویت با شناسهٔ ارسالی؛ ورود به `chat:<id>`؛ `chat:joined` |
| `chat:leave` | chatId, userId | خروج از room؛ `chat:left` |
| `message:send` | chatId, senderId, content | ذخیره و broadcast `message:new` به room؛ return پیام |
| `message:read` | chatId, userId, messageIds[] | ثبت read و broadcast هر رسید با همان نام |
| `typing:start`, `typing:stop` | chatId, userId, username | ارسال payload به دیگر socketهای room |

payload پیام جدید شامل id، chatId، senderId، content، createdAt، sender با profile و readStatuses است. رسید شامل messageId، userId، readAt است. احراز هویت handshake وجود ندارد؛ `handleConnection` عمداً خالی است. فرانت نیز token به socket نمی‌دهد.

## جریان‌ها و تفاوت دو مسیر چت

1. REST پس از JwtGuard، شناسهٔ واقعی کاربر را از JWT می‌گیرد. Socket فعلی به شناسه‌های داخل payload اعتماد می‌کند.
2. فرانت فعال تاریخچه را با GET polling می‌گیرد، ولی ارسال را با socket انجام می‌دهد.
3. سایدبار فعال `chat:list` را یک بار درخواست می‌کند. خود سرور پس از ارسال پیام یا ساخت چت لیست جدیدی push نمی‌کند.
4. REST و socket دو تعریف متفاوت برای شمارش و علامت‌گذاری unread دارند؛ حفظ سازگاری این دو بخش برای UX ضروری است.

## یافته‌های کدی برای اصلاح بعدی

اولویت‌ها ترتیب پیشنهادی رسیدگی‌اند؛ موارد امنیتی با خواندن کد شناسایی شده‌اند و برای اثبات، درخواست مخرب اجرا نشده است.

| شناسه | اولویت | شاهد و اثر |
| --- | --- | --- |
| BE-01 | فوری | `gateway/chat/gateway.ts`: نبود احراز هویت socket و اعتماد به userId/senderId؛ بررسی عضویت با شناسهٔ ادعایی جلوی جعل هویت عضو را نمی‌گیرد. typing حتی بررسی عضویت ندارد. |
| BE-02 | فوری | `auth/commands/create-user/`: DTO عمومی ADMIN را مجاز می‌داند و service همان role ورودی را ذخیره می‌کند؛ ثبت‌نام امکان درخواست نقش ادمین دارد. |
| BE-03 | بالا | `polling.service.ts:GetUnreadChatMessage`: کنترل عضویت پیش از خواندن/ثبت read وجود ندارد؛ JwtGuard به‌تنهایی مجوز دیدن هر chatId نیست. |
| BE-04 | بالا | `chat.service.ts:markMessagesRead`: messageIds به chatId یا عضویت پیام‌ها محدود نشده‌اند؛ علاوه بر شناسه‌های ورودی، همهٔ unreadهای چت را read می‌کند ولی فقط رسید ops را منتشر می‌کند. |
| BE-05 | بالا | `config/database.config.ts`: ساخت URI هنگام import و قبل از ConfigModule؛ در نشست بررسی وجود `undefined` در URI بازتولید شد. username/password نیز encode نمی‌شوند. |
| BE-06 | بالا | `auth/strategy/jwt.strategy.ts`: JWT_SECRET نیز در سطح module خوانده می‌شود؛ همان ریسک ترتیب بارگذاری محیط را دارد. این مورد جداگانه با bootstrap کامل آزمایش نشده است. |
| BE-07 | بالا | `polling.repository.ts:getChatContentsById`: شرط `some(unreadItem.id !== item.id)` به‌جای حذف شناسه‌های unread است؛ با حداقل دو unread تقریباً همهٔ پیام‌ها باقی می‌مانند. فرانت فعلی فقط chats را render می‌کند و unreadMessages را نادیده می‌گیرد. |
| BE-08 | بالا | `polling.repository.ts:getAllUserChats`: فیلتر ثابت `chatId: 1` در شمارش پیام‌ها؛ چت‌های دیگر شمارش نادرست می‌گیرند. مسیر socket این فیلتر را ندارد. |
| BE-09 | بالا | خواندن تاریخچه و unread، همهٔ unreadها را حتی خارج از صفحهٔ بارگیری‌شده read می‌کند؛ GET نوشتن دارد و «دیده‌شدن واقعی» مبنا نیست. شمارش بعضی مسیرها پیام‌های خود فرد را نیز شامل می‌شود. |
| BE-10 | بالا | `polling.repository.ts:createChat`: برای بیش از دو عضو فقط `data: 'newChat'` برمی‌گرداند و گروهی نمی‌سازد؛ برای کمتر از دو عضو خروجی مشخصی ندارد. |
| BE-11 | متوسط | جست‌وجوی existing direct chat و create اتمیک نیستند؛ unique برای زوج گفت‌وگوی دونفره وجود ندارد و ساخت همزمان می‌تواند چت تکراری بدهد. |
| BE-12 | بالا | `signin-user.service.ts`: اگر user دارای email ولی password=null باشد، بررسی رمز رد می‌شود و توکن صادر می‌شود؛ شرط باید سناریوی حساب بدون رمز را صریحاً رد کند. دسترس‌پذیری چنین حسابی به داده/مسیر ویرایش وابسته است. |
| BE-13 | متوسط | tokenها قابل ابطال نیستند؛ logout فقط cookie را پاک می‌کند؛ refresh rotation/session store نیست؛ JWT_REFRESH_SECRET در Joi اجباری نشده؛ ورودی refresh و OTP DTO کلاس‌دار ندارند. |
| BE-14 | متوسط | OTP با Math.random ساخته، به‌صورت متن ذخیره و در console چاپ می‌شود؛ ارسال واقعی نیست؛ محدودیت تلاش اختصاصی و مصرف اتمیک کد وجود ندارد؛ cooldown از relation بدون orderBy آخرین مورد را فرض می‌کند. |
| BE-15 | متوسط | `app.module.ts` یک PrismaClient مستقل برای ChatService می‌سازد؛ PrismaService بقیهٔ مسیرها URI دیگری را override می‌کند. چند pool و رفتار تنظیماتی متفاوت؛ lifecycle صریح connect/disconnect ندارد. |
| BE-16 | متوسط | pagination اجازهٔ page=0/limit=0 می‌دهد ولی repository با `||` آن‌ها را پیش‌فرض می‌کند؛ سقف 99999 و default 500؛ unreadها بدون pagination‌اند. |
| BE-17 | متوسط | `update-profile.service.ts` خطا را در catch خالی می‌بلعد؛ `user.repository.ts:findById` دارای `throw error` با tagged template خالی است و خطای اصلی را به خطای دیگری تبدیل می‌کند؛ profile.update برای پروفایل موجود فرض شده است. |
| BE-18 | متوسط | شکل پاسخ و استثناها یکسان نیست؛ خطاهای سرویس در چند محل متن داخلی را منتشر می‌کنند؛ محدودیت طول content و DTO زندهٔ معتبر دیده نشد. |
| BE-19 | توسعه | فهرست‌ها بر اساس زمان ساخت چت مرتب‌اند، نه آخرین فعالیت؛ index صریح مناسب `(chatId,createdAt,id)` برای تاریخچه نیست؛ ترتیب فقط createdAt برای pagination همزمان پایدار نیست. |
| BE-20 | توسعه | جست‌وجو بدون pagination و خروجی اطلاعات تماس/آدرس پروفایل است؛ دامنهٔ قابل‌مشاهده‌بودن اطلاعات باید بر اساس نیاز محصول تعیین شود. |

## بررسی‌های انجام‌شده

- `tsc --noEmit --incremental false` با Node 22: موفق؛ در این درخواست دوباره بررسی شد.
- در مرحلهٔ بررسی محیط همین گفتگو، اتصال مستقیم psql به `localhost:5432/test_realtime` با تنظیم read-only موفق بود: PostgreSQL 16.11؛ هفت جدول برنامه و `_prisma_migrations`؛ هر پنج migration finished و بدون rollback بودند. این نتیجه مربوط به همان زمان است، نه پایش زنده.
- در همان مرحله، تطابق DB_* با POSTGRES_DATABASE_URL تأیید و capture شدن undefined پیش از dotenv بازتولید شد. اتصال مستقیم سالم، سلامت bootstrap برنامه را تضمین نمی‌کند.
- تست e2e موجود هنوز `/` و `Hello World!` را انتظار دارد، در حالی که controller مربوطه در app وجود ندارد؛ تست چت/مجوزها موجود نیست. تستی که داده ایجاد کند اجرا نشد.
- build، lint اصلاح‌کننده، migration، seed، نصب پکیج و درخواست نوشتنی انجام نشد.

## راهنمای ادامهٔ کار

ابتدا قرارداد auth و هویت socket، مجوز دسترسی پیام و ترتیب بارگذاری config تثبیت شود؛ سپس پاسخ تاریخچه/unread، رسید خواندن و فهرست چت یکسان شوند. این ترتیب مانع می‌شود مشکلات بک‌اند به اشتباه فقط ایراد فرانت تلقی شوند.

پیش از قابلیت‌های آینده، دربارهٔ شکل canonical پیام، شناسهٔ موقت ارسال، ack/retry بدون تکرار، تعریف delivered/read، pagination و رفتار reconnect تصمیم مشترک لازم است. موارد گروه، فایل، حضور آنلاین، ویرایش/حذف، جست‌وجوی پیام و تماس هنوز نیاز به طراحی دارند؛ افزودنشان در این درخواست مجاز یا انجام نشده است.

سناریوهای مناسب برای مرحلهٔ اصلاح: دو کاربر در دو مرورگر؛ تعویض چت با چند unread؛ read receipt؛ قطع و وصل؛ خروج و ورود کاربر دیگر؛ دسترسی غیرعضو؛ ارسال همزمان و بازگشت به تاریخچه. آزمون‌های دسترسی باید با دادهٔ آزمایشی انجام شوند.
