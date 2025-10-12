

// Local safe logger
if (typeof window !== 'undefined') {
    window.__log = window.__log || function(level, tag, ...args) { try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
    var __log = window.__log
} else {
    var __log = function(level, tag, ...args) { try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
}

async function ephe() {
    // Affiche le jour/mois pour debug
    __log('debug','ephe','today=' + dateDayMonth())
    const date = new Date();

    // Read CSV via preload API; prefer C:\SEE\ephe.csv, fallback to bundled ephe.csv
    try {
        let csvText = null
        if (window && window.api && typeof window.api.readFile === 'function') {
            try { csvText = await window.api.readFile('ephe.csv') } catch (e) { csvText = null }
        }
        if (!csvText && window && window.api && typeof window.api.readBundledFile === 'function') {
            try { csvText = await window.api.readBundledFile('ephe.csv') } catch (e) { csvText = null }
        }
        if (!csvText) { throw new Error('no ephe.csv available') }

        // Defensive: some preload shims may return non-string (Buffer, object). Coerce to string.
        if (typeof csvText !== 'string') {
            try {
                if (csvText && typeof csvText.toString === 'function') csvText = csvText.toString()
                else csvText = JSON.stringify(csvText)
            } catch (e) {
                __log('error','ephe','unable to coerce ephe.csv to string', typeof csvText)
                throw new Error('invalid ephe.csv content')
            }
        }

        const lines = csvText.split(/\r?\n/)
        let TxtEphe = ''
        for (let i = 0; i < lines.length; i++) {
            const row = lines[i].split(',')
            // row[0] expected in format DD/MM
            if (dateDayMonth() === row[0]) {
                if (row[1] == '2') TxtEphe = 'Saint ' + row[2]
                else if (row[1] == '3') TxtEphe = 'Sainte ' + row[2]
                else TxtEphe = row[2] || ''
                break
            }
        }
        const el = document.getElementById('ephe')
        if (el) el.innerHTML = TxtEphe || '';
    } catch (e) {
        __log('error','ephe','failed to read ephe.csv', e && e.message)
    }

}
