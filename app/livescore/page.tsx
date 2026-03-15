import { Suspense } from "react";
import Livescore from "@/components/Livescore";

export const dynamic = "force-dynamic";

export default function LivescorePage() {
  return (
    <Suspense fallback={null}>
      <Livescore />
    </Suspense>
  );
}
