const assert = require('assert')
const { listeDiapo } = require('../API/listeDiapo')

describe('listeDiapo', () => {
  it('parses happy path and filters by date range', () => {
    const now = Date.now()
    const yesterday = new Date(now - 24*3600*1000).toISOString()
    const tomorrow = new Date(now + 24*3600*1000).toISOString()
    const data = [
      {
        DateDebutDiapo: yesterday,
        DateFinDiapo: tomorrow,
        ligneMedia: [ { MediaLigneMedia: { TypeMedia: 'img', FichierMedia: 'a.jpg' }, DureeLigneMedia: 5 } ]
      }
    ]
    const out = listeDiapo(data)
    assert.strictEqual(Array.isArray(out), true)
    assert.strictEqual(out.length, 1)
    assert.strictEqual(out[0][0], 'img')
  })

  it('returns empty array when dates out of range', () => {
    const past = new Date(2000,0,1).toISOString()
    const past2 = new Date(2000,0,2).toISOString()
    const data = [
      { DateDebutDiapo: past, DateFinDiapo: past2, ligneMedia: [ { MediaLigneMedia: { TypeMedia: 'img', FichierMedia: 'b.jpg' }, DureeLigneMedia: 5 } ] }
    ]
    const out = listeDiapo(data)
    assert.strictEqual(Array.isArray(out), true)
    assert.strictEqual(out.length, 0)
  })
})
