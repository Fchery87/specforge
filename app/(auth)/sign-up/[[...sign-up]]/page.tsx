import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-grid-auth p-4">
      <SignUp
        appearance={{
          variables: {
            colorPrimary: "#DFE104",
            colorBackground: "#18181B",
            colorText: "#FAFAFA",
            colorTextSecondary: "#D4D4D8",
            colorInputBackground: "#27272A",
            colorInputText: "#FAFAFA",
            colorDanger: "#EF4444",
            borderRadius: "0px",
          },
          elements: {
            card: "border-2 border-primary/40 shadow-[0_0_40px_-8px_rgba(223,225,4,0.3)] bg-zinc-900/95 backdrop-blur-sm",
            headerTitle: "font-bold uppercase tracking-tighter text-2xl text-foreground",
            headerSubtitle: "text-zinc-400 font-medium",
            socialButtonsBlockButton: 
              "border-2 border-zinc-700 hover:border-primary/60 hover:bg-zinc-800 rounded-none text-zinc-200 font-bold uppercase tracking-wide transition-all focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-zinc-900",
            dividerLine: "bg-zinc-700",
            dividerText: "text-zinc-500 font-bold uppercase",
            formFieldLabel: "text-zinc-300 font-bold uppercase tracking-wide text-xs",
            formFieldInput: 
              "border-2 border-zinc-700 rounded-none focus:border-primary focus:ring-0 bg-zinc-800 text-foreground placeholder:text-zinc-500",
            formButtonPrimary: 
              "bg-primary text-black hover:bg-primary/90 rounded-none font-bold uppercase tracking-wide border-2 border-primary transition-all active:translate-y-0.5 shadow-[0_0_20px_-4px_rgba(223,225,4,0.4)]",
            footerActionText: "text-zinc-400",
            footerActionLink: "text-primary hover:text-primary/90 font-bold uppercase no-underline hover:underline",
            identityPreviewText: "text-zinc-200 font-bold",
            identityPreviewEditButton: "text-primary hover:text-primary/90 font-bold uppercase",
            formFieldWarningText: "text-amber-400",
            formFieldErrorText: "text-red-400 font-bold",
            alertText: "text-red-400 font-bold",
            formFieldInputShowPasswordButton: "text-zinc-400 hover:text-primary",
          },
          layout: {
            socialButtonsPlacement: "bottom",
            socialButtonsVariant: "blockButton",
          }
        }}
      />
    </div>
  );
}
