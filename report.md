# 🔍 Code Review Report — Module Catalogue

**Date:** Thu Jul 23 2026
**Scope:** Catalogue module — dead code, duplications, naming issues

---

## Résumé Exécutif

| Catégorie | 🔴 Critique | 🟡 Moyen | 🟢 Mineur |
|---|---|---|---|
| Code Mort | 2 | 3 | 1 |
| Duplications | 1 | 2 | 1 |
| Nommages | 0 | 1 | 4 |
| **Total** | **3** | **6** | **6** |

---

## 1. Code Mort

### 1.1 — `useCheckNewBuilds` hook — Jamais importé
- **Fichier :** `src/hooks/useBuilds.ts`
- **Lignes :** 14–32
- **Sévérité :** 🔴 CRITIQUE
- **Description :** Le hook `useCheckNewBuilds` est exporté mais jamais importé nulle part dans le codebase. L'interface `CheckNewBuildsResult` associée est également morte.
- **Correction suggérée :** Supprimer les lignes 14–32 de `useBuilds.ts`.

---

### 1.2 — `useDownloads` hook — Fichier entier inutilisé
- **Fichier :** `src/hooks/useDownloads.ts`
- **Lignes :** 1–10
- **Sévérité :** 🔴 CRITIQUE
- **Description :** Le fichier entier `useDownloads.ts` est exporté mais jamais importé. Le hook retourne un tableau vide avec un intervalle de refetch de 5 secondes, ce qui ne sert à rien.
- **Correction suggérée :** Supprimer le fichier `src/hooks/useDownloads.ts`.

---

### 1.3 — `startDownload` service function — Jamais importée
- **Fichier :** `src/services/download.ts`
- **Lignes :** 4–11
- **Sévérité :** 🟡 MOYEN
- **Description :** La fonction `startDownload` est exportée du service de download mais jamais importée. Le frontend utilise exclusivement `installVersion` à la place.
- **Correction suggérée :** Supprimer la fonction `startDownload` de `src/services/download.ts`.

---

### 1.4 — `start_download` Tauri Command — API backend morte
- **Fichier :** `src-tauri/src/lib.rs`
- **Lignes :** 124–221
- **Sévérité :** 🟡 MOYEN
- **Description :** La commande Tauri `start_download` est enregistrée dans l'invoke handler (ligne 456) mais le frontend ne l'appelle jamais. Seule `install_version` est utilisée. Cette commande duplique une grande partie du setup d'`install_version` (résolution du chemin de stockage, création du record de download, spawn du canal de progression) mais ne fait que l'étape de download sans extraction/validation.
- **Correction suggérée :** Supprimer la commande `start_download` de `lib.rs` et son inscription dans la liste des handlers.

---

### 1.5 — Canal MPSC inutilisé dans VersionManager
- **Fichier :** `src-tauri/src/version/manager.rs`
- **Ligne :** 93
- **Sévérité :** 🟢 MINEUR
- **Description :** Un canal `(_done_tx, _done_rx)` est créé mais jamais utilisé. Le préfixe underscore supprime l'avertissement du compilateur, mais le canal ne sert à rien.
```rust
let (_done_tx, _done_rx) = mpsc::channel::<Result<(), AppError>>(1);
```
- **Correction suggérée :** Supprimer la ligne 93 entièrement.

---

### 1.6 — `#![allow(dead_code)]` suppression globale
- **Fichier :** `src-tauri/src/lib.rs`
- **Ligne :** 1
- **Sévérité :** 🟡 MOYEN
- **Description :** L'attribut `#![allow(dead_code)]` à la racine du crate supprime tous les avertissements de code mort sur l'entièreté du backend Rust. Cela masque les vrais problèmes de code mort (comme ceux identifiés ci-dessus) et empêche le compilateur de détecter les régressions futures.
- **Correction suggérée :** Retirer la suppression globale `#![allow(dead_code)]` et utiliser `#[allow(dead_code)]` ciblé uniquement sur du code intentionnellement inutilisé.

---

## 2. Duplications

