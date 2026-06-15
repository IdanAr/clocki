'use client'
import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

export type UploadResult = { url: string; name: string }

export default function FileUpload({
  onUpload,
  label,
}: {
  onUpload: (result: UploadResult) => void
  label?: string
}) {
  const t = useTranslations('documents')
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (file: File) => {
    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Upload failed')
      } else {
        onUpload(json)
      }
    } catch {
      setError('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.bmp,.gif,.tiff,.tif"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="rounded-md border border-dashed border-blue-300 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50"
      >
        {uploading ? t('uploading') : (label ?? t('selectFile'))}
      </button>
      <p className="text-xs text-gray-400">{t('maxSize')}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
