import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

// GET /api/users — list all users (ADMIN only)
export async function GET(req: Request) {
  await assertApiAccess(req)

  const users = await db.user.findMany({
    select: {
      id: true, name: true, email: true, role: true,
      image: true, jobPosition: true,
      phone: true, mobile: true,
      address: true, city: true, zip: true,
      createdAt: true, updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(users)
}

// POST /api/users — create user (ADMIN only)
export async function POST(req: Request) {
  await assertApiAccess(req)

  const body = await req.json()
  const { name, email, password, role } = body

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }

  const validRoles = ["ADMIN", "OPERATOR", "VIEWER"]
  if (role && !validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 })
  }

  const hash = await bcrypt.hash(password, 12)

  const user = await db.user.create({
    data: {
      name: name || null,
      email,
      password: hash,
      role: role ?? "VIEWER",
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true },
  })

  return NextResponse.json(user, { status: 201 })
}
