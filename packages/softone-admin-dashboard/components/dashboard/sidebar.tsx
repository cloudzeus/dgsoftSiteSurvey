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
  FolderKanban,
} from "lucide-react"
import { LicenseModal, type LicenseData } from "./license-modal"
import { LanguageSwitcher } from "@/components/shared/language-switcher"
import { cn } from "@/lib/utils"
import { signOut } from "next-auth/react"
import { pathnameToPageResource } from "@/lib/rbac-resources"
import { userCanReadResource } from "@/lib/rbac-builtins"
import type { ResourceKey } from "@/lib/rbac-resources"

// ─── DG Design tokens (Mica sidebar) ─────────────────────────────────────────
const S = {
  bg:          "#1B1917",
  border:      "rgba(255,255,255,0.07)",
  text:        "rgba(255,255,255,0.50)",
  textHover:   "rgba(255,255,255,0.87)",
  textActive:  "#ffffff",
  icon:        "rgba(255,255,255,0.35)",
  iconHover:   "rgba(255,255,255,0.75)",
  iconActive:  "#60B0F8",
  activeBg:    "rgba(0,120,212,0.20)",
  hoverBg:     "rgba(255,255,255,0.06)",
  groupLabel:  "rgba(255,255,255,0.30)",
  ease:        "cubic-bezier(0.33,0,0.67,1)",
} as const

const MENU_ICON_MAP: Record<string, React.ElementType> = {
  Database, Table2, Users, Package, FileText,
  ShoppingCart, Globe, Building2, Truck, CreditCard, Layers, Tag,
}

export interface EntityMenuItem {
  id: string
  label: string
  icon: string
}

export interface AuthUser {
  email?: string | null
  role?: string
  readResources?: ResourceKey[]
}

// ─── Nav structure ─────────────────────────────────────────────────────────────

type NavItem    = { href: string; labelKey: string; icon: React.ElementType }
type NavGroupDef = { key: string; labelKey: string; items: NavItem[] }

