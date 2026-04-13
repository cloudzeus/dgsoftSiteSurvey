// Bunny CDN integration
// Env vars: BUNNY_ACCESS_KEY, BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_HOST, BUNNY_CDN_HOSTNAME

import crypto from "crypto"
import { PrismaClient } from "@prisma/client"
import type { BunnyUploadResult } from "./types"

function bunnyEnv() {
  return {
    apiKey: process.env.BUNNY_ACCESS_KEY!,
    zone: process.env.BUNNY_STORAGE_ZONE!,
    // e.g. storage.bunnycdn.com
    apiHost: process.env.BUNNY_STORAGE_API_HOST ?? "storage.bunnycdn.com",
    // e.g. dgsoft.b-cdn.net
    cdnHostname: process.env.BUNNY_CDN_HOSTNAME!,
  }
}

async function bunnyPut(remotePath: string, data: Buffer): Promise<void> {
  const { apiKey, zone, apiHost } = bunnyEnv()
  const res = await fetch(`https://${apiHost}/${zone}/${remotePath}`, {
    method: "PUT",
    headers: {
      AccessKey: apiKey,
      "Content-Type": "application/octet-stream",
      "Content-Length": String(data.length),
    },
    body: data as unknown as BodyInit,
  })
  if (!res.ok) {
    throw new Error(`Bunny PUT failed [${res.status}]: ${await res.text()}`)
  }
}

/**
 * Upload a JSON sync result to Bunny CDN and record metadata in DB.
 */
export async function uploadSyncData(
  prisma: PrismaClient,
  syncConfigId: string,
  jobId: string,
  objectName: string,
  data: unknown
): Promise<BunnyUploadResult> {
  const { cdnHostname } = bunnyEnv()

  const json = JSON.stringify(data)
  const buf = Buffer.from(json, "utf8")
  const date = new Date().toISOString().slice(0, 10)
  const remotePath = `softone/${objectName}/${date}/${jobId}.json`
  const checksum = crypto.createHash("sha256").update(buf).digest("hex")

  await bunnyPut(remotePath, buf)

  const fullUrl = `https://${cdnHostname}/${remotePath}`

  await prisma.syncDataFile.create({
    data: {
      syncConfigId,
      fileName: `${jobId}.json`,
      fileType: "JSON",
      fileSize: buf.length,
      bunnyUrl: fullUrl,
      bunnyPath: remotePath,
      checksumSHA256: checksum,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  })

  return { url: fullUrl, path: remotePath, checksumSHA256: checksum, fileSize: buf.length }
}

/**
 * Upload a raw buffer (e.g. a gzipped MySQL backup) to Bunny CDN.
 */
export async function uploadBackup(
  prisma: PrismaClient,
  backupPath: string,
  data: Buffer,
  databaseSizeBytes: number
): Promise<string> {
  const { cdnHostname } = bunnyEnv()
  const remotePath = `mysql-backups/${backupPath}`
  await bunnyPut(remotePath, data)
  const fullUrl = `https://${cdnHostname}/${remotePath}`

  await prisma.databaseBackup.create({
    data: {
      filename: backupPath.split("/").pop() ?? backupPath,
      bunnyUrl: fullUrl,
      bunnyPath: backupPath,
      fileSizeBytes: BigInt(data.length),
      status: "COMPLETED",
      completedAt: new Date(),
      notes: `databaseSize:${databaseSizeBytes}`,
    },
  })

  return fullUrl
}

/**
 * Delete a file from Bunny CDN.
 */
export async function deleteBunnyFile(remotePath: string): Promise<void> {
  const { apiKey, zone, apiHost } = bunnyEnv()
  const res = await fetch(`https://${apiHost}/${zone}/${remotePath}`, {
    method: "DELETE",
    headers: { AccessKey: apiKey },
  })
  if (!res.ok) {
    throw new Error(`Bunny DELETE failed [${res.status}]: ${await res.text()}`)
  }
}
