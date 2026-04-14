"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ListChecks,
  BarChart2,
  LogOut,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Users,
  ShieldCheck,
  Settings,
  Database,
  Table2,
  Package,
  FileText,
  ShoppingCart,
  Globe,
  Building2,
  Truck,
  CreditCard,
  Layers,
  Tag,
  Plug,
  GitMerge,
  Inbox,
  GitCompareArrows,
  Search,
  Images,
  FileSpreadsheet,
  Rss,
  Map,
  ContactRound,
  HardDriveDownload,
  ClipboardList,
  Server,
  AppWindow,
  Cpu,
  Wifi,
  ScrollText,
} from "lucide-react"
import { LicenseModal, type LicenseData } from "./license-modal"

const MENU_ICON_MAP: Record<string, React.ElementType> = {
  Database, Table2, Users, Package, FileText,
  ShoppingCart, Globe, Building2, Truck, CreditCard, Layers, Tag,
}

export interface EntityMenuItem {
  id: string
  label: string
  icon: string
}
import { cn } from "@/lib/utils"
import { signOut } from "next-auth/react"
import { pathnameToPageResource } from "@/lib/rbac-resources"
import { userCanReadResource } from "@/lib/rbac-builtins"
import type { ResourceKey } from "@/lib/rbac-resources"

export interface AuthUser {
  email?: string | null
  role?: string
  readResources?: ResourceKey[]
}

// ─── Nav structure ─────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    key: "platform",
    label: "Platform",
    items: [
      { href: "/dashboard",   label: "Overview",    icon: LayoutDashboard },
      { href: "/connections", label: "Connections", icon: Plug },
      { href: "/entities",    label: "Entities",    icon: GitMerge },
      { href: "/mappings",    label: "Mappings",    icon: GitCompareArrows },
    ],
  },
  {
    key: "orchestration",
    label: "Orchestration",
    items: [
      { href: "/records",    label: "Records",    icon: Inbox },
      { href: "/jobs",       label: "Jobs",       icon: ListChecks },
      { href: "/monitoring", label: "Monitoring", icon: BarChart2 },
    ],
  },
  {
    key: "site-survey",
    label: "Site Survey",
    items: [
      { href: "/site-survey",           label: "All Surveys", icon: ClipboardList },
      { href: "/customers",             label: "Customers",   icon: ContactRound  },
    ],
  },
  {
    key: "master-options",
    label: "Master Options",
    items: [
      { href: "/master-options/brands",            label: "Brands",            icon: Tag       },
      { href: "/master-options/asset-types",       label: "Asset Types",       icon: Server    },
      { href: "/master-options/software-vendors",  label: "Software Vendors",  icon: AppWindow },
      { href: "/master-options/software-products", label: "Software Products", icon: Layers    },
      { href: "/master-options/web-platforms",     label: "Web Platforms",     icon: Globe     },
      { href: "/master-options/digital-tools",     label: "Digital Tools",     icon: BarChart2 },
      { href: "/master-options/iot-categories",    label: "IoT Categories",    icon: Cpu         },
      { href: "/master-options/iot-products",      label: "IoT Products",      icon: Wifi        },
      { href: "/master-options/survey-questions",  label: "Survey Questions",  icon: ListChecks  },
    ],
  },
  {
    key: "tools",
    label: "Tools",
    items: [
      { href: "/vat-lookup", label: "AEEDE VAT Info",  icon: Search },
      { href: "/media",      label: "Media Library",   icon: Images },
      { href: "/import",     label: "Excel Import",    icon: FileSpreadsheet },
      { href: "/xml-feeds",  label: "XML Feeds",       icon: Rss },
      { href: "/backups",    label: "DB Backups",      icon: HardDriveDownload },
    ],
  },
  {
    key: "users",
    label: "Users Management",
    items: [
      { href: "/users", label: "Users", icon: Users },
      { href: "/roles", label: "Roles", icon: ShieldCheck },
    ],
  },
]

const SETTINGS_ITEMS = [
  { href: "/settings", label: "Settings", icon: Settings },
]

function navHrefAllowed(href: string, user: AuthUser | null | undefined): boolean {
  if (!user) return false
  const resource = pathnameToPageResource(href)
  if (!resource) return true
  return userCanReadResource(user, resource)
}

// ─── NavLink ──────────────────────────────────────────────────────────────────

