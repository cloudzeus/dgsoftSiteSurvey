import { NextResponse } from "next/server"
import { gzip } from "zlib"
import { promisify } from "util"
import mysql from "mysql2/promise"
import { db } from "@/lib/db"
import { bunnyUpload } from "@/lib/bunny"
import { assertApiAccess } from "@/lib/permissions"

const gzipAsync = promisify(gzip)

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

// GET /api/backups — list all backups
export async function GET(req: Request) {
  await assertApiAccess(req)
  const backups = await db.databaseBackup.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(backups)
}

// POST /api/backups — trigger a new backup
export async function POST(req: Request) {
  await assertApiAccess(req)

  const now = new Date()
  const ts = now.toISOString().replace(/[:.]/g, "-").replace("Z", "")
  const filename = `backup-${ts}.sql.gz`
  const bunnyPath = `db-backups/${now.toISOString().slice(0, 10)}/${filename}`

  const record = await db.databaseBackup.create({ data: { filename, status: "PENDING" } })

  runBackup(record.id, bunnyPath).catch(async (err) => {
    console.error("[backup] Failed:", err)
    await db.databaseBackup.update({
      where: { id: record.id },
      data: { status: "FAILED", notes: String(err) },
    })
  })

  return NextResponse.json(record, { status: 202 })
}

async function runBackup(id: string, bunnyPath: string) {
  const conn = parseDatabaseUrl(process.env.DATABASE_URL!)
  const connection = await mysql.createConnection(conn)

  try {
    const sql = await dumpDatabase(connection, conn.database)
    const compressed = await gzipAsync(Buffer.from(sql, "utf8"))
    const cdnUrl = await bunnyUpload(bunnyPath, compressed, "application/gzip")

    await db.databaseBackup.update({
      where: { id },
      data: {
        status: "COMPLETED",
        bunnyUrl: cdnUrl,
        bunnyPath,
        fileSizeBytes: BigInt(compressed.length),
        completedAt: new Date(),
      },
    })
  } finally {
    await connection.end()
  }
}

async function dumpDatabase(connection: mysql.Connection, database: string): Promise<string> {
  const lines: string[] = []

  lines.push(`-- Database backup: ${database}`)
  lines.push(`-- Generated: ${new Date().toISOString()}`)
  lines.push(`SET FOREIGN_KEY_CHECKS=0;`)
  lines.push(`SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";`)
  lines.push(`SET NAMES utf8mb4;`)
  lines.push(``)

  // Get all tables
  const [tables] = await connection.query<mysql.RowDataPacket[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
    [database]
  )

  for (const row of tables) {
    const table = row.TABLE_NAME as string

    // CREATE TABLE
    const [[createRow]] = await connection.query<mysql.RowDataPacket[]>(`SHOW CREATE TABLE \`${database}\`.\`${table}\``)
    lines.push(`DROP TABLE IF EXISTS \`${table}\`;`)
    lines.push((createRow["Create Table"] as string) + ";")
    lines.push(``)

    // Row data in batches
    const [[{ count }]] = await connection.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${database}\`.\`${table}\``)
    const total = Number(count)
    const BATCH = 500

    for (let offset = 0; offset < total; offset += BATCH) {
      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        `SELECT * FROM \`${database}\`.\`${table}\` LIMIT ? OFFSET ?`,
        [BATCH, offset]
      )
      if (rows.length === 0) break

      const cols = Object.keys(rows[0]).map((c) => `\`${c}\``).join(", ")
      const values = rows.map((r) =>
        "(" +
        Object.values(r)
          .map((v) => {
            if (v === null) return "NULL"
            if (typeof v === "number" || typeof v === "bigint") return String(v)
            if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace("T", " ")}'`
            if (Buffer.isBuffer(v)) return `X'${v.toString("hex")}'`
            return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r")}'`
          })
          .join(", ") +
        ")"
      )

      lines.push(`INSERT INTO \`${table}\` (${cols}) VALUES`)
      lines.push(values.join(",\n") + ";")
      lines.push(``)
    }
  }

  lines.push(`SET FOREIGN_KEY_CHECKS=1;`)
  return lines.join("\n")
}
