---
name: release-changelog
description: "Use when the user wants to create a GitHub release, generate a changelog from git commits, bump the version, or tag a new release. Triggered by keywords: release, changelog, tag, version bump, nouvelle version, publier."
---

# Release Changelog Skill

Ce skill automatise la création de releases GitHub pour le projet LlamaCpp Manager.

## Workflow à suivre

### 1. Récupérer la version actuelle
Lire la version dans un des 3 fichiers (elles sont synchronisées) :
- `package.json` (ligne 3, champ `"version"`)
- `src-tauri/Cargo.toml` (ligne 3, champ `version`)
- `src-tauri/tauri.conf.json` (ligne 3, champ `"version"`)

### 2. Analyser les commits depuis le dernier tag
```bash
# Trouver le dernier tag
git describe --tags --abbrev=0 2>/dev/null || echo "AUCUN_TAG"

# Lister les commits depuis le dernier tag (ou tous les commits si aucun tag)
git log LAST_TAG..HEAD --oneline --no-merges
```

### 3. Catégoriser les commits (court et concis, PAS de code)
Analyser chaque commit et le classer dans une catégorie :

| Préfixe commit | Catégorie changelog |
|---|---|
| `feat:` | ✨ Features |
| `fix:` | 🐛 Fixes |
| `chore:` | 🔧 Chores |
| `docs:` | 📝 Documentation |
| `refactor:` | ♻️ Refactoring |
| `perf:` | ⚡ Performance |
| `style:` | 🎨 Style |
| `test:` | 🧪 Tests |
| `bump:` | Ne pas inclure dans le changelog |
| autre | 🔧 Chores |

Pour chaque commit, extraire **une ligne courte en français** (max 80 chars), sans montrer de code.

Exemple de transformation :
- `b34c105 chore: initialize project and set version to 0.2.6` → `Initialisation du projet et configuration de la version`
- `fix: correct CUDA download path` → `Correction du chemin de téléchargement CUDA`

### 4. Générer le changelog Markdown
Format du changelog (en français) :

```markdown
## Changements

### ✨ Features
- ...

### 🐛 Fixes
- ...

### 🔧 Chores
- ...

### 📝 Documentation
- ...
```

Supprimer les sections vides. Garder uniquement les sections qui ont des entrées.

### 5. Proposer à l'utilisateur
Montrer le changelog généré et demander :
1. La **nouvelle version** (proposer l'incrément logique : patch si fixes/chores, minor si features, major si breaking)
2. Confirmer ou modifier le changelog

### 6. Exécuter la release (après confirmation)

```bash
# Mettre à jour les 3 fichiers de version
# (package.json, Cargo.toml, tauri.conf.json)

# Commit
git add .
git commit -m "bump: version NEW_VERSION"

# Créer le tag annoté
git tag -a vNEW_VERSION -m "Release vNEW_VERSION"

# Push commits + tag
git push origin main
git push origin vNEW_VERSION
```

### 7. Créer la release GitHub automatiquement

**Vérifier d'abord si `gh` est installé :**
```bash
gh --version
```

**Si `gh` est disponible → créer la release directement :**

```bash
gh release create vNEW_VERSION \
  --repo 10skro/LLamaCpp_Manager \
  --title "vNEW_VERSION" \
  --generate-notes
```

Puis mettre à jour la description de la release avec le changelog généré :

```bash
# Écrire le changelog dans un fichier temporaire
echo "## Changements

[CONTENU DU CHANGELOG ICI]" > /tmp/release_body.md

# Mettre à jour la release
gh release edit vNEW_VERSION \
  --repo 10skro/LLamaCpp_Manager \
  --notes-file /tmp/release_body.md
```

**Si `gh` n'est PAS disponible → fallback API curl :**

```bash
# Écrire le changelog dans un fichier
echo 'CHANGELOG_JSON_ESCAPED' > /tmp/release_body.json

curl -s -X POST \
  -H "Authorization: Bearer ${GITHUB_TOKEN:?Erreur: GITHUB_TOKEN non défini}" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/10skro/LLamaCpp_Manager/releases" \
  -d "{
    \"tag_name\": \"vNEW_VERSION\",
    \"target_commitish\": \"main\",
    \"name\": \"vNEW_VERSION\",
    \"body\": \"CHANGELOG_MD_CONTENT\",
    \"draft\": false,
    \"prerelease\": false
  }"
```

**Si les deux méthodes échouent → fournir le body prêt à copier-coller** et indiquer à l'utilisateur de créer la release manuellement sur GitHub.

### 8. Confirmation finale
Afficher le lien de la release :
```
✅ Release créée : https://github.com/10skro/LLamaCpp_Manager/releases/tag/vNEW_VERSION
```

## Règles importantes
- **Jamais** inclure de code dans le changelog
- **Toujours** être concis (une ligne par changement)
- **Toujours** en français
- **Ne pas** inclure les commits de type `bump:` dans le changelog
- Si aucun commit depuis le dernier tag → informer l'utilisateur qu'il n'y a rien à releaser
