# API Heartbeat SOEK - Monitoring SEE Display

Ce document décrit l'implémentation côté serveur SOEK pour recevoir les heartbeats et afficher un dashboard de monitoring.

---

## 📡 Endpoint Heartbeat

### Request

```http
POST /see/API/heartbeat/{ecranUuid}
Content-Type: application/json
X-API-Token: {apiToken}
```

### Payload reçu

```json
{
  "ecranUuid": "96371d93-ed93-11f0-88b0-00e04cdaf7ae",
  "version": "1.9.35",
  "timestamp": "2026-01-26T16:45:00.000Z",
  "uptime": 3600,
  "debug": {
    "mediaCount": 12,
    "currentMedia": "video-accueil.mp4",
    "cacheStatus": "ok",
    "cacheEntries": 45,
    "screenStatus": "active",
    "luminosite": 50,
    "sonActif": false,
    "nightMode": false,
    "sleepMode": false,
    "planningActive": true,
    "memoryUsage": 42
  },
  "screenshot": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

### Response

```json
{
  "success": true,
  "message": "Heartbeat received"
}
```

### Codes HTTP

| Code | Signification |
|------|---------------|
| 200 | OK |
| 401 | Token invalide |
| 404 | Écran non trouvé |

---

## 🗄️ Base de données

### Table `ecran_heartbeat`

```sql
CREATE TABLE ecran_heartbeat (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ecran_id INT NOT NULL,
    version VARCHAR(20),
    last_seen DATETIME NOT NULL,
    uptime INT DEFAULT 0,
    screen_status VARCHAR(20) DEFAULT 'unknown',
    media_count INT DEFAULT 0,
    current_media VARCHAR(255),
    luminosite INT DEFAULT 100,
    son_actif TINYINT(1) DEFAULT 0,
    night_mode TINYINT(1) DEFAULT 0,
    sleep_mode TINYINT(1) DEFAULT 0,
    planning_active TINYINT(1) DEFAULT 0,
    cache_status VARCHAR(20),
    cache_entries INT DEFAULT 0,
    memory_usage INT,
    debug_json JSON,
    screenshot_path VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (ecran_id) REFERENCES ecran(id) ON DELETE CASCADE,
    INDEX idx_ecran_last_seen (ecran_id, last_seen),
    INDEX idx_last_seen (last_seen)
);
```

### Ou ajouter à la table `ecran` existante

```sql
ALTER TABLE ecran ADD COLUMN heartbeat_version VARCHAR(20);
ALTER TABLE ecran ADD COLUMN heartbeat_last_seen DATETIME;
ALTER TABLE ecran ADD COLUMN heartbeat_uptime INT DEFAULT 0;
ALTER TABLE ecran ADD COLUMN heartbeat_status VARCHAR(20) DEFAULT 'offline';
ALTER TABLE ecran ADD COLUMN heartbeat_debug JSON;
ALTER TABLE ecran ADD COLUMN heartbeat_screenshot VARCHAR(255);
```

---

## 🖼️ Stockage Screenshots

### Structure dossiers

```
/uploads/see/heartbeat/
├── 96371d93-ed93-11f0-88b0-00e04cdaf7ae.jpg
├── a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg
└── ...
```

### Logique

1. Recevoir le base64 du payload
2. Décoder et sauvegarder en JPG
3. Remplacer l'ancien fichier (pas d'historique)
4. Stocker le chemin en BDD

---

## 🎯 Controller Symfony (exemple)

```php
<?php

namespace App\Controller\Api;

