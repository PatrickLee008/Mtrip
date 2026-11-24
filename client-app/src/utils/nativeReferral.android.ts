import { requireOptionalNativeModule } from 'expo-modules-core';

import { referralCodeFromInstall } from '@/utils/referralInvitation';
import { storage } from '@/utils/storage';

const INSTALL_REFERRAL = 'referral_install_pending';
const installReferrer = requireOptionalNativeModule<{ read(): Promise<string | null> }>('MtripInstallReferrer');

export async function getInstallReferral(): Promise<string | null> {
  if (!installReferrer) return null;
  try {
    const cached = await storage.getString(INSTALL_REFERRAL);
    if (cached !== null) return cached || null;
    const result = await installReferrer.read();
    if (result === null) return null; // Play Store service unavailable, retry on a future launch.
    const code = referralCodeFromInstall(result);
    await storage.setString(INSTALL_REFERRAL, code ?? '');
    return code;
  } catch {
    return null;
  }
}

export function clearInstallReferral(): Promise<void> {
  return storage.setString(INSTALL_REFERRAL, '');
}
