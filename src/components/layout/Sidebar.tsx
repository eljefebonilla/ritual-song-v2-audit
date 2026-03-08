"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useUser } from "@/lib/user-context";
import { useViewMode } from "@/hooks/useViewMode";

// ─── Pending badge ────────────────────────────────────────────────────────────

function PendingBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/members/pending-count")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.count != null) setCount(d.count); })
      .catch(() => {});
  }, []);

  if (!count) return null;
  return (
    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white leading-none">
      {count}
    </span>
  );
}

// --- Persistence ---

const HIDDEN_NAV_KEY = "rs_hidden_nav";
const NAV_ORDER_KEY = "rs_nav_order";

function getHiddenNav(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_NAV_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function saveHiddenNav(hidden: Set<string>) {
  localStorage.setItem(HIDDEN_NAV_KEY, JSON.stringify([...hidden]));
}
function getNavOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(NAV_ORDER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveNavOrder(order: string[]) {
  localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(order));
}

// --- Nav item definitions ---

interface NavItemDef {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
  seasonColor?: string; // For season dot
}

const SEASON_ITEMS: NavItemDef[] = [
  { id: "season-advent", label: "Advent", href: "/season/advent", seasonColor: "bg-purple-700", icon: null },
  { id: "season-christmas", label: "Christmas", href: "/season/christmas", seasonColor: "bg-white ring-1 ring-black/30", icon: null },
  { id: "season-ordinary", label: "Ordinary Time", href: "/season/ordinary", seasonColor: "bg-green-700", icon: null },
  { id: "season-lent", label: "Lent", href: "/season/lent", seasonColor: "bg-purple-900", icon: null },
  { id: "season-holyweek", label: "Holy Week", href: "/season/holyweek", seasonColor: "bg-red-900", icon: null },
  { id: "season-easter", label: "Easter", href: "/season/easter", seasonColor: "bg-white ring-1 ring-black/30", icon: null },
  { id: "season-solemnity", label: "Solemnities", href: "/season/solemnity", seasonColor: "bg-red-800", icon: null },
  { id: "season-feast", label: "Feasts", href: "/season/feast", seasonColor: "bg-red-700", icon: null },
];

function IconFor({ id }: { id: string }) {
  const cls = "w-[18px] h-[18px] shrink-0";
  switch (id) {
    case "today": return (
      <svg className={cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    );
    case "calendar": return (
      <svg className={cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    );
    case "announcements": return (
      <svg className={cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 11 18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </svg>
    );
    case "choir": return (
      <svg className={cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    );
    case "planner-view": return (
      <svg className={cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    );
    case "compare": return (
      <svg className={cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="8" height="18" rx="1" /><rect x="13" y="3" width="8" height="18" rx="1" />
      </svg>
    );
    case "library": return (
      <svg className={cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
      </svg>
    );
    case "liturgies": return (
      <svg className={cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M2 12h20" /><circle cx="12" cy="12" r="10" />
      </svg>
    );
    default: return null;
  }
}

const DEFAULT_ORDER: string[] = [
  "today", "calendar", "announcements", "choir",
  "planner-view", "compare", "library", "liturgies",
  ...SEASON_ITEMS.map((s) => s.id),
];

function buildOrderedItems(savedOrder: string[] | null): NavItemDef[] {
  const allItems: Record<string, NavItemDef> = {};

  // Non-season items
  for (const id of ["today", "calendar", "announcements", "choir", "planner-view", "compare", "library", "liturgies"]) {
    const labels: Record<string, string> = {
      today: "Today", calendar: "Calendar", announcements: "Announcements",
      choir: "Choir Sign-Up", "planner-view": "Planner View",
      compare: "Comparison View",
      library: "Music Library",
      liturgies: "Other Liturgies",
    };
    const hrefs: Record<string, string> = {
      today: "/today", calendar: "/calendar", announcements: "/announcements",
      choir: "/choir", "planner-view": "/planner", compare: "/planner/compare",
      library: "/library",
      liturgies: "/liturgies",
    };
    allItems[id] = { id, label: labels[id], href: hrefs[id], icon: <IconFor id={id} /> };
  }

  // Season items
  for (const s of SEASON_ITEMS) {
    allItems[s.id] = s;
  }

  const order = savedOrder ?? DEFAULT_ORDER;

  // Add any new items not in saved order
  const ordered: NavItemDef[] = [];
  for (const id of order) {
    if (allItems[id]) ordered.push(allItems[id]);
  }
  for (const id of DEFAULT_ORDER) {
    if (!order.includes(id) && allItems[id]) ordered.push(allItems[id]);
  }

  return ordered;
}

// --- Sub-components ---

function EyeIcon({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className={`p-0.5 rounded transition-colors shrink-0 ${visible ? "text-stone-500 hover:text-parish-gold" : "text-stone-700 hover:text-stone-500"}`}
      title={visible ? "Hide from members" : "Show to members"}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {visible ? (
          <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
        ) : (
          <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
        )}
      </svg>
    </button>
  );
}

function ArrowButton({ direction, onClick }: { direction: "up" | "down"; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className="p-0.5 text-stone-600 hover:text-parish-gold transition-colors shrink-0"
      title={`Move ${direction}`}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {direction === "up"
          ? <polyline points="18 15 12 9 6 15" />
          : <polyline points="6 9 12 15 18 9" />}
      </svg>
    </button>
  );
}

// --- Main Component ---

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { isAuthenticated, isAdmin, displayName, signOut } = useUser();
  const { viewMode, toggleViewMode, isRealAdmin, effectiveIsAdmin } = useViewMode();
  const [hiddenNav, setHiddenNav] = useState<Set<string>>(new Set());
  const [navOrder, setNavOrder] = useState<string[] | null>(null);

  useEffect(() => {
    setHiddenNav(getHiddenNav());
    setNavOrder(getNavOrder());
  }, []);

  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleNavVisibility = useCallback((id: string) => {
    setHiddenNav((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveHiddenNav(next);
      return next;
    });
  }, []);

  const moveItem = useCallback((id: string, direction: "up" | "down") => {
    setNavOrder((prev) => {
      const current = prev ?? [...DEFAULT_ORDER];
      const idx = current.indexOf(id);
      if (idx === -1) return current;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= current.length) return current;
      const next = [...current];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      saveNavOrder(next);
      return next;
    });
  }, []);

  const isDirector = effectiveIsAdmin;
  const showToggle = isRealAdmin && viewMode === "director";
  const shouldShow = (id: string) => showToggle || isDirector || !hiddenNav.has(id);

  if (pathname.startsWith("/gate") || pathname.startsWith("/auth") || pathname.startsWith("/join") || pathname.startsWith("/onboard") || pathname.startsWith("/pending") || pathname.startsWith("/privacy") || pathname.startsWith("/terms")) return null;

  const orderedItems = buildOrderedItems(navOrder);

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="p-4 border-b border-parish-gold/20 flex items-center justify-between">
        {!collapsed && (
          <Link href="/" className="block" onClick={onClose}>
            <Image src="/logo-stmonica-white.png" alt="St. Monica Catholic Community" width={180} height={60} className="mb-1" priority />
            <p className="text-[10px] uppercase tracking-widest text-parish-gold mt-0.5">Mass Preparation</p>
          </Link>
        )}
        <button
          onClick={() => { if (window.innerWidth < 768) onClose(); else setCollapsed(!collapsed); }}
          className="p-1.5 rounded hover:bg-stone-700 text-stone-400 hover:text-white transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? (
              <polyline points="9 18 15 12 9 6" />
            ) : (
              <><line x1="18" y1="6" x2="6" y2="18" className="md:hidden" /><line x1="6" y1="6" x2="18" y2="18" className="md:hidden" /><polyline points="15 18 9 12 15 6" className="hidden md:block" /></>
            )}
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {/* Dashboard — always first */}
        <Link
          href="/"
          onClick={onClose}
          className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
            pathname === "/" ? "bg-stone-700 text-white" : "text-stone-300 hover:bg-stone-800 hover:text-white"
          }`}
        >
          <svg className="w-[18px] h-[18px] shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          {!collapsed && <span>Dashboard</span>}
        </Link>

        {/* Reorderable items */}
        {orderedItems.map((item, idx) => {
          if (!shouldShow(item.id)) return null;
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const isHidden = hiddenNav.has(item.id);

          return (
            <div key={item.id} className="flex items-center">
              <Link
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors flex-1 ${
                  isActive ? "bg-stone-700 text-white" : "text-stone-300 hover:bg-stone-800 hover:text-white"
                } ${showToggle && isHidden ? "opacity-40" : ""}`}
              >
                {item.seasonColor ? (
                  <span className={`w-3 h-3 rounded-full ${item.seasonColor} shrink-0`} />
                ) : (
                  item.icon
                )}
                {!collapsed && <span>{item.label}</span>}
              </Link>
              {showToggle && !collapsed && (
                <div className="flex items-center gap-0.5 pr-1.5">
                  <div className="flex flex-col">
                    {idx > 0 && <ArrowButton direction="up" onClick={() => moveItem(item.id, "up")} />}
                    {idx < orderedItems.length - 1 && <ArrowButton direction="down" onClick={() => moveItem(item.id, "down")} />}
                  </div>
                  <EyeIcon visible={!isHidden} onClick={() => toggleNavVisibility(item.id)} />
                </div>
              )}
            </div>
          );
        })}

        {/* Admin Section */}
        {isAdmin && !collapsed && (
          <>
            <div className="mt-6 px-4 mb-2">
              <p className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold">Admin</p>
            </div>
            {/* Booking Grid */}
            <Link href="/admin/booking" onClick={onClose} className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${pathname.startsWith("/admin/booking") ? "bg-stone-700 text-white" : "text-stone-300 hover:bg-stone-800 hover:text-white"}`}>
              <svg className="w-[18px] h-[18px] shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></svg>
              <span>Booking Grid</span>
            </Link>
            {/* Members — with pending badge */}
            <Link href="/admin/members" onClick={onClose} className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${pathname.startsWith("/admin/members") ? "bg-stone-700 text-white" : "text-stone-300 hover:bg-stone-800 hover:text-white"}`}>
              <svg className="w-[18px] h-[18px] shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              <span>Members</span>
              <PendingBadge />
            </Link>
            {/* Messages */}
            <Link href="/admin/messages" onClick={onClose} className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${pathname.startsWith("/admin/messages") ? "bg-stone-700 text-white" : "text-stone-300 hover:bg-stone-800 hover:text-white"}`}>
              <svg className="w-[18px] h-[18px] shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              <span>Messages</span>
            </Link>
            {/* Compliance */}
            <Link href="/admin/compliance" onClick={onClose} className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${pathname.startsWith("/admin/compliance") ? "bg-stone-700 text-white" : "text-stone-300 hover:bg-stone-800 hover:text-white"}`}>
              <svg className="w-[18px] h-[18px] shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>
              <span>Compliance</span>
            </Link>
            {/* Duplicates */}
            <Link href="/admin/duplicates" onClick={onClose} className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${pathname.startsWith("/admin/duplicates") ? "bg-stone-700 text-white" : "text-stone-300 hover:bg-stone-800 hover:text-white"}`}>
              <svg className="w-[18px] h-[18px] shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="2" width="13" height="13" rx="2" /><path d="M5 8H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1" /></svg>
              <span>Duplicates</span>
            </Link>
            {/* Psalm Gaps */}
            <Link href="/admin/psalm-gaps" onClick={onClose} className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${pathname.startsWith("/admin/psalm-gaps") ? "bg-stone-700 text-white" : "text-stone-300 hover:bg-stone-800 hover:text-white"}`}>
              <svg className="w-[18px] h-[18px] shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
              <span>Psalm Gaps</span>
            </Link>
            {/* Season Briefing */}
            <Link href="/admin/season-briefing" onClick={onClose} className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${pathname.startsWith("/admin/season-briefing") ? "bg-stone-700 text-white" : "text-stone-300 hover:bg-stone-800 hover:text-white"}`}>
              <svg className="w-[18px] h-[18px] shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
              <span>Season Briefing</span>
            </Link>
            {/* Settings */}
            <Link href="/admin/settings" onClick={onClose} className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${pathname.startsWith("/admin/settings") ? "bg-stone-700 text-white" : "text-stone-300 hover:bg-stone-800 hover:text-white"}`}>
              <svg className="w-[18px] h-[18px] shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
              <span>Settings</span>
            </Link>
            {/* Calendar V2 */}
            <Link href="/calendar-v2" onClick={onClose} className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${pathname.startsWith("/calendar-v2") ? "bg-stone-700 text-white" : "text-stone-300 hover:bg-stone-800 hover:text-white"}`}>
              <svg className="w-[18px] h-[18px] shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /><path d="m9 16 2 2 4-4" /></svg>
              <span>Calendar V2</span>
            </Link>
          </>
        )}
      </nav>

      {/* View mode toggle — admin only */}
      {!collapsed && isRealAdmin && (
        <div className="px-4 py-2 border-t border-parish-gold/20">
          <button
            onClick={toggleViewMode}
            className="flex items-center gap-2 w-full group"
            title={viewMode === "director" ? "Switch to Member View" : "Switch to Director View"}
          >
            <span className={`relative w-7 h-4 rounded-full transition-colors ${viewMode === "director" ? "bg-parish-gold" : "bg-stone-600"}`}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${viewMode === "director" ? "left-3.5" : "left-0.5"}`} />
            </span>
            <span className="text-[10px] font-medium text-parish-gold uppercase tracking-wide group-hover:text-parish-gold/80 transition-colors">
              {viewMode === "director" ? "Director View" : "Member View"}
            </span>
          </button>
        </div>
      )}

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-parish-gold/20 space-y-3">
          {isAuthenticated ? (
            <div className="flex items-center justify-between">
              <Link href="/profile" onClick={onClose} className="flex items-center gap-2 text-xs text-stone-300 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
                <span className="truncate max-w-[120px]">{displayName}</span>
              </Link>
              <button onClick={signOut} className="text-xs text-stone-500 hover:text-stone-300 transition-colors" title="Sign out">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
                </svg>
              </button>
            </div>
          ) : (
            <Link href="/auth/login" onClick={onClose} className="flex items-center gap-2 text-xs text-parish-gold hover:text-parish-gold/80 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" x2="3" y1="12" y2="12" />
              </svg>
              Sign In
            </Link>
          )}
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-parish-gold/60 uppercase tracking-wider">St. Monica Catholic Community</p>
            <span className="text-[9px] text-stone-500">v1.18.0</span>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />}
      <aside
        className={`
          fixed left-0 top-0 h-full bg-stone-900 text-stone-100 z-50 flex flex-col
          transition-transform duration-300 ease-in-out
          ${collapsed ? "w-16" : "w-64"}
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:transition-[width] md:duration-300
        `}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
