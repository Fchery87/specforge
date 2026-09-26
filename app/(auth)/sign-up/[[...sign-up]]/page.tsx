import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { clerkAuthAppearance } from "@/lib/clerk-theme";
import { SpecForgeLogo } from "@/components/ui/logo";

export default function Page() {
  return (
    <div className="flex min-h-[calc(100vh-var(--header-height))] flex-col items-center justify-center px-5 py-16">
      <Link
        href="/"
        className="mb-8 flex items-center rounded-sm"
        aria-label="SpecForge home"
      >
        <SpecForgeLogo size="md" />
      </Link>

      <SignUp appearance={clerkAuthAppearance} />

      <p className="mt-8 max-w-sm text-center text-label leading-relaxed text-dim">
        Start with a title and a paragraph. SpecForge asks what it needs to know before it writes
        anything. By continuing you agree to the{" "}
        <Link href="/terms" className="text-ember hover:underline">
          terms
        </Link>{" "}
        and the{" "}
        <Link href="/privacy" className="text-ember hover:underline">
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
