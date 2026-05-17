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

export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<UploadResult> {
  const base64 = buffer.toString('base64')
  const dataUri = `data:${mimeType};base64,${base64}`
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'datafever-hub/attachments',
    resource_type: 'auto',
    public_id: fileName.replace(/\.[^/.]+$/, ''),
    use_filename: true,
    unique_filename: true,
  })
  return { url: result.secure_url, publicId: result.public_id }
}

export async function uploadPdf(buffer: Buffer, folder: string): Promise<UploadResult> {
  const base64 = buffer.toString('base64')
  const dataUri = `data:application/pdf;base64,${base64}`
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `datafever-hub/${folder}`,
    resource_type: 'raw',
    format: 'pdf',
  })
  return { url: result.secure_url, publicId: result.public_id }
}

export { cloudinary }
