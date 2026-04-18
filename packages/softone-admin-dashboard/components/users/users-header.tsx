"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Users as UsersIcon } from "lucide-react"
import { Btn } from "@/components/ui/btn"
import { MicrosoftImportDialog } from "./microsoft-import-dialog"

export function UsersHeader({ count, microsoftEnabled }: { count: number; microsoftEnabled: boolean }) {
  const router = useRouter()
  const [importOpen, setImportOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            Χρήστες
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
            {count} χρήστ{count === 1 ? "ης" : "ες"} · διαχείριση λογαριασμών και ρόλων
          </p>
        </div>
        {microsoftEnabled && (
          <Btn variant="secondary" size="md" onClick={() => setImportOpen(true)}>
            <UsersIcon className="size-3.5 text-sky-400" />
            Εισαγωγή από Microsoft 365
          </Btn>
        )}
      </div>

      <MicrosoftImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => router.refresh()}
      />
    </>
  )
}
