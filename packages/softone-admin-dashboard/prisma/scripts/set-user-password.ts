/**
 * One-off: set bcrypt password for a user (e.g. after DB copy when hashes don’t match this app).
 * Usage: npx tsx prisma/scripts/set-user-password.ts <email> <plainPassword>
 */
import { config as loadEnv } from "dotenv"
import path from "node:path"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

loadEnv({ path: path.join(process.cwd(), ".env.local") })
loadEnv({ path: path.join(process.cwd(), ".env") })

async function main() {
  const email = process.argv[2]
  const plain = process.argv[3]
  if (!email || !plain) {
    console.error("Usage: npx tsx prisma/scripts/set-user-password.ts <email> <plainPassword>")
    process.exit(1)
  }

  const db = new PrismaClient()
  try {
    const existing = await db.user.findUnique({ where: { email } })
    if (!existing) {
      console.error("User not found:", email)
      process.exit(1)
    }
    const hash = await bcrypt.hash(plain, 12)
    await db.user.update({ where: { email }, data: { password: hash } })
    console.log("OK: password updated for", email)
  } finally {
    await db.$disconnect()
  }
}

void main()