function NavLink({
  href, label, icon: Icon, active, collapsed,
}: {
  href: string; label: string; icon: React.ElementType; active: boolean; collapsed: boolean
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center rounded-md text-[13px] font-medium transition-all duration-150",
        collapsed ? "justify-center p-2.5" : "gap-2.5 px-2.5 py-[7px]",
      )}
      style={{
        background: active ? "var(--sidebar-active-bg)" : "transparent",
        color: active ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "rgba(255,255,255,0.05)"
          e.currentTarget.style.color = "var(--sidebar-text-hover)"
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent"
          e.currentTarget.style.color = "var(--sidebar-text)"
        }
      }}
    >
      <Icon
        className="size-4 flex-shrink-0"
        style={{ color: active ? "#a5b4fc" : "var(--sidebar-icon)" }}
      />
      <span
        className="flex-1 truncate"
        style={{
          maxWidth: collapsed ? 0 : 140,
          opacity: collapsed ? 0 : 1,
          overflow: "hidden",
          transition: "max-width 200ms ease, opacity 150ms ease",
          whiteSpace: "nowrap",
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </span>
      {active && !collapsed && (
        <ChevronRight className="size-3 opacity-30 flex-shrink-0" />
      )}
    </Link>
  )
}

// ─── NavGroup ─────────────────────────────────────────────────────────────────

