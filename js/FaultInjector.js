/**
 * FaultInjector — injection de pannes pour tester le watchdog et la remontée
 * d'incidents. Inactif en production : n'est activé que si l'app est lancée
 * avec SEEDISPLAY_FAULTS=1 (npm run start:faults).
 *
 * Usage (console DevTools) :
 *   __faults.freeze(60000)    JS figé 60s          → RENDERER_FIGE / RENDERER_NE_REPOND_PLUS, reload
 *   __faults.crash()          crash du renderer    → RENDERER_CRASH, reload (×4 en 10 min → relaunch)
 *   __faults.breakLoop()      chaîne de timers cassée → BOUCLE_BLOQUEE niveaux 1, 2, 3
 *   __faults.hangTemplate()   templates qui ne finissent jamais → TEMPLATE_TIMEOUT
 *   __faults.failAllMedia()   tous les médias illisibles → VIDEO/IMAGE_SAUTEE, TOUS_MEDIAS_EN_ECHEC
 *   __faults.stallVideo()     vidéo courante figée → VIDEO_FIGEE
 *   __faults.leak(1600)       retient 1600 Mo      → MEMOIRE_ELEVEE, reload
 *   __faults.reset()          annule les pannes réversibles
 *
 * Note : DevTools ouverts = watchdog main en pause. Lancer la commande puis
 * fermer DevTools (Ctrl+Shift+I) pour observer la réaction.
 */
(function () {
    const log = (msg) => { try { (window.__log || console.log)('warn', 'faults', msg) } catch (e) { console.warn('[faults]', msg) } };
    const originals = {};
    const leaks = [];

    const faults = {
        freeze(ms = 60000) {
            log('freeze ' + ms + 'ms');
            const end = Date.now() + ms;
            while (Date.now() < end) { /* JS bloqué volontairement */ }
        },

        crash() {
            log('crash du renderer');
            if (window.api && window.api.faultCrashRenderer) window.api.faultCrashRenderer();
        },

        breakLoop() {
            // Casse la chaîne sans rien nettoyer d'autre : plus aucun timer de la
            // génération courante ne se déclenche, comme une exception avalée.
            log('chaîne de la boucle cassée');
            try { _abortAllVideoControllers(); } catch (e) { /* ignore */ }
            try { if (loopTimeout) clearTimeout(loopTimeout); } catch (e) { /* ignore */ }
            try { loopGeneration++; } catch (e) { log('loopGeneration inaccessible: ' + e.message); }
        },

        hangTemplate() {
            if (!window.templateRenderer || originals.templateShow) return;
            log('templates bloqués');
            originals.templateShow = window.templateRenderer.show;
            window.templateRenderer.show = () => new Promise(() => {});
        },

        failAllMedia() {
            if (originals.getMediaUrl) return;
            log('tous les médias en échec');
            originals.getMediaUrl = window.getMediaUrl;
            window.getMediaUrl = () => 'see-media://media/__fault_missing__.bin';
        },

        stallVideo() {
            const v = document.querySelector('#divVideo1[style*="block"] video, #divVideo2[style*="block"] video');
            if (!v) { log('aucune vidéo visible'); return; }
            log('vidéo figée : ' + v.id);
            v.playbackRate = 0;
        },

        leak(mb = 1600) {
            log('fuite mémoire ' + mb + ' Mo');
            for (let i = 0; i < mb; i++) {
                const a = new Float64Array(131072);   // 1 Mo
                a.fill(i);
                leaks.push(a);
            }
        },

        reset() {
            log('reset des pannes');
            if (originals.templateShow) { window.templateRenderer.show = originals.templateShow; delete originals.templateShow; }
            if (originals.getMediaUrl) { window.getMediaUrl = originals.getMediaUrl; delete originals.getMediaUrl; }
            leaks.length = 0;
        },

        status() {
            return {
                watchdogLevel: window._loopWatchdogLevel,
                safeMode: window._watchdogSafeMode,
                secondsSinceLastMedia: Math.round((Date.now() - (window._lastMediaChange || 0)) / 1000),
                actives: Object.keys(originals),
                leakMB: leaks.length
            };
        }
    };

    Promise.resolve()
        .then(() => window.api && window.api.getEnv ? window.api.getEnv('SEEDISPLAY_FAULTS') : null)
        .then((v) => {
            if (v !== '1') return;
            window.__faults = faults;
            log('INJECTION DE PANNES ACTIVE — window.__faults disponible');
        })
        .catch(() => {});
})();
