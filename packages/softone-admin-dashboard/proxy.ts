// Route protection for Next.js 16 (proxy replaces middleware).
// Combines next-intl locale routing with NextAuth-based auth + RBAC.
// Uses Prisma-free auth config so Turbopack does not bundle @prisma/client here.
import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { NextResponse } from "next/server"
import createIntlMiddleware from "next-intl/middleware"
import { defaultLocale, locales } from "@/i18n"
import { pathnameToPageResource } from "@/lib/rbac-resources"
import { userCanReadResource } from "@/lib/rbac-builtins"

const { auth } = NextAuth(authConfig)

const intl = createIntlMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: "always",
})

function splitLocale(pathname: string): { locale: string; rest: string } {
  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0]
  if (first && (locales as readonly string[]).includes(first)) {
    return { locale: first, rest: "/" + segments.slice(1).join("/") }
  }
  return { locale: defaultLocale, rest: pathname }
}

function isPublicPath(rest: string): boolean {
  if (rest === "/login" || rest.startsWith("/login/")) return true
  if (rest === "/access-denied" || rest.startsWith("/access-denied/")) return true
  if (rest.startsWith("/survey-invite/")) return true
  return false
}

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/api/")) return NextResponse.next()

  // Let next-intl handle locale routing first (e.g. "/" → "/el", "/dashboard" → "/el/dashboard").
  const intlResponse = intl(req)

  // If next-intl issued a redirect or rewrite (locale prefix injection), honor it immediately.
  if (intlResponse.status === 307 || intlResponse.status === 308) {
    return intlResponse
  }

  const { locale, rest } = splitLocale(pathname)

  if (isPublicPath(rest)) return intlResponse

  if (!req.auth?.user) {
    const login = new URL(`/${locale}/login`, req.url)
    login.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(login)
  }

  const resource = pathnameToPageResource(rest)
  if (resource) {
    const u = req.auth.user as { role?: string; readResources?: string[] }
    if (!userCanReadResource(u, resource)) {
      return NextResponse.redirect(new URL(`/${locale}/access-denied`, req.url))
    }
  }

  return intlResponse
})

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
}
