# Plan : Console Dev + Usine à Potions

---

## 1. Console de développement

Un overlay flottant accessible via un bouton discret (long-press sur le logo du jeu ou bouton fixe en bas à droite). Accessible uniquement si `localStorage.setItem('inku.dev', '1')` est activé.

### Fonctionnalités
| Action | Détail |
|---|---|
| `+500 💎` | Ajoute 500 hexagons |
| `Équipe pleine` | Ajoute 4 slimes fictifs en équipe |
| `Reset factory` | Efface `localStorage` factory |
| `Reset storage` | Efface `localStorage` storage |
| `Reset tout` | Reset complet (recharge la page) |
| `État JSON` | Affiche le state store courant |
| `Box ready` | Force `box.status = 'ready'` dans la factory |

**Implémentation** : nouveau fichier `src/utils/dev-console.js` avec un export `mountDevConsole(store)`. Monté depuis le bootstrap principal.

---

## 2. Usine à Potions — Refonte visuelle + mécanique

### Problèmes actuels
- Étagère : `height: 160px` fixe → trop haute sur smartphone
- Table : `height: 250px` fixe → laisse trop peu d'espace
- 1 seule boîte statique, toujours présente → pas de boucle économique claire
- Aucun message expliquant comment gagner de l'argent

### Nouvelles règles de jeu
| Élément | Coût | Limite |
|---|---|---|
| Boîte vide | 50 💎 | 4 sur la table |
| Potion vide | 10 💎 | 6 par boîte |

> **Changement de paradigme** : la table peut accueillir jusqu'à 4 boîtes, chacune contenant jusqu'à 6 potions (au lieu de 4). L'utilisateur achète d'abord une boîte, puis des potions vides à remplir avec les slimes.

### Refonte de l'état persisté
```
state = {
  boxes: [           // max 4, chacune indépendante
    {
      id: 0,
      potions: [],   // max 6 par boîte
      status: 'idle' | 'packaging' | 'ready',
      timerEnd: null,
      rewardValue: 0
    }
  ],
  flasks: [{ id, doses }] // 4 fioles, inchangées
}
```

### Refonte visuelle (CSS mobile-first)
- **Étagère** : `height: clamp(80px, 18vh, 130px)` — beaucoup plus compacte
- **Header** : `padding: 8px 12px` (réduit)
- **Table** : flex + `flex-grow: 1` pour s'adapter à l'espace disponible
- **Zone boîtes** : grille 2×2 scrollable horizontalement pour 4 boîtes
- **Zone fioles** : restent en bas de table, redimensionnées
- **Boutons d'achat** : affichés en bas, toujours visibles

### Flux utilisateur
```
[Acheter une boîte (50💎)] → apparaît sur la table
  → [Acheter potion (10💎)] → slot vide dans la boîte
    → [Clic slime + clic fiole] → dose ajoutée
      → [Fiole pleine → clic sur fiole] → dose versée dans potion
        → [Toutes potions remplies → Timer auto] → [Boîte prête] → [Vendre]
```

---

## Fichiers modifiés

### Dev Console
#### [NEW] [dev-console.js](file:///d:/inku_game/V10/www/src/utils/dev-console.js)
#### [MODIFY] bootstrap (create-game-menu-app.js ou index.html)

### Usine à Potions
#### [MODIFY] [potion-factory-controller.js](file:///d:/inku_game/V10/www/src/features/potion-factory/potion-factory-controller.js)
#### [MODIFY] [potion-persistence.js](file:///d:/inku_game/V10/www/src/features/potion-factory/potion-persistence.js)
#### [MODIFY] [potion-factory.css](file:///d:/inku_game/V10/www/styles/features/potion-factory.css)

---

## Vérification
- Test sur viewport 390×844px (iPhone 14)
- Acheter 1 boîte → vérifier déduction 50💎
- Acheter 1 potion → vérifier déduction 10💎
- Remplir les potions avec un slime → vérifier timer + récompense
- Console dev : `+500💎` → vérifier balance
