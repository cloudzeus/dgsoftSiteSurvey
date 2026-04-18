import { ExcelWizard } from "@/components/import/excel-wizard"

export const metadata = { title: "Excel Import" }

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Excel Import
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          Upload a spreadsheet, map columns to any connected service, and import your data in minutes
        </p>
      </div>

      <ExcelWizard />
    </div>
  )
}
