import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { format, subDays, startOfDay, startOfMonth, subMonths } from "date-fns"
import { el, enUS } from "date-fns/locale"
import Link from "next/link"
import { getTranslations, getLocale } from "next-intl/server"
import {
  Building2, ClipboardList, FileText, Activity,
  CheckCircle2, XCircle, Loader2, ArrowRight,
  ChevronRight, Plus, Users, Plug, GitMerge,
  Inbox, AlertTriangle, Image,
  BarChart3, Trophy, MapPin,
  Database, Rss, RefreshCw, AlertCircle, Clock,
  Zap, Search, FileSpreadsheet,
} from "lucide-react"
import { SystemSection } from "@/components/dashboard/system-section"

export const metadata = { title: "Dashboard" }
export const dynamic = "force-dynamic"

// ── Constants ────────────────────────────────────────────────────────────────

const SURVEY_STATUS = {
  DRAFT:       { key: "draft",       color: "#94a3b8" },
  SCHEDULED:   { key: "scheduled",   color: "#3b82f6" },
  IN_PROGRESS: { key: "in_progress", color: "#f59e0b" },
  COMPLETED:   { key: "completed",   color: "#16a34a" },
  CANCELLED:   { key: "cancelled",   color: "#ef4444" },
} as const

const PROPOSAL_STATUS = {
  DRAFT:    { key: "draft",    color: "#94a3b8" },
  SENT:     { key: "sent",     color: "#6366f1" },
  ACCEPTED: { key: "accepted", color: "#16a34a" },
  REJECTED: { key: "rejected", color: "#ef4444" },
} as const

