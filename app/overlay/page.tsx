import { Suspense } from "react";
import Overlay from "@/components/Overlay";

export const dynamic = "force-dynamic";

export default function OverlayPage() {
  return (
    <Suspense fallback={null}>
      <Overlay />
    </Suspense>
  );
}
