import { VatLookup } from "@/components/aeede/vat-lookup"

export const metadata = { title: "AEEDE VAT Info" }

export default function VatLookupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          AEEDE VAT Info
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          Αναζήτηση στοιχείων εταιρείας και ΚΑΔ μέσω ΑΦΜ
        </p>
      </div>
      <VatLookup />
    </div>
  )
}
