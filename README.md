# Real-time chat

فرانت فعال پروژه از این مرحله **React + Vite در [`frontend/`](frontend/README.md)** است. توسعهٔ جدید فرانت در همین پوشه انجام می‌شود؛ `nextjs-frontend/` فقط به‌عنوان نسخهٔ قبلی نگه داشته شده است.

- بک‌اند: `backend/` — NestJS، PostgreSQL و Prisma؛ اجرا مستقل از فرانت.
- فرانت: `frontend/` — React، TypeScript، React Router، Tailwind و shadcn/ui؛ پورت توسعه 3003.
- اسناد بررسی: [`docs/backend-context.md`](docs/backend-context.md) و [`docs/nextjs-frontend-context.md`](docs/nextjs-frontend-context.md).

```bash
cd frontend
npm install
npm run dev
```

پیش‌نیاز Node و تنظیم مقصد API، ساختار پوشه‌ها، مسیرهای محافظت‌شده، build/test و تنظیم SPA در production در [راهنمای فرانت](frontend/README.md) آمده است.
