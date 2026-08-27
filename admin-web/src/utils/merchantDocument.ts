import { get } from '@/utils/http';

/** Fetch with the normal Authorization header; never put credentials in a URL. */
export async function fetchMerchantDocument(docId: number, revisionId?: number): Promise<{ blob: Blob; name: string }> {
  const data = await get<{ content: string; mime: string; name: string }>('/admin/merchant/document/download', { docId, revisionId });
  const bytes = Uint8Array.from(atob(data.content), (c) => c.charCodeAt(0));
  const mime = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(data.mime) ? data.mime : 'application/octet-stream';
  return { blob: new Blob([bytes], { type: mime }), name: data.name };
}

export async function openMerchantDocument(docId: number, revisionId?: number): Promise<void> {
  const data = await fetchMerchantDocument(docId, revisionId);
  const url = URL.createObjectURL(data.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = data.name || `document-${docId}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
