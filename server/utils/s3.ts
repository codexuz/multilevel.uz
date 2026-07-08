import { S3Client } from '@aws-sdk/client-s3'

let client: S3Client | null = null

// Prefer plain process.env (set at container runtime) and fall back to
// build-time runtimeConfig — matches how useDb()/jwt read their secrets.
export function useS3Client(): S3Client {
  if (client) return client
  const cfg = useRuntimeConfig()
  client = new S3Client({
    region: process.env.S3_REGION || cfg.s3Region || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || cfg.s3Endpoint || undefined,
    // Path-style is required by most S3-compatible providers (MinIO, R2, etc.)
    forcePathStyle: true,
    credentials: {
      accessKeyId: (process.env.S3_ACCESS_KEY_ID || cfg.s3AccessKeyId) as string,
      secretAccessKey: (process.env.S3_SECRET_ACCESS_KEY || cfg.s3SecretAccessKey) as string
    }
  })
  return client
}

export function s3Bucket(): string {
  return (process.env.S3_BUCKET || useRuntimeConfig().s3Bucket) as string
}

/** Public URL an uploaded object is served from. */
export function s3PublicUrl(key: string): string {
  const base = (process.env.S3_PUBLIC_URL || useRuntimeConfig().public.s3PublicUrl as string || '').replace(/\/$/, '')
  return `${base}/${key}`
}
