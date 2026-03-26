# Implémentation — 4 fonctionnalités Storage & Dev

## Résumé

Quatre points à adresser dans le stockage et l'interface de développement :
1. **Commande dev argent** — commande temporaire accessible via console pour générer des Inkübits pendant le développement, avec effacement propre après usage.
2. **Vente de slimes depuis l'archive** — confirmer que le drag-to-sell fonctionne pour les slimes en archive (pas seulement en équipe) et ajouter un bouton "Vendre" dans le panneau de détail.
3. **Bouton "Ranger"** dans le panneau de détail des slimes en archive — ouvre un pop-up avec saisie d'un numéro de boîte (1–99), déplace le slime, affiche un message si la boîte est pleine.
4. **Remplacer les snapshots** (images fixes) par le portrait SVG canonique dans les slots — utiliser [buildCanonicalPortraitSvg](file:///d:/inku_game/V10/www/src/features/storage/storage-canonical-visual-renderer.js#3-104) déjà en place mais de façon centrée et parfaite.

> [!IMPORTANT]
> Point 4 : [buildCanonicalPortraitSvg](file:///d:/inku_game/V10/www/src/features/storage/storage-canonical-visual-renderer.js#3-104) est **déjà utilisé** dans [storage-grid-renderer.js](file:///d:/inku_game/V10/www/src/features/storage/storage-grid-renderer.js) pour les slots. Les "snapshots" évoqués semblent être les rendus actuels dans les slots — il faut vérifier s'il existe d'autres endroits avec des images statiques (ex. balises `<img>`) qui auraient remplacé le SVG. Confirmé ci-dessous après analyse — aucune `<img>` dans le slot renderer. Le SVG est déjà le rendu principal. Ce point concerne probablement le détail modal visuellement — voir section ci-dessous.

---

## Proposed Changes

### 1. Commande dev argent

> [!WARNING]
> Cette commande doit être **entièrement supprimée** après développement (aucune trace). Elle est exposée temporairement via `window.__inkuDev`.

#### [MODIFY] [index.html](file:///d:/inku_game/V10/www/index.html)
_Après le bootstrap, exposer la commande dev via un script inline à supprimer manuellement._

#### [NEW] Exposé dans `bootstrap/` ou via [index.html](file:///d:/inku_game/V10/www/index.html)
Ajouter dans le script de bootstrap (ou en script inline temporaire dans [index.html](file:///d:/inku_game/V10/www/index.html)) :
```js
// ==== DEV ONLY — À SUPPRIMER ====
window.__inkuDev = {
  addMoney(amount = 10000) {
    store.dispatch({ type: 'ADD_CURRENCY', payload: { currency: 'hexagon', amount } });
    console.log(`[DEV] +${amount} hexagons ajoutés.`);
  }
};
// ================================
```
→ Le `store` doit être accessible via une variable captée dans le scope du bootstrap.

**Usage en console :** `__inkuDev.addMoney(50000)`

**Suppression :** supprimer le bloc `window.__inkuDev = {...}` + l'import éventuel.

---

### 2. Vente de slimes depuis l'archive

#### [MODIFY] [storage-panel-controller.js](file:///d:/inku_game/V10/www/src/features/storage/storage-panel-controller.js)

**Constat :** La zone de drag `sell` dans `storage-drag-actions` est déjà présente et fonctionne pour tous les slimes (team et archive). La logique `finishDrag → openSellModal` est déjà implémentée. La vente est fonctionnelle via drag.

**À ajouter :** Un bouton **"Vendre"** dans le panneau de détail (section [renderDetail](file:///d:/inku_game/V10/www/src/features/storage/storage-panel-controller.js#1276-1375)), similaire au bouton "Ranger". Ce bouton ouvre la `sellModal` sans nécessiter le drag.

```html
<button type="button" class="storage-detail-modal__action-btn storage-detail-modal__action-btn--danger"
        data-storage-detail-sell>
  <span class="storage-detail-modal__action-icon">🛒</span>
  Vendre
</button>
```

Puis dans le gestionnaire de clics (`root.addEventListener('click', async (e) => ...`) :
```js
const sellBtn = e.target.closest('[data-storage-detail-sell]');
if (sellBtn && selectedCanonicalId) {
  const snapshot = repository.getSnapshot();
  const record = snapshot.recordsById[selectedCanonicalId];
  if (record) {
    closeDetail();
    openSellModal({ canonicalId: selectedCanonicalId, record });
  }
}
```

---

### 3. Bouton "Ranger" dans l'archive (detail panel)

#### [MODIFY] [storage-panel-controller.js](file:///d:/inku_game/V10/www/src/features/storage/storage-panel-controller.js)

**Constat :** Le bouton "Ranger/Déplacer" dans [renderDetail](file:///d:/inku_game/V10/www/src/features/storage/storage-panel-controller.js#1276-1375) utilise `data-storage-detail-move` et appelle [requestBoxSelection()](file:///d:/inku_game/V10/www/src/features/storage/storage-panel-controller.js#1447-1453) qui affiche la grille de boîtes. **Mais** ce bouton n'est affiché que si `record.placement?.kind === 'team'` (pour les slimes d'équipe) ou en mode "DÉPLACER" pour les slimes d'archive.

**Problème :** Pour les slimes en archive, le bouton "DÉPLACER" appelle [requestBoxSelection()](file:///d:/inku_game/V10/www/src/features/storage/storage-panel-controller.js#1447-1453) → grille de boîtes. Mais cette grille est un sélecteur visuel par clic, pas une saisie de numéro.

**Changement demandé** : Remplacer la grille de boîtes par un **pop-up avec saisie de numéro** (1–99).

**Plan :**
1. Remplacer le `storage-box-selector` (grille cliquable) par un nouveau modal de saisie numérique.
2. Le modal contient : titre, input numérique (1–99), bouton Confirmer, bouton Annuler.
3. À la validation : vérifier si la boîte est pleine → toast/message d'erreur ; sinon déplacer.

**HTML du nouveau modal** (remplace `data-storage-box-modal`) :
```html
<div class="storage-box-input-modal" data-storage-box-modal hidden inert ...>
  <div class="storage-box-input-modal__content">
    <h3>Ranger dans une boîte</h3>
    <p>Entre le numéro de boîte (1–99) :</p>
    <input type="number" min="1" max="99" data-storage-box-number-input>
    <p class="storage-box-input-modal__error" data-storage-box-error hidden></p>
    <div class="storage-box-input-modal__actions">
      <button data-storage-box-cancel>Annuler</button>
      <button data-storage-box-confirm>Ranger</button>
    </div>
  </div>
</div>
```

**Logique modifiée dans [confirmBoxSelection](file:///d:/inku_game/V10/www/src/features/storage/storage-panel-controller.js#1454-1460)** :
- Lire la valeur de l'input
- Valider 1 ≤ n ≤ 99
- Vérifier si la page n est pleine (via `snapshot.pages[n]`)
- Si pleine → afficher message d'erreur dans le modal (ne pas fermer)
- Si valide → appeler [resolve({ page: n })](file:///d:/inku_game/V10/www/src/core/state-store.js#5-20)

#### [MODIFY] [translations.js](file:///d:/inku_game/V10/www/src/i18n/translations.js)
Ajouter les clés manquantes :
- `storage.box_input_title` : "Ranger dans une boîte"
- `storage.box_input_hint` : "Numéro de boîte (1–99)"
- `storage.box_full_error` : "Cette boîte est pleine !"
- `storage.box_invalid` : "Numéro invalide (1–99)"
- `storage.action_move_label` : "Ranger" (déjà partiellement présent)

---

### 4. Remplacement des snapshots par SVG canonique

**Constat après analyse :** Le [storage-grid-renderer.js](file:///d:/inku_game/V10/www/src/features/storage/storage-grid-renderer.js) utilise déjà [buildCanonicalPortraitSvg](file:///d:/inku_game/V10/www/src/features/storage/storage-canonical-visual-renderer.js#3-104) pour chaque slot. Il n'y a pas d'images `<img>` statiques dans les slots. La demande concerne probablement :
- Les **slots vides** qui ont juste un `+` : pas de changement nécessaire
- L'éventuel **snapshot statique** du détail modal — qui affiche le sandbox live (canvas), pas une image

> [!NOTE]
> Après analyse approfondie : le rendu SVG est **déjà en place** dans la grille. Si la demande vise à améliorer le rendu dans les slots (centrage, taille), les ajustements doivent être faits dans le CSS et/ou en modifiant les paramètres [size](file:///d:/inku_game/V10/www/src/features/storage/storage-canonical-inspection-sandbox.js#241-250) dans [buildCanonicalPortraitSvg](file:///d:/inku_game/V10/www/src/features/storage/storage-canonical-visual-renderer.js#3-104) dans le grid renderer.

**Changements CSS pour centrage parfait des portraits SVG :**

#### [MODIFY] Fichier CSS du storage (à identifier)
S'assurer que `.storage-canonical-portrait--slot` est centré via :
```css
.storage-slot__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
.storage-canonical-portrait--slot {
  width: 64px;
  height: 64px;
  max-width: 100%;
  max-height: 100%;
  display: block;
}
```

---

## Verification Plan

### Tests manuels (via navigateur)

1. **Commande dev argent** : Ouvrir la console JS du navigateur, taper `__inkuDev.addMoney(10000)`. Vérifier que le solde HUD augmente de 10 000.

2. **Vente depuis archive** :
   - Ouvrir le storage → onglet Archive.
   - Long-press sur un slime → zone "Revendre" apparaît → drag dessus → modal de confirmation → cliquer "Revendre".
   - OU : Appuyer sur un slime → ouvrir la fiche → cliquer "Vendre" → même modal → confirmer.
   - Vérifier que le slime disparaît et que le solde augmente.

3. **Bouton Ranger avec saisie** :
   - Ouvrir le storage → onglet Archive (ou Équipe).
   - Appuyer sur un slime → ouvrir la fiche → cliquer "Ranger".
   - Modal avec input apparaît → entrer un numéro valide → confirmer → slime se déplace.
   - Tester une boîte pleine → message d'erreur visible dans le modal (pas de fermeture).
   - Tester un numéro hors plage (0 ou 100) → message d'erreur.

4. **Portrait SVG dans les slots** :
   - Ouvrir le storage → vérifier que les slimes dans les slots ont un portrait centré et bien proportionné, sans débordement ni décalage.
