import type { Metadata } from "next";
import { Toaster } from "sonner";
import { signOut } from "@/app/agency/actions";
import { Sidebar, type SidebarNavItem } from "@/components/admin/sidebar";
import { BrandMark, buttonStyles } from "@/components/admin/ui";
import { requireAgencyPage } from "@/lib/auth/agency";

// Never cached, and never prerendered. Authentication already forces this
// (the session is read from cookies), but stating it explicitly means a
// future refactor cannot quietly make an authenticated dashboard cacheable.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Agency workspace", template: "%s · Agency" },
  robots: { index: false, follow: false },
};

const AGENCY_NAV: SidebarNavItem[] = [
  {
    href: "/agency",
    label: "Dashboard",
    icon: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z",
    match: "exact",
  },
  {
    href: "/agency/products",
    label: "Products",
    icon: "M3.5 8.5 12 4l8.5 4.5v7L12 20l-8.5-4.5v-7Zm0 0L12 13l8.5-4.5M12 13v7",
    match: "prefix",
  },
  {
    href: "/agency/reviews",
    label: "Reviews",
    icon: "M12 17.3 6.2 20.5l1.1-6.5L2.5 9.3l6.5-.9L12 2.5l3 5.9 6.5.9-4.8 4.7 1.1 6.5Z",
    match: "prefix",
  },
  {
    href: "/agency/guides",
    label: "Guides",
    icon: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z",
    match: "prefix",
  },
  {
    href: "/agency/articles",
    label: "Articles",
    icon: "M4 6h16M4 12h16M4 18h10",
    match: "prefix",
  },
  {
    href: "/agency/comparisons",
    label: "Comparisons",
    icon: "M8 4v16M16 4v16M4 9h4M16 9h4M4 15h4M16 15h4",
    match: "prefix",
  },
];

const ROLE_LABEL: Record<string, string> = {
  agency_admin: "Agency admin",
  content_editor: "Content editor",
  seo_editor: "SEO editor",
};

export default async function AgencyLayout({ children }: LayoutProps<"/agency">) {
  const session = await requireAgencyPage();

  if (session.state === "no-access") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="flex justify-center">
            <BrandMark />
          </div>
          <h1 className="mt-10 font-display text-3xl text-ink">Agency access only</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
            {session.email ?? "This account"} is signed in
            {session.role ? ` with the ${session.role.replace("_", " ")} role` : " but hasn't been assigned a role yet"}.
            This area is limited to agency accounts.
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
      <Sidebar email={session.email} roleLabel={ROLE_LABEL[session.role] ?? "Agency"} nav={AGENCY_NAV} signOutAction={signOut} />
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
