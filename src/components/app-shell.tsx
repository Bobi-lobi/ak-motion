"use client";

import clsx from "clsx";
import { BarChart3, CalendarDays, ClipboardList, GalleryVerticalEnd, LogOut, Package, PanelLeftClose, PanelLeftOpen, Upload, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/components/app-provider";
import { updateProfile } from "@/lib/data-store";
import { knowledgePages } from "@/lib/knowledge";

const SIDEBAR_WIDTH_KEY = "ak-motion-sidebar-width";
const SIDEBAR_COLLAPSED_KEY = "ak-motion-sidebar-collapsed";
const MOBILE_OPENED_PAGE_KEY = "ak-motion-mobile-opened-page";

const navItems = [
  { href: "/calendar", label: "Veranstaltungskalender", icon: CalendarDays, admin: false },
  { href: "/analytics", label: "Statistik", icon: BarChart3, admin: false },
  ...knowledgePages.map((page) => ({ href: page.href, label: page.title, icon: page.icon, admin: false })),
  { href: "/equipment", label: "Equipment", icon: Package, admin: false }
];

const adminNavItems = [
  { href: "/requests", label: "Anfragen", icon: ClipboardList, admin: true },
  { href: "/team", label: "Techniker", icon: Users, admin: true },
  { href: "/landing", label: "Startseite", icon: GalleryVerticalEnd, admin: true }
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
  const { session, isAdmin, logout, refresh } = useApp();
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => getInitialSidebarCollapsed());
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState(session?.name ?? "");
  const [profilePhone, setProfilePhone] = useState(session?.phone ?? "");
  const [profileAvatar, setProfileAvatar] = useState(session?.avatarUrl ?? "");

  useEffect(() => {
    const savedWidth = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
    setSidebarWidth(Number.isFinite(savedWidth) && savedWidth >= 220 ? savedWidth : 280);
    if (window.sessionStorage.getItem(MOBILE_OPENED_PAGE_KEY) === "true") {
      window.sessionStorage.removeItem(MOBILE_OPENED_PAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    setProfileName(session?.name ?? "");
    setProfilePhone(session?.phone ?? "");
    setProfileAvatar(session?.avatarUrl ?? "");
  }, [session]);

  function startSidebarResize(mouseEvent: React.MouseEvent<HTMLButtonElement>) {
    mouseEvent.preventDefault();
    const startX = mouseEvent.clientX;
    const startWidth = sidebarWidth;

    function handleMouseMove(moveEvent: MouseEvent) {
      const nextWidth = Math.min(420, Math.max(220, startWidth + moveEvent.clientX - startX));
      setSidebarWidth(nextWidth);
    }

    function stopResize() {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", stopResize);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResize);
  }

  async function saveProfile() {
    if (!session || !profileName.trim()) {
      return;
    }

    await updateProfile(session.id, {
      avatarUrl: profileAvatar,
      name: profileName.trim(),
      phone: profilePhone.trim()
    });
    refresh();
    setProfileOpen(false);
  }

  function updateAvatar(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setProfileAvatar(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  function openPageOnMobile(clickEvent: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (!window.matchMedia("(max-width: 900px)").matches) {
      return;
    }

    window.sessionStorage.setItem(MOBILE_OPENED_PAGE_KEY, "true");
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
    setSidebarCollapsed(true);
    if (pathname === href) {
      clickEvent.preventDefault();
      window.sessionStorage.removeItem(MOBILE_OPENED_PAGE_KEY);
    }
  }

  const profileModal =
    profileOpen && typeof document !== "undefined" ? (
      <div className="page-modal-backdrop profile-modal-backdrop" role="presentation" onClick={() => setProfileOpen(false)}>
        <section
          className="profile-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Profil bearbeiten"
          onClick={(clickEvent) => clickEvent.stopPropagation()}
        >
          <header className="profile-modal-head">
            <div>
              <span className="eyebrow">Profil</span>
              <h2>Deine Angaben</h2>
            </div>
            <button className="icon-button ghost" type="button" aria-label="Profil schließen" onClick={() => setProfileOpen(false)}>
              <X size={18} />
            </button>
          </header>

          <div className="profile-editor">
            <div className="profile-editor-avatar">
              <span className="profile-avatar large" aria-hidden="true">
                {profileAvatar ? <img src={profileAvatar} alt="" /> : initials(profileName)}
              </span>
              <label className="button">
                <Upload size={16} />
                Bild ändern
                <input className="visually-hidden" type="file" accept="image/*" onChange={(event) => updateAvatar(event.target.files)} />
              </label>
            </div>

            <label>
              <span>Name</span>
              <input value={profileName} onChange={(event) => setProfileName(event.target.value)} />
            </label>
            <label>
              <span>Telefonnummer</span>
              <input value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} inputMode="tel" placeholder="Optional" />
            </label>
            <label>
              <span>E-Mail</span>
              <input value={session?.email ?? ""} disabled />
            </label>
          </div>

          <div className="button-row">
            <button className="button primary" type="button" onClick={saveProfile} disabled={!profileName.trim()}>
              Speichern
            </button>
            <button className="button" type="button" onClick={() => setProfileOpen(false)}>
              Abbrechen
            </button>
          </div>
        </section>
      </div>
    ) : null;

  return (
    <div
      className={clsx("workspace", sidebarCollapsed && "is-sidebar-collapsed")}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
    >
      {sidebarCollapsed ? (
        <button
          className="sidebar-show-button"
          type="button"
          onClick={() => {
            window.sessionStorage.removeItem(MOBILE_OPENED_PAGE_KEY);
            setSidebarCollapsed(false);
          }}
          aria-label="Menü einblenden"
          title="Menü einblenden"
        >
          <PanelLeftOpen size={18} />
        </button>
      ) : null}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <img className="brand-mark" src="/ak-motion-logo.png" alt="Motion" />
            <div>
              <strong>Motion</strong>
              <span>AK-Technik</span>
            </div>
          </div>
          <button
            className="icon-button ghost"
            type="button"
            onClick={() => setSidebarCollapsed(true)}
            aria-label="Menü ausblenden"
            title="Menü ausblenden"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        <nav className="nav-list" aria-label="Hauptnavigation">
          <div className="nav-section">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  className={clsx("nav-item", active && "is-active")}
                  href={item.href}
                  onClick={(clickEvent) => openPageOnMobile(clickEvent, item.href)}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </div>
          {isAdmin ? (
            <div className="nav-section admin-nav-section" aria-label="Adminbereich">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    className={clsx("nav-item", active && "is-active")}
                    href={item.href}
                    onClick={(clickEvent) => openPageOnMobile(clickEvent, item.href)}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </nav>

        <div className="sidebar-bottom">
          <nav className="sidebar-legal-links" aria-label="Rechtliche Hinweise">
            <Link href="/impressum">Impressum</Link>
            <Link href="/datenschutz">Datenschutz</Link>
          </nav>
          <div className="sidebar-footer">
            <button className="profile-trigger" type="button" onClick={() => setProfileOpen(true)}>
              <span className="profile-avatar" aria-hidden="true">
                {session?.avatarUrl ? <img src={session.avatarUrl} alt="" /> : initials(session?.name)}
              </span>
              <span>
                <strong>{session?.name}</strong>
                <span>{session?.role === "admin" ? "Admin" : "Techniker"}</span>
              </span>
            </button>
            <button className="icon-button" type="button" onClick={logout} aria-label="Abmelden" title="Abmelden">
              <LogOut size={18} />
            </button>
          </div>
        </div>
        <button
          className="sidebar-resize-handle"
          type="button"
          onMouseDown={startSidebarResize}
          aria-label="Menübreite ändern"
          title="Menübreite ändern"
        />
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

      {profileModal ? createPortal(profileModal, document.body) : null}
    </div>
  );
}

function initials(name?: string) {
  return (name ?? "AK")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getInitialSidebarCollapsed() {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.matchMedia("(max-width: 900px)").matches) {
    return window.sessionStorage.getItem(MOBILE_OPENED_PAGE_KEY) === "true";
  }

  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}
