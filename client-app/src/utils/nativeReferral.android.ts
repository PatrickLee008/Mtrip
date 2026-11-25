import { requireOptionalNativeModule } from 'expo-modules-core';

import { parseReferralDestination, referralDestinationFromInstall, referralLink } from '@/utils/referralInvitation';
import { storage } from '@/utils/storage';

const INSTALL_REFERRAL = 'referral_install_pending';
const installReferrer = requireOptionalNativeModule<{ read(): Promise<string | null> }>('MtripInstallReferrer');

export async function getInstallReferral(): Promise<string | null> {
  if (!installReferrer) return null;
  try {
    const cached = await storage.getString(INSTALL_REFERRAL);
    if (cached !== null) {
      if (/^[a-z0-9]{4,32}$/i.test(cached)) return referralLink(cached);
      return parseReferralDestination(cached) ? cached : null;
    }
    const result = await installReferrer.read();
    if (result === null) return null; // Play Store service unavailable, retry on a future launch.
    const destination = referralDestinationFromInstall(result);
    const link = destination ? referralLink(destination.code, destination.propertyId) : null;
    await storage.setString(INSTALL_REFERRAL, link ?? '');
    return link;
  } catch {
    return null;
  }
}

export function clearInstallReferral(): Promise<void> {
  return storage.setString(INSTALL_REFERRAL, '');
}