const NAV_GROUPS: NavGroupDef[] = [
  {
    key: "site-survey",
    labelKey: "siteSurvey",
    items: [
      { href: "/dashboard",  labelKey: "overview",   icon: LayoutDashboard },
      { href: "/site-survey", labelKey: "allSurveys", icon: ClipboardList },
      { href: "/projects",   labelKey: "projects",   icon: FolderKanban },
      { href: "/customers",  labelKey: "customers",  icon: ContactRound },
    ],
  },
  {
    key: "master-options",
    labelKey: "masterOptions",
    items: [
      { href: "/master-options/survey-questions", labelKey: "surveyQuestions", icon: ListChecks },
      { href: "/master-options/brands",           labelKey: "brands",          icon: Tag },
      { href: "/master-options/asset-types",      labelKey: "assetTypes",      icon: Server },
      { href: "/master-options/software-vendors", labelKey: "softwareVendors", icon: AppWindow },
      { href: "/master-options/software-products", labelKey: "softwareProducts", icon: Layers },
      { href: "/master-options/web-platforms",    labelKey: "webPlatforms",    icon: Globe },
      { href: "/master-options/digital-tools",    labelKey: "digitalTools",    icon: BarChart2 },
      { href: "/master-options/iot-categories",   labelKey: "iotCategories",   icon: Cpu },
      { href: "/master-options/iot-products",     labelKey: "iotProducts",     icon: Wifi },
    ],
  },
  {
    key: "tools",
    labelKey: "tools",
    items: [
      { href: "/vat-lookup", labelKey: "vatLookup", icon: Search },
      { href: "/media",      labelKey: "media",     icon: Images },
      { href: "/import",     labelKey: "import",    icon: FileSpreadsheet },
      { href: "/xml-feeds",  labelKey: "xmlFeeds",  icon: Rss },
      { href: "/backups",    labelKey: "backups",   icon: HardDriveDownload },
    ],
  },
  {
    key: "platform",
    labelKey: "platform",
    items: [
      { href: "/connections", labelKey: "connections", icon: Plug },
      { href: "/entities",   labelKey: "entities",   icon: GitMerge },
      { href: "/mappings",   labelKey: "mappings",   icon: GitCompareArrows },
    ],
  },
  {
    key: "orchestration",
    labelKey: "orchestration",
    items: [
      { href: "/records",    labelKey: "records",    icon: Inbox },
      { href: "/jobs",       labelKey: "jobs",       icon: ListChecks },
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
  { href: "/settings",              labelKey: "settings",     icon: Settings },
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
  href: string; label: string; icon: React.ElementType
  active: boolean; collapsed: boolean; locale: string
}) {
  const localizedHref = `/${locale}${href}`

  return (
    <Link
      href={localizedHref}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center text-[13px] font-medium select-none",
        "transition-[background,color] duration-[80ms]",
        collapsed ? "justify-center rounded-lg p-2.5" : "gap-2.5 rounded-[4px] px-2.5 py-[7px]",
      )}
      style={{
        background: active ? S.activeBg : "transparent",
        color:      active ? S.textActive : S.text,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = S.hoverBg
          e.currentTarget.style.color = S.textHover
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent"
          e.currentTarget.style.color = S.text
        }
      }}
    >
      {/* Active indicator — 2 px left edge bar */}
      {active && !collapsed && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-full"
          style={{ height: "60%", background: "#0078D4" }}
        />
      )}

      <Icon
        className="size-[15px] flex-shrink-0"
        strokeWidth={1.5}
        style={{
          color: active ? S.iconActive : S.icon,
          transition: `color 80ms ${S.ease}`,
        }}
      />

      {/* Label — hidden when collapsed */}
      <span
        className="flex-1 truncate"
        style={{
          maxWidth:  collapsed ? 0 : 140,
          opacity:   collapsed ? 0 : 1,
          overflow:  "hidden",
          whiteSpace: "nowrap",
          letterSpacing: "-0.01em",
          transition: `max-width 240ms ${S.ease}, opacity 150ms ${S.ease}`,
        }}
      >
        {label}
      </span>
    </Link>
  )
}

// ─── NavGroup ─────────────────────────────────────────────────────────────────

