import { headers } from "next/headers";
import Link from "next/link";
import { NavbarLogo } from "@/components/navbar-logo";
import { UserMenu } from "@/components/user-menu";
import { AssistantTrigger } from "@/features/assistant";
import { auth } from "@/lib/auth/auth";

export async function Navbar() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <header className="w-full border-b border-nav-border bg-nav-background text-white flex items-center justify-between pl-6 pr-4 h-16">
      <NavbarLogo />
      <nav
        className="ml-6 flex flex-1 items-center gap-2 text-sm"
        aria-label="Primary"
      >
        <Link
          href="/catalog"
          className="rounded-md px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white"
        >
          Catalog
        </Link>
        <Link
          href="/runtime/workloads"
          className="rounded-md px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white"
        >
          Runtime
        </Link>
      </nav>
      <div className="flex shrink-0 items-center h-full">
        {session?.user?.name && <UserMenu userName={session.user.name} />}
        <div className="mx-4 h-full w-px bg-nav-border" />
        <AssistantTrigger />
      </div>
    </header>
  );
}
