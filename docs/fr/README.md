# CryptoCast Desktop - Outil Professionnel de Distribution Airdrop en Lot

> 🚀 Plateforme de Distribution de Récompenses Cryptographiques Multi-chaînes - Application Bureau Sécurisée, Efficace et Conviviale

[![Licence](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![Plateforme](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](../../.github/workflows/build.yml)
[![Version](https://img.shields.io/badge/version-1.4.2-blue.svg)](https://github.com/viaweb3/cryptocast-desktop/releases)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue.svg)](../../.github/workflows/build.yml)

---

## 📖 Aperçu du Projet

CryptoCast Desktop est une application bureau professionnelle multi-plateforme construite sur Electron, conçue pour les campagnes marketing, la distribution airdrop et les récompenses communautaires, supportant la distribution de tokens en lot sur les chaînes compatibles EVM et Solana.

### ✨ Fonctionnalités Principales

#### 🔗 **Support Multi-chaînes**
- **Chaînes EVM** : Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, Avalanche, etc.
- **Solana** : Support mainnet et devnet
- **Contrats Intelligents** : Contrats de transfert en lot pré-déployés, optimisés pour les frais de gas

#### 📦 **Opérations en Lot**
- **Traitement à Grande Échelle** : Importation d'adresses et de montants depuis des fichiers CSV
- **Transferts en Lot** : Envoi de tokens ERC-20 et Solana (SPL) en lot
- **Progression en Temps Réel** : Visualisation de la progression de distribution et surveillance du statut

#### 🔒 **Sécurité et Confidentialité**
- **Local-First** : Toutes les données sensibles (telles que les clés privées) sont chiffrées et stockées localement, ne passant jamais par un serveur
- **Portefeuilles Isolés** : Chaque campagne utilise un portefeuille dérivé indépendant, isolant les risques de fonds
- **Totalement Hors-Ligne** : Les fonctions principales peuvent fonctionner en mode hors-ligne (signature de transactions, etc.)

#### 💡 **Expérience Utilisateur**
- **Multi-Plateforme** : Supporte Windows et macOS (Intel & Apple Silicon)
- **Interface Intuitive** : Design moderne avec interaction simple et claire
- **Estimation des Coûts** : Estimation en temps réel des frais de gas et du coût total
- **Historique des Transactions** : Historique complet des transactions et suivi de statut
- **Journalisation Structurée** : Système de journalisation Winston pour faciliter le débogage et le suivi des problèmes

---

## 📚 Documentation

- **[Architecture de Conception](../../ARCHITECTURE.md)** - Architecture système et décisions techniques
- **[Guide de Développement](../../DEVELOPMENT.md)** - Configuration de l'environnement de développement et workflow
- **[Documentation API](../../API_DOCS.md)** - Documentation API interne
- **[Guide de Test](../../TESTING.md)** - Stratégie de test et exécution
- **[Guide de Contribution](./CONTRIBUTING.md)** - Comment contribuer au projet
- **[Journal des Modifications](../../CHANGELOG.md)** - Historique des mises à jour de version
- **[Feuille de Route Développement](../../ROADMAP.md)** - Planification des fonctionnalités et développement

---

## 💾 Téléchargement et Installation

| Plateforme | Lien de Téléchargement | Description |
|-----------|------------------------|-------------|
| **Windows (x64)** | [📥 Télécharger l'Installateur](https://github.com/viaweb3/cryptocast-desktop/releases/latest) | Supporte Windows 10 et supérieur |
| **macOS (Intel)** | [📥 Télécharger DMG](https://github.com/viaweb3/cryptocast-desktop/releases/latest) | Mac architecture x64 |
| **macOS (Apple Silicon)** | [📥 Télécharger DMG](https://github.com/viaweb3/cryptocast-desktop/releases/latest) | Mac puces M1/M2/M3 |

👉 [Visiter la page des Releases pour voir toutes les versions](https://github.com/viaweb3/cryptocast-desktop/releases)

### 📋 Instructions d'Installation

**Windows :**
1. Téléchargez `CryptoCast Setup *.exe` depuis la [page des Releases](https://github.com/viaweb3/cryptocast-desktop/releases)
2. Exécutez l'installateur et suivez les invites pour compléter l'installation

**macOS :**
1. Téléchargez le fichier `.dmg` correspondant depuis la [page des Releases](https://github.com/viaweb3/cryptocast-desktop/releases)
   - Mac Intel : Téléchargez `*-x64.dmg` ou `*-mac.dmg`
   - Mac Apple Silicon : Téléchargez `*-arm64.dmg`
2. Double-cliquez pour ouvrir le fichier DMG et glissez `CryptoCast` dans le dossier `Applications`
3. Au premier lancement, vous devez l'autoriser dans les Préférences Système (Préférences Système → Sécurité et Confidentialité)

> **Note** : La version actuelle est une build non signée, destinée uniquement au développement et aux tests.

### Résolution des Problèmes de Lancement d'Application Non Signée

Comme l'application n'est pas signée par code, le système d'exploitation peut bloquer son exécution. Veuillez suivre ces étapes selon votre système d'exploitation :

**Windows :**
1. Si vous rencontrez l'invite "Windows protected your PC" lors de l'exécution de l'installateur, cliquez sur "Plus d'infos" dans le popup.
2. Puis cliquez sur "Exécuter quand même".

**macOS :**

*Méthode 1 : Raccourci (Recommandé)*
1. Trouvez l'application CryptoCast dans Finder.
2. **Clic droit** (ou maintenez Contrôle et cliquez) sur l'icône de l'application.
3. Sélectionnez **"Ouvrir"** dans le menu.
4. Dans la boîte de dialogue d'avertissement, cliquez sur **"Ouvrir"**.

*Méthode 2 : Paramètres Système*
1. Si vous rencontrez l'avertissement "Impossible d'ouvrir..." lors du double-clic, cliquez sur "Annuler".
2. Ouvrez "Paramètres Système" > "Confidentialité et Sécurité".
3. Trouvez l'invite de blocage en bas de la page et cliquez sur **"Ouvrir quand même"**.

> ❓ **Si vous voyez "L'application est endommagée"** :
> C'est un mécanisme de blocage courant de macOS pour les applications non signées. Il existe deux solutions :
>
> *Méthode 1 : Installation locale sans permissions root (Recommandé)*
> 1. Glissez CryptoCast.app dans le dossier Applications du domicile utilisateur (`~/Applications`)
> 2. Ouvrez Terminal et exécutez la commande suivante (aucun sudo requis) :
>    ```bash
>    xattr -cr ~/Applications/CryptoCast.app
>    ```
> 3. Vous pouvez maintenant lancer l'application normalement depuis le dossier `~/Applications`
> 4. Il est recommandé de créer une icône Dock pour l'application : glissez l'application dans la barre Dock
>
> *Méthode 2 : Installation au niveau système (requiert des privilèges d'administrateur)*
> 1. Glissez l'application dans le dossier `/Applications`
> 2. Ouvrez Terminal et exécutez la commande suivante :
>    ```bash
>    sudo xattr -cr /Applications/CryptoCast.app
>    ```
> 3. Entrez le mot de passe administrateur pour ouvrir normalement

---

## 🛠️ Configuration de l'Environnement de Développement

### Prérequis

- Node.js 18+
- npm (ou yarn/pnpm)
- Git

### 1. Cloner le Projet

```bash
git clone https://github.com/viaweb3/cryptocast-desktop.git
cd cryptocast-desktop
```

### 2. Installer les Dépendances

```bash
npm install
```

### 3. Exécuter en Mode Développement

```bash
npm run dev
```

### 4. Construire l'Application

```bash
# Construire l'application pour la plateforme actuelle
npm run build

# Construire pour des plateformes spécifiques
npm run build:win              # Windows x64
npm run build:mac-intel        # macOS Intel (x64)
npm run build:mac-arm          # macOS Apple Silicon (arm64)
```

Les artefacts de build sont situés dans le répertoire `release/`.

### 5. Scripts d'Outils de Test

```bash
# Générer une liste d'airdrop test EVM (333 adresses)
node scripts/generate-evm-airdrop.js

# Générer une liste d'airdrop test Solana (333 adresses)
node scripts/generate-solana-airdrop.js
```

---

## 📁 Structure du Projet

```
cryptocast-desktop/
├── 📂 src/
│   ├── 📂 main/                     # Processus principal Electron (backend Node.js)
│   │   ├── 📄 index.ts              # Point d'entrée de l'application
│   │   ├── 📄 preload.ts            # Script de préchargement (pont de sécurité IPC)
│   │   ├── 📂 database/             # Base de données SQLite
│   │   │   ├── 📄 db-adapter.ts     # Adaptateur de base de données
│   │   │   └── 📄 sqlite-schema.ts  # Structure de base de données et migrations
│   │   ├── 📂 ipc/                  # Gestionnaires de communication IPC
│   │   │   └── 📄 handlers.ts       # Implémentation de tous les canaux IPC
│   │   ├── 📂 services/             # Logique métier principale
│   │   │   ├── 📄 CampaignService.ts   # Gestion des campagnes
│   │   │   ├── 📄 WalletService.ts     # Gestion des portefeuilles
│   │   │   ├── 📄 BlockchainService.ts # Service blockchain générique
│   │   │   ├── 📄 SolanaService.ts     # Service spécifique Solana
│   │   │   ├── 📄 GasService.ts        # Service d'estimation de gas
│   │   │   └── 📄 ...                # Autres services
│   │   └── 📂 utils/                # Fonctions utilitaires
│   │
│   └── 📂 renderer/                 # Processus renderer Electron (frontend React)
│       └── 📂 src/
│           ├── 📄 App.tsx           # Composant racine de l'application
│           ├── 📄 main.tsx          # Point d'entrée React
│           ├── 📂 components/       # Composants UI
│           ├── 📂 pages/            # Composants de niveau page
│           ├── 📂 hooks/            # Hooks React personnalisés
│           ├── 📂 contexts/         # Contexte React
│           └── 📂 utils/            # Fonctions utilitaires frontend
│
├── 📂 contracts/                    # Contrats intelligents (Solidity)
│   ├── 📂 src/
│   │   └── 📄 BatchAirdropContract.sol # Contrat d'airdrop en lot EVM
│   └── 📄 foundry.toml              # Configuration Foundry
│
├── 📄 package.json                  # Configuration du projet et dépendances
├── 📄 vite.config.ts                # Configuration Vite
├── 📄 electron-builder.json         # Configuration de packaging Electron Builder
├── 📄 jest.config.mjs               # Configuration de test Jest
```

---

## 🛠️ Stack Technologique

### 🎨 Frontend
- **React** : Framework UI
- **TypeScript** : Système de types
- **Vite** : Outil de build
- **TailwindCSS** : Framework CSS
- **DaisyUI** : Bibliothèque de composants TailwindCSS
- **React Router** : Routage

### ⚙️ Backend & Cœur d'Application
- **Node.js 18+** : Environnement d'exécution
- **Electron 39.2.2** : Framework d'application bureau multi-plateforme
- **SQLite** : Base de données locale
- **TypeScript 5.7.3** : Système de types
- **Winston 3.18.3** : Système de journalisation structurée

### 🔗 Blockchain
- **ethers.js** : Bibliothèque d'interaction chaîne EVM
- **@solana/web3.js** : Bibliothèque d'interaction chaîne Solana
- **Foundry** : Framework de développement et test Solidity

### 🧪 Test
- **Jest** : Tests unitaires/intégration
- **@testing-library/react** : Tests de composants React

---

## 🏗️ Conception d'Architecture

### Services Principaux
La logique backend de l'application est divisée en plusieurs services situés dans `src/main/services/`, incluant :

- **CampaignService** : Responsable de la création, gestion et exécution des campagnes airdrop
- **WalletManagementService / WalletService** : Gère les portefeuilles utilisateurs, incluant création, import et stockage sécurisé
- **ChainManagementService / ChainService** : Gère et connecte à différents réseaux blockchain (EVM & Solana)
- **ContractService** : Responsable du déploiement et interaction avec les contrats intelligents
- **GasService / PriceService** : Estime les frais de transaction et récupère les prix des tokens
- **SolanaService** : Gère toute la logique spécifique Solana
- **CampaignEstimator / CampaignExecutor** : Responsable de l'estimation des coûts de campagne et de l'exécution, respectivement

### Stockage de Données
L'application utilise **SQLite** comme base de données locale, avec des structures de table définies dans `src/main/database/sqlite-schema.ts`.

#### Tables de Données Principales
```sql
-- Table des Campagnes
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  chain_type TEXT NOT NULL CHECK (chain_type IN ('evm', 'solana')),
  chain_id INTEGER,
  token_address TEXT NOT NULL,
  status TEXT NOT NULL,
  total_recipients INTEGER NOT NULL,
  wallet_address TEXT,
  contract_address TEXT,
  ...
);

-- Table des Destinataires
CREATE TABLE recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL,
  address TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
  tx_hash TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
);

-- Table des Transactions
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  tx_type TEXT NOT NULL,
  status TEXT NOT NULL,
  ...
  FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
);

-- Table des Réseaux Blockchain
CREATE TABLE chains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('evm', 'solana')),
  name TEXT NOT NULL UNIQUE,
  rpc_url TEXT NOT NULL,
  ...
);
```

### Emplacement de Stockage de Données
- **Windows** : `%APPDATA%\\cryptocast\\`
- **macOS** : `~/Library/Application Support/cryptocast/`
- **Linux** : `~/.config/cryptocast/`

---

## 🧪 Test

### Exécuter les Tests

```bash
# Exécuter tous les tests unitaires et d'intégration
npm test

# Générer un rapport de couverture
npm run test:coverage
```

---

## 🤝 Contribution

Nous accueillons toutes les formes de contribution ! Veuillez lire le fichier **[CONTRIBUTING.md](./CONTRIBUTING.md)** pour les détails.

---

## 📄 Licence

Ce projet est sous licence [Licence MIT](../../LICENSE).