use App\Entity\Ecran;
use App\Repository\EcranRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/see/API')]
class HeartbeatController extends AbstractController
{
    #[Route('/heartbeat/{ecranUuid}', name: 'api_heartbeat', methods: ['POST'])]
    public function heartbeat(
        string $ecranUuid,
        Request $request,
        EcranRepository $ecranRepository,
        EntityManagerInterface $em
    ): JsonResponse {
        // Vérifier le token
        $token = $request->headers->get('X-API-Token');
        $ecran = $ecranRepository->findOneBy(['uuid' => $ecranUuid]);
        
        if (!$ecran) {
            return new JsonResponse(['error' => 'Ecran not found'], 404);
        }
        
        // Parser le payload
        $data = json_decode($request->getContent(), true);
        
        // Mettre à jour les infos heartbeat
        $ecran->setHeartbeatVersion($data['version'] ?? null);
        $ecran->setHeartbeatLastSeen(new \DateTime());
        $ecran->setHeartbeatUptime($data['uptime'] ?? 0);
        $ecran->setHeartbeatStatus($data['debug']['screenStatus'] ?? 'active');
        $ecran->setHeartbeatDebug($data['debug'] ?? []);
        
        // Sauvegarder le screenshot si présent
        if (!empty($data['screenshot'])) {
            $screenshotPath = $this->saveScreenshot($ecranUuid, $data['screenshot']);
            $ecran->setHeartbeatScreenshot($screenshotPath);
        }
        
        $em->flush();
        
        return new JsonResponse(['success' => true, 'message' => 'Heartbeat received']);
    }
    
    private function saveScreenshot(string $ecranUuid, string $base64): string
    {
        // Extraire les données base64
        $data = explode(',', $base64);
        $imageData = base64_decode($data[1] ?? $data[0]);
        
        // Chemin de destination
        $uploadDir = $this->getParameter('kernel.project_dir') . '/public/uploads/see/heartbeat/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        
        $filename = $ecranUuid . '.jpg';
        $filepath = $uploadDir . $filename;
        
        file_put_contents($filepath, $imageData);
        
        return '/uploads/see/heartbeat/' . $filename;
    }
}
```

---

## 📺 Dashboard Monitoring - Vue d'ensemble

### Route

```
GET /admin/see/monitoring
```

### Template Twig `monitoring/index.html.twig`

```twig
{% extends 'admin/base.html.twig' %}

{% block title %}Monitoring SEE Display{% endblock %}

