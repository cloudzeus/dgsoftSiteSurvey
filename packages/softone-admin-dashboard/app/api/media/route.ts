import { assertApiAccess } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { bunnyUpload } from "@/lib/bunny"
import { toWebP } from "@/lib/image"
import sharp from "sharp"

const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml"]
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-msvideo"]
const ALLOWED_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES]

const MAX_IMAGE_BYTES = 20 * 1024 * 1024 // 20 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024 // 200 MB

const VIDEO_EXT: Record<string, string> = {
  "video/mp4":        "mp4",
  "video/webm":       "webm",
  "video/ogg":        "ogv",
  "video/quicktime":  "mov",
  "video/x-msvideo":  "avi",
}

function uniqueName() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// GET /api/media?folderId=xxx  →  { folders, files }
export async function GET(req: Request) {
  await assertApiAccess(req)
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const folderId = searchParams.get("folderId") || null

    const [folders, files] = await Promise.all([
      db.mediaFolder.findMany({
        where: { parentId: folderId },
        orderBy: { name: "asc" },
        include: {
          _count: { select: { files: true, children: true } },
        },
      }),
      db.mediaFile.findMany({
        where: { folderId },
        orderBy: { createdAt: "desc" },
      }),
    ])

    return NextResponse.json({ folders, files })
  } catch (err) {
    console.error("[GET /api/media]", err)
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal server error" },
      { status: 500 },
    )
  }
}

// POST /api/media  →  multipart: files[] + folderId?
export async function POST(req: Request) {
  await assertApiAccess(req)
  const session = await auth()
  if (!session?.user) return new Response("Unauthorized", { status: 401 })

  const formData = await req.formData()
  const folderId = (formData.get("folderId") as string | null) || null
  const rawFiles = formData.getAll("files")

  if (!rawFiles.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 })
  }

  // Validate folder exists if provided
  if (folderId) {
    const folder = await db.mediaFolder.findUnique({ where: { id: folderId } })
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 })
  }

  const results: { success: boolean; file?: object; name?: string; error?: string }[] = []

  for (const raw of rawFiles) {
    if (!(raw instanceof File)) continue

    const { name, type, size } = raw

    if (!ALLOWED_TYPES.includes(type)) {
      results.push({ success: false, name, error: "Unsupported file type" })
      continue
    }

    const isImage = IMAGE_TYPES.includes(type)
    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES

    if (size > maxBytes) {
      results.push({ success: false, name, error: `File exceeds ${isImage ? "20 MB" : "200 MB"} limit` })
      continue
    }

    try {
      const rawBuffer = Buffer.from(await raw.arrayBuffer())
      const slug = `${folderId ?? "root"}/${uniqueName()}`

      let uploadBuffer: Buffer
      let contentType: string
      let ext: string
      let width: number | null = null
      let height: number | null = null

      if (isImage) {
        const converted = await toWebP(rawBuffer, type)
        uploadBuffer = converted.buffer
        contentType = converted.contentType
        ext = converted.ext

        if (type !== "image/svg+xml") {
          const meta = await sharp(converted.buffer).metadata()
          width = meta.width ?? null
          height = meta.height ?? null
        }
      } else {
        uploadBuffer = rawBuffer
        contentType = type
        ext = VIDEO_EXT[type] ?? "mp4"
      }

      const path = `media/${slug}.${ext}`
      const cdnUrl = await bunnyUpload(path, uploadBuffer, contentType)

      const record = await db.mediaFile.create({
        data: {
          name,
          cdnUrl,
          mimeType: isImage ? contentType : type,
          size,
          width,
          height,
          folderId,
          uploadedBy: (session.user as { id?: string }).id ?? null,
        },
      })

      results.push({ success: true, file: record })
    } catch (err) {
      results.push({ success: false, name, error: (err as Error).message })
    }
  }

  const failed = results.filter(r => !r.success)
  if (failed.length === rawFiles.length) {
    return NextResponse.json({ error: "All uploads failed", results }, { status: 500 })
  }

  return NextResponse.json({ results }, { status: 201 })
}
