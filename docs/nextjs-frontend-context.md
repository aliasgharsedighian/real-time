# آرشیو بررسی بکاپ Next.js

> این سند بررسی تاریخی `nextjs-frontend/` پیش از مهاجرت است. نسخهٔ اصلی اکنون React + Vite در `frontend/` است و تمام درخواست‌های فرانت به‌صورت پیش‌فرض روی آن اعمال می‌شوند. برای ادامهٔ کار [مرجع فرانت اصلی](frontend-context.md) را بخوانید. Next.js فعلاً فقط بکاپ است و حذف آن به درخواست بعدی موکول شده است.

تاریخ بررسی: ۲۰۲۶-۱۱-۰۳ — مبنای Git: `1785456` به‌علاوهٔ تغییرات موجود در working tree.

این سند وضعیت نسخهٔ قبلی در زمان بررسی اولیه را ثبت می‌کند. سند همراه: [بک‌اند](backend-context.md).

## هدف، دامنه و محدودیت بررسی

در بررسی اولیه، هدف `nextjs-frontend/` بود. همهٔ صفحه‌ها، layoutها، componentها، hookها، storeها، utilityها، CSS، middleware و تنظیمات آن فولدر خوانده شدند؛ نسخه‌های lockfile و فهرست assetها بررسی شدند. dependencyها و خروجی `.next` کد برنامه محسوب نشده‌اند؛ assetهای تصویری صرفاً فهرست شدند. این بررسی توصیف نسخهٔ React فعلی در `frontend/` نیست.

این بررسی عمدتاً استاتیک است؛ نتیجهٔ TypeScript جداگانه ثبت شده است. رفتار مرورگر، ظاهر موبایل، hydration و سناریوی واقعی دوکاربره هنوز آزمایش نشده‌اند. موارد قطعی کد از ریسک‌های نیازمند بازتولید تفکیک شده‌اند. رمزها و مقادیر حساس محیط در سند نیستند.

پس از این بررسی، مهاجرت به React مستقل انجام شد. یادداشت‌های مهاجرت و ترتیب پیشنهادی انتهای این سند مربوط به قبل از انتقال‌اند؛ وضعیت و برنامهٔ جاری از سند فرانت اصلی و کد `frontend/` خوانده شود.

## فناوری و اجرا

| مورد | وضعیت |
| --- | --- |
| چارچوب | Next.js 15.5.2، App Router، React 19.1.0 |
| زبان | TypeScript؛ lockfile برابر 5.9.2؛ strict فعال |
| UI | Tailwind 4، shadcn با style new-york، Radix، Lucide، Sonner |
| فرم | React Hook Form، Zod 4 و resolver |
| دادهٔ سرور | TanStack Query 5.87.1؛ هم fetch مستقیم و هم Axios |
| وضعیت محلی | Zustand 5.0.8، persist در localStorage برای auth |
| زنده | socket.io-client 4.8.1؛ singleton، transport فقط websocket |
| توسعه | `npm run dev` → `next dev --turbopack -p 3003` |
| build/start | `next build --turbopack` و `next start`؛ start پورت 3003 را در script تعیین نمی‌کند |

README هنوز متن قالب و پورت 3000 دارد. next.config هم lint و هم خطای TypeScript را در build نادیده می‌گیرد؛ موفق‌شدن build به‌تنهایی شاهد سلامت نیست. Redux Toolkit/react-redux/redux-persist در dependencies هستند ولی در کد برنامهٔ بررسی‌شده provider/store یا استفادهٔ فعال ندارند.

## نقشهٔ صفحات

| مسیر مرورگر | فایل نسبت به `nextjs-frontend/` | رفتار |
| --- | --- | --- |
| `/` | `app/page.tsx` | landing با Header، modal ورود/ثبت‌نام و FeatureCard |
| `/dashboard` | `app/(signed-in)/dashboard/page.tsx` | حالت هیچ چتی انتخاب نشده |
| `/dashboard/profile` | `app/(signed-in)/dashboard/profile/page.tsx` | ویرایش firstname/lastname |
| `/dashboard/websocket/:chatId` | `app/(signed-in)/dashboard/websocket/[chatId]/page.tsx` | تاریخچه، bubble، composer، socket و typing |
| ناموجود | `app/not-found.tsx` | placeholder ساده |

`(signed-in)` فقط route group است؛ نام آن خودش دسترسی را محدود نمی‌کند. layout این گروه SidebarProvider، AppSidebar، header و ChatDetailHeader را می‌سازد. middleware روی dashboard و login کار می‌کند، ولی صفحهٔ `/login` در کد فعلی نیست؛ ورود در modal صفحهٔ خانه است.

