// Route protection for Next.js 16 (proxy replaces middleware).
// Use Prisma-free auth config so Turbopack does not bundle @prisma/client here.
import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { NextResponse } from "next/server"
import { pathnameToPageResource } from "@/lib/rbac-resources"
import { userCanReadResource } from "@/lib/rbac-builtins"

const { auth } = NextAuth(authConfig)

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/api/")) return NextResponse.next()
  if (pathname === "/login" || pathname.startsWith("/login/")) return NextResponse.next()
  if (pathname === "/access-denied" || pathname.startsWith("/access-denied/")) {
    return NextResponse.next()
  }

  if (!req.auth?.user) {
    const login = new URL("/login", req.url)
    login.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(login)
  }

  const resource = pathnameToPageResource(pathname)
  if (resource) {
    const u = req.auth.user as { role?: string; readResources?: string[] }
    if (!userCanReadResource(u, resource)) {
      return NextResponse.redirect(new URL("/access-denied", req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
}
