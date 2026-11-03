import { lazy, Suspense } from "react";
import { Outlet, type RouteObject } from "react-router-dom";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import HomePage from "@/pages/HomePage";

const ChatLayout = lazy(() => import("./layouts/ChatLayout"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const ProfilePage = lazy(() => import("@/features/profile/ProfilePage"));
const ChatPage = lazy(() => import("@/features/chat/ChatPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

function RouteBoundary() {
  return (
    <Suspense
      fallback={
        <div role="status" className="grid min-h-[60dvh] place-items-center">
          Loading…
        </div>
      }
    >
      <Outlet />
    </Suspense>
  );
}

export const routes: RouteObject[] = [
  {
    element: <RouteBoundary />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/login", element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "/dashboard",
            element: <ChatLayout />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: "profile", element: <ProfilePage /> },
              { path: "websocket/:chatId", element: <ChatPage /> },
              { path: "*", element: <NotFoundPage /> },
            ],
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
