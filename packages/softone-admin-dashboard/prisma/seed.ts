import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { RESOURCE_KEYS } from "../lib/rbac-resources"
import { builtinPerm } from "../lib/rbac-builtins"

const db = new PrismaClient()

async function main() {
  // ─── Admin user ───────────────────────────────────────────────────────────────
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env")
  }

  const hash = await bcrypt.hash(password, 12)

  const user = await db.user.upsert({
    where: { email },
    create: {
      email,
      name: "Giannis Kozyris",
      password: hash,
      role: "ADMIN",
      emailVerified: new Date(),
    },
    update: {
      password: hash,
      role: "ADMIN",
    },
  })

  console.log(`✓ Super admin seeded: ${user.email} (role: ${user.role})`)

  // ─── Softone connection ───────────────────────────────────────────────────────
  // Credentials stored in DB only — never in env vars.
  const existing = await db.softoneConnection.findFirst({ where: { name: "DGSmart Softone" } })

  if (existing) {
    await db.softoneConnection.update({
      where: { id: existing.id },
      data: {
        baseUrl: "https://dgsoft.oncloud.gr",
        username: "dgsmart",
        password: "123dgSm@rt!@#",
        appId: "2000",
        isDefault: true,
        isActive: true,
      },
    })
    console.log(`✓ Softone connection updated (id: ${existing.id})`)
  } else {
    const conn = await db.softoneConnection.create({
      data: {
        name: "DGSmart Softone",
        baseUrl: "https://dgsoft.oncloud.gr",
        username: "dgsmart",
        password: "123dgSm@rt!@#",
        appId: "2000",
        company: "",
        branch: "",
        module: "",
        refId: "",
        isDefault: true,
        isActive: true,
      },
    })
    console.log(`✓ Softone connection created (id: ${conn.id})`)
  }

  // ─── Default RolePermission rows (only if table empty) ───────────────────────
  const permCount = await db.rolePermission.count()
  if (permCount === 0) {
    for (const role of ["OPERATOR", "VIEWER"] as const) {
      for (const resource of RESOURCE_KEYS) {
        const p = builtinPerm(role, resource)
        await db.rolePermission.create({
          data: { role, resource, ...p },
        })
      }
    }
    console.log("✓ RolePermission defaults seeded for OPERATOR + VIEWER")
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
