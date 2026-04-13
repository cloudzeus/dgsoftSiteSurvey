import { assertApiAccess } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { bunnyDelete } from "@/lib/bunny"

// Recursively collect all file cdnUrls within a folder tree, then delete everything
async function deleteFolderTree(folderId: string): Promise<void> {
  const files = await db.mediaFile.findMany({
    where: { folderId },
    select: { cdnUrl: true },
  })

  // Delete CDN files in parallel
  await Promise.all(files.map(f => bunnyDelete(f.cdnUrl)))

  // Delete DB files
  await db.mediaFile.deleteMany({ where: { folderId } })

  // Recurse into children
  const children = await db.mediaFolder.findMany({
    where: { parentId: folderId },
    select: { id: true },
  })
  await Promise.all(children.map(c => deleteFolderTree(c.id)))

  // Delete the folder itself
  await db.mediaFolder.delete({ where: { id: folderId } })
}

// DELETE /api/media/folders/[id]
// ?force=true  →  recursive delete (all files + subfolders)
// default      →  only deletes if empty
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertApiAccess(req)
  const session = await auth()
  if (!session?.user) return new Response("Unauthorized", { status: 401 })

  const { id } = await params
  const force = new URL(req.url).searchParams.get("force") === "true"

  const folder = await db.mediaFolder.findUnique({
    where: { id },
    include: {
      _count: { select: { files: true, children: true } },
    },
  })

  if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 })

  const isEmpty = folder._count.files === 0 && folder._count.children === 0

  if (!isEmpty && !force) {
    return NextResponse.json(
      {
        error: "Folder is not empty",
        fileCount: folder._count.files,
        childCount: folder._count.children,
      },
      { status: 409 },
    )
  }

  await deleteFolderTree(id)

  return new Response(null, { status: 204 })
}
