import type { Metadata } from "next";
import { Toaster } from "sonner";
import { signOut } from "@/app/admin/actions";
import { Sidebar } from "@/components/admin/sidebar";
import { BrandMark, buttonStyles } from "@/components/admin/ui";
import { requireOwnerPage } from "@/lib/auth/owner";

export const metadata: Metadata = {
  title: { default: "Owner dashboard", template: "%s · Owner" },
  robots: { index: false, follow: false },
};

export default async function OwnerLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireOwnerPage();

  if (session.state === "no-access") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="flex justify-center">
            <BrandMark />
          </div>
          <h1 className="mt-10 font-display text-3xl text-ink">Owner access only</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
            {session.email ?? "This account"} is signed in
            {session.role ? ` with the ${session.role.replace("_", " ")} role` : " but hasn't been assigned a role yet"}.
            This area is limited to the site owner.
          </p>
          <form action={signOut} className="mt-8">
            <button type="submit" className={buttonStyles.primary}>
              Sign out and switch account
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar email={session.email} />
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: "!rounded-xl !border !border-line !bg-surface !text-ink !shadow-pop !font-sans",
            description: "!text-ink-muted",
            actionButton: "!bg-brand-700 !text-white",
          },
        }}
      />
    </div>
  );
}
