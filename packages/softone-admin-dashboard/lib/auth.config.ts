// Edge / proxy–safe Auth.js options (no Prisma, no Node-only deps).
// Full sign-in + adapter live in `auth.ts`.

import type { NextAuthConfig } from "next-auth"
import { AuthError, JWTSessionError } from "@auth/core/errors"

const AUTH_SECRET = (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "").trim()
if (!AUTH_SECRET) {
  throw new Error(
    "AUTH_SECRET is missing or empty. Set AUTH_SECRET in .env.local (see .env.local.example; run `npx auth secret`).",
  )
}

function logAuthError(error: Error) {
  const red = "\x1b[31m"
  const reset = "\x1b[0m"
  const name = error instanceof AuthError ? error.type : error.name
  console.error(`${red}[auth][error]${reset} ${name}: ${error.message}`)
  if (
    error.cause &&
    typeof error.cause === "object" &&
    "err" in error.cause &&
    error.cause.err instanceof Error
  ) {
    console.error(`${red}[auth][cause]${reset}:`, error.cause.err.stack)
  } else if (error.stack) {
    console.error(error.stack.replace(/.*/, "").substring(1))
  }
}

export const authConfig = {
  trustHost: true,
  secret: AUTH_SECRET,
  logger: {
    error(error: Error) {
      if (error instanceof JWTSessionError) return
      logAuthError(error)
    },
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = (user as { role?: string }).role
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as string | undefined
        session.user.readResources = token.readResources as typeof session.user.readResources
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
} satisfies NextAuthConfig