### 2.1 — Progress Event Forwarding — Dupliqué dans 2 commandes
- **Fichier :** `src-tauri/src/lib.rs`
- **Lignes :** 176–205 (`start_download`) et 298–317 (`install_version`)
- **Sévérité :** 🔴 CRITIQUE
- **Description :** Les deux commandes `start_download` et `install_version` contiennent des blocs tokio spawn quasi identiques pour le forwarding des événements de progression :
  - Création d'un canal MPSC
  - Clonage de `app` et `db`
  - Spawn d'une tâche avec la même constante `DB_WRITE_INTERVAL = 5`
  - Même logique d'écriture DB throttled
  - Même vérification de statut terminal (`["completed", "failed", "cancelled"]`)
- **Correction suggérée :** Extraire cela dans une fonction helper partagée comme `spawn_progress_forwarder(app, db, tx)`.

---

### 2.2 — Storage Path Resolution — Logique dupliquée
- **Fichier :** `src-tauri/src/lib.rs`
- **Lignes :** 133–140 (`start_download`) et 279–283 (`install_version`)
- **Sévérité :** 🟡 MOYEN
- **Description :** Les deux commandes répètent la même logique de résolution du chemin de stockage :
```rust
// start_download (lignes 133-140)
let fallback_path = app.path().app_local_data_dir()...
let app_dir = PathBuf::from(SettingsManager::get_storage_path(&state_db, &fallback_path));

// install_version (lignes 279-283)
let fallback_path = app.path().app_local_data_dir()...
let storage_base = PathBuf::from(SettingsManager::get_storage_path(&state_db, &fallback_path));
```
- **Correction suggérée :** Extraire dans une fonction helper comme `resolve_storage_base(app, &state_db)`.

---

### 2.3 — Status Display Components — JSX dupliqué
- **Fichier :** `src/pages/CatalogPage.tsx`
- **Lignes :** 642–654 (ligne parent) et 704–715 (ligne enfant)
- **Sévérité :** 🟡 MOYEN
- **Description :** L'affichage du statut installé/en téléchargement est dupliqué entre la ligne du groupe parent et les lignes des variantes enfants :
```tsx
// Ligne parent (lignes 642-654)
{variants.some(v => installedKeys.has(...)) ? (
  <div className="flex items-center justify-center gap-1.5 text-emerald-400">
    <CheckCircle2 className="h-4 w-4" />
    <span className="text-xs">Installed</span>
  </div>
) : variants.some(v => downloading.has(...)) ? (
  <div className="flex items-center justify-center gap-1.5 text-blue-400">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span className="text-xs">Downloading</span>
  </div>
) : null}

// Ligne enfant (lignes 704-715) — structure identique
{isInstalled ? (
  <div className="flex items-center justify-center gap-1.5 text-emerald-400">...</div>
) : isDownloading ? (
  <div className="flex items-center justify-center gap-1.5 text-blue-400">...</div>
) : null}
```
- **Correction suggérée :** Extraire dans un composant `<BuildStatusBadge installed={...} downloading={...} />`.

---

### 2.4 — `formatSize` et `formatRelativeTime` — Locaux au lieu de partagés
- **Fichier :** `src/pages/CatalogPage.tsx`
- **Lignes :** 41–47 (`formatSize`) et 70–83 (`formatRelativeTime`)
- **Sévérité :** 🟢 MINEUR
- **Description :** Les deux fonctions utilitaires sont définies localement dans le fichier du composant. `formatDate` (objectif similaire) est déjà dans `src/utils/format.ts`, mais `formatRelativeTime` et `formatSize` ne sont pas partagés. Si elles sont nécessaires ailleurs (Dashboard, Settings, etc.), elles devraient être dupliquées.
- **Correction suggérée :** Déplacer `formatSize` vers `src/utils/format.ts` et `formatRelativeTime` vers un nouveau `src/utils/time.ts` ou l'ajouter à `format.ts`.

---

## 3. Nommages

### 3.1 — `getBuildKey` vs `getBuildIdentifier` — Double nommage confus
- **Fichier :** `src/pages/CatalogPage.tsx`
- **Lignes :** 30–39
- **Sévérité :** 🟡 MOYEN
- **Description :** Deux fonctions servent des objectifs chevauchants avec des noms confus :
  - `getBuildKey` (ligne 30) : Utilise `download_url` comme clé primaire, fallback sur `build_number_backend`. Utilisée pour les clés de ligne et les favoris.
  - `getBuildIdentifier` (ligne 36) : Utilise toujours `build_number_backend`. Utilisée pour le statut installé et le suivi des téléchargements.
  
  Le nommage est trompeur car "Key" semble plus fondamental que "Identifier", mais le plus stable est `getBuildIdentifier`. Le commentaire sur la ligne 37 dit "legacy key generation" ce qui implique que `getBuildIdentifier` est le pattern legacy, mais c'est en fait le plus utilisé de manière cohérente.
