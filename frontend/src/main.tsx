import ReactDOM from "react-dom/client";
import { v4 as uuidv4 } from "uuid";
import App from "./App.tsx";
import "./index.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { NotFound } from "./components/NotFound.tsx";

function getCookie(name: string) {
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return cookie ? cookie.split("=")[1] : null;
}

document.addEventListener("DOMContentLoaded", () => {
  const userId =
    localStorage.getItem("opengpts_user_id") ||
    getCookie("opengpts_user_id") ||
    uuidv4();

  // Push the user id to localStorage in any case to make it stable
  localStorage.setItem("opengpts_user_id", userId);
  // Ensure the cookie is always set (for both new and returning users)
  const weekInMilliseconds = 7 * 24 * 60 * 60 * 1000;
  const expires = new Date(Date.now() + weekInMilliseconds).toUTCString();
  document.cookie = `opengpts_user_id=${userId}; path=/; expires=${expires}; SameSite=Lax;`;
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // data stays fresh for 30s — no refetch during that window
      cacheTime: 5 * 60_000,    // keep cache for 5 min after component unmount
      refetchOnWindowFocus: false,  // don't refetch every time user clicks the window
      refetchOnReconnect: false,    // don't refetch on network reconnect
      retry: 1,                     // only retry once on error
    },
  },
});

import { Login } from "./components/Login.tsx";
import { AcceptInvite } from "./components/AcceptInvite.tsx";
import { PlanSelection } from "./components/PlanSelection.tsx";
import { PurchaseHistory } from "./components/PurchaseHistory.tsx";
import { WrongPage } from "./components/WrongPage.tsx";
import { Navigate, Outlet } from "react-router-dom";

// Decode JWT payload without verifying signature (client-side only, for UI guards)
function getJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Payload = token.split(".")[1];
    const decoded = atob(base64Payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// A simple PrivateRoute that checks for the presence of our auth_token
// For admin routes, it also verifies the is_admin claim in the JWT payload.
function PrivateRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const token = localStorage.getItem("auth_token");

  if (!token) {
    const loginPath = adminOnly ? "/admin/login" : "/login";
    return <Navigate to={loginPath} replace />;
  }

  if (adminOnly) {
    const payload = getJwtPayload(token);
    if (!payload?.is_admin) {
      return <WrongPage />;
    }
  }

  return <Outlet />;
}

import { ThemeProvider } from "./components/ThemeProvider.tsx";
import { ToastProvider } from "./components/Toast.tsx";

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (response.status === 401) {
    const isAdmin = window.location.pathname.startsWith("/admin");
    const loginPath = isAdmin ? "/admin/login" : "/login";
    
    if (window.location.pathname !== loginPath) {
      localStorage.removeItem("auth_token");
      window.location.href = loginPath;
    }
  }
  return response;
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="surtn-ui-theme">
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/admin/login" element={<Login isAdminLogin={true} />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />

              <Route element={<PrivateRoute />}>
                <Route path="/plan" element={<PlanSelection />} />
                <Route path="/billing/history" element={<PurchaseHistory />} />
                <Route path="/thread/:chatId" element={<App />} />
                <Route
                  path="/assistant/:assistantId/edit"
                  element={<App edit={true} />}
                />
                <Route path="/assistant/:assistantId" element={<App />} />
                <Route path="/" element={<App />} />
              </Route>

              <Route element={<PrivateRoute adminOnly={true} />}>
                <Route path="/admin" element={<App admin={true} />} />
                <Route path="/admin/assistant/:assistantId" element={<App admin={true} />} />
                <Route path="/admin/chat-with-kb/:assistantId" element={<App admin={true} />} />
                <Route path="/admin/thread/:chatId" element={<App admin={true} />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </QueryClientProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
