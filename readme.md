# 🎰 Discord Roulette Bot

**A fun and interactive roulette game for Discord servers, developed using `discord.js v14`. Join the game, challenge your friends, and try to be the last one standing!**


## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Commands](#commands)
- [Game Rules](#game-rules)
- [Usage](#usage)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

- 🎮 **Interactive Gameplay**: Play an exciting roulette game within your Discord server.
- 🛡️ **Shield & Revive Mechanics**: Protect yourself or bring back fallen players.
- 🕹️ **Automated Rounds**: The game progresses automatically, providing a seamless experience.
- 📊 **Game Statistics**: View detailed statistics for all players after the game ends.
- 🔥 **Kick Players**: Choose who to kick out of the game as the rounds progress.
- 🎉 **Randomized Events**: Enjoy the unpredictability of random actions within the game.

## Installation

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/wickstudio/discord-roulette-bot.git
   cd discord-roulette-bot
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Set Up Environment Variables:**
   Create a `.env` file in the root directory and add your Discord bot token:
   ```env
   TOKEN=your-discord-bot-token
   ```

## Configuration

Configure the bot settings in the `config.json` file:

```json
{
  "startTime": 10,
  "chooseTimeout": 30,
  "timeBetweenRounds": 5,
  "token": "your-discord-bot-token",
  "allowedRoleId": "role-id-allowed-to-start-game"
}
```

- `startTime`: Time (in seconds) before the game starts after the command is issued.
- `chooseTimeout`: Time (in seconds) the winner has to choose a player to kick.
- `timeBetweenRounds`: Time (in seconds) between rounds.
- `token`: Your Discord bot token.
- `allowedRoleId`: The role ID of users allowed to start the game.

## Commands

### `/roulette`

- **Description**: Starts a new roulette game in the server.
- **Permissions**: Only users with the specified role (`allowedRoleId`) can start the game.

## Game Rules

- **Joining**: Players join the game by clicking a button corresponding to a number.
- **Gameplay**: After joining, players are randomly chosen to kick others out or perform special actions like shielding or reviving.
- **Winning**: The last player standing wins the game!

## Usage

1. **Start the Bot:**
   ```bash
   node index.js
   ```

2. **Interact with the Bot:**
   - Use the `/roulette` command in any channel where the bot is present to start a game.
   - Players can join, leave, protect themselves, or revive others using interactive buttons provided by the bot.

## Development

### Project Structure

```bash
discord-roulette-bot/
├── assets/
│   ├── Poppins/
│   │   ├── Poppins-Bold.ttf
│   │   └── Poppins-Regular.ttf
│   ├── fallback.png
│   └── pointer.png
├── src/
│   ├── index.js
│   ├── utils.js
│   └── wheel.js
├── .env
├── config.json
├── package.json
└── README.md
```

### Key Files

- **index.js**: Main bot file handling commands and interactions.
- **utils.js**: Contains utility functions for creating button rows and handling interactions.
- **wheel.js**: Logic for creating and drawing the roulette wheel.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-branch`).
3. Make your changes.
4. Commit your changes (`git commit -m 'Add new feature'`).
5. Push to the branch (`git push origin feature-branch`).
6. Create a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Bot developed by [Wick Studio](https://discord.gg/wicks)**