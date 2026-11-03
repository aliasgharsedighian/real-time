import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { Providers } from "./app/providers";
import { routes } from "./app/router";
import "./styles/globals.css";
import { registerServiceWorker } from "@/shared/lib/register-service-worker";

registerServiceWorker();

const router = createBrowserRouter(routes);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