// ── Sub-components ───────────────────────────────────────────────────────────

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const W = 80
  const H = 28
  const pad = 2
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W
      const y = H - pad - (v / max) * (H - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${H} ${pts} ${W},${H}`}
        fill={`url(#sg-${color.replace("#", "")})`}
      />
      <polyline
        points={pts}
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StatusDot({ on }: { on: boolean }) {
  return (
    <span className="relative flex size-2">
      {on && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
        style={{ background: "#16a34a" }} />}
      <span className="relative inline-flex rounded-full size-2"
        style={{ background: on ? "#16a34a" : "#ef4444" }} />
    </span>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type TimeAgoT = (key: string, values?: Record<string, string | number>) => string

function timeAgo(date: Date, t: TimeAgoT): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return t("justNow")
  if (mins < 60) return t("minutes", { count: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t("hours", { count: hours })
  const days = Math.floor(hours / 24)
  if (days === 1) return t("yesterday")
  return t("days", { count: days })
}

function formatBytes(bytes: bigint | null | undefined): string {
  if (!bytes) return "—"
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function bucketByDay(dates: Date[], days = 7): number[] {
  const counts = Array<number>(days).fill(0)
  const now = Date.now()
  for (const d of dates) {
    const daysAgo = Math.floor((now - d.getTime()) / 86_400_000)
    if (daysAgo >= 0 && daysAgo < days) counts[days - 1 - daysAgo]++
  }
  return counts
}

function initials(name: string | null | undefined): string {
  if (!name) return "?"
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth()
  const locale = await getLocale()
  const t = await getTranslations("dashboard")
  const dateLocale = locale === "el" ? el : enUS

  const now = new Date()
  const today = startOfDay(now)
  const sevenDaysAgo = startOfDay(subDays(now, 6))
  const thisMonth = startOfMonth(now)
  const lastMonth = startOfMonth(subMonths(now, 1))

  const [
    totalCustomers,
    customersThisMonth,
    customersLastMonth,
    surveyByStatus,
    totalSurveys,
    recentSurveys,
    topCustomers,
    surveysLast7Raw,
    customersLast7Raw,
    proposalByStatus,
    totalProposals,
    recentProposals,
    connections,
    entities,
    pendingRecords,
    failedDeliveries,
    completedToday,
    recentJobs,
    totalUsers,
    totalMedia,
    dlqUnresolved,
    lastBackup,
    activeXmlFeeds,
    recentSyncJobs,
    syncFailedToday,
  ] = await Promise.all([
    // Customers
    db.customer.count(),
    db.customer.count({ where: { insdate: { gte: thisMonth } } }),
    db.customer.count({ where: { insdate: { gte: lastMonth, lt: thisMonth } } }),

    // Surveys
    db.siteSurvey.groupBy({ by: ["status"], _count: { id: true } }),
    db.siteSurvey.count(),
    db.siteSurvey.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true, city: true } },
        surveyor: { select: { name: true, email: true } },
      },
    }),

    // Top customers by survey count
    db.customer.findMany({
      take: 5,
      where: { siteSurveys: { some: {} } },
      orderBy: { siteSurveys: { _count: "desc" } },
      select: {
        id: true,
        name: true,
        city: true,
        _count: { select: { siteSurveys: true } },
      },
    }),

    // 7-day trends
    db.siteSurvey.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
    db.customer.findMany({
      where: { insdate: { gte: sevenDaysAgo } },
      select: { insdate: true },
    }),

    // Proposals
    db.surveyProposal.groupBy({ by: ["status"], _count: { id: true } }),
    db.surveyProposal.count(),
    db.surveyProposal.findMany({
      take: 4,
      orderBy: { createdAt: "desc" },
      include: { survey: { select: { name: true, customer: { select: { name: true } } } } },
    }),

    // Pipeline
    db.connection.count({ where: { isActive: true } }),
    db.pipelineEntity.count({ where: { isActive: true } }),
    db.pipelineRecord.count({ where: { status: "PENDING" } }),
    db.recordDelivery.count({ where: { status: { in: ["FAILED", "DEAD"] } } }),

    // Jobs
    db.pipelineJob.count({ where: { status: "COMPLETED", startedAt: { gte: today } } }),
    db.pipelineJob.findMany({
      take: 5,
      orderBy: { startedAt: "desc" },
      include: { entity: { select: { name: true } } },
    }),

    // Misc
    db.user.count(),
    db.mediaFile.count(),

    // System health extras
    db.syncJobDLQ.count({ where: { resolvedAt: null } }),
    db.databaseBackup.findFirst({
      orderBy: { createdAt: "desc" },
      select: { status: true, createdAt: true, completedAt: true, fileSizeBytes: true },
    }),
    db.xmlFeed.count({ where: { isActive: true } }),
    db.syncJob.findMany({
      take: 4,
      orderBy: { lastAttempt: "desc" },
      select: {
        id: true, status: true, operation: true,
        totalRecords: true, recordsSuccessful: true, recordsFailed: true,
        lastAttempt: true,
      },
    }),
    db.syncJob.count({ where: { status: "FAILED", lastAttempt: { gte: today } } }),
  ])

  // ── Derived values ──────────────────────────────────────────────────────────

  const userName = session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "—"
  const hour = now.getHours()
  const greetingKey = hour < 12 ? "greeting.morning" : hour < 18 ? "greeting.afternoon" : "greeting.evening"

  const surveyMap: Record<string, number> = Object.fromEntries(
    surveyByStatus.map((s: { status: string; _count: { id: number } }) => [s.status, s._count.id])
  )
  const proposalMap: Record<string, number> = Object.fromEntries(
    proposalByStatus.map((p: { status: string; _count: { id: number } }) => [p.status, p._count.id])
  )

  const activeSurveys = (surveyMap["IN_PROGRESS"] ?? 0) + (surveyMap["SCHEDULED"] ?? 0)
  const completedSurveys = surveyMap["COMPLETED"] ?? 0
  const acceptedProposals = proposalMap["ACCEPTED"] ?? 0
  const acceptanceRate = totalProposals > 0 ? Math.round((acceptedProposals / totalProposals) * 100) : 0
  const systemHealthy = dlqUnresolved === 0 && syncFailedToday === 0 && failedDeliveries === 0

  const customerDelta =
    customersLastMonth > 0
      ? Number(((customersThisMonth - customersLastMonth) / customersLastMonth) * 100).toFixed(0)
      : null

  const surveysLast7 = bucketByDay(surveysLast7Raw.map((s: { createdAt: Date }) => s.createdAt))
  const customersLast7 = bucketByDay(
    customersLast7Raw
      .map((c: { insdate: Date | null }) => c.insdate)
      .filter((d: Date | null): d is Date => d !== null)
  )

  const maxTopSurveys = topCustomers[0]?._count.siteSurveys ?? 1

  const timeAgoT: TimeAgoT = (key, values) =>
    t(`timeAgo.${key}` as never, values as never)

  const surveyStatusLabel = (status: string) =>
    t(`surveyStatus.${status.toLowerCase()}` as never)
  const proposalStatusLabel = (status: string) =>
    t(`proposalStatus.${status.toLowerCase()}` as never)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-10 max-w-[1440px]">

      {/* ── Accent line ───────────────────────────────────────────────────── */}
      <div className="h-[3px] rounded-full -mx-2" style={{
        background: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 25%, #0ea5e9 50%, #16a34a 75%, #f59e0b 100%)",
        opacity: 0.6,
      }} />

      {/* ── Alert banner (only when failed deliveries > 0) ────────────────── */}
      {failedDeliveries > 0 && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
          <AlertTriangle className="size-4 shrink-0" style={{ color: "#dc2626" }} />
          <p className="text-[12px] font-medium flex-1" style={{ color: "#991b1b" }}>
            {t("alert.failedDeliveries", { count: failedDeliveries })}
          </p>
          <Link href="/records" className="btn btn-danger btn-sm">{t("alert.review")}</Link>
        </div>
      )}

      {/* ── Hero header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--foreground-subtle)" }}>
            {format(now, "EEEE · d MMMM yyyy", { locale: dateLocale })}
          </p>
          <h1 className="text-[24px] font-bold tracking-tight mt-0.5" style={{ color: "var(--foreground)" }}>
            {t(greetingKey as never)},{" "}
            <span style={{ color: "var(--primary)" }}>{userName}</span>
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
            {t("subtitle", { surveys: totalSurveys, customers: totalCustomers, users: totalUsers })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          <Link href="/customers" className="btn btn-secondary btn-sm">
            <Building2 className="size-3.5" /> {t("cta.customers")}
          </Link>
          <Link href="/site-survey" className="btn btn-primary btn-sm">
            <Plus className="size-3.5" /> {t("cta.newSurvey")}
          </Link>
        </div>
      </div>

      {/* ── Survey-first KPI Cards (3, Surveys highlighted) ───────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* Surveys — primary card, spans wider on md+ */}
        <Link href="/site-survey"
          className="group rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative hover:shadow-lg transition-all duration-200 hover:-translate-y-[1px] md:col-span-1"
          style={{
            background: "linear-gradient(135deg, var(--card) 0%, rgba(234,88,12,0.04) 100%)",
            border: "1px solid var(--border)",
            minHeight: 160,
          }}>
          <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: "#ea580c" }} />
          <div className="flex items-start justify-between">
            <div className="size-10 rounded-xl flex items-center justify-center" style={{ background: "#fff7ed" }}>
              <ClipboardList className="size-5" style={{ color: "#ea580c" }} />
            </div>
            {activeSurveys > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "#fff7ed", color: "#c2410c" }}>
                {t("kpi.activeBadge", { count: activeSurveys })}
              </span>
            )}
          </div>
          <div>
            <p className="text-[38px] font-bold tabular-nums leading-none mt-2"
              style={{ color: "var(--foreground)" }}>
              {totalSurveys.toLocaleString()}
            </p>
            <div className="flex items-center justify-between mt-2">
              <div>
                <p className="text-[13px] font-semibold" style={{ color: "var(--foreground-muted)" }}>
                  {t("kpi.surveys")}
                </p>
                <p className="text-[11px]" style={{ color: "var(--foreground-subtle)" }}>
                  {t("kpi.surveysSubtitle", { count: completedSurveys })}
                </p>
              </div>
              <div className="opacity-70 group-hover:opacity-100 transition-opacity">
                <Sparkline values={surveysLast7} color="#ea580c" />
              </div>
            </div>
          </div>
        </Link>

        {/* Customers */}
        <Link href="/customers"
          className="group rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative hover:shadow-lg transition-all duration-200 hover:-translate-y-[1px]"
          style={{ background: "var(--card)", border: "1px solid var(--border)", minHeight: 160 }}>
          <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: "#4f46e5" }} />
          <div className="flex items-start justify-between">
            <div className="size-9 rounded-xl flex items-center justify-center" style={{ background: "#eef2ff" }}>
              <Building2 className="size-[18px]" style={{ color: "#4f46e5" }} />
            </div>
            {customerDelta !== null && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: Number(customerDelta) >= 0 ? "#f0fdf4" : "#fef2f2",
                  color: Number(customerDelta) >= 0 ? "#15803d" : "#b91c1c",
                }}>
                {Number(customerDelta) >= 0 ? "▲" : "▼"} {t("kpi.deltaBadge", { delta: Math.abs(Number(customerDelta)) })}
              </span>
            )}
          </div>
          <div>
            <p className="text-[34px] font-bold tabular-nums leading-none mt-2"
              style={{ color: "var(--foreground)" }}>
              {totalCustomers.toLocaleString()}
            </p>
            <div className="flex items-center justify-between mt-1.5">
              <div>
                <p className="text-[12px] font-medium" style={{ color: "var(--foreground-muted)" }}>
                  {t("kpi.customers")}
                </p>
                {customersThisMonth > 0 && (
                  <p className="text-[11px]" style={{ color: "var(--foreground-subtle)" }}>
                    {t("kpi.customersSubtitle", { count: customersThisMonth })}
                  </p>
                )}
              </div>
              <div className="opacity-60 group-hover:opacity-100 transition-opacity">
                <Sparkline values={customersLast7} color="#4f46e5" />
              </div>
            </div>
          </div>
        </Link>

        {/* Proposals */}
        <Link href="/site-survey"
          className="group rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative hover:shadow-lg transition-all duration-200 hover:-translate-y-[1px]"
          style={{ background: "var(--card)", border: "1px solid var(--border)", minHeight: 160 }}>
          <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: "#16a34a" }} />
          <div className="flex items-start justify-between">
            <div className="size-9 rounded-xl flex items-center justify-center" style={{ background: "#f0fdf4" }}>
              <FileText className="size-[18px]" style={{ color: "#16a34a" }} />
            </div>
            {totalProposals > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "#f0fdf4", color: "#15803d" }}>
                {t("kpi.winRate", { rate: acceptanceRate })}
              </span>
            )}
          </div>
          <div>
            <p className="text-[34px] font-bold tabular-nums leading-none mt-2"
              style={{ color: "var(--foreground)" }}>
              {totalProposals.toLocaleString()}
            </p>
            <div className="mt-1.5">
              <p className="text-[12px] font-medium" style={{ color: "var(--foreground-muted)" }}>
                {t("kpi.proposals")}
              </p>
              <p className="text-[11px]" style={{ color: "var(--foreground-subtle)" }}>
                {t("kpi.proposalsSubtitle", { accepted: acceptedProposals, sent: proposalMap["SENT"] ?? 0 })}
              </p>
            </div>
          </div>
        </Link>

      </div>

      {/* ── Survey Pipeline (full-width hero panel) ───────────────────────── */}
      <div className="rounded-2xl p-5"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
              {t("pipeline.title")}
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
              {t("pipeline.subtitle", { total: totalSurveys })}
            </p>
          </div>
          <Link href="/site-survey"
            className="text-[11px] font-semibold flex items-center gap-1 hover:underline"
            style={{ color: "var(--primary)" }}>
            {t("pipeline.viewAll")} <ArrowRight className="size-3" />
          </Link>
        </div>

        {totalSurveys > 0 ? (
          <>
            {/* Segmented bar */}
            <div className="flex h-3 rounded-full overflow-hidden gap-[2px] mb-6">
              {(["COMPLETED", "IN_PROGRESS", "SCHEDULED", "DRAFT", "CANCELLED"] as const).map((status) => {
                const count = surveyMap[status] ?? 0
                if (!count) return null
                const pct = (count / totalSurveys) * 100
                return (
                  <div key={status} title={`${surveyStatusLabel(status)}: ${count}`}
                    style={{ width: `${pct}%`, background: SURVEY_STATUS[status].color, borderRadius: 4, minWidth: 5 }} />
                )
              })}
            </div>

            {/* Per-status stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(Object.entries(SURVEY_STATUS) as [keyof typeof SURVEY_STATUS, { key: string; color: string }][]).map(([status, cfg]) => {
                const count = surveyMap[status] ?? 0
                const pct = totalSurveys > 0 ? Math.round((count / totalSurveys) * 100) : 0
                return (
                  <div key={status}
                    className="rounded-xl p-3 flex flex-col gap-1 transition-colors"
                    style={{ background: cfg.color + "10", border: `1px solid ${cfg.color}25` }}>
                    <div className="size-1.5 rounded-full" style={{ background: cfg.color }} />
                    <p className="text-[22px] font-bold tabular-nums leading-none mt-1"
                      style={{ color: "var(--foreground)" }}>
                      {count}
                    </p>
                    <p className="text-[10px] font-semibold leading-tight" style={{ color: cfg.color }}>
                      {surveyStatusLabel(status)}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--foreground-subtle)" }}>
                      {pct}%
                    </p>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="size-12 rounded-2xl flex items-center justify-center" style={{ background: "#fff7ed" }}>
              <ClipboardList className="size-5" style={{ color: "#ea580c" }} />
            </div>
            <p className="text-[13px] font-medium" style={{ color: "var(--foreground-muted)" }}>
              {t("pipeline.empty")}
            </p>
            <Link href="/site-survey" className="btn btn-primary btn-sm">
              <Plus className="size-3.5" /> {t("pipeline.createFirst")}
            </Link>
          </div>
        )}
      </div>

      {/* ── Three-column: Recent Surveys | Top Customers | Recent Proposals ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent Surveys */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border)" }}>
            <div>
              <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                {t("recentSurveys.title")}
              </h2>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                {t("recentSurveys.subtitle")}
              </p>
            </div>
            <Link href="/site-survey"
              className="text-[11px] font-semibold flex items-center gap-1 hover:underline"
              style={{ color: "var(--primary)" }}>
              {t("recentSurveys.viewAll")} <ArrowRight className="size-3" />
            </Link>
          </div>

          {recentSurveys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <ClipboardList className="size-6" style={{ color: "var(--foreground-subtle)" }} />
              <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
                {t("recentSurveys.empty")}
              </p>
            </div>
          ) : recentSurveys.map((s: any, i: number) => {
            const sc = SURVEY_STATUS[s.status as keyof typeof SURVEY_STATUS]
            const isLast = i === recentSurveys.length - 1
            return (
              <Link key={s.id} href="/site-survey"
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted)]/40 transition-colors group"
                style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
                <div className="size-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: (sc?.color ?? "#94a3b8") + "18" }}>
                  <ClipboardList className="size-3.5" style={{ color: sc?.color ?? "#94a3b8" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
                    {s.name}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: "var(--foreground-muted)" }}>
                    {s.customer.name}
                    {s.customer.city ? ` · ${s.customer.city}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: (sc?.color ?? "#94a3b8") + "18", color: sc?.color ?? "#94a3b8" }}>
                    {sc ? surveyStatusLabel(s.status) : s.status}
                  </span>
                  <ChevronRight className="size-3 opacity-0 group-hover:opacity-50 transition-opacity"
                    style={{ color: "var(--foreground-muted)" }} />
                </div>
              </Link>
            )
          })}
        </div>

        {/* Top Customers */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border)" }}>
            <div>
              <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                {t("topCustomers.title")}
              </h2>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                {t("topCustomers.subtitle")}
              </p>
            </div>
            <Trophy className="size-4" style={{ color: "#f59e0b" }} />
          </div>

          {topCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Building2 className="size-6" style={{ color: "var(--foreground-subtle)" }} />
              <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
                {t("topCustomers.empty")}
              </p>
            </div>
          ) : topCustomers.map((c: any, i: number) => {
            const pct = Math.round((c._count.siteSurveys / maxTopSurveys) * 100)
            const medalColors = ["#f59e0b", "#94a3b8", "#b45309", "#64748b", "#64748b"]
            return (
              <Link key={c.id} href="/customers"
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted)]/40 transition-colors group"
                style={{ borderBottom: i < topCustomers.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div className="size-6 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold"
                  style={{ background: medalColors[i] + "20", color: medalColors[i] }}>
                  {i + 1}
                </div>
                <div className="size-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                  style={{ background: "#eef2ff", color: "#4f46e5" }}>
                  {initials(c.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
                    {c.name ?? "—"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#4f46e5" }} />
                    </div>
                  </div>
                </div>
                <span className="text-[12px] font-bold tabular-nums shrink-0"
                  style={{ color: "var(--foreground)" }}>
                  {c._count.siteSurveys}
                </span>
              </Link>
            )
          })}
        </div>

        {/* Recent Proposals */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border)" }}>
            <div>
              <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                {t("recentProposals.title")}
              </h2>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                {t("recentProposals.subtitle")}
              </p>
            </div>
            <Link href="/site-survey"
              className="text-[11px] font-semibold flex items-center gap-1 hover:underline"
              style={{ color: "var(--primary)" }}>
              {t("recentProposals.viewAll")} <ArrowRight className="size-3" />
            </Link>
          </div>

          {recentProposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <FileText className="size-6" style={{ color: "var(--foreground-subtle)" }} />
              <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
                {t("recentProposals.empty")}
              </p>
            </div>
          ) : recentProposals.map((p: any, i: number) => {
            const pc = PROPOSAL_STATUS[p.status as keyof typeof PROPOSAL_STATUS]
            const isLast = i === recentProposals.length - 1
            return (
              <Link key={p.id} href="/site-survey"
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted)]/40 transition-colors group"
                style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
                <div className="size-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: (pc?.color ?? "#94a3b8") + "18" }}>
                  <FileText className="size-3.5" style={{ color: pc?.color ?? "#94a3b8" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
                    {p.title}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: "var(--foreground-muted)" }}>
                    {p.survey.customer.name}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: (pc?.color ?? "#94a3b8") + "18", color: pc?.color ?? "#94a3b8" }}>
                  {pc ? proposalStatusLabel(p.status) : p.status}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Survey-relevant Quick Access bar ──────────────────────────────── */}
      <div className="rounded-2xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <h2 className="text-[13px] font-semibold mb-3" style={{ color: "var(--foreground)" }}>
          {t("quickAccess.title")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {([
            { label: t("quickAccess.newSurvey"),        href: "/site-survey",                      Icon: ClipboardList,   color: "#ea580c" },
            { label: t("quickAccess.customers"),        href: "/customers",                        Icon: Building2,       color: "#4f46e5" },
            { label: t("quickAccess.vatLookup"),        href: "/tools/vat-lookup",                 Icon: Search,          color: "#0ea5e9" },
            { label: t("quickAccess.media"),            href: "/media",                            Icon: Image,           color: "#7c3aed" },
            { label: t("quickAccess.surveyQuestions"),  href: "/master-options/survey-questions",  Icon: BarChart3,       color: "#16a34a" },
            { label: t("quickAccess.import"),           href: "/import",                           Icon: FileSpreadsheet, color: "#f59e0b" },
          ] as const).map((item) => (
            <Link key={item.label} href={item.href}
              className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl hover:bg-[var(--muted)]/50 transition-colors group"
              style={{ border: "1px solid var(--border)" }}>
              <div className="size-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: item.color + "18" }}>
                <item.Icon className="size-3.5" style={{ color: item.color }} />
              </div>
              <span className="text-[12px] font-medium flex-1 truncate" style={{ color: "var(--foreground)" }}>
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Activity Timeline ─────────────────────────────────────────────── */}
      {(() => {
        type ActivityItem = {
          id: string
          label: string
          sub: string
          time: Date
          iconColor: string
          iconBg: string
          type: "survey" | "proposal" | "job"
        }

        const items: ActivityItem[] = [
          ...recentSurveys.map((s: any) => ({
            id: `s-${s.id}`,
            label: s.name,
            sub: t("timeline.surveyType", { customer: s.customer.name }),
            time: new Date(s.createdAt),
            iconColor: SURVEY_STATUS[s.status as keyof typeof SURVEY_STATUS]?.color ?? "#94a3b8",
            iconBg: (SURVEY_STATUS[s.status as keyof typeof SURVEY_STATUS]?.color ?? "#94a3b8") + "18",
            type: "survey" as const,
          })),
          ...recentProposals.map((p: any) => ({
            id: `p-${p.id}`,
            label: p.title,
            sub: t("timeline.proposalType", { customer: p.survey.customer.name }),
            time: new Date(p.createdAt),
            iconColor: PROPOSAL_STATUS[p.status as keyof typeof PROPOSAL_STATUS]?.color ?? "#94a3b8",
            iconBg: (PROPOSAL_STATUS[p.status as keyof typeof PROPOSAL_STATUS]?.color ?? "#94a3b8") + "18",
            type: "proposal" as const,
          })),
          ...recentJobs
            .filter((j: any) => j.status === "COMPLETED" || j.status === "FAILED")
            .map((j: any) => ({
              id: `j-${j.id}`,
              label: j.entity.name,
              sub: t("timeline.jobType", { trigger: j.trigger, records: j.processed }),
              time: new Date(j.startedAt),
              iconColor: j.status === "COMPLETED" ? "#16a34a" : "#dc2626",
              iconBg: (j.status === "COMPLETED" ? "#16a34a" : "#dc2626") + "18",
              type: "job" as const,
            })),
        ]
          .sort((a, b) => b.time.getTime() - a.time.getTime())
          .slice(0, 8)

        if (items.length === 0) return null

        return (
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {t("timeline.title")}
                </h2>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                  {t("timeline.subtitle")}
                </p>
              </div>
              <Zap className="size-4" style={{ color: "#f59e0b" }} />
            </div>

            <div className="px-5 py-4">
              <div className="relative">
                <div className="absolute left-3.5 top-0 bottom-0 w-[1px]"
                  style={{ background: "var(--border)" }} />

                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-start gap-4 relative">
                      <div className="size-7 rounded-full flex items-center justify-center shrink-0 z-10 relative"
                        style={{ background: item.iconBg, border: `1.5px solid ${item.iconColor}40` }}>
                        {item.type === "survey" && <ClipboardList className="size-3" style={{ color: item.iconColor }} />}
                        {item.type === "proposal" && <FileText className="size-3" style={{ color: item.iconColor }} />}
                        {item.type === "job" && <Zap className="size-3" style={{ color: item.iconColor }} />}
                      </div>

                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
                              {item.label}
                            </p>
                            <p className="text-[11px] truncate" style={{ color: "var(--foreground-muted)" }}>
                              {item.sub}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 mt-0.5">
                            <Clock className="size-3" style={{ color: "var(--foreground-subtle)" }} />
                            <span className="text-[10px] tabular-nums" style={{ color: "var(--foreground-subtle)" }}>
                              {timeAgo(item.time, timeAgoT)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Collapsible System & Integration section ──────────────────────── */}
      <SystemSection
        title={t("systemSection.title")}
        subtitle={t("systemSection.subtitle")}
        expandLabel={t("systemSection.expand")}
        collapseLabel={t("systemSection.collapse")}
        healthy={systemHealthy}
        healthyLabel={t("systemStatus.allHealthy")}
        attentionLabel={t("systemStatus.attention")}
      >
        {/* Pipeline Jobs + Integration Pipeline metrics side-by-side */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Recent Jobs */}
          {recentJobs.length > 0 ? (
            <div className="lg:col-span-3 rounded-2xl overflow-hidden"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <div>
                  <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                    {t("jobs.title")}
                  </h2>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                    {t("jobs.subtitle", { count: completedToday })}
                  </p>
                </div>
                <Link href="/jobs"
                  className="text-[11px] font-semibold flex items-center gap-1 hover:underline"
                  style={{ color: "var(--primary)" }}>
                  {t("jobs.viewAll")} <ArrowRight className="size-3" />
                </Link>
              </div>
              {recentJobs.map((j: any, i: number) => {
                const ms = j.completedAt
                  ? new Date(j.completedAt).getTime() - new Date(j.startedAt).getTime()
                  : null
                const dur =
                  ms === null ? "—"
                  : ms < 1000 ? `${ms}ms`
                  : ms < 60_000 ? `${(ms / 1000).toFixed(1)}s`
                  : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
                const isLast = i === recentJobs.length - 1
                return (
                  <div key={j.id}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--muted)]/30 transition-colors"
                    style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
                    <div className="shrink-0 size-5 flex items-center justify-center">
                      {j.status === "RUNNING" && <Loader2 className="size-3.5 animate-spin" style={{ color: "#6366f1" }} />}
                      {j.status === "COMPLETED" && <CheckCircle2 className="size-3.5" style={{ color: "#16a34a" }} />}
                      {j.status === "FAILED" && <XCircle className="size-3.5" style={{ color: "#dc2626" }} />}
                    </div>
                    <span className="text-[13px] font-medium flex-1 min-w-0 truncate"
                      style={{ color: "var(--foreground)" }}>
                      {j.entity.name}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                      style={{ background: "var(--muted)", color: "var(--foreground-muted)" }}>
                      {j.trigger}
                    </span>
                    <span className="text-[11px] tabular-nums hidden sm:block w-24 text-right"
                      style={{ color: "var(--foreground-muted)" }}>
                      {t("jobs.records", { count: j.processed.toLocaleString() })}
                    </span>
                    <span className="text-[11px] tabular-nums hidden md:block w-10 text-right"
                      style={{ color: "var(--foreground-subtle)" }}>
                      {dur}
                    </span>
                    <span className="text-[10px] tabular-nums w-9 text-right"
                      style={{ color: "var(--foreground-subtle)" }}>
                      {format(new Date(j.startedAt), "HH:mm")}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="lg:col-span-3 rounded-2xl flex items-center justify-center py-10"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
                {t("jobs.empty")}
              </p>
            </div>
          )}

          {/* Integration Pipeline metrics */}
          <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                {t("pipelineMetrics.title")}
              </h2>
              {failedDeliveries > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "#fef2f2", color: "#b91c1c" }}>
                  <AlertTriangle className="size-2.5" /> {failedDeliveries}
                </span>
              )}
            </div>
            <div className="space-y-1">
              {([
                { label: t("pipelineMetrics.connections"),       value: connections,      href: "/connections", color: "#6366f1", Icon: Plug },
                { label: t("pipelineMetrics.entities"),          value: entities,         href: "/entities",    color: "#0ea5e9", Icon: GitMerge },
                { label: t("pipelineMetrics.pendingRecords"),    value: pendingRecords,   href: "/records",     color: "#f59e0b", Icon: Inbox },
                {
                  label: t("pipelineMetrics.failedDeliveries"),
                  value: failedDeliveries,
                  href: "/records",
                  color: failedDeliveries > 0 ? "#dc2626" : "#16a34a",
                  Icon: failedDeliveries > 0 ? XCircle : CheckCircle2,
                },
              ] as const).map((item) => (
                <Link key={item.label} href={item.href}
                  className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-[var(--muted)]/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <item.Icon className="size-3.5" style={{ color: item.color }} />
                    <span className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
                      {item.label}
                    </span>
                  </div>
                  <span className="text-[13px] font-bold tabular-nums" style={{ color: item.color }}>
                    {item.value.toLocaleString()}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* System status grid + Sync activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <div className="rounded-2xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {t("systemStatus.title")}
                </h2>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                  {t("systemStatus.subtitle")}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusDot on={systemHealthy} />
                <span className="text-[11px] font-semibold"
                  style={{ color: systemHealthy ? "#15803d" : "#b91c1c" }}>
                  {systemHealthy ? t("systemStatus.allHealthy") : t("systemStatus.attention")}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* DLQ */}
              <Link href="/dlq" className="rounded-xl p-3.5 flex flex-col gap-2 hover:shadow-sm transition-all group"
                style={{
                  background: dlqUnresolved > 0 ? "#fef2f2" : "#f0fdf4",
                  border: `1px solid ${dlqUnresolved > 0 ? "#fecaca" : "#dcfce7"}`,
                }}>
                <div className="flex items-center justify-between">
                  <AlertCircle className="size-4" style={{ color: dlqUnresolved > 0 ? "#dc2626" : "#16a34a" }} />
                  <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-60 transition-opacity"
                    style={{ color: dlqUnresolved > 0 ? "#dc2626" : "#16a34a" }} />
                </div>
                <p className="text-[22px] font-bold tabular-nums leading-none"
                  style={{ color: dlqUnresolved > 0 ? "#b91c1c" : "#15803d" }}>
                  {dlqUnresolved}
                </p>
                <p className="text-[11px] font-semibold"
                  style={{ color: dlqUnresolved > 0 ? "#dc2626" : "#16a34a" }}>
                  {t("systemStatus.dlq")}
                </p>
              </Link>

              {/* Backup */}
              <Link href="/backups" className="rounded-xl p-3.5 flex flex-col gap-2 hover:shadow-sm transition-all group"
                style={{
                  background: !lastBackup || lastBackup.status === "FAILED" ? "#fef2f2" : "#f0fdf4",
                  border: `1px solid ${!lastBackup || lastBackup.status === "FAILED" ? "#fecaca" : "#dcfce7"}`,
                }}>
                <div className="flex items-center justify-between">
                  <Database className="size-4"
                    style={{ color: !lastBackup || lastBackup.status === "FAILED" ? "#dc2626" : "#16a34a" }} />
                  <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-60 transition-opacity"
                    style={{ color: !lastBackup || lastBackup.status === "FAILED" ? "#dc2626" : "#16a34a" }} />
                </div>
                <p className="text-[14px] font-bold leading-tight"
                  style={{ color: !lastBackup || lastBackup.status === "FAILED" ? "#b91c1c" : "#15803d" }}>
                  {lastBackup
                    ? lastBackup.status === "COMPLETED"
                      ? timeAgo(lastBackup.completedAt ?? lastBackup.createdAt, timeAgoT)
                      : lastBackup.status
                    : t("systemStatus.never")}
                </p>
                <div>
                  <p className="text-[11px] font-semibold"
                    style={{ color: !lastBackup || lastBackup.status === "FAILED" ? "#dc2626" : "#16a34a" }}>
                    {t("systemStatus.lastBackup")}
                  </p>
                  {lastBackup?.fileSizeBytes && (
                    <p className="text-[10px]" style={{ color: "var(--foreground-subtle)" }}>
                      {formatBytes(lastBackup.fileSizeBytes)}
                    </p>
                  )}
                </div>
              </Link>

              {/* XML Feeds */}
              <Link href="/xml-feeds" className="rounded-xl p-3.5 flex flex-col gap-2 hover:shadow-sm transition-all group"
                style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}>
                <div className="flex items-center justify-between">
                  <Rss className="size-4" style={{ color: "#0ea5e9" }} />
                  <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-60 transition-opacity"
                    style={{ color: "#0ea5e9" }} />
                </div>
                <p className="text-[22px] font-bold tabular-nums leading-none" style={{ color: "#0369a1" }}>
                  {activeXmlFeeds}
                </p>
                <p className="text-[11px] font-semibold" style={{ color: "#0ea5e9" }}>
                  {t("systemStatus.activeFeeds")}
                </p>
              </Link>

              {/* Sync failures */}
              <Link href="/sync-configs" className="rounded-xl p-3.5 flex flex-col gap-2 hover:shadow-sm transition-all group"
                style={{
                  background: syncFailedToday > 0 ? "#fef2f2" : "#faf5ff",
                  border: `1px solid ${syncFailedToday > 0 ? "#fecaca" : "#e9d5ff"}`,
                }}>
                <div className="flex items-center justify-between">
                  <RefreshCw className="size-4" style={{ color: syncFailedToday > 0 ? "#dc2626" : "#7c3aed" }} />
                  <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-60 transition-opacity"
                    style={{ color: syncFailedToday > 0 ? "#dc2626" : "#7c3aed" }} />
                </div>
                <p className="text-[22px] font-bold tabular-nums leading-none"
                  style={{ color: syncFailedToday > 0 ? "#b91c1c" : "#6d28d9" }}>
                  {syncFailedToday}
                </p>
                <p className="text-[11px] font-semibold"
                  style={{ color: syncFailedToday > 0 ? "#dc2626" : "#7c3aed" }}>
                  {t("systemStatus.syncFailures")}
                </p>
              </Link>
            </div>
          </div>

          {/* Recent Sync Jobs */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {t("syncActivity.title")}
                </h2>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                  {t("syncActivity.subtitle")}
                </p>
              </div>
              <Link href="/sync-configs"
                className="text-[11px] font-semibold flex items-center gap-1 hover:underline"
                style={{ color: "var(--primary)" }}>
                {t("syncActivity.configure")} <ArrowRight className="size-3" />
              </Link>
            </div>

            {recentSyncJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <RefreshCw className="size-6" style={{ color: "var(--foreground-subtle)" }} />
                <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
                  {t("syncActivity.empty")}
                </p>
              </div>
            ) : recentSyncJobs.map((j: any, i: number) => {
              const isOk = j.status === "COMPLETED"
              const isPartial = j.status === "PARTIAL_FAILURE"
              const isFailed = j.status === "FAILED"
              const statusColor = isOk ? "#16a34a" : isPartial ? "#f59e0b" : isFailed ? "#dc2626" : "#6366f1"
              const statusLabel = isOk
                ? t("syncActivity.status.completed")
                : isPartial
                ? t("syncActivity.status.partial")
                : isFailed
                ? t("syncActivity.status.failed")
                : j.status
              const pct = j.totalRecords > 0 ? Math.round((j.recordsSuccessful / j.totalRecords) * 100) : 100
              const isLast = i === recentSyncJobs.length - 1
              return (
                <div key={j.id}
                  className="px-5 py-3.5"
                  style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {isOk && <CheckCircle2 className="size-3.5" style={{ color: "#16a34a" }} />}
                      {isPartial && <AlertCircle className="size-3.5" style={{ color: "#f59e0b" }} />}
                      {isFailed && <XCircle className="size-3.5" style={{ color: "#dc2626" }} />}
                      {!isOk && !isPartial && !isFailed && <Loader2 className="size-3.5 animate-spin" style={{ color: "#6366f1" }} />}
                      <span className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>
                        {j.operation}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: statusColor + "18", color: statusColor }}>
                        {statusLabel}
                      </span>
                    </div>
                    <span className="text-[11px]" style={{ color: "var(--foreground-subtle)" }}>
                      {timeAgo(new Date(j.lastAttempt), timeAgoT)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: statusColor }} />
                    </div>
                    <span className="text-[10px] tabular-nums shrink-0" style={{ color: "var(--foreground-subtle)" }}>
                      {j.recordsSuccessful}/{j.totalRecords}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </SystemSection>

      {/* ── Stats Footer Strip (slim, 3 items) ────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { label: t("statsFooter.teamMembers"),  value: totalUsers,               Icon: Users,  color: "#7c3aed", href: "/users" },
          { label: t("statsFooter.mediaFiles"),   value: totalMedia,               Icon: Image,  color: "#0ea5e9", href: "/media" },
          { label: t("statsFooter.activePipes"),  value: connections + entities,   Icon: MapPin, color: "#16a34a", href: "/connections" },
        ] as const).map(({ label, value, Icon, color, href }) => (
          <Link key={label} href={href}
            className="flex items-center gap-3 rounded-xl px-4 py-3 hover:shadow-sm transition-all"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="size-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: color + "15" }}>
              <Icon className="size-3.5" style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-[18px] font-bold tabular-nums leading-none" style={{ color: "var(--foreground)" }}>
                {value.toLocaleString()}
              </p>
              <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--foreground-muted)" }}>
                {label}
              </p>
            </div>
          </Link>
        ))}
      </div>

    </div>
  )
}
