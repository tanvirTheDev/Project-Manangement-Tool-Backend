import { v2 as cloudinary } from 'cloudinary'
import { env } from './env'

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
})

export interface UploadResult {
  url: string
  publicId: string
}

export async function uploadImage(
  source: string | Buffer,
  folder: string
): Promise<UploadResult> {
  const input: string = source instanceof Buffer
    ? `data:image/webp;base64,${(source as Buffer).toString('base64')}`
    : (source as string)

  const result = await cloudinary.uploader.upload(input, {
    folder: `datafever-hub/${folder}`,
    resource_type: 'auto',
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
  })

  return { url: result.secure_url, publicId: result.public_id }
}

export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId)
}

export { cloudinary }
