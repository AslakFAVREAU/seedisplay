const assert = require('assert')
const { redactString, redactValue, redactHook, MASK } = require('../lib/redact')

// Valeurs factices (même forme qu'un vrai jeton : 64 caractères hexadécimaux)
const TOKEN = 'f'.repeat(16) + '0123456789abcdef'.repeat(3)
const UUID = '00000000-1111-4222-8333-444444444444'

describe('redact — aucun jeton dans les logs', () => {
  it('JSON sérialisé (getConfig, pairing) : apiToken masqué, le reste intact', () => {
    const line = 'Pairing successful! ' + JSON.stringify({ status: 'paired', ecranUuid: UUID, apiToken: TOKEN, env: 'prod' })
    const out = redactString(line)
    assert.ok(!out.includes(TOKEN), out)
    assert.ok(out.includes('"apiToken":"' + MASK + '"'), out)
    assert.ok(out.includes(UUID), 'l\'UUID reste visible pour le debug')
    assert.ok(out.includes('"env":"prod"'))
  })

  it('formes texte : en-tête, objet JS, query string', () => {
    for (const s of [
      'X-API-Token: ' + TOKEN,
      "{ apiToken: '" + TOKEN + "' }",
      'https://soek.fr/x?token=' + TOKEN + '&a=1',
      '"api_token" : "' + TOKEN + '"'
    ]) {
      assert.ok(!redactString(s).includes(TOKEN), s + ' → ' + redactString(s))
    }
    assert.ok(redactString('https://soek.fr/x?token=' + TOKEN + '&a=1').endsWith('&a=1'))
  })

  it('objet passé tel quel au logger : clés secrètes masquées en profondeur, original non modifié', () => {
    const cfg = { ecranUuid: UUID, apiToken: TOKEN, headers: { 'X-API-Token': TOKEN }, liste: [{ token: TOKEN }] }
    const out = redactValue(cfg)
    assert.ok(!JSON.stringify(out).includes(TOKEN), JSON.stringify(out))
    assert.strictEqual(out.ecranUuid, UUID)
    assert.strictEqual(cfg.apiToken, TOKEN, 'la config réelle ne doit pas être modifiée')
  })

  it('clé IDFM (apiKey du template trafic) : masquée en texte et en objet', () => {
    const KEY = 'AbCdEf0123456789XyZ'
    assert.ok(!redactString(JSON.stringify({ type: 'trafic', apiKey: KEY })).includes(KEY))
    assert.ok(!redactString("headers: { apikey: '" + KEY + "' }").includes(KEY))
    assert.strictEqual(redactValue({ headers: { apikey: KEY } }).headers.apikey, MASK)
    assert.strictEqual(redactString('apiKey=yes'), 'apiKey=yes', 'indicateur de présence laissé lisible')
  })

  it('hashes sans nom de clé secrète (ETag, sha256) : laissés tels quels', () => {
    const s = 'syncMediaCache: etag "' + TOKEN + '" inchangé'
    assert.strictEqual(redactString(s), s)
  })

  it('hook electron-log : data masqué, objets circulaires et erreurs sans exception', () => {
    const circ = { apiToken: TOKEN }
    circ.self = circ
    const err = new Error('échec avec apiToken=' + TOKEN)
    const msg = redactHook({ level: 'info', data: ['cfg', JSON.stringify({ apiToken: TOKEN }), circ, err, 42, null] })
    assert.ok(!String(msg.data[1]).includes(TOKEN))
    assert.strictEqual(msg.data[2].apiToken, MASK)
    assert.ok(!msg.data[3].message.includes(TOKEN))
    assert.strictEqual(msg.data[4], 42)
    assert.strictEqual(msg.data[5], null)
    assert.strictEqual(msg.level, 'info')
  })
})
