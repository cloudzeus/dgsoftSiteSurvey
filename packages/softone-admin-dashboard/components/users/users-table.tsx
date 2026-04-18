"use client"

import { useState, useTransition, useRef, useMemo, useCallback } from "react"
import Image from "next/image"
import { format } from "date-fns"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import * as Checkbox from "@radix-ui/react-checkbox"
import {
  UserPlus, X, Eye, EyeOff, Camera, Loader2, MoreHorizontal,
  Check, ChevronUp, ChevronDown, ChevronsUpDown, Columns3,
  Trash2, Copy, ChevronLeft, ChevronRight,
} from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { useTablePrefs, PAGE_SIZES, type ColDef, type PageSize } from "@/hooks/use-table-prefs"
import { createUser, updateUser, deleteUser, deleteUsers } from "@/app/[locale]/(dashboard)/users/actions"

// ─── Types ────────────────────────────────────────────────────────────────────

type User = {
  id: string
  name: string | null
  email: string
  role: string
  image: string | null
  jobPosition: string | null
  phone: string | null
  mobile: string | null
  address: string | null
  city: string | null
  zip: string | null
  createdAt: Date
  updatedAt: Date
}

type SortDir = "asc" | "desc"

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS: ColDef[] = [
  { key: "name",        label: "Name",     sortable: true,  defaultVisible: true,  alwaysVisible: true },
  { key: "jobPosition", label: "Position", sortable: true,  defaultVisible: true  },
  { key: "role",        label: "Role",     sortable: true,  defaultVisible: true  },
  { key: "phone",       label: "Phone",    sortable: false, defaultVisible: true  },
  { key: "mobile",      label: "Mobile",   sortable: false, defaultVisible: false },
  { key: "address",     label: "Address",  sortable: false, defaultVisible: false },
  { key: "city",        label: "City",     sortable: true,  defaultVisible: false },
  { key: "zip",         label: "ZIP",      sortable: false, defaultVisible: false },
  { key: "createdAt",   label: "Created",  sortable: true,  defaultVisible: true  },
]

// Default column widths (px) — user overrides are persisted to localStorage
const DEFAULT_COL_WIDTHS: Record<string, number> = {
  name:        220,
  jobPosition: 160,
  role:        100,
  phone:       140,
  mobile:      140,
  address:     180,
  city:        120,
  zip:          80,
  createdAt:   110,
}

const ROLES = ["ADMIN", "OPERATOR", "VIEWER"] as const
type Role = (typeof ROLES)[number]

const ROLE_COLORS: Record<Role, { bg: string; fg: string }> = {
  ADMIN:    { bg: "#ede9fe", fg: "#6d28d9" },
  OPERATOR: { bg: "#dbeafe", fg: "#1d4ed8" },
  VIEWER:   { bg: "#f3f4f6", fg: "#374151" },
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_COLORS[role as Role] ?? { bg: "#f3f4f6", fg: "#374151" }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: c.bg, color: c.fg }}>
      {role}
    </span>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>{title}</h2>
      <button onClick={onClose} className="p-1 rounded" style={{ color: "var(--foreground-muted)" }}>
        <X className="size-4" />
      </button>
    </div>
  )
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <p className="text-[12px] px-3 py-2 rounded-lg"
      style={{ background: "var(--danger-light)", color: "var(--danger-fg)" }}>
      {msg}
    </p>
  )
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="col-span-2 pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--foreground-muted)" }}>{title}</p>
      <div className="mt-1.5" style={{ height: 1, background: "var(--border)" }} />
    </div>
  )
}

function Field({ label, children, span2 }: { label: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div className={`space-y-1${span2 ? " col-span-2" : ""}`}>
      <label className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--foreground-muted)" }}>{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = "text", disabled }: {
  value: string; onChange?: (v: string) => void
  placeholder?: string; type?: string; disabled?: boolean
}) {
  return (
    <input type={type} value={value} onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder} disabled={disabled} className="input-field"
      style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : {}} />
  )
}

