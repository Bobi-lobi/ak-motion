"use client";

import clsx from "clsx";
import { BarChart3, CalendarDays, ClipboardList, FileText, LogOut, Package, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/components/app-provider";

const navItems = [
  { href: "/calendar", label: "Kalender", icon: CalendarDays, admin: false },
  { href: "/requests", label: "Anfragen", icon: ClipboardList, admin: true },
  { href: "/team", label: "Techniker", icon: Users, admin: true },
  { href: "/analytics", label: "Statistik", icon: BarChart3, admin: false },
  { href: "#documents", label: "Dokumente", icon: FileText, admin: false, disabled: true },
  { href: "#equipment", label: "Equipment", icon: Package, admin: false, disabled: true }
];

export function AppShell({
  title,
  eyebrow,
  contentClassName,
  titleIcon,
  children
}: {
  title: string;
  eyebrow?: string;
  contentClassName?: string;
  titleIcon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { session, isAdmin, logout } = useApp();

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AK</div>
          <div>
            <strong>AK-Motion</strong>
            <span>Technikteam</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Hauptnavigation">
          {navItems
            .filter((item) => !item.admin || isAdmin)
            .map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              if (item.disabled) {
                return (
                  <span key={item.label} className="nav-item is-disabled" title="Für Version 2 vorbereitet">
                    <Icon size={18} />
                    {item.label}
                  </span>
                );
              }

              return (
                <Link key={item.href} className={clsx("nav-item", active && "is-active")} href={item.href}>
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
        </nav>

        <div className="sidebar-footer">
          <div>
            <strong>{session?.name}</strong>
            <span>{session?.role === "admin" ? "Admin" : "Techniker"}</span>
          </div>
          <button className="icon-button" type="button" onClick={logout} aria-label="Abmelden" title="Abmelden">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className={clsx("content", contentClassName)}>
        <header className="page-header">
          <div>
            {titleIcon ? <div className="page-title-icon">{titleIcon}</div> : null}
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            <h1>{title}</h1>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
