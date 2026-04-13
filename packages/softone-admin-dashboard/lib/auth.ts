// Auth.js v5 configuration
// Uses Prisma adapter + credentials provider (Node / Route Handlers only).
// Proxy uses `auth.config.ts` so Prisma is not bundled into middleware.

import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import type { UserRole } from "@softone/sync"
import { authConfig } from "@/lib/auth.config"
import { getReadableResourceKeysForRole } from "@/lib/rbac-policy"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      authConfig.callbacks?.jwt?.(params)
      if (params.user) {
        const role = (params.user as { role?: string }).role ?? "VIEWER"
        params.token.readResources = await getReadableResourceKeysForRole(role)
      }
      return params.token
    },
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await db.user.findUnique({
          where: { email: String(credentials.email) },
        })

        if (!user?.password) return null

        const valid = await bcrypt.compare(String(credentials.password), user.password)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role as UserRole,
        }
      },
    }),
  ],
})
