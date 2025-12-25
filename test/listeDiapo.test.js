const assert = require('assert')
const { 
  listeDiapo, 
  filterActiveDiapos, 
  sortDiaposByPriority, 
  extractFromTimeline,
  normalizeDiapo,
  isInSchedule 
} = require('../API/listeDiapo')

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

describe('Real API format (camelCase)', () => {
  const yesterday = new Date(Date.now() - 24*3600*1000).toISOString()
  const tomorrow = new Date(Date.now() + 24*3600*1000).toISOString()
  
  it('parses real API response with timeline', () => {
    const apiResponse = {
      status: 'active',
      ecranId: 1,
      timeline: [
        { ordre: 1, diapoId: 4, mediaType: 'img', mediaFichier: 'test1.jpg', duree: 5 },
        { ordre: 2, diapoId: 4, mediaType: 'img', mediaFichier: 'test2.jpg', duree: 10 }
      ],
      diapos: []
    }
    const out = listeDiapo(apiResponse)
    assert.strictEqual(out.length, 2)
    assert.strictEqual(out[0][0], 'img')
    assert.ok(out[0][1].includes('test1.jpg'))
    assert.strictEqual(out[0][2], 5)
    assert.strictEqual(out[1][2], 10)
  })

  it('parses real API response with diapos (fallback)', () => {
    const apiResponse = {
      status: 'active',
      ecranId: 1,
      diapos: [
        {
          id: 4,
          nom: 'test',
          dateDebut: yesterday,
          dateFin: tomorrow,
          type: 'standard',
          priorite: 0,
          programmation: { mode: 'simple', heureDebut: null, heureFin: null, joursSemaine: [], plagesHoraires: [] },
          medias: [
            { ordre: 0, duree: 5, type: 'img', fichier: 'real-api.jpg' }
          ]
        }
      ]
    }
    const out = listeDiapo(apiResponse)
    assert.strictEqual(out.length, 1)
    assert.ok(out[0][1].includes('real-api.jpg'))
  })

  it('normalizeDiapo converts legacy format to new format', () => {
    const legacy = {
      id: 1,
      NomDiapo: 'Legacy',
      DateDebutDiapo: yesterday,
      DateFinDiapo: tomorrow,
      TypeDiapo: 'programme',
      Priorite: 5,
      JoursSemaine: [1, 2, 3],
      HeureDebut: '09:00:00',
      HeureFin: '18:00:00',
      ligneMedia: [
        { OrdreLigneMedia: 1, DureeLigneMedia: 10, MediaLigneMedia: { TypeMedia: 'img', FichierMedia: 'legacy.jpg' } }
      ]
    }
    const normalized = normalizeDiapo(legacy)
    assert.strictEqual(normalized.type, 'programme')
    assert.strictEqual(normalized.priorite, 5)
    assert.strictEqual(normalized.medias.length, 1)
    assert.strictEqual(normalized.medias[0].fichier, 'legacy.jpg')
  })
})

