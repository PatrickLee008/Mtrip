import { get, post, request } from '@/api/request';
import type { AuthOtpChallenge } from '@/api/types';

export type DeletionStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type DeletionChannel = 'email' | 'sms';

export interface DeletionRequest {
  id: number;
  status: DeletionStatus;
  submittedAt: string;
  resolvedAt: string | null;
  reviewNote: string;
  receiptToken?: string;
}

const path = '/api/v1/app/merchant/deletion';
export const apiCurrentDeletion = () => get<{ request: DeletionRequest | null; channels: { channel: DeletionChannel; recipient: string }[] }>(path + '/current');
export const apiSendDeletionOtp = (channel: DeletionChannel) => post<AuthOtpChallenge>(path + '/otp', { channel });
export const apiSubmitDeletion = (data: { reason: string; details: string; challengeToken: string; otpCode: string }) => post<DeletionRequest>(path + '/submit', data);
export const apiCancelDeletion = (id: number) => post<DeletionRequest>(path + '/cancel', { id });
export const apiDeletionReceipt = (id: number, receiptToken: string) =>
  request<{ status: DeletionStatus; resolvedAt: string | null }>({ method: 'POST', url: path + '/receipt', data: { id, receiptToken } }, true);