- **Correction suggérée :** Renommer en `getBuildUniqueKey` (pour basé sur URL) et `getBuildCompositeId` (pour nombre+backend), ou consolider en une seule fonction avec un paramètre de stratégie.

---

### 3.2 — `legacyKey` — Intention peu claire
- **Fichier :** `src/pages/CatalogPage.tsx`
- **Lignes :** 210, 662
- **Sévérité :** 🟢 MINEUR
- **Description :** La variable `legacyKey` est utilisée pour stocker le résultat de `getBuildIdentifier()`, mais le nom "legacy" est trompeur. Ce n'est pas legacy — c'est la clé composite active utilisée pour le matching du statut installé/téléchargé. L'étiquette "legacy" vient du commentaire sur la ligne 37, qui est lui-même peu clair.
- **Correction suggérée :** Renommer en `compositeKey` ou `buildIdKey` et mettre à jour le commentaire pour expliquer clairement la stratégie à double clé.

---

### 3.3 — `availableBackends` vs `available` — Convention de nommage incohérente
- **Fichier :** `src/pages/CatalogPage.tsx` (ligne 383) vs `src-tauri/src/github/api.rs` (ligne 623)
- **Sévérité :** 🟢 MINEUR
- **Description :** Le frontend utilise `availableBackends` (camelCase, descriptif) tandis que le backend Rust utilise `available` (court, générique). Bien que le nommage inter-langage n'ait pas besoin de correspondre exactement, la variable `available` Rust dans `check_for_new_builds` peut être confondue avec "available backends" lors des code reviews.
- **Correction suggérée :** Renommer la variable Rust en `available_builds` pour plus de clarté.

---

### 3.4 — `FetchMode::Smart` — Nom d'énumération vague
- **Fichier :** `src-tauri/src/github/api.rs`
- **Lignes :** 22–28
- **Sévérité :** 🟢 MINEUR
- **Description :** `FetchMode::Smart` est un nom vague. Le commentaire explique que c'est "si cache frais → DB; si périmé → vérification ETag → fetch si besoin", ce qui est en réalité un mode de fetch "default" ou "conditional". "Smart" est subjectif et ne décrit pas le comportement réel.
- **Correction suggérée :** Renommer en `FetchMode::Default` ou `FetchMode::Conditional` pour plus de clarté.

---

### 3.5 — `builds` Variable Shadowing dans CatalogPage
- **Fichier :** `src/pages/CatalogPage.tsx`
- **Lignes :** 253, 660
- **Sévérité :** 🟢 MINEUR
- **Description :** Le nom de variable `builds` est shadowé :
  - Ligne 253 : `const builds = await fetchBuilds({ forceRefresh: true });` shadow le `builds` du hook `useBuilds()` (ligne 53).
  - Ligne 660 : `variants.map((build, idx)` utilise `build` ce qui est correct, mais le scope extérieur a déjà `builds` du hook.
  
  Ce n'est pas un bug car la variable shadowée est dans un scope différent, mais cela réduit la lisibilité.
- **Correction suggérée :** Renommer les builds fetchés en `freshBuilds` sur la ligne 253.

---

## Actions Prioritaires

| Priorité | Action |
|---|---|
| 🔴 1 | Supprimer `useCheckNewBuilds` et `useDownloads` (hooks/fichiers morts) |
| 🔴 2 | Supprimer `startDownload` + commande `start_download` Tauri |
| 🔴 3 | Retirer `#![allow(dead_code)]` du crate root |
| 🟡 4 | Extraire le forwarding de progression dans une fonction helper |
| 🟡 5 | Extraire le badge de statut dans `<BuildStatusBadge />` |
| 🟡 6 | Clarifier le nommage `getBuildKey` / `getBuildIdentifier` |

---

## Verdict Global

Le catalogue fonctionne mais contient **~150 lignes de code mort** et **2 blocs de duplication significative** côté backend. Le code est fonctionnel mais mérite un nettoyage pour réduire la dette technique et éviter des bugs futurs.

---

*Généré automatiquement par Code Review Agent — Thu Jul 23 2026*
