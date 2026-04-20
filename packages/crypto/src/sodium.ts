import _sodium from 'libsodium-wrappers-sumo'

let _ready = false

export async function getSodium(): Promise<typeof _sodium> {
  if (!_ready) {
    await _sodium.ready
    _ready = true
  }
  return _sodium
}
