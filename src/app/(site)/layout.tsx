import type { ReactNode } from "react";
import { AccountProvider } from "@/web/account-context";
import { SiteHeader } from "@/web/site-header";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <AccountProvider>
      <SiteHeader />
      {children}
    </AccountProvider>
  );
}
