"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ControlRoom from "@/components/ControlRoom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const AUTH_KEY = "ligr:admin-auth";

export default function SportAdminPage() {
  const params = useParams<{ sport?: string | string[] }>();
  const sport = Array.isArray(params?.sport) ? params.sport[0] : (params?.sport ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");

  // Restore session from localStorage on page load/refresh
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(AUTH_KEY);
      if (stored === "true") {
        setIsAuthenticated(true);
      }
    }
  }, []);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (username === "Karpot-TV" && password === "admin") {
      setIsAuthenticated(true);
      setError("");
      setUsername("");
      setPassword("");
      if (typeof window !== "undefined") {
        localStorage.setItem(AUTH_KEY, "true");
      }
      return;
    }

    setError("Virheellinen käyttäjätunnus tai salasana.");
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_KEY);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-5rem)] bg-gradient-to-br from-blue-50 to-indigo-100 p-6 text-gray-900">
        <div className="mx-auto mt-16 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-gray-900">Kirjaudu</h1>
          <p className="mt-2 text-sm text-gray-600">Anna tunnukset päästäksesi admin-näkymään.</p>

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <Input
              placeholder="Käyttäjätunnus"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <Input
              type="password"
              placeholder="Salasana"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              Kirjaudu sisään
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return <ControlRoom sport={sport} onLogout={handleLogout} />;

}
