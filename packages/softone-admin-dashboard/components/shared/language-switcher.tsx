"use client"

import { useLocale, useTranslations } from "next-intl"
import { useRouter, usePathname } from "next/navigation"
import { locales } from "@/i18n"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Globe } from "lucide-react"

interface LanguageSwitcherProps {
  variant?: "default" | "sidebar"
}

const LOCALE_LABELS: Record<string, string> = {
  el: "Ελληνικά",
  en: "English",
}

export function LanguageSwitcher({ variant = "default" }: LanguageSwitcherProps) {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations("navigation.actions")

  const handleLanguageChange = (newLocale: string) => {
    if (newLocale === locale) return
    const segments = pathname.split("/")
    segments[1] = newLocale
    router.push(segments.join("/"))
  }

  const isSidebar = variant === "sidebar"

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={
            isSidebar
              ? "p-1 rounded flex-shrink-0 transition-colors"
              : "size-9 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }
          style={isSidebar ? { color: "var(--sidebar-icon)" } : undefined}
          title={t("changeLanguage")}
          onMouseEnter={(e) => {
            if (isSidebar) e.currentTarget.style.color = "rgba(255,255,255,0.85)"
          }}
          onMouseLeave={(e) => {
            if (isSidebar) e.currentTarget.style.color = "var(--sidebar-icon)"
          }}
        >
          <Globe className="size-3.5" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-36 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg p-1 animate-in fade-in zoom-in-95 duration-150"
        >
          {locales.map((loc) => (
            <DropdownMenu.Item
              key={loc}
              onSelect={() => handleLanguageChange(loc)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer select-none outline-none hover:bg-[var(--muted)] transition-colors"
            >
              <span className={locale === loc ? "font-semibold" : ""}>{LOCALE_LABELS[loc]}</span>
              {locale === loc && <span className="ml-auto text-xs font-bold">✓</span>}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
