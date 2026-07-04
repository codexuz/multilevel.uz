import { S3Client } from '@aws-sdk/client-s3'

let client: S3Client | null = null

export function useS3Client(): S3Client {
  if (client) return client
  const cfg = useRuntimeConfig()
  client = new S3Client({
    region: cfg.s3Region || 'us-east-1',
    endpoint: cfg.s3Endpoint || undefined,
    // Path-style is required by most S3-compatible providers (MinIO, R2, etc.)
    forcePathStyle: true,
    credentials: {
      accessKeyId: cfg.s3AccessKeyId as string,
      secretAccessKey: cfg.s3SecretAccessKey as string
    }
  })
  return client
}

export function s3Bucket(): string {
  return useRuntimeConfig().s3Bucket as string
}

/** Public URL an uploaded object is served from. */
export function s3PublicUrl(key: string): string {
  const base = (useRuntimeConfig().public.s3PublicUrl as string || '').replace(/\/$/, '')
  return `${base}/${key}`
}
