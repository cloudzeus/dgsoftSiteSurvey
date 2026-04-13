import { NextResponse } from "next/server"
import { gunzip } from "zlib"
import { promisify } from "util"
import mysql from "mysql2/promise"
import { db } from "@/lib/db"
import { assertApiAccess } from "@/lib/permissions"

const gunzipAsync = promisify(gunzip)

type Params = { params: Promise<{ id: string }> }

function parseDatabaseUrl(url: string) {
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):?(\d+)?\/(.+)/)
  if (!match) throw new Error("Cannot parse DATABASE_URL")
  return {
    user: match[1],
    password: decodeURIComponent(match[2]),
    host: match[3],
    port: parseInt(match[4] ?? "3306", 10),
    database: match[5].split("?")[0],
  }
}

// POST /api/backups/[id]/restore
export async function POST(req: Request, { params }: Params) {
  await assertApiAccess(req)
  const { id } = await params

  const backup = await db.databaseBackup.findUnique({ where: { id } })
  if (!backup) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (backup.status !== "COMPLETED")
    return NextResponse.json({ error: "Backup is not in COMPLETED state" }, { status: 400 })
  if (!backup.bunnyUrl)
    return NextResponse.json({ error: "No CDN URL on this backup" }, { status: 400 })

  const res = await fetch(backup.bunnyUrl)
  if (!res.ok)
    return NextResponse.json({ error: `Failed to download backup (${res.status})` }, { status: 502 })

  const compressed = Buffer.from(await res.arrayBuffer())
  const sql = (await gunzipAsync(compressed)).toString("utf8")

  const conn = parseDatabaseUrl(process.env.DATABASE_URL!)
  const connection = await mysql.createConnection({ ...conn, multipleStatements: true })

  try {
    await connection.query(sql)
  } finally {
    await connection.end()
  }

  const restoredAt = new Date()
  await db.databaseBackup.update({ where: { id }, data: { restoredAt } })

  return NextResponse.json({ ok: true, restoredAt })
}
