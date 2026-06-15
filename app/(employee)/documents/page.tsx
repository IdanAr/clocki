'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveDocument } from '@/lib/actions/upload'
import FileUpload from '@/components/forms/FileUpload'
import { useTranslations } from 'next-intl'

type Document = {
  id: string
  type: string
  file_url: string
  file_name: string
  uploaded_at: string
}

export default function DocumentsPage() {
  const t = useTranslations('documents')
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadError, setUploadError] = useState('')

  const fetchDocs = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('documents')
      .select('id, type, file_url, file_name, uploaded_at')
      .order('uploaded_at', { ascending: false })
    setDocuments(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchDocs() }, [])

  const handleUpload = (type: 'client_report' | 'absence_note') =>
    async ({ url, name }: { url: string; name: string }) => {
      setUploadError('')
      const result = await saveDocument(url, name, type)
      if (!result.success) {
        setUploadError(result.error)
      } else {
        fetchDocs()
      }
    }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-800">{t('title')}</h1>

      <div className="flex flex-wrap gap-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">{t('uploadClientReport')}</p>
          <FileUpload
            label={t('uploadClientReport')}
            onUpload={handleUpload('client_report')}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">{t('uploadAbsenceNote')}</p>
          <FileUpload
            label={t('uploadAbsenceNote')}
            onUpload={handleUpload('absence_note')}
          />
        </div>
      </div>

      {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">טוען...</p>
      ) : documents.length === 0 ? (
        <p className="text-gray-400">{t('noDocuments')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('fileName')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('type')}</th>
                <th className="px-4 py-3 text-start font-medium text-gray-500">{t('uploadedAt')}</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {documents.map(doc => (
                <tr key={doc.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{doc.file_name}</td>
                  <td className="px-4 py-3">{t(`types.${doc.type as 'client_report' | 'absence_note'}`)}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(doc.uploaded_at).toLocaleDateString('he-IL')}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      צפה
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
