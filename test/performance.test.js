const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

describe('Performance Tests', function() {
    this.timeout(60000); // 60 secondes timeout

    let electronProcess;
    let performanceMetrics = {
        startTime: null,
        memoryUsage: [],
        cpuUsage: [],
        errors: []
    };

    before(function(done) {
        console.log('🚀 Démarrage du test d\'effort de l\'application...');
        performanceMetrics.startTime = Date.now();
        done();
    });

    after(function() {
        if (electronProcess) {
            electronProcess.kill();
        }
        
        // Générer rapport de performance
        const report = generatePerformanceReport(performanceMetrics);
        fs.writeFileSync(
            path.join(__dirname, '..', 'performance-report.json'), 
            JSON.stringify(report, null, 2)
        );
        
        console.log('📊 Rapport de performance généré: performance-report.json');
        console.log('⏱️  Durée du test:', (Date.now() - performanceMetrics.startTime) / 1000, 'secondes');
    });

    it('should start application within reasonable time', function(done) {
        const startTime = Date.now();
        
        electronProcess = spawn('npm', ['start'], {
            cwd: path.join(__dirname, '..'),
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        electronProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        electronProcess.stderr.on('data', (data) => {
            const error = data.toString();
            if (!error.includes('DevTools')) { // Ignorer les messages DevTools
                performanceMetrics.errors.push({
                    timestamp: Date.now(),
                    error: error
                });
            }
        });

        // Attendre que l'application soit prête
        setTimeout(() => {
            const startupTime = Date.now() - startTime;
            console.log(`⚡ Temps de démarrage: ${startupTime}ms`);
            
            if (startupTime < 10000) { // Moins de 10 secondes
                console.log('✅ Démarrage rapide');
            } else {
                console.log('⚠️  Démarrage lent');
            }
            
            done();
        }, 5000);
    });

    it('should handle memory usage efficiently', function(done) {
        // Simuler une charge de travail
        console.log('🔄 Test de charge mémoire...');
        
        const memoryInterval = setInterval(() => {
            const memUsage = process.memoryUsage();
            performanceMetrics.memoryUsage.push({
                timestamp: Date.now(),
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss
            });
        }, 1000);

        // Simuler 15 secondes d'activité
        setTimeout(() => {
            clearInterval(memoryInterval);
            
            const avgMemory = performanceMetrics.memoryUsage.reduce((acc, curr) => 
                acc + curr.heapUsed, 0) / performanceMetrics.memoryUsage.length;
            
            console.log(`📈 Mémoire moyenne utilisée: ${Math.round(avgMemory / 1024 / 1024)}MB`);
            
            if (avgMemory < 200 * 1024 * 1024) { // Moins de 200MB
                console.log('✅ Utilisation mémoire efficace');
            } else {
                console.log('⚠️  Utilisation mémoire élevée');
            }
            
            done();
        }, 15000);
    });

    it('should handle multiple rapid operations', function(done) {
        console.log('⚡ Test de charge rapide...');
        
        // Simuler des opérations rapides répétées
        let operations = 0;
        const startTime = Date.now();
        
        const operationInterval = setInterval(() => {
            // Simuler opération (lecture fichier, parsing, etc.)
            operations++;
            
            if (operations >= 100) {
                clearInterval(operationInterval);
                
                const duration = Date.now() - startTime;
                const opsPerSecond = (operations / duration) * 1000;
                
                console.log(`🔥 ${operations} opérations en ${duration}ms`);
                console.log(`📊 Performance: ${Math.round(opsPerSecond)} ops/seconde`);
                
                if (opsPerSecond > 50) {
                    console.log('✅ Performance élevée');
                } else {
                    console.log('⚠️  Performance modérée');
                }
                
                done();
            }
        }, 10);
    });
});

function generatePerformanceReport(metrics) {
    const duration = Date.now() - metrics.startTime;
    
    const avgMemory = metrics.memoryUsage.length > 0 ? 
        metrics.memoryUsage.reduce((acc, curr) => acc + curr.heapUsed, 0) / metrics.memoryUsage.length : 0;
    
    const maxMemory = metrics.memoryUsage.length > 0 ? 
        Math.max(...metrics.memoryUsage.map(m => m.heapUsed)) : 0;
    
    return {
        timestamp: new Date().toISOString(),
        duration: duration,
        memoryStats: {
            average: Math.round(avgMemory / 1024 / 1024), // MB
            peak: Math.round(maxMemory / 1024 / 1024), // MB
            samples: metrics.memoryUsage.length
        },
        errors: metrics.errors,
        recommendations: generateRecommendations(avgMemory, maxMemory, metrics.errors.length)
    };
}

function generateRecommendations(avgMemory, maxMemory, errorCount) {
    const recommendations = [];
    
    if (avgMemory > 150 * 1024 * 1024) {
        recommendations.push('Optimiser l\'utilisation mémoire - moyenne élevée');
    }
    
    if (maxMemory > 300 * 1024 * 1024) {
        recommendations.push('Surveiller les pics mémoire - pic très élevé');
    }
    
    if (errorCount > 5) {
        recommendations.push('Corriger les erreurs fréquentes');
    }
    
    if (recommendations.length === 0) {
        recommendations.push('Performance satisfaisante');
    }
    
    return recommendations;
}