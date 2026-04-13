// Central RBAC resource keys — pages, APIs, and Roles matrix must stay aligned.

export const RESOURCE_KEYS = [
  "dashboard",
  "connections",
  "entities",
  "mappings",
  "identity-maps",
  "records",
  "data",
  "jobs",
  "monitoring",
  "vat-lookup",
  "media",
  "import",
  "xml-feeds",
  "site-survey",
  "master-options",
  "sync-configs",
  "audit",
  "dlq",
  "users",
  "roles",
  "settings",
] as const

export type ResourceKey = (typeof RESOURCE_KEYS)[number]

export const RESOURCE_LABELS: Record<ResourceKey, string> = {
  dashboard: "Overview",
  connections: "Connections",
  entities: "Entities",
  mappings: "Mappings",
  "identity-maps": "Identity maps",
  records: "Records",
  data: "Live data (sync configs)",
  jobs: "Jobs & pipeline",
  monitoring: "Monitoring",
  "vat-lookup": "AEEDE VAT lookup",
  media: "Media library",
  import: "Excel import",
  "xml-feeds": "XML feeds",
  "site-survey": "Site survey",
  "master-options": "Master options",
  "sync-configs": "Sync configs",
  audit: "Audit trail",
  dlq: "Dead letter queue",
  users: "Users",
  roles: "Roles & permissions",
  settings: "Settings",
}

/** Resources shown in the Roles matrix (same keys as RESOURCE_KEYS). */
export const RBAC_MATRIX_RESOURCES = RESOURCE_KEYS.map((key) => ({
  key,
  label: RESOURCE_LABELS[key],
}))

const PAGE_PREFIXES: { prefix: string; resource: ResourceKey }[] = [
  { prefix: "/dashboard", resource: "dashboard" },
  { prefix: "/connections", resource: "connections" },
  { prefix: "/entities", resource: "entities" },
  { prefix: "/mappings", resource: "mappings" },
  { prefix: "/records", resource: "records" },
  { prefix: "/data", resource: "data" },
  { prefix: "/jobs", resource: "jobs" },
  { prefix: "/monitoring", resource: "monitoring" },
  { prefix: "/vat-lookup", resource: "vat-lookup" },
  { prefix: "/media", resource: "media" },
  { prefix: "/import", resource: "import" },
  { prefix: "/xml-feeds", resource: "xml-feeds" },
  { prefix: "/site-survey", resource: "site-survey" },
  { prefix: "/master-options", resource: "master-options" },
  { prefix: "/sync-configs", resource: "sync-configs" },
  { prefix: "/audit", resource: "audit" },
  { prefix: "/dlq", resource: "dlq" },
  { prefix: "/users", resource: "users" },
  { prefix: "/roles", resource: "roles" },
  { prefix: "/settings", resource: "settings" },
]

/** Map a dashboard URL to a resource key, or null if no specific gate applies. */
export function pathnameToPageResource(pathname: string): ResourceKey | null {
  for (const { prefix, resource } of PAGE_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return resource
  }
  return null
}

export const ALL_RESOURCE_KEYS: ResourceKey[] = [...RESOURCE_KEYS]
