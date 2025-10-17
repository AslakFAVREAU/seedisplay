# 🔒 Guide: Audit de Sécurité et Correction des Vulnérabilités

## ⚠️ Situation Actuelle

**GitHub Security Alert:**
```
44 vulnerabilities found
├── 2 critical
├── 18 high
├── 18 moderate
└── 6 low
```

**Source:** https://github.com/AslakFAVREAU/seedisplay/security/dependabot

---

## 🎯 Objectif

Corriger toutes les vulnérabilités sans casser l'application (maintenir 132/132 tests passing).

---

## 📋 Plan d'Action

### Phase 1: Analyse (15 min)
```bash
# Analyser les vulnérabilités
npm audit

# Export complet en JSON
npm audit --json > audit-report.json
```

### Phase 2: Corrections Automatiques (30 min)
```bash
# Tentative de correction automatique (safe)
npm audit fix

# Vérifier l'impact
npm test  # Doit rester 132/132
```

### Phase 3: Corrections Forcées (1h)
```bash
# Si audit fix ne suffit pas
npm audit fix --force

# ⚠️ ATTENTION: Peut introduire breaking changes
# Tester immédiatement après
npm test
```

### Phase 4: Corrections Manuelles (2h)
```bash
# Pour les vulnérabilités non corrigées
# Mettre à jour manuellement les packages problématiques
npm update <package-name>
```

---

## 🔍 Analyse Détaillée

### Commande 1: Vue d'Ensemble
```bash
npm audit
```

**Sortie attendue:**
```
found 44 vulnerabilities (2 critical, 18 high, 18 moderate, 6 low)
  run `npm audit fix` to fix 30 of them.
  14 vulnerabilities require manual review.
```

### Commande 2: Export JSON
```bash
npm audit --json > audit-report.json
```

**Permet:**
- Analyse détaillée par vulnérabilité
- Traçabilité pour documentation
- Comparaison avant/après

### Commande 3: Audit Lisible
```bash
npm audit --json | ConvertFrom-Json | Select-Object -ExpandProperty vulnerabilities | Format-Table
```

---

## 🛠️ Workflow de Correction

### Étape 1: Backup
```bash
# Sauvegarder package.json et package-lock.json
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup

# Créer une branche de sécurité
git checkout -b security/fix-vulnerabilities
```

### Étape 2: Correction Automatique Safe
```bash
# Correction des vulnérabilités sans breaking changes
npm audit fix

# Vérifier immédiatement
npm test

# Si échec: restaurer et analyser
# git checkout package.json package-lock.json
```

**Résultat attendu:**
```
fixed 30 vulnerabilities
14 vulnerabilities require manual review
```

### Étape 3: Vérifier l'Application
```bash
# Tests unitaires
npm test  # Doit afficher: 132 passing

# Build test
npm run dist

# Test manuel de l'app
npm start
```

### Étape 4: Correction Forcée (si nécessaire)
```bash
# ⚠️ Utiliser avec prudence
npm audit fix --force

# Tests critiques
npm test
npm start

# Si échec: rollback
git checkout .
npm install
```

### Étape 5: Corrections Manuelles
```bash
# Identifier les packages problématiques
npm audit --json | ConvertFrom-Json | Select-Object -ExpandProperty vulnerabilities | Where-Object {$_.severity -eq "critical"}

# Mettre à jour manuellement
npm update <package-critical>

# Ou installer version spécifique
npm install <package>@<version-safe>
```

---

## 📊 Catégories de Vulnérabilités

### Critical (2) - PRIORITÉ MAXIMALE
**Action:** Corriger immédiatement
**Risque:** Exploitation directe, compromission système

### High (18) - PRIORITÉ HAUTE
**Action:** Corriger dans les 7 jours
**Risque:** Exploitation possible, impact significatif

### Moderate (18) - PRIORITÉ MOYENNE
**Action:** Corriger dans les 30 jours
**Risque:** Exploitation difficile, impact limité

### Low (6) - PRIORITÉ BASSE
**Action:** Corriger quand possible
**Risque:** Exploitation très difficile, impact minimal

---

## 🎯 Stratégie par Package

### Dépendances Directes
```bash
# Lister les dépendances directes
npm list --depth=0

# Vérifier les versions disponibles
npm outdated
```

**Action:**
- Mettre à jour vers la dernière version stable
- Vérifier la compatibilité dans le changelog
- Tester après chaque mise à jour

### Dépendances Transitives
```bash
# Identifier les dépendances problématiques
npm audit --json | ConvertFrom-Json | Select-Object -ExpandProperty vulnerabilities | Select-Object via

# Voir l'arbre de dépendances
npm list <package-problematique>
```

**Action:**
- Mettre à jour le package parent
- Utiliser `npm audit fix --force` si nécessaire
- Documenter les exceptions si impossible à corriger

---

## ✅ Checklist de Validation

### Avant Correction
- [ ] Backup de `package.json` et `package-lock.json`
- [ ] Branche Git créée: `security/fix-vulnerabilities`
- [ ] Export audit initial: `audit-before.json`
- [ ] Tests passent: 132/132

### Après Correction
- [ ] Audit final: `npm audit` (0 vulnerabilities idéalement)
- [ ] Export audit final: `audit-after.json`
- [ ] Tests passent: 132/132
- [ ] Build réussie: `npm run dist`
- [ ] Application démarre: `npm start`
- [ ] Fonctionnalités testées manuellement

### Documentation
- [ ] Changelog mis à jour
- [ ] Commits clairs pour chaque correction
- [ ] PR créée avec résumé des changements
- [ ] Merge sur master après validation

---

## 📝 Template de Commit

