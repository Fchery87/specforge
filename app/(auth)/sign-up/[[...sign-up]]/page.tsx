import { SignUp } from "@clerk/nextjs";
import { clerkAuthAppearance } from "@/lib/clerk-theme";

export default function Page() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-grid-auth p-4">
      <SignUp
        appearance={clerkAuthAppearance}
      />
    </div>
  );
}
