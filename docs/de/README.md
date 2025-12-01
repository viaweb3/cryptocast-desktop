# CryptoCast Desktop - Professionelles Batch-Airdrop-Tool

> 🚀 Multi-Chain Kryptowährungs-Belohnungsverteilungsplattform - Sichere, Effiziente und Benutzerfreundliche Desktop-Anwendung

[![Lizenz](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![Plattform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](../../.github/workflows/build.yml)
[![Version](https://img.shields.io/badge/version-1.4.2-blue.svg)](https://github.com/viaweb3/cryptocast-desktop/releases)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue.svg)](../../.github/workflows/build.yml)

---

## 📖 Projektübersicht

CryptoCast Desktop ist eine professionelle Cross-Plattform-Desktop-Anwendung, die auf Electron basiert und für Marketingkampagnen, Airdrop-Verteilung und Community-Belohnungen konzipiert wurde. Sie unterstützt die Batch-Token-Verteilung auf EVM-kompatiblen Chains und Solana.

### ✨ Kernfunktionen

#### 🔗 **Multi-Chain-Unterstützung**
- **EVM-Chains**: Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, Avalanche usw.
- **Solana**: Mainnet- und Devnet-Unterstützung
- **Smart Contracts**: Vorinstallierte Batch-Transfer-Verträge, optimiert für Gas-Gebühren

#### 📦 **Batch-Operationen**
- **Großmaßstäbliche Verarbeitung**: Importieren von Adressen und Beträgen aus CSV-Dateien
- **Batch-Transfers**: ERC-20 und Solana (SPL) Token Batch-Sending
- **Echtzeitfortschritt**: Visualisierte Verteilungsfortschritte und Statusüberwachung

#### 🔒 **Sicherheit und Datenschutz**
- **Local-First**: Alle sensiblen Daten (wie private Schlüssel) werden lokal verschlüsselt und gespeichert, niemals über einen Server geleitet
- **Isolierte Wallets**: Jede Kampagne verwendet ein unabhängiges abgeleitetes Wallet, um Kapitalrisiken zu isolieren
- **Vollständig Offline**: Kernfunktionen können im Offline-Modus arbeiten (Transaktionsunterschrift usw.)

#### 💡 **Benutzererfahrung**
- **Cross-Plattform**: Unterstützt Windows und macOS (Intel & Apple Silicon)
- **Intuitive Benutzeroberfläche**: Modernes Design mit einfacher und klarer Interaktion
- **Kostenschätzung**: Echtzeit-Gas-Gebühr und Gesamtkostenschätzung
- **Transaktionshistorie**: Vollständige Transaktionshistorie und Statusverfolgung
- **Strukturiertes Logging**: Winston-Logging-System für einfaches Debugging und Issue-Tracking

---

## 📚 Dokumentation

- **[Architekturdesign](../../ARCHITECTURE.md)** - Systemarchitektur und technische Entscheidungen
- **[Entwicklungshandbuch](../../DEVELOPMENT.md)** - Entwicklungsumgebungseinrichtung und Workflow
- **[API-Dokumentation](../../API_DOCS.md)** - Interne API-Dokumentation
- **[Testhandbuch](../../TESTING.md)** - Teststrategie und -durchführung
- **[Beitragsleitfaden](./CONTRIBUTING.md)** - Wie man zum Projekt beiträgt
- **[Änderungsprotokoll](../../CHANGELOG.md)** - Versionsaktualisierungshistorie
- **[Entwicklungs-Roadmap](../../ROADMAP.md)** - Funktionsplanung und Entwicklung

---

## 💾 Download und Installation

| Plattform | Download-Link | Beschreibung |
|-----------|---------------|-------------|
| **Windows (x64)** | [📥 Installer herunterladen](https://github.com/viaweb3/cryptocast-desktop/releases/latest) | Unterstützt Windows 10 und höher |
| **macOS (Intel)** | [📥 DMG herunterladen](https://github.com/viaweb3/cryptocast-desktop/releases/latest) | x64 Architektur Mac |
| **macOS (Apple Silicon)** | [📥 DMG herunterladen](https://github.com/viaweb3/cryptocast-desktop/releases/latest) | M1/M2/M3 Chip Mac |

👉 [Releases-Seite besuchen, um alle Versionen anzuzeigen](https://github.com/viaweb3/cryptocast-desktop/releases)

### 📋 Installationsanweisungen

**Windows:**
1. `CryptoCast Setup *.exe` von der [Releases-Seite](https://github.com/viaweb3/cryptocast-desktop/releases) herunterladen
2. Installer ausführen und den Anweisungen folgen, um die Installation abzuschließen

**macOS:**
1. Entsprechende Architektur `.dmg`-Datei von der [Releases-Seite](https://github.com/viaweb3/cryptocast-desktop/releases) herunterladen
   - Intel Mac: `*-x64.dmg` oder `*-mac.dmg` herunterladen
   - Apple Silicon Mac: `*-arm64.dmg` herunterladen
2. DMG-Datei doppelklicken, um sie zu öffnen, und `CryptoCast` in den `Applications`-Ordner ziehen
3. Beim ersten Lauf müssen Sie es in den Systemeinstellungen zulassen (Systemeinstellungen → Sicherheit und Datenschutz)

> **Hinweis**: Die aktuelle Version ist ein unsignierter Build, nur für Entwicklungs- und Testzwecke bestimmt.

### Lösung von Problemen mit unsignierten Anwendungen

Da die Anwendung nicht code-signiert ist, könnte das Betriebssystem die Ausführung blockieren. Bitte folgen Sie diesen Schritten entsprechend Ihrem Betriebssystem:

**Windows:**
1. Wenn Sie beim Ausführen des Installers die Meldung "Windows protected your PC" erhalten, klicken Sie im Popup auf "Weitere Informationen".
2. Klicken Sie dann auf "Trotzdem ausführen".

**macOS:**

*Methode 1: Verknüpfung (Empfohlen)*
1. Finden Sie die CryptoCast-Anwendung im Finder.
2. **Rechtsklick** (oder halten Sie die Steuerungstaste und klicken Sie) auf das Anwendungssymbol.
3. Wählen Sie **"Öffnen"** aus dem Menü.
4. Klicken Sie im Warndialog auf **"Öffnen"**.

*Methode 2: Systemeinstellungen*
1. Wenn Sie beim Doppelklicken die Warnung "Kann nicht geöffnet werden..." erhalten, klicken Sie auf "Abbrechen".
2. Öffnen Sie "Systemeinstellungen" > "Datenschutz und Sicherheit".
3. Finden Sie die Blockiermeldung am Ende der Seite und klicken Sie auf **"Trotzdem öffnen"**.

> ❓ **Wenn "Anwendung ist beschädigt" angezeigt wird**:
> Dies ist ein üblicher Blockiermechanismus von macOS für unsignierte Anwendungen. Es gibt zwei Lösungen:
>
> *Methode 1: Lokale Installation ohne Root-Berechtigungen (Empfohlen)*
> 1. Ziehen Sie CryptoCast.app in den Applications-Ordner des Benutzer-Home-Verzeichnisses (`~/Applications`)
> 2. Öffnen Sie Terminal und führen Sie den folgenden Befehl aus (kein sudo erforderlich):
>    ```bash
>    xattr -cr ~/Applications/CryptoCast.app
>    ```
> 3. Jetzt können Sie die Anwendung normal aus dem `~/Applications`-Ordner starten
> 4. Es wird empfohlen, ein Dock-Symbol für die Anwendung zu erstellen: ziehen Sie die Anwendung in die Dock-Leiste
>
> *Methode 2: Systemweite Installation (erfordert Administratorrechte)*
> 1. Ziehen Sie die Anwendung in den `/Applications`-Ordner
> 2. Öffnen Sie Terminal und führen Sie den folgenden Befehl aus:
>    ```bash
>    sudo xattr -cr /Applications/CryptoCast.app
>    ```
> 3. Administratorpasswort eingeben, um normal zu öffnen

---

## 🛠️ Entwicklungsumgebungseinrichtung

### Voraussetzungen

- Node.js 18+
- npm (oder yarn/pnpm)
- Git

### 1. Projekt klonen

```bash
git clone https://github.com/viaweb3/cryptocast-desktop.git
cd cryptocast-desktop
```

### 2. Abhängigkeiten installieren

```bash
npm install
```

### 3. Im Entwicklungsmodus ausführen

```bash
npm run dev
```

### 4. Anwendung erstellen

```bash
# Anwendung für aktuelle Plattform erstellen
npm run build

# Für spezifische Plattformen erstellen
npm run build:win              # Windows x64
npm run build:mac-intel        # macOS Intel (x64)
npm run build:mac-arm          # macOS Apple Silicon (arm64)
```

Build-Artefakte befinden sich im Verzeichnis `release/`.

### 5. Test-Tool-Skripte

```bash
# EVM-Test-Airdrop-Liste generieren (333 Adressen)
node scripts/generate-evm-airdrop.js

# Solana-Test-Airdrop-Liste generieren (333 Adressen)
node scripts/generate-solana-airdrop.js
```

---

## 📁 Projektstruktur

```
cryptocast-desktop/
├── 📂 src/
│   ├── 📂 main/                     # Electron Hauptprozess (Node.js Backend)
│   │   ├── 📄 index.ts              # Anwendungseinstiegspunkt
│   │   ├── 📄 preload.ts            # Preload-Skript (IPC-Sicherheitsbrücke)
│   │   ├── 📂 database/             # SQLite-Datenbank
│   │   │   ├── 📄 db-adapter.ts     # Datenbankadapter
│   │   │   └── 📄 sqlite-schema.ts  # Datenbankstruktur und Migrationen
│   │   ├── 📂 ipc/                  # IPC-Kommunikationshandler
│   │   │   └── 📄 handlers.ts       # Implementierung aller IPC-Kanäle
│   │   ├── 📂 services/             # Kerngeschäftslogik
│   │   │   ├── 📄 CampaignService.ts   # Kampagnenverwaltung
│   │   │   ├── 📄 WalletService.ts     # Wallet-Verwaltung
│   │   │   ├── 📄 BlockchainService.ts # Generische Blockchain-Dienst
│   │   │   ├── 📄 SolanaService.ts     # Solana-spezifischer Dienst
│   │   │   ├── 📄 GasService.ts        # Gas-Schätzungsdienst
│   │   │   └── 📄 ...                # Andere Dienste
│   │   └── 📂 utils/                # Dienstfunktionen
│   │
│   └── 📂 renderer/                 # Electron Renderer-Prozess (React Frontend)
│       └── 📂 src/
│           ├── 📄 App.tsx           # Anwendungs-Wurzelkomponente
│           ├── 📄 main.tsx          # React-Einstiegspunkt
│           ├── 📂 components/       # UI-Komponenten
│           ├── 📂 pages/            # Seiten-Komponenten
│           ├── 📂 hooks/            # Benutzerdefinierte React Hooks
│           ├── 📂 contexts/         # React Context
│           └── 📂 utils/            # Frontend-Dienstfunktionen
│
├── 📂 contracts/                    # Smart Contracts (Solidity)
│   ├── 📂 src/
│   │   └── 📄 BatchAirdropContract.sol # EVM Batch-Airdrop-Vertrag
│   └── 📄 foundry.toml              # Foundry-Konfiguration
│
├── 📄 package.json                  # Projektkonfiguration und Abhängigkeiten
├── 📄 vite.config.ts                # Vite-Konfiguration
├── 📄 electron-builder.json         # Electron Builder Packaging-Konfiguration
├── 📄 jest.config.mjs               # Jest-Testkonfiguration
```

---

## 🛠️ Technologiestack

### 🎨 Frontend
- **React**: UI-Framework
- **TypeScript**: Typsystem
- **Vite**: Build-Tool
- **TailwindCSS**: CSS-Framework
- **DaisyUI**: TailwindCSS-Komponentenbibliothek
- **React Router**: Routing

### ⚙️ Backend & Anwendungskern
- **Node.js 18+**: Laufzeitumgebung
- **Electron 39.2.2**: Cross-Plattform Desktop-Anwendungsframework
- **SQLite**: Lokale Datenbank
- **TypeScript 5.7.3**: Typsystem
- **Winston 3.18.3**: Strukturiertes Logging-System

### 🔗 Blockchain
- **ethers.js**: EVM-Chain-Interaktionsbibliothek
- **@solana/web3.js**: Solana-Chain-Interaktionsbibliothek
- **Foundry**: Solidity-Entwicklungs- und Test-Framework

### 🧪 Test
- **Jest**: Unit/Integrations-Tests
- **@testing-library/react**: React-Komponententests

---

## 🏗️ Architekturdesign

### Kerndienste
Die Anwendungs-Backend-Logik ist in mehrere Dienste unterteilt, die sich in `src/main/services/` befinden, einschließlich:

- **CampaignService**: Verantwortlich für Erstellung, Verwaltung und Ausführung von Airdrop-Kampagnen
- **WalletManagementService / WalletService**: Verwaltet Benutzer-Wallets, einschließlich Erstellung, Import und sicherer Speicherung
- **ChainManagementService / ChainService**: Verwaltet und verbindet mit verschiedenen Blockchain-Netzwerken (EVM & Solana)
- **ContractService**: Verantwortlich für Bereitstellung und Interaktion mit Smart Contracts
- **GasService / PriceService**: Schätzt Transaktionsgebühren und ruft Token-Preise ab
- **SolanaService**: Behandelt alle Solana-spezifischen Logiken
- **CampaignEstimator / CampaignExecutor**: Verantwortlich für Kampagnenkostenschätzung bzw. -ausführung

### Datenspeicherung
Die Anwendung verwendet **SQLite** als lokale Datenbank, mit Tabellenstrukturen definiert in `src/main/database/sqlite-schema.ts`.

#### Hauptdatentabellen
```sql
-- Kampagnen-Tabelle
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

-- Empfänger-Tabelle
CREATE TABLE recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL,
  address TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
  tx_hash TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
);

-- Transaktionen-Tabelle
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  tx_type TEXT NOT NULL,
  status TEXT NOT NULL,
  ...
  FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
);

-- Blockchain-Netzwerke-Tabelle
CREATE TABLE chains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('evm', 'solana')),
  name TEXT NOT NULL UNIQUE,
  rpc_url TEXT NOT NULL,
  ...
);
```

### Datenspeicherort
- **Windows**: `%APPDATA%\\cryptocast\\`
- **macOS**: `~/Library/Application Support/cryptocast/`
- **Linux**: `~/.config/cryptocast/`

---

## 🧪 Tests

### Tests ausführen

```bash
# Alle Unit- und Integrationstests ausführen
npm test

# Deckungsbericht generieren
npm run test:coverage
```

---

## 🤝 Beitrag

Wir begrüßen alle Formen von Beiträgen! Bitte lesen Sie die Datei **[CONTRIBUTING.md](./CONTRIBUTING.md)** für Details.

---

## 📄 Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](../../LICENSE).