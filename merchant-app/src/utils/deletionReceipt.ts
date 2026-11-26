import * as SecureStore from 'expo-secure-store';
import type { DeletionRequest } from '@/api/deletion';

const key = 'merchant.deletion.receipt';
interface DeletionReceipt {
  id: number;
  accountId: number;
  token: string;
}

export async function readDeletionReceipt(): Promise<DeletionReceipt | null> {
  const stored = await SecureStore.getItemAsync(key);
  return stored ? JSON.parse(stored) as DeletionReceipt : null;
}

export async function saveDeletionReceipt(request: DeletionRequest, accountId: number): Promise<void> {
  if (request.receiptToken) {
    await SecureStore.setItemAsync(key, JSON.stringify({ id: request.id, accountId, token: request.receiptToken }));
  }
}

export async function clearDeletionReceipt(id: number): Promise<void> {
  if ((await readDeletionReceipt())?.id === id) await SecureStore.deleteItemAsync(key);
}
