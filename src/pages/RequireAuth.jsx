import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

function RequireAuth({ children }) {
  const [ok, setOk] = useState(null);
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store" });
        const j = await r.json();
        if (alive) setOk(Boolean(j.authorized));
      } catch {
        if (alive) setOk(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (ok === null) {
    return (
      <div className="min-h-screen grid place-items-center text-[#082C49]/70">
        Vérification de la session…
      </div>
    );
  }
  if (!ok) return <Navigate to="/login" replace state={{ from: location }} />;

  return children;
}

export default RequireAuth;
