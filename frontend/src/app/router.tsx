import { lazy, Suspense } from "react";
import { Outlet, type RouteObject } from "react-router-dom";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import HomePage from "@/pages/HomePage";
import { BrandLoading } from "@/shared/components/BrandLoading";

const ChatLayout = lazy(() => import("./layouts/ChatLayout"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const ProfilePage = lazy(() => import("@/features/profile/ProfilePage"));
const ChatPage = lazy(() => import("@/features/chat/ChatPage"));
const CallsPage = lazy(() => import("@/features/calls/CallsPage"));
const CallPage = lazy(() => import("@/features/calls/CallPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

function RouteBoundary() {
  return (
    <Suspense
      fallback={
        <BrandLoading />
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
              { path: "calls", element: <CallsPage /> },
              { path: "calls/active", element: <CallPage /> },
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