RootLayout فونت Geist/Geist Mono، metadata قالب، Toaster و QueryClientProvider را اضافه می‌کند. صفحهٔ اصلی server component است ولی تعاملات چت و حساب client component هستند. API route، server action یا BFF در کد برنامه دیده نشد؛ مرورگر مستقیم با بک‌اند مستقل ارتباط دارد.

## نقشهٔ componentها و وضعیت

| محل | مسئولیت |
| --- | --- |
| `components/AuthButton.tsx` | فرم‌های ورود/ثبت‌نام، دریافت token و سپس user-info |
| `components/Header.tsx` | لینک dashboard و کنترل نشست هنگام mount/تغییر pathname |
| `components/UserButton.tsx` | popover حساب، لینک پروفایل و خروج |
| `components/app-sidebar.tsx` | دریافت فهرست چت، جست‌وجوی ایمیل، انتخاب مخاطب و ساخت چت |
| `dashboard/components/ChatDetailHeader.tsx` | عنوان چت و typing از Zustand |
| `dashboard/websocket/components/ChatLoading.tsx` | skeleton تاریخچه |
| `components/ui/*` | primitiveهای Radix/shadcn؛ sidebar شامل حالت موبایل Sheet و میانبر Ctrl/Cmd+B |
| `components/utils/*` | تاریخ محلی و capitalize نام‌ها |
| `lib/api.ts` | Axios با baseURL و withCredentials |
| `lib/socket.ts` | ایجاد singleton socket بدون auth و lifecycle صریح |
| `app/components/providers/providers.tsx` | یک QueryClient در طول عمر provider |

### وضعیت auth

store فعال `store/useAuthStore.ts` است: token، user، isLoggedIn، setToken، setUser، login، logout و updateProfile؛ با کلید `auth-storage` ذخیره می‌شود. نوع token دارای `any` است. رابطهٔ profile و بعضی رشته‌ها برخلاف schema بک‌اند non-null فرض شده‌اند.

یک store دیگر در ریشه با نام `useAuthStore.ts` و کلید `auth` وجود دارد؛ امضای login آن متفاوت است. import فعال از این نسخه در مصرف‌کننده‌های فعلی پیدا نشد. نباید در اصلاح بعدی این دو را اشتباه گرفت.

### وضعیت چت

`store/useChatStore.ts` فقط currentChatId، currentOpenUserDetail و typingUsers را نگه می‌دارد؛ پیام‌ها دیگر در آن نیستند. صفحهٔ فعال از Query cache با کلید `["chat", chatId, "messages"]` استفاده می‌کند. AppSidebar فهرست را در useState محلی نگه می‌دارد؛ بنابراین cache مشترکی برای فهرست و اتاق وجود ندارد.

## جریان auth و قرارداد فعلی

1. AuthButton با React Hook Form/Zod فرم را بررسی می‌کند. ثبت‌نام role=USER می‌فرستد.
2. ورود از `data.accessToken` و ثبت‌نام از `data.token.accessToken` می‌خوانند؛ refreshToken ذخیره یا استفاده نمی‌شود.
3. accessToken در Zustand ثبت می‌شود؛ پس از timeout یک‌ثانیه‌ای، user-info با Bearer درخواست و سپس login store اجرا می‌شود. navigation خودکار به dashboard در این تابع وجود ندارد.
4. بک‌اند فقط در signin، cookie به نام token با HttpOnly و sameSite=strict تنظیم می‌کند؛ signup این cookie را تنظیم نمی‌کند.
5. middleware تنها وجود cookie در origin فرانت را می‌سنجد، نه اعتبار JWT. token در localStorage از دید middleware پنهان است. اگر بک‌اند و فرانت host متفاوت داشته باشند، cookie بک‌اند لزوماً به فرانت نمی‌رسد.
6. Header با document.cookie و localStorage کلید token نشست را چک می‌کند؛ cookie HttpOnly از JS خوانده نمی‌شود و کلید persist واقعی auth-storage است. این شروط با جریان واقعی ورود سازگار نیستند.
7. خروج تنها پس از موفقیت API، token/user را خالی می‌کند و به `/` می‌رود؛ query cache، وضعیت چت و singleton socket پاک/قطع نمی‌شوند. خطای خروج بازخورد ندارد.