function PasswordInput({ value, onChange, placeholder = "••••••••" }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className="input-field pr-9" />
      <button type="button" onClick={() => setShow(s => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2"
        style={{ color: "var(--foreground-muted)" }}>
        {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </div>
  )
}

function RowCheckbox({ checked, onCheckedChange }: {
  checked: boolean | "indeterminate"; onCheckedChange: (v: boolean) => void
}) {
  return (
    <Checkbox.Root checked={checked} onCheckedChange={v => onCheckedChange(v === true)}
      style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: "pointer",
        outline: "none", display: "flex", alignItems: "center", justifyContent: "center",
        border: `1.5px solid ${checked ? "var(--primary)" : "var(--border-strong)"}`,
        background: checked ? "var(--primary)" : "transparent",
        transition: "background 120ms, border-color 120ms",
      }}>
      <Checkbox.Indicator>
        {checked === "indeterminate"
          ? <span style={{ width: 8, height: 2, background: "white", display: "block", borderRadius: 1 }} />
          : <Check className="size-2.5 text-white" strokeWidth={3} />}
      </Checkbox.Indicator>
    </Checkbox.Root>
  )
}

// ─── Avatar upload ────────────────────────────────────────────────────────────

function AvatarUpload({ userId, image, initials, onUploaded }: {
  userId: string; image: string | null; initials: string; onUploaded: (url: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  async function handleFile(file: File) {
    setError(""); setUploading(true)
    const fd = new FormData(); fd.append("avatar", file)
    try {
      const res = await fetch(`/api/users/${userId}/avatar`, { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Upload failed"); return }
      onUploaded(data.image)
    } catch { setError("Upload failed") }
    finally { setUploading(false) }
  }

  async function removeAvatar() {
    setUploading(true)
    try {
      await fetch(`/api/users/${userId}/avatar`, { method: "DELETE" })
      onUploaded(null)
    } finally { setUploading(false) }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative group">
        <div className="size-20 rounded-full overflow-hidden flex items-center justify-center text-[20px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          {image
            ? <Image src={image} alt="avatar" width={80} height={80}
                className="object-cover w-full h-full" unoptimized />
            : initials}
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "rgba(0,0,0,0.45)" }}>
          {uploading
            ? <Loader2 className="size-5 text-white animate-spin" />
            : <Camera className="size-5 text-white" />}
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>

      <div className="flex items-center gap-2 text-[12px]">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          style={{ color: "var(--primary)" }}>
          {image ? "Change photo" : "Upload photo"}
        </button>
        {image && <>
          <span style={{ color: "var(--border-strong)" }}>·</span>
          <button type="button" onClick={removeAvatar} disabled={uploading}
            style={{ color: "var(--danger)" }}>Remove</button>
        </>}
      </div>
      {error && <p className="text-[11px]" style={{ color: "var(--danger)" }}>{error}</p>}
      <p className="text-[11px]" style={{ color: "var(--foreground-subtle)" }}>
        JPEG · PNG · WebP · GIF — max 5 MB
      </p>
    </div>
  )
}

// ─── Add user dialog ──────────────────────────────────────────────────────────

function AddUserDialog({ onSuccess }: { onSuccess: (user: User) => void }) {
  const [open, setOpen]         = useState(false)
  const [name, setName]         = useState("")
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole]         = useState<Role>("VIEWER")
  const [error, setError]       = useState("")
  const [pending, start]        = useTransition()

  function reset() { setName(""); setEmail(""); setPassword(""); setRole("VIEWER"); setError("") }
  function close() { reset(); setOpen(false) }

  function submit() {
    if (!email)    { setError("Email is required"); return }
    if (!password) { setError("Password is required"); return }
    start(async () => {
      const res = await createUser({ name, email, password, role })
      if (res.error) { setError(res.error); return }
      onSuccess(res.user!)
      close()
    })
  }

  return (
    <>
      <Btn variant="primary" size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="size-3.5 mr-1.5" />Add user
      </Btn>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-card w-full max-w-lg space-y-5">
            <ModalHeader title="Add new user" onClose={close} />
            {error && <ErrorBanner msg={error} />}

            <div className="grid grid-cols-2 gap-3">
              <SectionDivider title="Account" />
              <Field label="Full name">
                <Input value={name} onChange={setName} placeholder="Jane Smith" />
              </Field>
              <Field label="Role">
                <select value={role} onChange={e => setRole(e.target.value as Role)} className="input-field">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Email *" span2>
                <Input value={email} onChange={setEmail} placeholder="jane@company.com" type="email" />
              </Field>

              <SectionDivider title="Password" />
              <Field label="Password *" span2>
                <PasswordInput value={password} onChange={setPassword} />
              </Field>
              <p className="col-span-2 text-[11px] -mt-1" style={{ color: "var(--foreground-subtle)" }}>
                The user can change their password after first login.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Btn variant="secondary" size="sm" onClick={close}>Cancel</Btn>
              <Btn variant="primary" size="sm" loading={pending} onClick={submit}>Create user</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Edit user dialog ─────────────────────────────────────────────────────────

function EditDialog({ user, onSuccess, onClose }: {
  user: User; onSuccess: (u: User) => void; onClose: () => void
}) {
  const [image,       setImage]       = useState(user.image)
  const [name,        setName]        = useState(user.name ?? "")
  const [role,        setRole]        = useState<Role>(user.role as Role)
  const [jobPosition, setJobPosition] = useState(user.jobPosition ?? "")
  const [phone,       setPhone]       = useState(user.phone ?? "")
  const [mobile,      setMobile]      = useState(user.mobile ?? "")
  const [address,     setAddress]     = useState(user.address ?? "")
  const [city,        setCity]        = useState(user.city ?? "")
  const [zip,         setZip]         = useState(user.zip ?? "")
  const [password,    setPassword]    = useState("")
  const [error,       setError]       = useState("")
  const [pending,     start]          = useTransition()

  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase()

  function submit() {
    start(async () => {
      const res = await updateUser(user.id, {
        name, role, jobPosition, phone, mobile, address, city, zip,
        ...(password ? { password } : {}),
      })
      if (res.error) { setError(res.error); return }
      onSuccess({ ...res.user!, image })
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-card w-full max-w-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <ModalHeader title="Edit user" onClose={onClose} />
        {error && <ErrorBanner msg={error} />}

        {/* Avatar */}
        <AvatarUpload
          userId={user.id} image={image} initials={initials}
          onUploaded={url => setImage(url)}
        />

        <div className="grid grid-cols-2 gap-3">
          {/* ── Account ── */}
          <SectionDivider title="Account" />
          <Field label="Full name">
            <Input value={name} onChange={setName} placeholder="Jane Smith" />
          </Field>
          <Field label="Role">
            <select value={role} onChange={e => setRole(e.target.value as Role)} className="input-field">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Email">
            <Input value={user.email} disabled />
          </Field>
          <Field label="Job position">
            <Input value={jobPosition} onChange={setJobPosition} placeholder="e.g. Sales Manager" />
          </Field>

          {/* ── Contact ── */}
          <SectionDivider title="Contact" />
          <Field label="Phone">
            <Input value={phone} onChange={setPhone} placeholder="+30 210 0000000" type="tel" />
          </Field>
          <Field label="Mobile">
            <Input value={mobile} onChange={setMobile} placeholder="+30 697 0000000" type="tel" />
          </Field>

          {/* ── Address ── */}
          <SectionDivider title="Address" />
          <Field label="Street address" span2>
            <Input value={address} onChange={setAddress} placeholder="123 Main St" />
          </Field>
          <Field label="City">
            <Input value={city} onChange={setCity} placeholder="Athens" />
          </Field>
          <Field label="ZIP / Postal code">
            <Input value={zip} onChange={setZip} placeholder="10431" />
          </Field>

          {/* ── Security ── */}
          <SectionDivider title="Security" />
          <Field label="New password" span2>
            <PasswordInput value={password} onChange={setPassword} placeholder="Leave blank to keep current password" />
          </Field>
        </div>

        <div className="flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" size="sm" loading={pending} onClick={submit}>Save changes</Btn>
        </div>
      </div>
    </div>
  )
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ user, onSuccess, onClose }: {
  user: User; onSuccess: (id: string) => void; onClose: () => void
}) {
  const [error, setError] = useState("")
  const [pending, start]  = useTransition()

  function confirm() {
    start(async () => {
      const res = await deleteUser(user.id)
      if (res.error) { setError(res.error); return }
      onSuccess(user.id); onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-card w-full max-w-sm space-y-4">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>Delete user?</h2>
        <p className="text-[13px]" style={{ color: "var(--foreground-muted)" }}>
          <strong style={{ color: "var(--foreground)" }}>{user.email}</strong> will be permanently removed.
        </p>
        {error && <ErrorBanner msg={error} />}
        <div className="flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" size="sm" loading={pending} onClick={confirm}>Delete</Btn>
        </div>
      </div>
    </div>
  )
}

// ─── Bulk delete confirm ──────────────────────────────────────────────────────

function BulkDeleteConfirm({ count, onConfirm, onClose, loading }: {
  count: number; onConfirm: () => void; onClose: () => void; loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-card w-full max-w-sm space-y-4">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
          Delete {count} user{count !== 1 ? "s" : ""}?
        </h2>
        <p className="text-[13px]" style={{ color: "var(--foreground-muted)" }}>
          This permanently removes the selected users. Cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" size="sm" loading={loading} onClick={onConfirm}>
            Delete {count} user{count !== 1 ? "s" : ""}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ─── Column picker ────────────────────────────────────────────────────────────

function ColumnPicker({ columns, visibleCols, onToggle }: {
  columns: ColDef[]; visibleCols: Set<string>; onToggle: (key: string) => void
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium"
          style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground-muted)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--foreground)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--foreground-muted)")}>
          <Columns3 className="size-3.5" />Columns
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6}
          style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)",
            padding: 6, minWidth: 170, zIndex: 100,
          }}>
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--foreground-muted)" }}>Toggle columns</p>
          {columns.map(col => (
            <DropdownMenu.CheckboxItem key={col.key}
              checked={visibleCols.has(col.key)}
              onCheckedChange={() => onToggle(col.key)}
              disabled={col.alwaysVisible === true}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] cursor-pointer outline-none select-none"
              style={{ color: col.alwaysVisible ? "var(--foreground-subtle)" : "var(--foreground)" }}
              onMouseEnter={e => { if (!col.alwaysVisible) (e.currentTarget as HTMLElement).style.background = "var(--muted)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}>
              <div style={{
                width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                border: `1.5px solid ${visibleCols.has(col.key) ? "var(--primary)" : "var(--border-strong)"}`,
                background: visibleCols.has(col.key) ? "var(--primary)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {visibleCols.has(col.key) && <Check className="size-2" color="white" strokeWidth={3} />}
              </div>
              {col.label}
              {col.alwaysVisible && (
                <span className="ml-auto text-[10px]" style={{ color: "var(--foreground-subtle)" }}>locked</span>
              )}
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// ─── Row action menu ──────────────────────────────────────────────────────────

function RowMenu({ user, isSelf, onEdit, onDelete }: {
  user: User; isSelf: boolean; onEdit: () => void; onDelete: () => void
}) {
  const itemStyle = (danger?: boolean) => ({
    display: "flex", alignItems: "center", gap: 8,
    padding: "6px 10px", borderRadius: 6, fontSize: 13,
    cursor: "pointer", outline: "none",
    color: danger ? "var(--danger)" : "var(--foreground)",
  })

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="p-1.5 rounded-md"
          style={{ color: "var(--foreground-muted)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--muted)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4}
          style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)",
            padding: 6, minWidth: 160, zIndex: 100,
          }}>
          <DropdownMenu.Item onSelect={onEdit} style={itemStyle()}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--muted)")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
            Edit user
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => navigator.clipboard.writeText(user.email)}
            style={itemStyle()}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--muted)")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
            <Copy className="size-3.5" />Copy email
          </DropdownMenu.Item>
          {!isSelf && <>
            <DropdownMenu.Separator style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
            <DropdownMenu.Item onSelect={onDelete} style={itemStyle(true)}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--danger-light)")}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
              <Trash2 className="size-3.5" />Delete user
            </DropdownMenu.Item>
          </>}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// ─── Sort header ──────────────────────────────────────────────────────────────

function SortHeader({ col, sortBy, sortDir, onSort }: {
  col: ColDef; sortBy: string | null; sortDir: SortDir; onSort: (key: string) => void
}) {
  const active = sortBy === col.key
  return (
    <button onClick={() => col.sortable && onSort(col.key)}
      className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider select-none"
      style={{ color: active ? "var(--foreground)" : "var(--foreground-muted)", cursor: col.sortable ? "pointer" : "default" }}>
      {col.label}
      {col.sortable && (active
        ? sortDir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
        : <ChevronsUpDown className="size-3 opacity-30" />)}
    </button>
  )
}

// ─── Resize handle ────────────────────────────────────────────────────────────

function ResizeHandle({ colKey, width, onResize }: {
  colKey: string; width: number; onResize: (key: string, width: number) => void
}) {
  const startXRef = useRef(0)
  const startWRef = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    startXRef.current = e.clientX
    startWRef.current = width

    function onMove(ev: MouseEvent) {
      const newW = Math.max(60, startWRef.current + (ev.clientX - startXRef.current))
      onResize(colKey, newW)
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  // width changes don't need to re-create — startWRef captures it at drag start
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colKey, onResize])

  return (
    <div
      onMouseDown={onMouseDown}
      title="Drag to resize"
      style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: 6,
        cursor: "col-resize", zIndex: 10, borderRadius: 2,
        transition: "background 120ms",
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--primary)")}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
    />
  )
}

// ─── Row avatar ───────────────────────────────────────────────────────────────

function UserAvatar({ user }: { user: User }) {
  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase()
  return (
    <div className="size-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
      style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
      {user.image
        ? <Image src={user.image} alt="" width={32} height={32} className="object-cover w-full h-full" unoptimized />
        : initials}
    </div>
  )
}

// ─── Cell renderer ────────────────────────────────────────────────────────────

function Cell({ col, user, currentUserId }: { col: ColDef; user: User; currentUserId: string }) {
  const dash = <span style={{ color: "var(--foreground-subtle)" }}>—</span>
  const muted = { color: "var(--foreground-muted)" } as const

  switch (col.key) {
    case "name":
      return (
        <div className="flex items-center gap-3">
          <UserAvatar user={user} />
          <div className="min-w-0">
            <p className="font-medium truncate" style={{ color: "var(--foreground)" }}>
              {user.name ?? dash}
              {user.id === currentUserId && (
                <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={{ background: "var(--primary-light)", color: "var(--primary)" }}>you</span>
              )}
            </p>
            <p className="text-[11px] truncate" style={muted}>{user.email}</p>
          </div>
        </div>
      )
    case "jobPosition": return <span className="text-[12px]" style={muted}>{user.jobPosition ?? dash}</span>
    case "role":        return <RoleBadge role={user.role} />
    case "phone":       return <span className="text-[12px]" style={muted}>{user.phone ?? dash}</span>
    case "mobile":      return <span className="text-[12px]" style={muted}>{user.mobile ?? dash}</span>
    case "address":     return <span className="text-[12px]" style={muted}>{user.address ?? dash}</span>
    case "city":        return <span className="text-[12px]" style={muted}>{user.city ?? dash}</span>
    case "zip":         return <span className="text-[12px]" style={muted}>{user.zip ?? dash}</span>
    case "createdAt":   return <span className="text-[12px]" style={muted}>{format(new Date(user.createdAt), "d MMM yyyy")}</span>
    default:            return null
  }
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

function sortUsers(users: User[], by: string | null, dir: SortDir): User[] {
  if (!by) return users
  return [...users].sort((a, b) => {
    let av: string | Date | null = null
    let bv: string | Date | null = null
    if (by === "name")        { av = a.name ?? a.email; bv = b.name ?? b.email }
    else if (by === "jobPosition") { av = a.jobPosition; bv = b.jobPosition }
    else if (by === "role")        { av = a.role;        bv = b.role }
    else if (by === "city")        { av = a.city;        bv = b.city }
    else if (by === "createdAt")   { av = a.createdAt;   bv = b.createdAt }
    if (av === null && bv === null) return 0
    if (av === null) return 1; if (bv === null) return -1
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return dir === "asc" ? cmp : -cmp
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function UsersTable({ users: initial, currentUserId }: {
  users: User[]; currentUserId: string
}) {
  const [users,     setUsers]    = useState(initial)
  const [editing,   setEditing]  = useState<User | null>(null)
  const [deleting,  setDeleting] = useState<User | null>(null)
  const [selected,  setSelected] = useState<Set<string>>(new Set())
  const [showBulk,  setShowBulk] = useState(false)
  const [bulkPend,  startBulk]   = useTransition()
  const [sortBy,    setSortBy]   = useState<string | null>(null)
  const [sortDir,   setSortDir]  = useState<SortDir>("asc")
  const [page,      setPage]     = useState(1)

  const { visibleCols, toggleCol, pageSize, setPageSize, colWidths, setColWidth, hydrated } =
    useTablePrefs("users", COLUMNS, 25, DEFAULT_COL_WIDTHS)

  const visibleColDefs = COLUMNS.filter(c => visibleCols.has(c.key))

  const sorted    = useMemo(() => sortUsers(users, sortBy, sortDir), [users, sortBy, sortDir])
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage  = Math.min(page, totalPages)
  const pageRows  = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  function handleSort(key: string) {
    setSortBy(prev => { if (prev === key) setSortDir(d => d === "asc" ? "desc" : "asc"); return key })
    setPage(1)
  }

  // Select
  const pageIds         = pageRows.map(u => u.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id))
  const someSelected    = pageIds.some(id => selected.has(id))

  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev)
      allPageSelected ? pageIds.forEach(id => next.delete(id)) : pageIds.forEach(id => next.add(id))
      return next
    })
  }

  function toggleRow(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // Bulk delete
  function confirmBulk() {
    startBulk(async () => {
      const ids = Array.from(selected).filter(id => id !== currentUserId)
      await deleteUsers(ids)
      setUsers(prev => prev.filter(u => !ids.includes(u.id)))
      setSelected(new Set())
      setShowBulk(false)
    })
  }

  const bulkCount = Array.from(selected).filter(id => id !== currentUserId).length

  return (
    <>
      <div className="rounded-xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-xs)" }}>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            {selected.size > 0 ? <>
              <span className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                {selected.size} selected
              </span>
              <button onClick={() => setShowBulk(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium"
                style={{ background: "var(--danger-light)", color: "var(--danger-fg)", border: "1px solid #fca5a5" }}>
                <Trash2 className="size-3.5" />Delete selected
              </button>
              <button onClick={() => setSelected(new Set())} className="text-[12px]"
                style={{ color: "var(--foreground-muted)" }}>Clear</button>
            </> : (
              <p className="text-[12px] font-medium" style={{ color: "var(--foreground-muted)" }}>
                {users.length} user{users.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hydrated && <ColumnPicker columns={COLUMNS} visibleCols={visibleCols} onToggle={toggleCol} />}
            <AddUserDialog onSuccess={u => { setUsers(prev => [...prev, u]); setPage(1) }} />
          </div>
        </div>

        {/* Table */}
        {users.length === 0 ? (
          <div className="py-16 text-center text-[13px]" style={{ color: "var(--foreground-muted)" }}>
            No users yet. Add the first one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-[13px]" style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}>
              <colgroup>
                <col style={{ width: 40 }} />
                {visibleColDefs.map(col => (
                  <col key={col.key} style={{ width: colWidths[col.key] ?? DEFAULT_COL_WIDTHS[col.key] ?? 140 }} />
                ))}
                <col style={{ width: 44 }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}>
                  <th className="pl-4 pr-2 py-3">
                    <RowCheckbox
                      checked={allPageSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  {visibleColDefs.map(col => (
                    <th key={col.key} className="px-4 py-3 text-left" style={{ position: "relative", overflow: "hidden" }}>
                      <SortHeader col={col} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                      <ResizeHandle
                        colKey={col.key}
                        width={colWidths[col.key] ?? DEFAULT_COL_WIDTHS[col.key] ?? 140}
                        onResize={setColWidth}
                      />
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((user, i) => {
                  const isSel = selected.has(user.id)
                  return (
                    <tr key={user.id} style={{
                      borderBottom: i < pageRows.length - 1 ? "1px solid var(--border)" : "none",
                      background: isSel ? "var(--primary-light)" : "transparent",
                    }}>
                      <td className="pl-4 pr-2 py-3">
                        <RowCheckbox checked={isSel} onCheckedChange={() => toggleRow(user.id)} />
                      </td>
                      {visibleColDefs.map(col => (
                        <td key={col.key} className="px-4 py-3" style={{ overflow: "hidden" }}>
                          <Cell col={col} user={user} currentUserId={currentUserId} />
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        <RowMenu
                          user={user} isSelf={user.id === currentUserId}
                          onEdit={() => setEditing(user)}
                          onDelete={() => setDeleting(user)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {users.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 gap-4"
            style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--foreground-muted)" }}>
              <span>Rows per page</span>
              <select value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value) as PageSize); setPage(1) }}
                className="input-field" style={{ width: "auto", padding: "3px 8px", fontSize: 12 }}>
                {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--foreground-muted)" }}>
              <span>
                {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} of {sorted.length}
              </span>
              <button onClick={() => setPage(p => p - 1)} disabled={safePage <= 1}
                className="p-1 rounded" style={{ color: safePage <= 1 ? "var(--foreground-subtle)" : "var(--foreground-muted)", cursor: safePage <= 1 ? "not-allowed" : "pointer" }}>
                <ChevronLeft className="size-4" />
              </button>
              <span style={{ color: "var(--foreground)", fontWeight: 500 }}>{safePage} / {totalPages}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={safePage >= totalPages}
                className="p-1 rounded" style={{ color: safePage >= totalPages ? "var(--foreground-subtle)" : "var(--foreground-muted)", cursor: safePage >= totalPages ? "not-allowed" : "pointer" }}>
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <EditDialog user={editing}
          onSuccess={u => setUsers(prev => prev.map(x => x.id === u.id ? u : x))}
          onClose={() => setEditing(null)} />
      )}
      {deleting && (
        <DeleteConfirm user={deleting}
          onSuccess={id => setUsers(prev => prev.filter(x => x.id !== id))}
          onClose={() => setDeleting(null)} />
      )}
      {showBulk && (
        <BulkDeleteConfirm count={bulkCount} onConfirm={confirmBulk}
          onClose={() => setShowBulk(false)} loading={bulkPend} />
      )}

      <style>{`
        .input-field {
          width: 100%;
          padding: 7px 10px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-strong);
          background: var(--background);
          color: var(--foreground);
          font-size: 13px;
          outline: none;
          transition: border-color 150ms;
        }
        .input-field:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 12%, transparent);
        }
        .input-field::placeholder { color: var(--foreground-subtle); }
        .modal-card {
          background: var(--surface);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-xl);
          border-radius: var(--radius-xl);
          padding: 24px;
        }
      `}</style>
    </>
  )
}