describe('TypeDiapo filtering (API v2.0)', () => {
  const yesterday = new Date(Date.now() - 24*3600*1000).toISOString()
  const tomorrow = new Date(Date.now() + 24*3600*1000).toISOString()
  
  it('TypeDiapo standard: always shows within date range', () => {
    const data = [{
      id: 1,
      TypeDiapo: 'standard',
      DateDebutDiapo: yesterday,
      DateFinDiapo: tomorrow,
      ligneMedia: [{ MediaLigneMedia: { TypeMedia: 'img', FichierMedia: 'test.jpg' }, DureeLigneMedia: 5 }]
    }]
    const out = listeDiapo(data)
    assert.strictEqual(out.length, 1)
  })

  it('TypeDiapo programme: filters by JoursSemaine', () => {
    const now = new Date()
    const currentDay = now.getDay() // 0=Dim, 1=Lun...
    
    // Diapo pour le jour actuel
    const dataToday = [{
      id: 1,
      TypeDiapo: 'programme',
      DateDebutDiapo: yesterday,
      DateFinDiapo: tomorrow,
      JoursSemaine: [currentDay],
      ligneMedia: [{ MediaLigneMedia: { TypeMedia: 'img', FichierMedia: 'today.jpg' }, DureeLigneMedia: 5 }]
    }]
    
    // Diapo pour un autre jour
    const otherDay = (currentDay + 1) % 7
    const dataOtherDay = [{
      id: 2,
      TypeDiapo: 'programme',
      DateDebutDiapo: yesterday,
      DateFinDiapo: tomorrow,
      JoursSemaine: [otherDay],
      ligneMedia: [{ MediaLigneMedia: { TypeMedia: 'img', FichierMedia: 'other.jpg' }, DureeLigneMedia: 5 }]
    }]
    
    assert.strictEqual(listeDiapo(dataToday).length, 1, 'Should show today')
    assert.strictEqual(listeDiapo(dataOtherDay).length, 0, 'Should not show other day')
  })

  it('TypeDiapo programme: filters by HeureDebut/HeureFin', () => {
    // Simuler 10h00 du matin
    const testDate = new Date()
    testDate.setHours(10, 0, 0, 0)
    const currentDay = testDate.getDay()
    
    // Dans la plage 09:00-18:00
    const dataInRange = [{
      id: 1,
      TypeDiapo: 'programme',
      DateDebutDiapo: yesterday,
      DateFinDiapo: tomorrow,
      JoursSemaine: [currentDay],
      HeureDebut: '09:00:00',
      HeureFin: '18:00:00',
      ligneMedia: [{ MediaLigneMedia: { TypeMedia: 'img', FichierMedia: 'in.jpg' }, DureeLigneMedia: 5 }]
    }]
    
    // Hors plage 20:00-22:00
    const dataOutRange = [{
      id: 2,
      TypeDiapo: 'programme',
      DateDebutDiapo: yesterday,
      DateFinDiapo: tomorrow,
      JoursSemaine: [currentDay],
      HeureDebut: '20:00:00',
      HeureFin: '22:00:00',
      ligneMedia: [{ MediaLigneMedia: { TypeMedia: 'img', FichierMedia: 'out.jpg' }, DureeLigneMedia: 5 }]
    }]
    
    assert.strictEqual(listeDiapo(dataInRange, testDate).length, 1, 'Should show in time range')
    assert.strictEqual(listeDiapo(dataOutRange, testDate).length, 0, 'Should not show out of time range')
  })

  it('PlagesHoraires: filters by advanced schedule', () => {
    // Simuler lundi 10h00
    const testDate = new Date()
    // Trouver le prochain lundi
    const daysUntilMonday = (1 - testDate.getDay() + 7) % 7
    testDate.setDate(testDate.getDate() + daysUntilMonday)
    testDate.setHours(10, 0, 0, 0)
    
    const dataWithPlages = [{
      id: 1,
      TypeDiapo: 'programme',
      DateDebutDiapo: new Date(testDate.getTime() - 24*3600*1000).toISOString(),
      DateFinDiapo: new Date(testDate.getTime() + 24*3600*1000).toISOString(),
      PlagesHoraires: {
        lundi: [{ debut: '08:00', fin: '12:00' }, { debut: '14:00', fin: '18:00' }],
        mardi: [],
        mercredi: [],
        jeudi: [],
        vendredi: [],
        samedi: [],
        dimanche: []
      },
      ligneMedia: [{ MediaLigneMedia: { TypeMedia: 'img', FichierMedia: 'plage.jpg' }, DureeLigneMedia: 5 }]
    }]
    
    const result = listeDiapo(dataWithPlages, testDate)
    assert.strictEqual(result.length, 1, 'Should show during PlagesHoraires lundi 08:00-12:00')
  })
})

describe('Priority sorting (API v2.0)', () => {
  const yesterday = new Date(Date.now() - 24*3600*1000).toISOString()
  const tomorrow = new Date(Date.now() + 24*3600*1000).toISOString()
  
  it('prioritaire type comes first', () => {
    const data = [
      {
        id: 1,
        TypeDiapo: 'standard',
        Priorite: 0,
        DateDebutDiapo: yesterday,
        DateFinDiapo: tomorrow,
        ligneMedia: [{ MediaLigneMedia: { TypeMedia: 'img', FichierMedia: 'standard.jpg' }, DureeLigneMedia: 5 }]
      },
      {
        id: 2,
        TypeDiapo: 'prioritaire',
        Priorite: 5,
        DateDebutDiapo: yesterday,
        DateFinDiapo: tomorrow,
        ligneMedia: [{ MediaLigneMedia: { TypeMedia: 'img', FichierMedia: 'prio.jpg' }, DureeLigneMedia: 5 }]
      }
    ]
    
    const out = listeDiapo(data)
    assert.strictEqual(out.length, 2)
    // Le média prioritaire doit être en premier
    assert.ok(out[0][1].includes('prio'), 'Prioritaire should be first')
  })

  it('higher Priorite value comes first', () => {
    const data = [
      {
        id: 1,
        TypeDiapo: 'prioritaire',
        Priorite: 3,
        DateDebutDiapo: yesterday,
        DateFinDiapo: tomorrow,
        ligneMedia: [{ MediaLigneMedia: { TypeMedia: 'img', FichierMedia: 'prio3.jpg' }, DureeLigneMedia: 5 }]
      },
      {
        id: 2,
        TypeDiapo: 'prioritaire',
        Priorite: 10,
        DateDebutDiapo: yesterday,
        DateFinDiapo: tomorrow,
        ligneMedia: [{ MediaLigneMedia: { TypeMedia: 'img', FichierMedia: 'prio10.jpg' }, DureeLigneMedia: 5 }]
      }
    ]
    
    const out = listeDiapo(data)
    assert.strictEqual(out.length, 2)
    assert.ok(out[0][1].includes('prio10'), 'Higher priority should be first')
  })
})