تنظیمات `.env` و `.env.local` فعلی API و socket را به host راه‌دور با پورت 3333 می‌برند؛ این فرانت فعلاً به بک‌اند localhost اشاره نمی‌کند. نام متغیرها: NEXT_PUBLIC_API_ADDRESS، NEXT_PUBLIC_WS_URL و SERVER_ADDRESS. مورد آخر در کد فعال بررسی‌شده مصرفی ندارد. baseURL به slash پایانی API_ADDRESS وابسته است.

## جریان فعال چت

1. AppSidebar هنگام آماده‌شدن user.id رویداد `chat:list` می‌فرستد و پاسخ را در state محلی می‌گذارد؛ دریافت لیست در این component polling نیست.
2. ساخت چت با POST `realtime/polling/create-chat` انجام می‌شود و UI به شناسهٔ پاسخ navigate می‌کند. سایدبار پس از آن لیست را دوباره درخواست نمی‌کند.
3. صفحهٔ اتاق GET `realtime/polling/:chatId?page=1&limit=100` می‌زند؛ خروجی query یک object با chats، users، unreadMessages و unreadCount است، نه Message[].
4. effect به room می‌پیوندد و listenerهای message:new و typing را نصب می‌کند؛ cleanup درخواست leave می‌فرستد و listenerها را برمی‌دارد.
5. message:new به `old.chats` append می‌شود؛ deduplication ندارد؛ سپس markAllRead فراخوانی می‌شود.
6. ارسال با message:send شامل senderId است؛ input فوراً خالی می‌شود و scroll با timeout انجام می‌شود؛ ack، optimistic state و retry وجود ندارد.
7. صفحه فقط messages.chats را render می‌کند؛ unreadMessages پاسخ جداگانه نمایش داده نمی‌شود. تاریخچهٔ بیشتر از ۱۰۰ مورد در این صفحه بارگذاری نمی‌شود.
8. برای readStatuses فقط render اولیه وجود دارد؛ صفحهٔ فعال listener مربوط به message:read ندارد.

### hookهای باقی‌مانده و استفاده‌نشده

| hook | وضعیت در کد فعلی |
| --- | --- |
| `useAllChats` در `hooks/useChats.ts` | polling هر سه ثانیه با کلید Allchats؛ مصرف فعال بیرون تعریف پیدا نشد |
| `useGetChatById`, `usePollUnreadMessages` | مسیر قدیمی pagination/polling؛ به actions حذف‌شدهٔ store پیام وابسته؛ مصرف فعال پیدا نشد ولی TypeScript آن‌ها را بررسی می‌کند |
| `useChatSocket` | مصرف فعال پیدا نشد؛ روی همان کلید صفحه، Message[] فرض می‌کند و با object صفحه سازگار نیست؛ read handler خالی است |
| `useCreateChat`, `useSearchContact`, `useSignin`, `useSignup`, `useUpdateProfile`, `logoutUser` | در UI فعلی استفاده می‌شوند؛ آخری نام hook استاندارد ندارد |

## یافته‌های کدی برای اصلاح بعدی