{% block stylesheets %}
{{ parent() }}
<style>
    .monitoring-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 20px;
        padding: 20px;
    }
    
    .ecran-card {
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        overflow: hidden;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .ecran-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }
    
    .ecran-screenshot {
        width: 100%;
        height: 180px;
        object-fit: cover;
        background: #1a1a2e;
    }
    
    .ecran-screenshot.offline {
        filter: grayscale(100%);
        opacity: 0.5;
    }
    
    .ecran-info {
        padding: 16px;
    }
    
    .ecran-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }
    
    .ecran-name {
        font-size: 18px;
        font-weight: 600;
        color: #333;
    }
    
    .ecran-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
    }
    
    .ecran-status.online {
        background: #d4edda;
        color: #155724;
    }
    
    .ecran-status.offline {
        background: #f8d7da;
        color: #721c24;
    }
    
    .ecran-status.sleep {
        background: #fff3cd;
        color: #856404;
    }
    
    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }
    
    .status-dot.online { background: #28a745; }
    .status-dot.offline { background: #dc3545; }
    .status-dot.sleep { background: #ffc107; }
    
    .ecran-details {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        font-size: 13px;
        color: #666;
    }
    
    .ecran-detail {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    
    .ecran-detail-icon {
        width: 16px;
        text-align: center;
    }
    
    .ecran-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #eee;
    }
    
    .ecran-action {
        flex: 1;
        padding: 8px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.2s;
    }
    
    .ecran-action.primary {
        background: #007bff;
        color: white;
    }
    
    .ecran-action.primary:hover {
        background: #0056b3;
    }
    
    .ecran-action.secondary {
        background: #f8f9fa;
        color: #333;
    }
    
    .ecran-action.secondary:hover {
        background: #e9ecef;
    }
    
    /* Header */
    .monitoring-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        background: #fff;
        border-bottom: 1px solid #eee;
    }
    
    .monitoring-title {
        font-size: 24px;
        font-weight: 600;
    }
    
    .monitoring-stats {
        display: flex;
        gap: 20px;
    }
    
    .stat-box {
        text-align: center;
        padding: 10px 20px;
        background: #f8f9fa;
        border-radius: 8px;
    }
    
    .stat-value {
        font-size: 24px;
        font-weight: 700;
    }
    
    .stat-value.online { color: #28a745; }
    .stat-value.offline { color: #dc3545; }
    .stat-value.total { color: #007bff; }
    
    .stat-label {
        font-size: 12px;
        color: #666;
    }
    
    /* Auto-refresh indicator */
    .refresh-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #666;
    }
    
    .refresh-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid #e9ecef;
        border-top-color: #007bff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
</style>
{% endblock %}

{% block body %}
<div class="monitoring-header">
    <h1 class="monitoring-title">📺 Monitoring SEE Display</h1>
    
    <div class="monitoring-stats">
        <div class="stat-box">
            <div class="stat-value online">{{ ecrans_online }}</div>
            <div class="stat-label">En ligne</div>
        </div>
        <div class="stat-box">
            <div class="stat-value offline">{{ ecrans_offline }}</div>
            <div class="stat-label">Hors ligne</div>
        </div>
        <div class="stat-box">
            <div class="stat-value total">{{ ecrans|length }}</div>
            <div class="stat-label">Total</div>
        </div>
    </div>
    
    <div class="refresh-indicator">
        <div class="refresh-spinner"></div>
        <span>Actualisation auto</span>
    </div>
</div>

<div class="monitoring-grid">
    {% for ecran in ecrans %}
    {% set isOnline = ecran.heartbeatLastSeen and ecran.heartbeatLastSeen > date('-2 minutes') %}
    {% set status = isOnline ? (ecran.heartbeatStatus ?? 'active') : 'offline' %}
    
    <div class="ecran-card" data-ecran-id="{{ ecran.id }}">
        <!-- Screenshot -->
        <img 
            src="{{ ecran.heartbeatScreenshot ?? '/img/placeholder-screen.jpg' }}?t={{ 'now'|date('U') }}" 
            alt="{{ ecran.nom }}"
            class="ecran-screenshot {{ status == 'offline' ? 'offline' : '' }}"
            loading="lazy"
        >
        
        <div class="ecran-info">
            <!-- Header -->
            <div class="ecran-header">
                <span class="ecran-name">{{ ecran.nom }}</span>
                <span class="ecran-status {{ status }}">
                    <span class="status-dot {{ status }}"></span>
                    {% if status == 'offline' %}
                        Hors ligne
                    {% elseif status == 'sleep' %}
                        Veille
                    {% elseif status == 'night' %}
                        Mode nuit
                    {% else %}
                        En ligne
                    {% endif %}
                </span>
            </div>
            
            <!-- Details -->
            <div class="ecran-details">
                <div class="ecran-detail">
                    <span class="ecran-detail-icon">📦</span>
                    <span>v{{ ecran.heartbeatVersion ?? '?' }}</span>
                </div>
                <div class="ecran-detail">
                    <span class="ecran-detail-icon">🎬</span>
                    <span>{{ ecran.heartbeatDebug.mediaCount ?? 0 }} médias</span>
                </div>
                <div class="ecran-detail">
                    <span class="ecran-detail-icon">💡</span>
                    <span>{{ ecran.heartbeatDebug.luminosite ?? 100 }}%</span>
                </div>
                <div class="ecran-detail">
                    <span class="ecran-detail-icon">🔊</span>
                    <span>{{ ecran.heartbeatDebug.sonActif ? 'Activé' : 'Muet' }}</span>
                </div>
                <div class="ecran-detail">
                    <span class="ecran-detail-icon">⏱️</span>
                    <span>{{ ecran.heartbeatUptime ? (ecran.heartbeatUptime / 3600)|number_format(1) ~ 'h' : '-' }}</span>
                </div>
                <div class="ecran-detail">
                    <span class="ecran-detail-icon">🕐</span>
                    <span>{{ ecran.heartbeatLastSeen ? ecran.heartbeatLastSeen|date('H:i') : 'Jamais' }}</span>
                </div>
            </div>
            
            <!-- Actions -->
            <div class="ecran-actions">
                <a href="{{ path('admin_ecran_edit', {id: ecran.id}) }}" class="ecran-action primary">
                    ⚙️ Configurer
                </a>
                <button class="ecran-action secondary" onclick="showDetails({{ ecran.id }})">
                    📊 Détails
                </button>
            </div>
        </div>
    </div>
    {% endfor %}
</div>

<!-- Modal détails (optionnel) -->
<div id="details-modal" class="modal" style="display:none;">
    <!-- Contenu du modal -->
</div>
{% endblock %}

{% block javascripts %}
{{ parent() }}
<script>
// Auto-refresh toutes les 30 secondes
setInterval(() => {
    // Recharger uniquement les screenshots et statuts via AJAX
    fetch('{{ path("api_monitoring_status") }}')
        .then(r => r.json())
        .then(data => {
            data.ecrans.forEach(ecran => {
                const card = document.querySelector(`[data-ecran-id="${ecran.id}"]`);
                if (card) {
                    // Mettre à jour le screenshot
                    const img = card.querySelector('.ecran-screenshot');
                    if (ecran.screenshot) {
                        img.src = ecran.screenshot + '?t=' + Date.now();
                    }
                    
                    // Mettre à jour le statut
                    const statusEl = card.querySelector('.ecran-status');
                    const statusDot = card.querySelector('.status-dot');
                    statusEl.className = 'ecran-status ' + ecran.status;
                    statusDot.className = 'status-dot ' + ecran.status;
                }
            });
        });
}, 30000);

function showDetails(ecranId) {
    // Ouvrir modal avec détails complets
    alert('Détails écran #' + ecranId);
}
</script>
{% endblock %}
```

---

## 🔄 API Status pour refresh AJAX

```php
#[Route('/api/monitoring/status', name: 'api_monitoring_status', methods: ['GET'])]
public function monitoringStatus(EcranRepository $ecranRepository): JsonResponse
{
    $ecrans = $ecranRepository->findAll();
    $twoMinutesAgo = new \DateTime('-2 minutes');
    
    $data = [];
    foreach ($ecrans as $ecran) {
        $isOnline = $ecran->getHeartbeatLastSeen() && $ecran->getHeartbeatLastSeen() > $twoMinutesAgo;
        
        $data[] = [
            'id' => $ecran->getId(),
            'status' => $isOnline ? ($ecran->getHeartbeatStatus() ?? 'active') : 'offline',
            'screenshot' => $ecran->getHeartbeatScreenshot(),
            'version' => $ecran->getHeartbeatVersion(),
            'lastSeen' => $ecran->getHeartbeatLastSeen()?->format('H:i:s'),
        ];
    }
    
    return new JsonResponse(['ecrans' => $data]);
}
```

---

## 📊 Statistiques globales

### Controller

```php
#[Route('/admin/see/monitoring', name: 'admin_see_monitoring')]
public function monitoring(EcranRepository $ecranRepository): Response
{
    $ecrans = $ecranRepository->findAll();
    $twoMinutesAgo = new \DateTime('-2 minutes');
    
    $online = 0;
    $offline = 0;
    
    foreach ($ecrans as $ecran) {
        if ($ecran->getHeartbeatLastSeen() && $ecran->getHeartbeatLastSeen() > $twoMinutesAgo) {
            $online++;
        } else {
            $offline++;
        }
    }
    
    return $this->render('admin/monitoring/index.html.twig', [
        'ecrans' => $ecrans,
        'ecrans_online' => $online,
        'ecrans_offline' => $offline,
    ]);
}
```

---

## ⏰ Fréquence et timeout

| Paramètre | Valeur |
|-----------|--------|
| Envoi heartbeat | Toutes les 30 secondes |
| Timeout "offline" | 2 minutes sans heartbeat |
| Refresh dashboard | 30 secondes (AJAX) |
| Taille screenshot | ~50-100 KB (JPEG 720p) |

---

## 🚀 Résumé implémentation

### Côté SOEK (à faire)

1. ✅ Créer endpoint `POST /see/API/heartbeat/{uuid}`
2. ✅ Ajouter colonnes heartbeat à table `ecran`
3. ✅ Créer dossier `/uploads/see/heartbeat/`
4. ✅ Créer page monitoring `/admin/see/monitoring`
5. ✅ Créer API refresh `/api/monitoring/status`

### Côté SEE Display (déjà fait)

1. ✅ HeartbeatManager.js
2. ✅ Capture screenshot 720p
3. ✅ Envoi toutes les 30s
