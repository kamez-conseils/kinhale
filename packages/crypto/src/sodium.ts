import _sodium from 'libsodium-wrappers-sumo';

let _instance: Promise<typeof _sodium> | null = null;

export async function getSodium(): Promise<typeof _sodium> {
  _instance ??= _sodium.ready.then(() => _sodium);
  return _instance;
}
