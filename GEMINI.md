# GEMINI.md

## Project Overview
**FARTLESS** (sometimes referred to as FEARLESS) is a Discord bot built with **Bun** and **TypeScript**. It features a gamified loot drop system and a virtual economy.

### Main Features
- **Loot Drop System:** Randomly spawns loot items (e.g., Crimson Sigil, Bleed Cache) in a specified Discord channel.
- **Currency (Gorency):** Users earn "gorency" by claiming loot before it expires or reaches its claim limit.
- **Shop System:** Users can spend gorency on items like name change permissions, image permissions, and XP.
- **Inventory & Receipts:** Users can view their purchased items and generate a one-time "receipt" to finalize their purchases.
- **Gifting:** Users can transfer gorency to each other.

### Technologies
- **Runtime:** [Bun](https://bun.sh/)
- **Language:** TypeScript
- **Library:** [discord.js](https://discord.js.org/)
- **Persistence:** Local JSON file storage (`.cache/users.json`).

---

## Building and Running

### Prerequisites
- [Bun](https://bun.sh/) installed.
- A Discord Bot Token.
- A target Discord Channel ID for loot spawns.

### Environment Variables
Create a `.env` file (or set environment variables) with the following:
```env
TOKEN=your_discord_bot_token
CHANNEL_ID=your_target_channel_id
```

### Commands
- **Install dependencies:**
  ```bash
  bun install
  ```
- **Run the bot:**
  ```bash
  bun run index.ts
  ```

---

## Development Conventions

### Project Structure
- `index.ts`: The main entry point containing all bot logic, command handling, and loot/shop definitions.
- `media/`: Contains image assets for loot drops.
- `.cache/`: Contains `users.json` for persistent user data (ignored by git).
- `tsconfig.json`: Configured for Bun's native TypeScript support.

### Coding Style
- **Prefix:** Commands use the `rf ` prefix (e.g., `rf help`, `rf balance`).
- **Data Model:** User data is managed via a simple `users` record object and saved synchronously to `users.json`.
- **Command Handling:** Commands are processed in the `messageCreate` event handler.
- **Interactions:** Button interactions (claims, shop buys, receipt confirmation) are handled in the `interactionCreate` event handler.

### Key Data Structures
- `loots`: Array of objects defining loot types, spawn rates, values, and images.
- `shopItems`: Record of available items for purchase with their prices and limits.
- `activeClaims`: A `Map` tracking currently active (unexpired/unclaimed) loot drops in the channel.

### Adding New Loot/Items
To add new loot or shop items, modify the `loots` array or `shopItems` record in `index.ts`. Ensure any new loot images are added to the `media/` folder.
