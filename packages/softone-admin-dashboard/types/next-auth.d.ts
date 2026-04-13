import type { DefaultSession } from "next-auth"
import type { ResourceKey } from "@/lib/rbac-resources"

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string
      role?: string
      readResources?: ResourceKey[]
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
    readResources?: ResourceKey[]
  }
}
