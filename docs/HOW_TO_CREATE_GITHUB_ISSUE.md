# Créer une GitHub Issue Manuellement

## 📌 Méthode 1: Interface Web GitHub (Plus simple)

1. **Accédez à:** https://github.com/AslakFAVREAU/seedisplay/issues/new

2. **Remplissez le formulaire:**

### Title
```
[AMELIORATION] Gestion multi-ratio et orientation ecran (16:9, 16:10, Portrait, Vertical)
```

### Description (Body)
Copiez le contenu de: `docs/GITHUB_ISSUE_TEMPLATE_DISPLAY_RATIO.md`

### Labels
Cochez:
- `amelioration`
- `enhancement`  
- `ui`
- `display`

3. **Cliquez:** "Submit new issue"

---

## 📌 Méthode 2: GitHub CLI (Si installé)

```bash
gh issue create \
  --title "[AMELIORATION] Gestion multi-ratio et orientation ecran" \
  --body "$(cat docs/GITHUB_ISSUE_TEMPLATE_DISPLAY_RATIO.md)" \
  --label "amelioration,enhancement,ui,display"
```

**Installation GitHub CLI:**
```bash
winget install GitHub.cli
```

---

## 📌 Méthode 3: API REST (Approche programmée)

**Token requis:** `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`

**Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN_HERE" \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Content-Type: application/json" \
  -d @- https://api.github.com/repos/AslakFAVREAU/seedisplay/issues <<'EOF'
{
  "title": "[AMELIORATION] Gestion multi-ratio et orientation ecran",
  "body": "Contenu ici",
  "labels": ["amelioration", "enhancement", "ui", "display"]
}
EOF
```

---

## 🎯 Résumé pour l'Issue

**Titre:**
```
[AMELIORATION] Gestion multi-ratio et orientation ecran (16:9, 16:10, Portrait, Vertical)
```

**Description Courte:**
```
Gerer correctement l'affichage des images et videos selon les differents ratios d'ecran et orientations.

Probleme: Bandes noires visibles quand image 16:9 sur ecran 16:10

Solution: Implémenter trois modes (FILL, FIT, STRETCH) avec detection automatique du ratio

Template complet: docs/GITHUB_ISSUE_TEMPLATE_DISPLAY_RATIO.md
```

**Labels:**
- amelioration
- enhancement
- ui
- display

---

**ℹ️ Note:** La méthode web est la plus simple et ne nécessite pas de token!
