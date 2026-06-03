import { notFound } from "next/navigation";
import { DepositApp } from "./DepositApp";

// Feature-flagged via NEXT_PUBLIC_FEATURE_TURTLE_DEPOSIT. When the flag is anything
// other than "true", this route 404s and the deposit embed never reaches users —
// keeping `main` and the live site clean until the flag is flipped.
export default function DepositPage() {
  if (process.env.NEXT_PUBLIC_FEATURE_TURTLE_DEPOSIT !== "true") {
    notFound();
  }
  return <DepositApp />;
}
