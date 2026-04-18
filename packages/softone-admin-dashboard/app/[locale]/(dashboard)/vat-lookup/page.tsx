import { VatLookupTabs } from "@/components/aeede/vat-lookup-tabs"

export const metadata = { title: "VAT & ΓΕΜΗ Lookup" }

export default function VatLookupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Αναζήτηση Επιχειρήσεων
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          AEEDE (στοιχεία ΑΦΜ & ΚΑΔ) και ΓΕΜΗ (μητρώο επιχειρήσεων)
        </p>
      </div>
      <VatLookupTabs />
    </div>
  )
}
