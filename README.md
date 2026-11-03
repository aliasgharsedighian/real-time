# Real-time chat

فرانت اصلی پروژه **React + Vite در [`frontend/`](frontend/README.md)** است. هر درخواست تغییر فرانت یا UX به‌صورت پیش‌فرض روی همین پوشه اعمال می‌شود. `nextjs-frontend/` فقط بکاپ موقت است؛ حذف آن به درخواست صریح بعدی موکول شده است.

- بک‌اند: `backend/` — NestJS، PostgreSQL و Prisma؛ اجرا مستقل از فرانت.
- فرانت: `frontend/` — React، TypeScript، React Router، Tailwind و shadcn/ui؛ پورت توسعه 3003.
- مراجع فعلی: [فرانت اصلی](docs/frontend-context.md) و [بک‌اند](docs/backend-context.md). [بررسی تاریخی Next.js](docs/nextjs-frontend-context.md) فقط برای رجوع به بکاپ است.

```bash
cd frontend
npm install
npm run dev
```

پیش‌نیاز Node و تنظیم مقصد API، ساختار پوشه‌ها، مسیرهای محافظت‌شده، build/test و تنظیم SPA در production در [راهنمای فرانت](frontend/README.md) آمده است.
