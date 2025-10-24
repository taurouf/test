import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import LoginPage from "./pages/LoginPage.jsx";
import RequireAuth from "./pages/RequireAuth.jsx";
import QuickTestPage from "./pages/QuickTestPage.jsx";
import OrderPage from "./pages/OrderPage.jsx";
import AdminWhitelistPage from "./pages/AdminWhitelistPage.jsx";
import AdminWhitelistProdPage from "./pages/AdminWhitelistProdPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/quick" replace />} />
        <Route
          path="/advanced"
          element={
            <RequireAuth>
              <OrderPage />
            </RequireAuth>
          }
        />
        <Route
          path="/quick"
          element={
            <RequireAuth>
              <QuickTestPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/whitelist"
          element={
            <RequireAuth>
              <AdminWhitelistPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/whitelist/production"
          element={
            <RequireAuth>
              <AdminWhitelistProdPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/quick" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
