import { generateSigningKeypair } from '@kinhale/crypto';

let _adminKeypair: Awaited<ReturnType<typeof generateSigningKeypair>> | null = null;
let _caregiverKeypair: Awaited<ReturnType<typeof generateSigningKeypair>> | null = null;

export async function getAdminTestKeypair() {
  if (!_adminKeypair) _adminKeypair = await generateSigningKeypair();
  return _adminKeypair;
}

export async function getCaregiverTestKeypair() {
  if (!_caregiverKeypair) _caregiverKeypair = await generateSigningKeypair();
  return _caregiverKeypair;
}