function NavGroup({
  label,
  items,
  pathname,
  collapsed,
  defaultOpen,
}: {
  label: string
  items: { href: string; label: string; icon: React.ElementType }[]
  pathname: string
  collapsed: boolean
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  // When sidebar collapses, still show all icons (no group toggle)
  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {items.map(({ href, label: l, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return <NavLink key={href} href={href} label={l} icon={Icon} active={active} collapsed />
        })}
      </div>
    )
  }

  const itemHeight = 34 // approx px per item

  return (
    <div>
      {/* Group header button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md mb-0.5 transition-colors duration-150"
        style={{ color: "var(--sidebar-icon)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sidebar-icon)")}
      >
        <span
          className="flex-1 text-left text-[10px] font-semibold uppercase tracking-widest"
          style={{ whiteSpace: "nowrap" }}
        >
          {label}
        </span>
        <ChevronRight
          className="size-3 flex-shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Animated items */}
      <div
        style={{
          overflow: "hidden",
          maxHeight: open ? `${items.length * itemHeight + 8}px` : 0,
          transition: "max-height 220ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <div className="space-y-0.5">
          {items.map(({ href, label: l, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/")
            return <NavLink key={href} href={href} label={l} icon={Icon} active={active} collapsed={false} />
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ email }: { email: string }) {
  const initials = email.slice(0, 2).toUpperCase()
  return (
    <div
      className="size-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
      style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
    >
      {initials}
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({
  user,
  entityMenuItems = [],
  licenseData,
}: {
  user: AuthUser | null | undefined
  entityMenuItems?: EntityMenuItem[]
  licenseData?: LicenseData
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [licenseOpen, setLicenseOpen] = useState(false)

  const filteredEntityItems =
    user && userCanReadResource(user, "records") ? entityMenuItems : []

  return (
    <aside
      className="flex-shrink-0 flex flex-col overflow-hidden"
      style={{
        width: collapsed ? "60px" : "220px",
        transition: "width 250ms cubic-bezier(0.4, 0, 0.2, 1)",
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
      }}
    >
      {/* Logo + Toggle */}
      <div
        className="h-14 flex items-center flex-shrink-0"
        style={{
          borderBottom: "1px solid var(--sidebar-border)",
          padding: collapsed ? "0 8px" : "0 12px 0 14px",
          overflow: "hidden",
        }}
      >
        {/* Logo */}
        {collapsed ? (
          <div className="flex-1 flex items-center justify-center">
            <img
              src="https://dgsmart.b-cdn.net/newsletter/newsletter-1773404641179-7ql2ec.webp"
              alt="Logo"
              style={{ width: 44, height: 44, objectFit: "contain" }}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <img
              src="https://dgsmart.b-cdn.net/newsletter/newsletter-1773404619932-zl85vx.webp"
              alt="Logo"
              style={{ height: 36, width: "auto", display: "block" }}
            />
          </div>
        )}

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex-shrink-0 p-1.5 rounded-md"
          style={{
            color: "var(--sidebar-icon)",
            opacity: collapsed ? 0 : 1,
            pointerEvents: collapsed ? "none" : "auto",
            transition: "opacity 150ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sidebar-icon)")}
          title="Collapse sidebar"
        >
          <PanelLeftClose className="size-3.5" />
        </button>
      </div>

      {/* Expand button — only visible when collapsed */}
      <div
        className="flex justify-center flex-shrink-0"
        style={{
          height: collapsed ? "44px" : 0,
          opacity: collapsed ? 1 : 0,
          overflow: "hidden",
          transition: "height 250ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease",
          borderBottom: collapsed ? "1px solid var(--sidebar-border)" : "none",
          alignItems: "center",
        }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-md"
          style={{ color: "var(--sidebar-icon)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sidebar-icon)")}
          title="Expand sidebar"
        >
          <PanelLeft className="size-3.5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: collapsed ? "12px 8px" : "12px" }}>
        <div className="space-y-1">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => navHrefAllowed(item.href, user))
            if (items.length === 0) return null
            const hasActive = items.some(
              (item) => pathname === item.href || pathname.startsWith(item.href + "/")
            )
            return (
              <NavGroup
                key={group.key}
                label={group.label}
                items={items}
                pathname={pathname}
                collapsed={collapsed}
                defaultOpen={hasActive}
              />
            )
          })}

          {filteredEntityItems.length > 0 && (
            <NavGroup
              key="entities-data"
              label="Live Records"
              items={filteredEntityItems.map((item) => ({
                href: `/records/${item.id}`,
                label: item.label,
                icon: MENU_ICON_MAP[item.icon] ?? Database,
              }))}
              pathname={pathname}
              collapsed={collapsed}
              defaultOpen={filteredEntityItems.some(
                (item) => pathname === `/records/${item.id}` || pathname.startsWith(`/records/${item.id}/`)
              )}
            />
          )}
        </div>
      </nav>

      {/* Settings — pinned above user footer */}
      <div
        className="flex-shrink-0"
        style={{
          borderTop: "1px solid var(--sidebar-border)",
          padding: collapsed ? "8px" : "8px 12px",
          transition: "padding 250ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {!collapsed && (
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 px-2"
            style={{ color: "var(--sidebar-icon)" }}
          >
            Settings
          </p>
        )}
        <div className="space-y-0.5">
          {SETTINGS_ITEMS.filter((item) => navHrefAllowed(item.href, user)).map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/")
            return <NavLink key={href} href={href} label={label} icon={Icon} active={active} collapsed={collapsed} />
          })}

          {/* License button */}
          {licenseData && (
            <button
              onClick={() => setLicenseOpen(true)}
              title={collapsed ? "License" : undefined}
              className={cn(
                "w-full flex items-center rounded-md text-[13px] font-medium transition-all duration-150",
                collapsed ? "justify-center p-2.5" : "gap-2.5 px-2.5 py-[7px]",
              )}
              style={{ background: "transparent", color: "var(--sidebar-text)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)"
                e.currentTarget.style.color = "var(--sidebar-text-hover)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent"
                e.currentTarget.style.color = "var(--sidebar-text)"
              }}
            >
              <ScrollText
                className="size-4 flex-shrink-0"
                style={{ color: "var(--sidebar-icon)" }}
              />
              <span
                className="flex-1 text-left truncate"
                style={{
                  maxWidth: collapsed ? 0 : 140,
                  opacity: collapsed ? 0 : 1,
                  overflow: "hidden",
                  transition: "max-width 200ms ease, opacity 150ms ease",
                  whiteSpace: "nowrap",
                  letterSpacing: "-0.01em",
                }}
              >
                License
              </span>
            </button>
          )}
        </div>
      </div>

      {/* License modal */}
      {licenseData && (
        <LicenseModal
          open={licenseOpen}
          onClose={() => setLicenseOpen(false)}
          license={licenseData}
        />
      )}

      {/* User footer */}
      {user && (
        <div
          className="flex-shrink-0"
          style={{
            borderTop: "1px solid var(--sidebar-border)",
            padding: collapsed ? "10px 8px" : "10px 12px",
            transition: "padding 250ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div
            className="flex items-center rounded-md"
            style={{
              gap: collapsed ? 0 : 10,
              background: "rgba(255,255,255,0.04)",
              padding: collapsed ? "6px" : "6px 8px",
              justifyContent: collapsed ? "center" : "flex-start",
              transition: "gap 200ms ease, padding 250ms cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <Avatar email={user.email ?? "??"} />

            <div
              className="overflow-hidden"
              style={{
                flex: collapsed ? "0 0 0" : "1 1 0",
                maxWidth: collapsed ? 0 : 200,
                opacity: collapsed ? 0 : 1,
                transition: "max-width 200ms ease, opacity 150ms ease, flex 200ms ease",
                minWidth: 0,
              }}
            >
              <p className="text-[12px] font-medium text-white truncate" style={{ letterSpacing: "-0.01em" }}>
                {user.email}
              </p>
              <p className="text-[10px] truncate capitalize" style={{ color: "var(--sidebar-icon)" }}>
                {user.role}
              </p>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sign out"
              className="p-1 rounded flex-shrink-0"
              style={{
                color: "var(--sidebar-icon)",
                display: collapsed ? "none" : "flex",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sidebar-icon)")}
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