| شناسه | اولویت | شاهد و اثر |
| --- | --- | --- |
| FE-01 | بالا | `Header.tsx`: بررسی cookie HttpOnly و کلید اشتباه localStorage باعث پاک‌شدن نشست در mount/تغییر مسیر Header می‌شود؛ تعامل hydration نیز باید در مرورگر بازتولید شود. |
| FE-02 | بالا | `middleware.ts` و auth: cookie/localStorage و تفاوت signup/signin با هم سازگار نیستند؛ دسترسی dashboard می‌تواند با وجود token محلی مسدود شود. وابسته به origin استقرار نیز هست. |
| FE-03 | بالا | صفحهٔ chat، `markAllRead`: روی object خروجی query، `messages.map` صدا می‌زند؛ با دادهٔ بارگذاری‌شده TypeError رخ می‌دهد و receipt emit انجام نمی‌شود. |
| FE-04 | بالا | `useGetChatById.ts`: سه ارجاع به messages/setMessages/addMessage که در ChatState نیستند؛ TypeScript فعلی شکست می‌خورد. |
| FE-05 | بالا | `next.config.ts`: ignoreBuildErrors و ignoreDuringBuilds فعال‌اند؛ خطاهای واقعی از مسیر build عبور می‌کنند. |
| FE-06 | بالا | سایدبار فقط یک snapshot می‌گیرد؛ listener برای message:new/read یا refresh پس از create ندارد؛ لیست، preview، شمارنده و ترتیب مکالمه کهنه می‌مانند. |
| FE-07 | بالا | صفحهٔ chat read receiptها را subscribe نمی‌کند؛ تغییر تیک پیام فرستنده از رویداد زنده منعکس نمی‌شود. |
| FE-08 | بالا | singleton socket بدون auth، قطع در logout، handler reconnect و rejoin است؛ پس از reconnect عضویت roomها باید دوباره برقرار شود ولی کد آن نیست؛ roomهای کاربر قبلی نیز ریسک باقی‌ماندن دارند. |
| FE-09 | بالا | send input را پیش از تأیید پاک می‌کند؛ هنگام قطع ارتباط/رد سرور، pending/failed/retry و بازگرداندن متن نیست؛ وضعیت واقعی تحویل از UI مشخص نیست. |
| FE-10 | متوسط | event handler پیام به closure اولیهٔ messages متکی است؛ حتی پس از اصلاح map، read IDs می‌توانند قدیمی باشند. cache append بدون dedupe و رقابت fetch اولیه با socket نیازمند سناریوی دوکاربره است. |
| FE-11 | متوسط | typingTimeout متغیر render است، ref نیست؛ رندر بعدی handle تایمر قبلی را از دست می‌دهد؛ cleanup تایمر و clearTypingUsers هنگام تعویض اتاق نیست؛ typing با نام به‌جای userId از خود فرد جدا می‌شود. |
| FE-12 | متوسط | `ChatDetailHeader`: شاخهٔ بیش از یک typingUser مقدار را return نمی‌کند؛ profile nullable را نیز ایمن نمی‌خواند. |
| FE-13 | متوسط | effect ثبت currentChatId با deps خالی و effect ثبت users فقط با isSuccess هستند؛ تغییر params/data لزوماً header/selection را تازه نمی‌کند؛ بازگشت از اتاق به پروفایل نیز state عنوان را پاک نمی‌کند. |
| FE-14 | متوسط | unreadMessages پاسخ در render لحاظ نمی‌شود؛ بک‌اند خودش فیلتر history/unread ناسازگار دارد؛ نشانهٔ unread در UI بر اساس length-unreadCount می‌تواند غلط شود. رجوع به BE-07 تا BE-09. |
| FE-15 | متوسط | fetchInitialMessages، res.ok را بررسی نمی‌کند؛ برای خطاهایی غیر از statusCode=404 ممکن است `{}` را دادهٔ موفق تلقی کند؛ chatId منفی/نامعتبر اعتبارسنجی صریح ندارد. |
| FE-16 | متوسط | query keyها هویت کاربر را ندارند و cache در logout پاک نمی‌شود؛ در ورود کاربر دیگر امکان نمایش موقت دادهٔ نشست قبلی وجود دارد. کلید hook قدیمی chatById حتی chatId ندارد. |
| FE-17 | متوسط | AppSidebar چند مخاطب را می‌پذیرد، ولی بک‌اند گروه را placeholder برمی‌گرداند؛ navigation به data.id برای آن قرارداد معتبر نیست. |
| FE-18 | متوسط | جست‌وجوی مخاطب responseهای خارج از ترتیب را کنترل نمی‌کند؛ ردیف «نتیجه‌ای نیست» با id خالی انتخاب‌پذیر است؛ callback به‌جای text ورودی از searchInput می‌خواند و بهتر است هنگام اصلاح صریح شود. |
| FE-19 | متوسط | profile defaultValues فقط هنگام ساخت فرم خوانده می‌شوند؛ reset پس از hydrate/تغییر user نیست؛ catch ذخیرهٔ پروفایل و logout خالی است؛ profile و firstname/lastname ممکن است null باشند. |
| FE-20 | UX | scroll هنگام ارسال با تأخیر ثابت و هنگام دریافت به‌صورت اجباری به پایین می‌رود؛ موقعیت کاربری که تاریخچه می‌خواند لحاظ نمی‌شود؛ key ردیف پیام index است؛ loading قدیمی‌تر و virtualization نیست. |
| FE-21 | UX | composer فقط Enter/Shift+Enter را بررسی می‌کند و composition ورودی را لحاظ نمی‌کند؛ دکمهٔ پیوست handler ندارد؛ دکمه‌های صرفاً آیکونی label روشن ندارند؛ موبایل/صفحه‌کلید نیازمند بررسی واقعی است. |
| FE-22 | UX | lang=en، متن‌های انگلیسی، RTL صرفاً utility و font IRANSans در textarea بدون تعریف فونت است؛ تصمیم زبان/جهت محصول هنوز لازم است؛ dark styles وجود دارند ولی ThemeProvider در root نیست و chat سفید ثابت است. |
| FE-23 | محصول | landing ادعای E2E encryption، گروه، اعداد کاربر/پیام و uptime دارد؛ شاهد پیاده‌سازی/اندازه‌گیری برای این ادعاها در کد نیست؛ نباید به‌عنوان قابلیت موجود مستند شوند. |

