"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();

  const sports = [
    { key: "jalkapallo", label: "Jalkapallo" },
    { key: "salibandy", label: "Salibandy" },
    { key: "koripallo", label: "Koripallo" },
  ];

  const isAdminPage = pathname.includes("/admin");
  const isHomePage = pathname === "/";
  const isBroadcastRoute = pathname.startsWith("/overlay") || pathname.startsWith("/livescore");

  if (isBroadcastRoute) {
    return null;
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center gap-4">
            <Image src="/karpot-tv.svg" alt="Karpot-TV" width={140} height={40} priority />
          </Link>
          <nav className="flex space-x-4">
            <Link href="/" className="text-gray-600 hover:text-gray-900">Etusivu</Link>
            <Link href="/?tab=stats" className="text-gray-600 hover:text-gray-900">Tilastot</Link>
            {/* Kirjaudu-linkki poistettu */}
            {!isHomePage && (
              <Link href={`/${sports[0].key}/admin`} className="text-gray-600 hover:text-gray-900">Admin</Link>
            )}
            {isAdminPage && sports.map((sport) => (
              <Link
                key={sport.key}
                href={`/${sport.key}/admin`}
                className="text-gray-600 hover:text-gray-900"
              >
                {sport.label}
              </Link>
            ))}
          </nav>
        </div>
        {isAdminPage && (
          <div className="flex items-center space-x-4">
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
              value={pathname.split("/")[1]}
              onChange={(e) => router.push(`/${e.target.value}/admin`)}
            >
              {sports.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <button className="text-gray-600 hover:text-gray-900">Asetukset</button>
          </div>
        )}
      </div>
    </header>
  );
}