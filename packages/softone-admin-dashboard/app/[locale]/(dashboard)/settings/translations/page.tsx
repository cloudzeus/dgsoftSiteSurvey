import { loadTranslations } from "@/app/actions/translations"
import { TranslationsEditor } from "@/components/translations/translations-editor"
import { getTranslations } from "next-intl/server"

export const metadata = { title: "Translations" }
export const dynamic = "force-dynamic"

export default async function TranslationsPage() {
  const [{ entries }, t] = await Promise.all([
    loadTranslations(),
    getTranslations("translationsPage"),
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
          {t("title")}
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--muted-foreground)" }}>
          {t("subtitle")}
        </p>
      </div>
      <TranslationsEditor initialEntries={entries} />
    </div>
  )
}