موارد بحرانی بک‌اند از جمله جعل شناسهٔ socket، ثبت‌نام با نقش ADMIN و دسترسی unread غیرعضو در سند بک‌اند ثبت شده‌اند؛ اصلاح صرف UI آن‌ها را برطرف نمی‌کند.

## بررسی اجرایی

فرمان زیر در فولدر فرانت و بدون emit اجرا شد:

```bash
/home/aliasghar/.nvm/versions/node/v22.19.0/bin/node node_modules/typescript/bin/tsc --noEmit --incremental false
```

خروجی سه خطای TS2339 در `hooks/useGetChatById.ts` بود: setMessages در خط ۱۰، messages در خط ۱۱ و addMessage در خط ۴۵. مصرف‌نشدن hookها مانع بررسی TypeScript نیست.

تست اختصاصی فرانت و script تست در package.json وجود ندارد. build کامل، مرورگر، نصب، تغییر source و تماس نوشتنی با API انجام نشد. پس این سند تأیید بصری UX یا کارکرد سرتاسری محصول نیست.

## یادداشت مهاجرت احتمالی از Next.js

این بخش تحلیل وابستگی‌های همین مخزن است، نه انتخاب قطعی ابزار یا برنامهٔ اجرایی مهاجرت. بیشتر UI فعلی React معمولی است و بک‌اند مستقل مانده است؛ بنابراین بخش بزرگی قابل استفادهٔ مجدد است.

| قابل نگه‌داشتن با بازبینی | نیازمند جایگزینی یا تصمیم |
| --- | --- |
| componentهای Radix/shadcn، Tailwind و utilityها | App Router، route group و nested layout با router مقصد |
| فرم‌های RHF/Zod و hookهای REST | next/link و next/navigation؛ redirect و صفحهٔ 404 |
| Zustand و TanStack Query پس از یکسان‌سازی داده | middleware با route guard کلاینت؛ مجوز واقعی همچنان در بک‌اند |
| Socket.IO پس از اصلاح auth/lifecycle | NEXT_PUBLIC_* و process.env با سازوکار محیط مقصد |
| محتوای landing و assetها پس از بازبینی | next/font/google، metadata، document root و تنظیمات build |
| توکن‌های CSS و الگوی sidebar موبایل | استقرار SPA با fallback مسیرهای عمیق، CORS و سیاست cookie |

ابتدا باید مشخص شود landing عمومی به SSR/SEO نیاز دارد یا خیر و مدل نشست روی چه originهایی اجرا می‌شود. امکان حفظ landing در Next و جداکردن app چت نیز صرفاً یک گزینهٔ آینده است. فولدر `frontend/` از قبل وجود دارد، اما در این بررسی مبنای مهاجرت یا آماده‌بودن آن تأیید نشده است؛ نباید بدون بررسی روی آن بازنویسی انجام داد.

پیش از مهاجرت، شکل واحد Chat/Message/HistoryResponse و cache، lifecycle اتصال، refresh/logout و تجربهٔ ارسال/خطا تثبیت شوند تا ناسازگاری‌های فعلی همراه کد منتقل نشوند. بهبود UXهایی مانند حفظ draft، scroll آگاه از موقعیت، حالت آفلاین و receipt مستقل از چارچوب هستند.

## مسیر پیشنهادی جلسات بعدی

1. انتخاب مدل auth مشترک با بک‌اند و رفع پاک‌شدن نشست و guardهای ناسازگار.
2. رفع TS و یکسان‌سازی قرارداد تاریخچه، پیام جدید و read؛ شناسایی کد قدیمی پیش از حذف احتمالی.
3. اتصال فهرست چت و اتاق به cache مشخص؛ refresh پس از create/send/read و logout کامل.
4. reconnect/rejoin، ack، pending/failed/retry و dedupe با قرارداد بک‌اند.
5. بازبینی UX در دو مرورگر و موبایل: scroll، unread، typing، composer، draft و خطاها.
6. پس از تثبیت رفتار، تصمیم دربارهٔ حفظ Next یا React مستقل و سپس افزودن قابلیت‌ها.

این ترتیب صرفاً مرجع ادامهٔ گفتگوست؛ در این مرحله هیچ‌یک از اصلاحات بالا اجرا نشده‌اند. در جلسات بعدی این سند و سند بک‌اند با کد روز تطبیق داده شوند، نه اینکه فرض شود این snapshot همیشه معتبر است.
