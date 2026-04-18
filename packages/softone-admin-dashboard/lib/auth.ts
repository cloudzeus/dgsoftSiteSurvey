// Auth.js v5 configuration
// Uses Prisma adapter + credentials provider + Microsoft Entra ID (Office 365 SSO).
// Proxy uses `auth.config.ts` so Prisma is not bundled into middleware.

import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import type { UserRole } from "@softone/sync"
import { authConfig } from "@/lib/auth.config"
import { getReadableResourceKeysForRole } from "@/lib/rbac-policy"

const MS_TENANT  = process.env.MICROSOFT_TENANT_ID  || process.env.AZURE_AD_TENANT_ID  || process.env.TENANT_ID
const MS_CLIENT  = process.env.MICROSOFT_CLIENT_ID  || process.env.AZURE_AD_CLIENT_ID  || process.env.CLIENT_SECRET_ID
const MS_SECRET  = process.env.MICROSOFT_CLIENT_SECRET || process.env.AZURE_AD_CLIENT_SECRET || process.env.CLIENT_SECRET_VALUE
const MS_ENABLED = Boolean(MS_TENANT && MS_CLIENT && MS_SECRET)

export const microsoftAuthEnabled = MS_ENABLED

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // Microsoft sign-in: only allow users that have already been provisioned
      // (imported from the M365 tenant or created manually). This blocks random
      // tenant members from signing themselves in.
      if (account?.provider === "microsoft-entra-id") {
        if (!user.email) return "/login?error=NoEmail"
        const existing = await db.user.findUnique({ where: { email: user.email } })
        if (!existing) return "/login?error=NotImported"
      }
      return true
    },
    async jwt(params) {
      authConfig.callbacks?.jwt?.(params)
      if (params.user) {
        // For OAuth sign-in, user.role isn't populated — read from DB by email.
        let role = (params.user as { role?: string }).role
        if (!role && params.user.email) {
          const dbUser = await db.user.findUnique({
            where: { email: params.user.email },
            select: { role: true },
          })
          role = dbUser?.role
        }
        role = role ?? "VIEWER"
        params.token.role = role
        params.token.readResources = await getReadableResourceKeysForRole(role)
      }
      return params.token
    },
  },
  providers: [
    ...(MS_ENABLED
      ? [
          MicrosoftEntraID({
            clientId: MS_CLIENT!,
            clientSecret: MS_SECRET!,
            issuer: `https://login.microsoftonline.com/${MS_TENANT}/v2.0`,
            // Auto-link OAuth account to existing User row when emails match
            // (pre-imported users sign in seamlessly).
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
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
