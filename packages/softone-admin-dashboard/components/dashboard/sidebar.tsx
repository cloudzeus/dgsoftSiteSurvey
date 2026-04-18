"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
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
  Languages,
} from "lucide-react"
import { LicenseModal, type LicenseData } from "./license-modal"
import { LanguageSwitcher } from "@/components/shared/language-switcher"

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

type NavItem = { href: string; labelKey: string; icon: React.ElementType }
type NavGroupDef = { key: string; labelKey: string; items: NavItem[] }

// ─── Order reflects product priority ──
// 1. Site Survey (the product)
// 2. Master Options + Tools (support survey workflow — fill-in data + gather external info)
// 3. Platform/Orchestration (Softone ERP integration — admin)
// 4. Users management (admin)
const NAV_GROUPS: NavGroupDef[] = [
  {
    key: "site-survey",
    labelKey: "siteSurvey",
    items: [
      { href: "/dashboard", labelKey: "overview", icon: LayoutDashboard },
      { href: "/site-survey", labelKey: "allSurveys", icon: ClipboardList },
      { href: "/customers", labelKey: "customers", icon: ContactRound },
    ],
  },
  {
    key: "master-options",
    labelKey: "masterOptions",
    items: [
      { href: "/master-options/survey-questions", labelKey: "surveyQuestions", icon: ListChecks },
      { href: "/master-options/brands", labelKey: "brands", icon: Tag },
      { href: "/master-options/asset-types", labelKey: "assetTypes", icon: Server },
      { href: "/master-options/software-vendors", labelKey: "softwareVendors", icon: AppWindow },
      { href: "/master-options/software-products", labelKey: "softwareProducts", icon: Layers },
      { href: "/master-options/web-platforms", labelKey: "webPlatforms", icon: Globe },
      { href: "/master-options/digital-tools", labelKey: "digitalTools", icon: BarChart2 },
      { href: "/master-options/iot-categories", labelKey: "iotCategories", icon: Cpu },
      { href: "/master-options/iot-products", labelKey: "iotProducts", icon: Wifi },
    ],
  },
  {
    key: "tools",
    labelKey: "tools",
    items: [
      { href: "/vat-lookup", labelKey: "vatLookup", icon: Search },
      { href: "/media", labelKey: "media", icon: Images },
      { href: "/import", labelKey: "import", icon: FileSpreadsheet },
      { href: "/xml-feeds", labelKey: "xmlFeeds", icon: Rss },
      { href: "/backups", labelKey: "backups", icon: HardDriveDownload },
    ],
  },
  {
    key: "platform",
    labelKey: "platform",
    items: [
      { href: "/connections", labelKey: "connections", icon: Plug },
      { href: "/entities", labelKey: "entities", icon: GitMerge },
      { href: "/mappings", labelKey: "mappings", icon: GitCompareArrows },
    ],
  },
  {
    key: "orchestration",
    labelKey: "orchestration",
    items: [
      { href: "/records", labelKey: "records", icon: Inbox },
      { href: "/jobs", labelKey: "jobs", icon: ListChecks },
      { href: "/monitoring", labelKey: "monitoring", icon: BarChart2 },
    ],
  },
  {
    key: "users",
    labelKey: "usersManagement",
    items: [
      { href: "/users", labelKey: "users", icon: Users },
      { href: "/roles", labelKey: "roles", icon: ShieldCheck },
    ],
  },
]

const SETTINGS_ITEMS: NavItem[] = [
  { href: "/settings", labelKey: "settings", icon: Settings },
  { href: "/settings/translations", labelKey: "translations", icon: Languages },
]

function navHrefAllowed(href: string, user: AuthUser | null | undefined): boolean {
  if (!user) return false
  const resource = pathnameToPageResource(href)
  if (!resource) return true
  return userCanReadResource(user, resource)
}

// ─── NavLink ──────────────────────────────────────────────────────────────────