function NavGroup({
  label, items, pathname, collapsed, defaultOpen, locale,
}: {
  label: string
  items: { href: string; label: string; icon: React.ElementType }[]
  pathname: string
  collapsed: boolean
  defaultOpen: boolean
  locale: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  // Collapsed mode — show only icons, no group chrome
  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {items.map(({ href, label: l, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <NavLink
              key={href}
              href={href} label={l} icon={Icon}
              active={active} collapsed locale={locale}
            />
          )
        })}
      </div>
    )
  }

  const itemHeight = 34

  return (
    <div>
      {/* Group header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] mb-0.5"
        style={{
          color: S.groupLabel,
          transition: `color 80ms ${S.ease}`,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = S.groupLabel)}
      >
        <span className="flex-1 text-left text-[10px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap">
          {label}
        </span>
        <ChevronRight
          className="size-3 flex-shrink-0"
          strokeWidth={2}
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: `transform 200ms ${S.ease}`,
          }}
        />
      </button>

      {/* Animated items list */}
      <div
        style={{
          overflow: "hidden",
          maxHeight: open ? `${items.length * itemHeight + 8}px` : 0,
          transition: `max-height 240ms ${S.ease}`,
        }}
      >
        <div className="space-y-0.5 pl-2">
          {items.map(({ href, label: l, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/")
            return (
              <NavLink
                key={href}
                href={href} label={l} icon={Icon}
                active={active} collapsed={false} locale={locale}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: 1, background: S.border, margin: "6px 0" }} />
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, email }: { name?: string | null; email: string }) {
  const initials = ((name ?? email).trim().slice(0, 2)).toUpperCase()
  return (
    <div
      className="size-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
      style={{
        background: "linear-gradient(135deg, #0078D4 0%, #005A9E 100%)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08)",
      }}
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
  const pathname  = usePathname()
  const locale    = useLocale()
  const tGroups   = useTranslations("navigation.groups")
  const tItems    = useTranslations("navigation.items")
  const tActions  = useTranslations("navigation.actions")
  const [collapsed, setCollapsed]     = useState(false)
  const [licenseOpen, setLicenseOpen] = useState(false)

  const filteredEntityItems =
    user && userCanReadResource(user, "records") ? entityMenuItems : []

  const pathnameForMatch =
    pathname.replace(new RegExp(`^/${locale}(?=/|$)`), "") || "/"

  return (
    <aside
      className="flex-shrink-0 flex flex-col overflow-hidden"
      style={{
        width:      collapsed ? 60 : 228,
        minHeight:  "100vh",
        background: S.bg,
        borderRight: `1px solid ${S.border}`,
        transition: `width 240ms ${S.ease}`,
      }}
    >
      {/* ── Logo / header ───────────────────────────────────────── */}
      <div
        className="h-14 flex items-center flex-shrink-0"
        style={{
          borderBottom: `1px solid ${S.border}`,
          padding: collapsed ? "0 10px" : "0 12px 0 14px",
          overflow: "hidden",
        }}
      >
        {collapsed ? (
          /* Icon-only logo */
          <button
            onClick={() => setCollapsed(false)}
            className="flex-1 flex items-center justify-center"
            title={tActions("expandSidebar")}
            style={{ color: S.icon }}
          >
            <img
              src="https://dgsmart.b-cdn.net/newsletter/newsletter-1773404641179-7ql2ec.webp"
              alt="Logo"
              style={{ width: 36, height: 36, objectFit: "contain" }}
            />
          </button>
        ) : (
          <>
            <div className="flex-1 overflow-hidden">
              <img
                src="https://dgsmart.b-cdn.net/newsletter/newsletter-1773404619932-zl85vx.webp"
                alt="Logo"
                style={{ height: 34, width: "auto", display: "block" }}
              />
            </div>

            {/* Collapse toggle */}
            <button
              onClick={() => setCollapsed(true)}
              className="flex-shrink-0 p-1.5 rounded-[4px]"
              title={tActions("collapseSidebar")}
              style={{
                color:      S.icon,
                transition: `color 80ms ${S.ease}`,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = S.iconHover)}
              onMouseLeave={(e) => (e.currentTarget.style.color = S.icon)}
            >
              <PanelLeftClose className="size-4" strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ padding: collapsed ? "10px 8px" : "10px 10px" }}
      >
        <div className="space-y-1">
          {NAV_GROUPS.map((group) => {
            const items = group.items
              .filter((item) => navHrefAllowed(item.href, user))
              .map((item) => ({
                href:  item.href,
                label: tItems(item.labelKey),
                icon:  item.icon,
              }))
            if (items.length === 0) return null

            const hasActive = items.some(
              (item) =>
                pathnameForMatch === item.href ||
                pathnameForMatch.startsWith(item.href + "/")
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
                href:  `/records/${item.id}`,
                label: item.label,
                icon:  MENU_ICON_MAP[item.icon] ?? Database,
              }))}
              pathname={pathnameForMatch}
              collapsed={collapsed}
              defaultOpen={filteredEntityItems.some(
                (item) =>
                  pathnameForMatch === `/records/${item.id}` ||
                  pathnameForMatch.startsWith(`/records/${item.id}/`)
              )}
              locale={locale}
            />
          )}
        </div>
      </nav>

      {/* ── Settings section ─────────────────────────────────────── */}
      <div
        className="flex-shrink-0"
        style={{
          borderTop: `1px solid ${S.border}`,
          padding: collapsed ? "8px" : "8px 10px",
        }}
      >
        {!collapsed && (
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-1 px-2.5"
            style={{ color: S.groupLabel }}
          >
            {tGroups("settings")}
          </p>
        )}
        <div className="space-y-0.5">
          {SETTINGS_ITEMS.filter((item) => navHrefAllowed(item.href, user)).map(
            ({ href, labelKey, icon: Icon }) => {
              const active =
                pathnameForMatch === href || pathnameForMatch.startsWith(href + "/")
              return (
                <NavLink
                  key={href}
                  href={href}
                  label={tItems(labelKey)}
                  icon={Icon}
                  active={active}
                  collapsed={collapsed}
                  locale={locale}
                />
              )
            }
          )}

          {/* License */}
          {licenseData && (
            <button
              onClick={() => setLicenseOpen(true)}
              title={collapsed ? tActions("license") : undefined}
              className={cn(
                "w-full flex items-center text-[13px] font-medium rounded-[4px]",
                "transition-[background,color] duration-[80ms]",
                collapsed ? "justify-center p-2.5" : "gap-2.5 px-2.5 py-[7px]",
              )}
              style={{ background: "transparent", color: S.text }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = S.hoverBg
                e.currentTarget.style.color = S.textHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent"
                e.currentTarget.style.color = S.text
              }}
            >
              <ScrollText
                className="size-[15px] flex-shrink-0"
                strokeWidth={1.5}
                style={{ color: S.icon }}
              />
              <span
                className="flex-1 text-left truncate"
                style={{
                  maxWidth:  collapsed ? 0 : 140,
                  opacity:   collapsed ? 0 : 1,
                  overflow:  "hidden",
                  whiteSpace: "nowrap",
                  letterSpacing: "-0.01em",
                  transition: `max-width 240ms ${S.ease}, opacity 150ms ${S.ease}`,
                }}
              >
                {tActions("license")}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── User footer ──────────────────────────────────────────── */}
      {user && (
        <div
          className="flex-shrink-0"
          style={{
            borderTop: `1px solid ${S.border}`,
            padding: collapsed ? "10px 8px" : "10px 12px",
          }}
        >
          <div
            className="flex items-center"
            style={{
              gap: collapsed ? 0 : 8,
              justifyContent: collapsed ? "center" : "flex-start",
            }}
          >
            <Avatar name={undefined} email={user.email ?? "??"} />

            {/* Email + role */}
            <div
              style={{
                flex:     collapsed ? "0 0 0" : "1 1 0",
                maxWidth: collapsed ? 0 : 200,
                opacity:  collapsed ? 0 : 1,
                overflow: "hidden",
                minWidth: 0,
                transition: `max-width 240ms ${S.ease}, opacity 150ms ${S.ease}`,
              }}
            >
              <p
                className="text-[12px] font-medium truncate"
                style={{ color: S.textActive, letterSpacing: "-0.01em" }}
              >
                {user.email}
              </p>
              <p
                className="text-[10px] truncate lowercase"
                style={{ color: S.icon }}
              >
                {user.role}
              </p>
            </div>

            {/* Actions */}
            <div
              className="flex items-center gap-1 flex-shrink-0"
              style={{
                display:  collapsed ? "none" : "flex",
                opacity:  collapsed ? 0 : 1,
                transition: `opacity 150ms ${S.ease}`,
              }}
            >
              <LanguageSwitcher variant="sidebar" />
              <button
                onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
                title={tActions("signOut")}
                className="p-1 rounded-[4px]"
                style={{
                  color: S.icon,
                  transition: `color 80ms ${S.ease}`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#E84A50")}
                onMouseLeave={(e) => (e.currentTarget.style.color = S.icon)}
              >
                <LogOut className="size-[15px]" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* License modal */}
      {licenseData && (
        <LicenseModal
          open={licenseOpen}
          onClose={() => setLicenseOpen(false)}
          license={licenseData}
        />
      )}
    </aside>
  )
}
