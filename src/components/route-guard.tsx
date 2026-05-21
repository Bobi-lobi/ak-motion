"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/components/app-provider";

export function RouteGuard({ adminOnly = false, children }: { adminOnly?: boolean; children: React.ReactNode }) {
  const { ready, session } = useApp();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (adminOnly && session.role !== "admin") {
      router.replace("/calendar");
    }
  }, [adminOnly, pathname, ready, router, session]);

  if (!ready || !session || (adminOnly && session.role !== "admin")) {
    return <main className="center-screen">Lade Berechtigungen...</main>;
  }

  return children;
}
