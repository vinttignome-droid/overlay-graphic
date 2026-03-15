import { NextResponse } from "next/server";
import { readServerStorage, writeServerStorage, type ServerStorageMap } from "@/lib/serverStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const normalizeEntries = (value: unknown): ServerStorageMap => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
    )
  );
};

export async function GET() {
  const entries = await readServerStorage();
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const type = typeof payload.type === "string" ? payload.type : "";

  if (type === "sync") {
    const entries = normalizeEntries(payload.entries);
    await writeServerStorage(entries);
    return NextResponse.json({ ok: true, entriesCount: Object.keys(entries).length });
  }

  if (type === "set") {
    const key = typeof payload.key === "string" ? payload.key : "";
    const value = typeof payload.value === "string" ? payload.value : "";
    if (!key) {
      return NextResponse.json({ ok: false, error: "Invalid key" }, { status: 400 });
    }

    const entries = await readServerStorage();
    entries[key] = value;
    await writeServerStorage(entries);
    return NextResponse.json({ ok: true });
  }

  if (type === "remove") {
    const key = typeof payload.key === "string" ? payload.key : "";
    if (!key) {
      return NextResponse.json({ ok: false, error: "Invalid key" }, { status: 400 });
    }

    const entries = await readServerStorage();
    delete entries[key];
    await writeServerStorage(entries);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unsupported operation" }, { status: 400 });
}