function NavLink({
  href, label, icon: Icon, active, collapsed, locale,
}: {
  href: string; label: string; icon: React.ElementType; active: boolean; collapsed: boolean; locale: string
}) {
  const localizedHref = `/${locale}${href}`
  return (
    <Link
      href={localizedHref}
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
  locale,
}: {
  label: string
  items: { href: string; label: string; icon: React.ElementType }[]
  pathname: string
  collapsed: boolean
  defaultOpen: boolean
  locale: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  // When sidebar collapses, still show all icons (no group toggle)
  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {items.map(({ href, label: l, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return <NavLink key={href} href={href} label={l} icon={Icon} active={active} collapsed locale={locale} />
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
            return <NavLink key={href} href={href} label={l} icon={Icon} active={active} collapsed={false} locale={locale} />
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
  const locale = useLocale()
  const tGroups = useTranslations("navigation.groups")
  const tItems = useTranslations("navigation.items")
  const tActions = useTranslations("navigation.actions")
  const [collapsed, setCollapsed] = useState(false)
  const [licenseOpen, setLicenseOpen] = useState(false)

  const filteredEntityItems =
    user && userCanReadResource(user, "records") ? entityMenuItems : []

  // Strip the locale prefix from pathname so it matches NAV_GROUPS hrefs (e.g. "/el/dashboard" → "/dashboard").
  const pathnameForMatch = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), "") || "/"

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
          title={tActions("collapseSidebar")}
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
          title={tActions("expandSidebar")}
        >
          <PanelLeft className="size-3.5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: collapsed ? "12px 8px" : "12px" }}>
        <div className="space-y-1">
          {NAV_GROUPS.map((group) => {
            const items = group.items
              .filter((item) => navHrefAllowed(item.href, user))
              .map((item) => ({ href: item.href, label: tItems(item.labelKey), icon: item.icon }))
            if (items.length === 0) return null
            const hasActive = items.some(
              (item) => pathnameForMatch === item.href || pathnameForMatch.startsWith(item.href + "/")
            )
            return (
              <NavGroup
                key={group.key}
                label={tGroups(group.labelKey)}
                items={items}
                pathname={pathnameForMatch}
                collapsed={collapsed}
                defaultOpen={hasActive}
                locale={locale}
              />
            )
          })}

          {filteredEntityItems.length > 0 && (
            <NavGroup
              key="entities-data"
              label={tGroups("liveRecords")}
              items={filteredEntityItems.map((item) => ({
                href: `/records/${item.id}`,
                label: item.label,
                icon: MENU_ICON_MAP[item.icon] ?? Database,
              }))}
              pathname={pathnameForMatch}
              collapsed={collapsed}
              defaultOpen={filteredEntityItems.some(
                (item) => pathnameForMatch === `/records/${item.id}` || pathnameForMatch.startsWith(`/records/${item.id}/`)
              )}
              locale={locale}
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
            {tGroups("settings")}
          </p>
        )}
        <div className="space-y-0.5">
          {SETTINGS_ITEMS.filter((item) => navHrefAllowed(item.href, user)).map(({ href, labelKey, icon: Icon }) => {
            const active = pathnameForMatch === href || pathnameForMatch.startsWith(href + "/")
            return <NavLink key={href} href={href} label={tItems(labelKey)} icon={Icon} active={active} collapsed={collapsed} locale={locale} />
          })}

          {/* License button */}
          {licenseData && (
            <button
              onClick={() => setLicenseOpen(true)}
              title={collapsed ? tActions("license") : undefined}
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
                {tActions("license")}
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

            <div
              className="flex items-center gap-1 flex-shrink-0"
              style={{ display: collapsed ? "none" : "flex" }}
            >
              <LanguageSwitcher variant="sidebar" />
              <button
                onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
                title={tActions("signOut")}
                className="p-1 rounded transition-colors"
                style={{ color: "var(--sidebar-icon)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sidebar-icon)")}
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