```
fix(security): resolve <severity> vulnerability in <package>

- Update <package> from <old-version> to <new-version>
- Fixes <CVE-ID> or <vulnerability-description>
- Impact: <none|minor|breaking>
- Tests: 132/132 passing

Refs: https://github.com/advisories/<GHSA-ID>
```

**Exemples:**

```
fix(security): resolve critical vulnerability in axios

- Update axios from 1.6.8 to 1.7.0
- Fixes CVE-2024-XXXXX (SSRF vulnerability)
- Impact: none (backward compatible)
- Tests: 132/132 passing

Refs: https://github.com/advisories/GHSA-xxxx-xxxx-xxxx
```

---

## 🔧 Cas Particuliers

### Vulnérabilité Non Corrigeable
Si un package n'a pas de version corrigée disponible:

```bash
# Option 1: Accepter le risque temporairement
npm audit --json > exceptions.json
# Documenter dans SECURITY.md

# Option 2: Trouver une alternative
npm uninstall <package-vulnerable>
npm install <alternative-package>

# Option 3: Fork et patch
# (pour cas extrêmes uniquement)
```

**Documentation:**
```markdown
## Exceptions de Sécurité

### <package-name> v<version>
- **Vulnérabilité:** <description>
- **Gravité:** <severity>
- **Raison de l'exception:** <justification>
- **Mitigation:** <mesures prises>
- **Date de revue:** <date-prochaine-revue>
```

### Breaking Changes Détectés
Si `npm audit fix --force` casse les tests:

```bash
# 1. Identifier le package problématique
git diff package.json

# 2. Restaurer ce package spécifique
npm install <package>@<version-precedente>

# 3. Chercher une solution alternative
# - Mise à jour incrémentale
# - Patch manuel
# - Alternative au package
```

---

## 📊 Rapport Final

### Template de Rapport

```markdown
# Rapport d'Audit de Sécurité

**Date:** <date>
**Version:** <version>
**Auditeur:** <nom>

## Résumé

| Catégorie | Avant | Après | Corrigées |
|-----------|-------|-------|-----------|
| Critical  | 2     | 0     | 2         |
| High      | 18    | 0     | 18        |
| Moderate  | 18    | 0     | 18        |
| Low       | 6     | 0     | 6         |
| **TOTAL** | **44**| **0** | **44**    |

## Actions Effectuées

1. `npm audit fix` → 30 vulnérabilités corrigées
2. Mise à jour manuelle de `axios`, `electron`, etc.
3. Remplacement de `<package-obsolete>` par `<alternative>`

## Impacts

- **Tests:** ✅ 132/132 passing (aucun impact)
- **Build:** ✅ Réussie
- **Fonctionnalités:** ✅ Toutes opérationnelles

## Exceptions

Aucune vulnérabilité non corrigée.

## Recommandations

- Audit mensuel automatisé
- Dépendances critiques: monitoring actif
- Process de revue pour nouvelles dépendances
```

---

## 🤖 Automatisation Future

### Script d'Audit Mensuel

```javascript
// scripts/security-audit.js
const { execSync } = require('child_process');
const fs = require('fs');

const audit = JSON.parse(execSync('npm audit --json').toString());
const report = {
  date: new Date().toISOString(),
  totalVulnerabilities: audit.metadata.vulnerabilities.total,
  critical: audit.metadata.vulnerabilities.critical,
  high: audit.metadata.vulnerabilities.high,
  moderate: audit.metadata.vulnerabilities.moderate,
  low: audit.metadata.vulnerabilities.low
};

fs.writeFileSync('audit-history.json', JSON.stringify(report, null, 2));

if (report.critical > 0 || report.high > 0) {
  console.error('❌ Vulnerabilités critiques ou high détectées!');
  process.exit(1);
}

console.log('✅ Aucune vulnérabilité critique ou high');
```

**Usage:**
```bash
node scripts/security-audit.js
```

### GitHub Actions (CI/CD)

```yaml
# .github/workflows/security-audit.yml
name: Security Audit

on:
  schedule:
    - cron: '0 0 * * 0'  # Tous les dimanches
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm audit
      - run: npm audit fix
      - name: Create PR if fixes available
        if: success()
        uses: peter-evans/create-pull-request@v5
        with:
          title: 'security: automated dependency updates'
          branch: security/auto-update
```

---

## 📚 Ressources

- [npm audit Documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [GitHub Advisory Database](https://github.com/advisories)
- [Snyk Vulnerability DB](https://snyk.io/vuln/)
- [CVE Details](https://www.cvedetails.com/)

---

## ✅ TODO Immédiat

1. **Phase 1: Analyse**
   - [ ] `npm audit` → Identifier les 44 vulnérabilités
   - [ ] Export JSON pour documentation
   - [ ] Créer branche `security/fix-vulnerabilities`

2. **Phase 2: Correction**
   - [ ] `npm audit fix` (corrections safe)
   - [ ] Tests: `npm test` (132/132)
   - [ ] `npm audit fix --force` si nécessaire
   - [ ] Tests après chaque changement

3. **Phase 3: Validation**
   - [ ] Build test: `npm run dist`
   - [ ] Application test: `npm start`
   - [ ] Documentation des changements
   - [ ] Commit + PR

4. **Phase 4: Déploiement**
   - [ ] Merge sur master
   - [ ] Tag nouvelle version: v1.9.3
   - [ ] Publish: `npm run publish`

---

**Date:** October 17, 2025  
**Priorité:** 🔴 HAUTE (2 critical, 18 high)  
**Effort estimé:** 2-4 heures  
**Deadline:** 7 jours maximum pour critical/high
