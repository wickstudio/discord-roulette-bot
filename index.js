require('dotenv').config();
const {
  Client,
  IntentsBitField,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  InteractionType,
} = require('discord.js');
const {
  createButtonRows,
  commands,
  sleep,
} = require('./utils.js');
const {
  startTime,
  chooseTimeout,
  timeBetweenRounds,
  token,
  allowedRoleId,
  prefix,
} = require('./config.json');
const { createWheel } = require('./wheel.js');

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

const Games = new Map();
const KickedPlayers = new Map();
const AllPlayers = new Map();

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

client.on('ready', async () => {
  const rest = new REST().setToken(token);

  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);
    const data = await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error('Error refreshing application commands:', error);
  }

  console.log(`
    ██╗    ██╗██╗ ██████╗██╗  ██╗    ███████╗████████╗██╗   ██╗██████╗ ██╗ ██████╗ 
    ██║    ██║██║██╔════╝██║ ██╔╝    ██╔════╝╚══██╔══╝██║   ██║██╔══██╗██║██╔═══██╗
    ██║ █╗ ██║██║██║     █████╔╝     ███████╗   ██║   ██║   ██║██║  ██║██║██║   ██║
    ██║███╗██║██║██║     ██╔═██╗     ╚════██║   ██║   ██║   ██║██║  ██║██║██║   ██║
    ╚███╔███╔╝██║╚██████╗██║  ██╗    ███████║   ██║   ╚██████╔╝██████╔╝██║╚██████╔╝
     ╚══╝╚══╝ ╚═╝ ╚═════╝╚═╝  ╚═╝    ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝ ╚═════╝ 
    `);
  console.log('I am ready!');
  console.log('Bot By Wick Studio');
  console.log('discord.gg/wicks');
});

client.on('messageCreate', async message => {
  try {
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (commandName === 'روليت') {
      if (!message.member.roles.cache.has(allowedRoleId)) {
        message.reply('ليس لديك الإذن لاستخدام هذا الأمر.').catch(console.error);
        return;
      }

      if (await Games.get(message.guildId)) {
        message.reply('هناك لعبة قيد التقدم بالفعل في هذا السيرفر.').catch(console.error);
        return;
      }

      await startRouletteGame(message);
    }
  } catch (error) {
    console.error('Error handling message command:', error);
    message.reply('حدث خطأ أثناء معالجة الأمر. يرجى المحاولة مرة أخرى.').catch(console.error);
  }
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.type === InteractionType.ApplicationCommand) {
      if (interaction.commandName === 'roulette') {
        await startRouletteGame(interaction);
      }
    } else if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    if (!interaction.replied) {
      interaction
        .reply({ content: 'حدث خطأ أثناء معالجة التفاعل. يرجى المحاولة مرة أخرى.', ephemeral: true })
        .catch(console.error);
    }
  }
});


async function startRouletteGame(source) {
  try {
    const member = source.member || source.guild.members.cache.get(source.author.id);
    const guildId = source.guildId || source.guild.id;

    if (!member.roles.cache.has(allowedRoleId)) {
      if (source.reply) {
        source.reply({ content: 'ليس لديك الإذن لاستخدام هذا الأمر.', ephemeral: true }).catch(console.error);
      } else {
        source.channel.send('ليس لديك الإذن لاستخدام هذا الأمر.').catch(console.error);
      }
      return;
    }

    if (await Games.get(guildId)) {
      if (source.reply) {
        source.reply({ content: 'هناك لعبة قيد التقدم بالفعل في هذا السيرفر.', ephemeral: true }).catch(console.error);
      } else {
        source.channel.send('هناك لعبة قيد التقدم بالفعل في هذا السيرفر.').catch(console.error);
      }
      return;
    }

    const joinButton = new ButtonBuilder()
      .setCustomId('join_roulette')
      .setLabel('انضم إلى اللعبة')
      .setStyle(ButtonStyle.Success);

    const leaveButton = new ButtonBuilder()
      .setCustomId('leave_roulette')
      .setLabel('غادر اللعبة')
      .setStyle(ButtonStyle.Danger);

    const rows = createButtonRows([joinButton, leaveButton]);

    const attachment = new AttachmentBuilder('./roulette.png');

    const initialMessage = await source.channel.send({
      content: '🎲 **بدء لعبة الروليت**\n0/40 لاعبين انضموا',
      files: [attachment],
      components: rows,
    });

    Games.set(guildId, {
      players: [],
      messageId: initialMessage.id,
      winner: {},
    });
    KickedPlayers.set(guildId, { players: [] });
    AllPlayers.set(guildId, new Map());

    if (source.reply) {
      source.reply({ content: 'تم بدء اللعبة! انضم عن طريق الضغط على الزر أدناه.', ephemeral: true }).catch(console.error);
    } else {
      source.channel.send('تم بدء اللعبة! انضم عن طريق الضغط على الزر أدناه.').catch(console.error);
    }

    setTimeout(async () => {
      try {
        await initialMessage.edit({ components: [] }).catch(console.error);
        await startGame(source, true);
      } catch (error) {
        console.error('Error starting the game:', error);
      }
    }, startTime * 1000);
  } catch (error) {
    console.error('Error in startRouletteGame:', error);
    source.channel.send('حدث خطأ أثناء بدء اللعبة. يرجى المحاولة مرة أخرى.').catch(console.error);
  }
}


async function handleButtonInteraction(interaction) {
  try {
    const customId = interaction.customId;

    if (customId === 'join_roulette') {
      await handleJoinGame(interaction);
    } else if (customId === 'leave_roulette') {
      await handleLeaveGame(interaction);
    } else if (customId.startsWith('kick_')) {
      await handleKickPlayer(interaction);
    } else if (customId === 'auto_kick') {
      await handleAutoKick(interaction);
    } else if (customId === 'withdrawal') {
      await handleWithdrawal(interaction);
    } else if (customId.startsWith('revive_player')) {
      await handleReviveAction(interaction);
    } else if (customId.startsWith('protect_player')) {
      await handleProtectYourself(interaction);
    } else if (customId.startsWith('switch_turn')) {
      await handleSwitchTurn(interaction);
    } else if (customId.startsWith('freeze_player')) {
      await handleFreezeAction(interaction);
    } else if (customId.startsWith('select_player_')) {
      await handleSelectPlayer(interaction);
    } else if (customId.startsWith('paginate_')) {
      await handlePagination(interaction);
    }
  } catch (error) {
    console.error('Error handling button interaction:', error);
    if (!interaction.replied) {
      interaction.reply({ content: 'حدث خطأ أثناء معالجة التفاعل. يرجى المحاولة مرة أخرى.', ephemeral: true }).catch(console.error);
    }
  }
}


async function handleJoinGame(interaction) {
  try {
    const savedGame = await Games.get(interaction.guildId);
    const allPlayers = AllPlayers.get(interaction.guildId);

    if (!savedGame) {
      interaction
        .reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true })
        .catch(console.error);
      return;
    }

    if (savedGame.players.some(user => user.user === interaction.user.id)) {
      interaction
        .reply({
          content: 'لقد انضممت بالفعل.',
          ephemeral: true,
        })
        .catch(console.error);
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);

    const assignedNumbers = savedGame.players.map(p => parseInt(p.buttonNumber, 10));
    let number = 1;
    while (assignedNumbers.includes(number)) {
      number++;
    }

    if (number > 40) {
      interaction
        .reply({
          content: 'تم الوصول إلى الحد الأقصى لعدد اللاعبين في هذه اللعبة.',
          ephemeral: true,
        })
        .catch(console.error);
      return;
    }

    const playerData = {
      user: interaction.user.id,
      buttonNumber: number.toString(),
      username: member.displayName,
      avatar: interaction.user.displayAvatarURL({ size: 256, extension: 'png' }),
      color: interaction.user.hexAccentColor,
      shield: false,
      shieldUsed: false,
      reviveUsed: false,
      freezeUsed: false,
      frozen: false,
      switchUsed: false,
      kills: 0,
      deaths: 0,
    };

    savedGame.players.push(playerData);
    allPlayers.set(interaction.user.id, playerData);
    Games.set(interaction.guildId, savedGame);
    AllPlayers.set(interaction.guildId, allPlayers);

    const messageId = savedGame.messageId;
    const channel = interaction.channel;

    const message = await channel.messages.fetch(messageId);

    const joinCount = savedGame.players.length;

    await message.edit({ content: `🎲 **بدء لعبة الروليت**\n${joinCount}/40 لاعبين انضموا` }).catch(console.error);

    interaction
      .reply({ content: `انضممت بنجاح! رقمك هو ${number}.`, ephemeral: true })
      .catch(console.error);
  } catch (error) {
    console.error('Error handling join game:', error);
    interaction.reply({ content: 'حدث خطأ أثناء الانضمام إلى اللعبة.', ephemeral: true }).catch(console.error);
  }
}


async function handleLeaveGame(interaction) {
  try {
    const savedGame = await Games.get(interaction.guildId);

    if (!savedGame) {
      interaction
        .reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true })
        .catch(console.error);
      return;
    }

    if (!savedGame.players.some(user => user.user === interaction.user.id)) {
      interaction.reply({ content: 'لم تنضم إلى اللعبة.', ephemeral: true }).catch(console.error);
      return;
    }

    savedGame.players = savedGame.players.filter(user => user.user !== interaction.user.id);
    await Games.set(interaction.guildId, savedGame);

    const messageId = savedGame.messageId;
    const channel = interaction.channel;

    const message = await channel.messages.fetch(messageId);

    const joinCount = savedGame.players.length;

    await message.edit({ content: `🎲 **بدء لعبة الروليت**\n${joinCount}/40 لاعبين انضموا` }).catch(console.error);

    interaction.reply({ content: 'لقد غادرت اللعبة.', ephemeral: true }).catch(console.error);
  } catch (error) {
    console.error('Error handling leave game:', error);
    interaction.reply({ content: 'حدث خطأ أثناء مغادرة اللعبة.', ephemeral: true }).catch(console.error);
  }
}


async function handleKickPlayer(interaction) {
  try {
    const kickedUserId = interaction.customId.split('_')[1];

    const savedGame = await Games.get(interaction.guildId);
    const kickedPlayers = await KickedPlayers.get(interaction.guildId);
    const allPlayers = AllPlayers.get(interaction.guildId);

    if (!savedGame) {
      interaction
        .reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true })
        .catch(console.error);
      return;
    }

    if (interaction.user.id !== savedGame?.winner.id) {
      interaction
        .reply({ content: 'ليس دورك في اللعبة، لذا لا يمكنك طرد اللاعبين.', ephemeral: true })
        .catch(console.error);
      return;
    }
    if (Date.now() > savedGame.winner.until) {
      interaction.reply({ content: 'لقد فاتك دورك.', ephemeral: true }).catch(console.error);
      return;
    }

    const playerToKick = savedGame.players.find(player => player.user === kickedUserId);

    if (!playerToKick) {
      interaction.reply({ content: 'هذا اللاعب غير موجود في اللعبة.', ephemeral: true }).catch(console.error);
      return;
    }

    if (playerToKick.shield) {
      interaction
        .reply({ content: 'لا يمكنك طرد هذا اللاعب لأنه محمي للدور القادم.', ephemeral: true })
        .catch(console.error);
      return;
    }

    kickedPlayers.players.push(playerToKick);
    playerToKick.deaths += 1;
    const kicker = savedGame.players.find(player => player.user === interaction.user.id);
    kicker.kills += 1;
    allPlayers.get(playerToKick.user).deaths = playerToKick.deaths;
    allPlayers.get(kicker.user).kills = kicker.kills;

    savedGame.players = savedGame.players.filter(player => player.user !== kickedUserId);
    savedGame.winner.id = '';

    await Games.set(interaction.guildId, savedGame);
    await KickedPlayers.set(interaction.guildId, kickedPlayers);
    await AllPlayers.set(interaction.guildId, allPlayers);

    interaction
      .reply({ content: 'تم طرد اللاعب من اللعبة.', ephemeral: true })
      .catch(console.error);
    interaction.channel
      .send(
        `💣 | <@${kickedUserId}> تم طرده من اللعبة، ستبدأ الجولة التالية قريبًا...`,
      )
      .catch(console.error);
    await startGame(interaction).catch(console.error);
  } catch (error) {
    console.error('Error handling kick player:', error);
    interaction.reply({ content: 'حدث خطأ أثناء طرد اللاعب.', ephemeral: true }).catch(console.error);
  }
}


async function handleAutoKick(interaction) {
  try {
    const savedGame = await Games.get(interaction.guildId);

    if (!savedGame) {
      interaction
        .reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true })
        .catch(console.error);
      return;
    }

    if (interaction.user.id !== savedGame?.winner.id) {
      interaction
        .reply({
          content: 'ليس دورك في اللعبة، لذا لا يمكنك تنفيذ هذا الإجراء.',
          ephemeral: true,
        })
        .catch(console.error);
      return;
    }
    if (Date.now() > savedGame.winner.until) {
      interaction.reply({ content: 'لقد فاتك دورك.', ephemeral: true }).catch(console.error);
      return;
    }

    const randomPlayer = savedGame.players.find(
      player => player.user !== interaction.user.id && !player.shield,
    );
    if (!randomPlayer) {
      interaction
        .reply({ content: 'لا يوجد لاعبون لطردهم.', ephemeral: true })
        .catch(console.error);
      return;
    }

    const kickedPlayers = await KickedPlayers.get(interaction.guildId);
    const allPlayers = AllPlayers.get(interaction.guildId);

    kickedPlayers.players.push(randomPlayer);
    randomPlayer.deaths += 1;
    const kicker = savedGame.players.find(player => player.user === interaction.user.id);
    kicker.kills += 1;
    allPlayers.get(randomPlayer.user).deaths = randomPlayer.deaths;
    allPlayers.get(kicker.user).kills = kicker.kills;

    savedGame.players = savedGame.players.filter(player => player.user !== randomPlayer.user);
    savedGame.winner.id = '';

    await Games.set(interaction.guildId, savedGame);
    await KickedPlayers.set(interaction.guildId, kickedPlayers);
    await AllPlayers.set(interaction.guildId, allPlayers);

    interaction
      .reply({ content: 'تم طرد اللاعب تلقائيًا من اللعبة.', ephemeral: true })
      .catch(console.error);
    interaction.channel
      .send(
        `💣 | <@${randomPlayer.user}> تم طرده من اللعبة تلقائيًا، ستبدأ الجولة التالية قريبًا...`,
      )
      .catch(console.error);

    await startGame(interaction).catch(console.error);
  } catch (error) {
    console.error('Error handling auto kick:', error);
    interaction.reply({ content: 'حدث خطأ أثناء الطرد التلقائي.', ephemeral: true }).catch(console.error);
  }
}


async function handleWithdrawal(interaction) {
  try {
    const savedGame = await Games.get(interaction.guildId);

    if (!savedGame) {
      interaction
        .reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true })
        .catch(console.error);
      return;
    }

    if (interaction.user.id !== savedGame?.winner.id) {
      interaction
        .reply({
          content: 'ليس دورك في اللعبة، لذا لا يمكنك تنفيذ هذا الإجراء.',
          ephemeral: true,
        })
        .catch(console.error);
      return;
    }
    if (Date.now() > savedGame.winner.until) {
      interaction.reply({ content: 'لقد فاتك دورك.', ephemeral: true }).catch(console.error);
      return;
    }

    savedGame.players = savedGame.players.filter(player => player.user !== interaction.user.id);
    savedGame.winner.id = '';

    await Games.set(interaction.guildId, savedGame);

    interaction
      .reply({ content: 'لقد انسحبت بنجاح من اللعبة.', ephemeral: true })
      .catch(console.error);
    interaction.channel
      .send(
        `💣 | <@${interaction.user.id}> انسحب من اللعبة، ستبدأ الجولة التالية قريبًا...`,
      )
      .catch(console.error);

    await startGame(interaction).catch(console.error);
  } catch (error) {
    console.error('Error handling withdrawal:', error);
    interaction.reply({ content: 'حدث خطأ أثناء الانسحاب من اللعبة.', ephemeral: true }).catch(console.error);
  }
}


async function handleReviveAction(interaction) {
  try {
    const savedGame = await Games.get(interaction.guildId);
    const kickedPlayers = await KickedPlayers.get(interaction.guildId);

    if (!savedGame) {
      interaction.reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true }).catch(console.error);
      return;
    }

    if (interaction.user.id !== savedGame?.winner.id) {
      interaction.reply({
        content: 'ليس دورك في اللعبة، لذا لا يمكنك تنفيذ هذا الإجراء.',
        ephemeral: true,
      }).catch(console.error);
      return;
    }

    if (!kickedPlayers || !kickedPlayers.players.length) {
      interaction.reply({ content: 'لا يوجد لاعبون لإعادتهم.', ephemeral: true }).catch(console.error);
      return;
    }

    const currentPlayer = savedGame.players.find(player => player.user === interaction.user.id);

    if (currentPlayer.reviveUsed) {
      interaction.reply({
        content: 'يمكنك استخدام انعاش اللاعب مرة واحدة فقط في اللعبة.',
        ephemeral: true,
      }).catch(console.error);
      return;
    }

    const maxButtons = 21;
    const reviveButtons = kickedPlayers.players.slice(0, maxButtons).map(player =>
      new ButtonBuilder()
        .setCustomId(`select_player_revive_${player.user}`)
        .setLabel(`${player.buttonNumber} - ${player.username}`)
        .setStyle(ButtonStyle.Secondary)
    );

    const components = createButtonRows(reviveButtons);

    const message = await interaction.reply({
      content: 'اختر لاعبًا لإعادته:',
      components: components,
      ephemeral: true,
      fetchReply: true,
    });

    savedGame.actionData = {
      action: 'revive',
    };
    await Games.set(interaction.guildId, savedGame);

  } catch (error) {
    console.error('Error handling revive action:', error);
    interaction.reply({ content: 'حدث خطأ أثناء تنفيذ إجراء الإحياء.', ephemeral: true }).catch(console.error);
  }
}


async function handleSelectPlayer(interaction) {
  try {
    const [action, userId] = interaction.customId.split('_').slice(2);
    const savedGame = await Games.get(interaction.guildId);

    if (!savedGame) {
      interaction.reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true }).catch(console.error);
      return;
    }

    if (interaction.user.id !== savedGame.winner.id) {
      interaction.reply({ content: 'ليس دورك في اللعبة، لذا لا يمكنك تنفيذ هذا الإجراء.', ephemeral: true }).catch(console.error);
      return;
    }

    switch (action) {
      case 'revive':
        await revivePlayer(interaction, userId);
        break;
      case 'shield':
        await shieldPlayer(interaction, userId);
        break;
      case 'switch':
        await switchPlayer(interaction, userId);
        break;
      case 'freeze':
        await freezePlayer(interaction, userId);
        break;
      default:
        interaction.reply({ content: 'إجراء غير معروف.', ephemeral: true }).catch(console.error);
    }
  } catch (error) {
    console.error('Error handling select player:', error);
    interaction.reply({ content: 'حدث خطأ أثناء تنفيذ الإجراء.', ephemeral: true }).catch(console.error);
  }
}


async function revivePlayer(interaction, userId) {
  try {
    const savedGame = await Games.get(interaction.guildId);
    const kickedPlayers = await KickedPlayers.get(interaction.guildId);
    const allPlayers = AllPlayers.get(interaction.guildId);

    const currentPlayer = savedGame.players.find(player => player.user === interaction.user.id);

    if (currentPlayer.reviveUsed) {
      interaction.reply({
        content: 'يمكنك استخدام انعاش اللاعب مرة واحدة فقط في اللعبة.',
        ephemeral: true,
      }).catch(console.error);
      return;
    }

    const playerToRevive = kickedPlayers.players.find(player => player.user === userId);

    if (!playerToRevive) {
      interaction.reply({ content: 'هذا اللاعب غير موجود في قائمة المطرودين.', ephemeral: true }).catch(console.error);
      return;
    }

    kickedPlayers.players = kickedPlayers.players.filter(player => player.user !== userId);
    savedGame.players.push(playerToRevive);
    savedGame.winner.id = '';
    currentPlayer.reviveUsed = true;

    allPlayers.get(playerToRevive.user).reviveUsed = true;

    await Games.set(interaction.guildId, savedGame);
    await KickedPlayers.set(interaction.guildId, kickedPlayers);
    await AllPlayers.set(interaction.guildId, allPlayers);

    interaction
      .reply({
        content: `تم إحياء اللاعب ${playerToRevive.username} بنجاح وإعادته إلى اللعبة.`,
        ephemeral: true,
      })
      .catch(console.error);
    interaction.channel
      .send(
        `💖 | <@${playerToRevive.user}> تم إحياؤه وإعادته إلى اللعبة، ستبدأ الجولة التالية قريبًا...`,
      )
      .catch(console.error);

    await startGame(interaction).catch(console.error);
  } catch (error) {
    console.error('Error reviving player:', error);
    interaction.reply({ content: 'حدث خطأ أثناء إحياء اللاعب.', ephemeral: true }).catch(console.error);
  }
}


async function handleProtectYourself(interaction) {
  try {
    const savedGame = await Games.get(interaction.guildId);

    if (!savedGame) {
      interaction
        .reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true })
        .catch(console.error);
      return;
    }

    if (interaction.user.id !== savedGame?.winner.id) {
      interaction
        .reply({
          content: 'ليس دورك في اللعبة، لذا لا يمكنك تنفيذ هذا الإجراء.',
          ephemeral: true,
        })
        .catch(console.error);
      return;
    }

    const currentPlayer = savedGame.players.find(player => player.user === interaction.user.id);

    if (currentPlayer.shieldUsed) {
      interaction
        .reply({ content: 'يمكنك استخدام حماية نفسك مرة واحدة فقط في اللعبة.', ephemeral: true })
        .catch(console.error);
      return;
    }

    const maxButtons = 21;
    const shieldButtons = savedGame.players.slice(0, maxButtons).map(player =>
      new ButtonBuilder()
        .setCustomId(`select_player_shield_${player.user}`)
        .setLabel(`${player.buttonNumber} - ${player.username}`)
        .setStyle(ButtonStyle.Secondary)
    );

    const components = createButtonRows(shieldButtons);

    const message = await interaction.reply({
      content: 'اختر لاعبًا لتمنحه الحماية:',
      components: components,
      ephemeral: true,
      fetchReply: true,
    });

    savedGame.actionData = {
      action: 'shield',
    };
    await Games.set(interaction.guildId, savedGame);
  } catch (error) {
    console.error('Error handling protect action:', error);
    interaction.reply({ content: 'حدث خطأ أثناء تنفيذ إجراء الحماية.', ephemeral: true }).catch(console.error);
  }
}


async function shieldPlayer(interaction, userId) {
  try {
    const savedGame = await Games.get(interaction.guildId);
    const allPlayers = AllPlayers.get(interaction.guildId);

    const currentPlayer = savedGame.players.find(player => player.user === interaction.user.id);

    if (currentPlayer.shieldUsed) {
      interaction
        .reply({ content: 'يمكنك استخدام حماية نفسك مرة واحدة فقط في اللعبة.', ephemeral: true })
        .catch(console.error);
      return;
    }

    const playerToShield = savedGame.players.find(player => player.user === userId);

    if (!playerToShield) {
      interaction
        .reply({ content: 'لا يوجد لاعب بهذا الاسم في اللعبة.', ephemeral: true })
        .catch(console.error);
      return;
    }

    playerToShield.shield = true;
    currentPlayer.shieldUsed = true;

    allPlayers.get(playerToShield.user).shieldUsed = true;

    await Games.set(interaction.guildId, savedGame);
    await AllPlayers.set(interaction.guildId, allPlayers);

    interaction
      .reply({
        content: `تم منح الحماية بنجاح للاعب ${playerToShield.username}.`,
        ephemeral: true,
      })
      .catch(console.error);
    interaction.channel
      .send(`🛡️ | <@${playerToShield.user}> تم منحه الحماية للدور القادم.`)
      .catch(console.error);

    savedGame.winner.id = '';
    await Games.set(interaction.guildId, savedGame);
    await startGame(interaction).catch(console.error);
  } catch (error) {
    console.error('Error shielding player:', error);
    interaction.reply({ content: 'حدث خطأ أثناء منح الحماية.', ephemeral: true }).catch(console.error);
  }
}


async function handleSwitchTurn(interaction) {
  try {
    const savedGame = await Games.get(interaction.guildId);

    if (!savedGame) {
      interaction
        .reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true })
        .catch(console.error);
      return;
    }

    if (interaction.user.id !== savedGame?.winner.id) {
      interaction
        .reply({
          content: 'ليس دورك في اللعبة، لذا لا يمكنك تنفيذ هذا الإجراء.',
          ephemeral: true,
        })
        .catch(console.error);
      return;
    }

    const currentPlayer = savedGame.players.find(player => player.user === interaction.user.id);

    if (currentPlayer.switchUsed) {
      interaction
        .reply({
          content: 'يمكنك تبديل دورك مرة واحدة فقط في اللعبة.',
          ephemeral: true,
        })
        .catch(console.error);
      return;
    }

    const maxButtons = 21;
    const switchButtons = savedGame.players
      .filter(player => player.user !== interaction.user.id)
      .slice(0, maxButtons)
      .map(player =>
        new ButtonBuilder()
          .setCustomId(`select_player_switch_${player.user}`)
          .setLabel(`${player.buttonNumber} - ${player.username}`)
          .setStyle(ButtonStyle.Secondary)
      );

    const components = createButtonRows(switchButtons);

    const message = await interaction.reply({
      content: 'اختر لاعبًا لتبديل دورك معه:',
      components: components,
      ephemeral: true,
      fetchReply: true,
    });

    savedGame.actionData = {
      action: 'switch',
    };
    await Games.set(interaction.guildId, savedGame);
  } catch (error) {
    console.error('Error handling switch turn action:', error);
    interaction.reply({ content: 'حدث خطأ أثناء تنفيذ إجراء تبديل الدور.', ephemeral: true }).catch(console.error);
  }
}


async function switchPlayer(interaction, userId) {
  try {
    const savedGame = await Games.get(interaction.guildId);
    const allPlayers = AllPlayers.get(interaction.guildId);

    const currentPlayer = savedGame.players.find(player => player.user === interaction.user.id);

    if (currentPlayer.switchUsed) {
      interaction
        .reply({
          content: 'يمكنك تبديل دورك مرة واحدة فقط في اللعبة.',
          ephemeral: true,
        })
        .catch(console.error);
      return;
    }

    const playerToSwitch = savedGame.players.find(player => player.user === userId);

    if (!playerToSwitch) {
      interaction
        .reply({ content: 'لا يوجد لاعب بهذا الاسم في اللعبة.', ephemeral: true })
        .catch(console.error);
      return;
    }

    savedGame.winner.id = playerToSwitch.user;
    savedGame.winner.until = Date.now() + chooseTimeout * 1000;

    currentPlayer.switchUsed = true;
    allPlayers.get(interaction.user.id).switchUsed = true;

    await AllPlayers.set(interaction.guildId, allPlayers);
    await Games.set(interaction.guildId, savedGame);

    interaction
      .reply({
        content: `تم تبديل دورك مع اللاعب ${playerToSwitch.username}.`,
        ephemeral: true,
      })
      .catch(console.error);
    interaction.channel
      .send(
        `🔄 | <@${interaction.user.id}> قام بتبديل دوره مع <@${playerToSwitch.user}>. لديك ${chooseTimeout} ثانية للاختيار!`,
      )
      .catch(console.error);

    setTimeout(async () => {
      try {
        const checkUser = await Games.get(interaction.guildId);
        if (
          checkUser &&
          checkUser.winner.id === playerToSwitch.user &&
          Date.now() >= checkUser.winner.until
        ) {
          checkUser.players = checkUser.players.filter(player => player.user !== playerToSwitch.user);
          checkUser.winner.id = '';

          await Games.set(interaction.guildId, checkUser);

          interaction.channel
            .send(
              `⏰ | <@${playerToSwitch.user}> تم طرده من اللعبة بسبب انتهاء الوقت. ستبدأ الجولة التالية قريبًا...`,
            )
            .catch(console.error);

          await startGame(interaction).catch(console.error);
        }
      } catch (error) {
        console.error('Error during switch turn timeout:', error);
      }
    }, chooseTimeout * 1000);
  } catch (error) {
    console.error('Error switching player turn:', error);
    interaction.reply({ content: 'حدث خطأ أثناء تبديل الدور.', ephemeral: true }).catch(console.error);
  }
}


async function handleFreezeAction(interaction) {
  try {
    const savedGame = await Games.get(interaction.guildId);

    if (!savedGame) {
      interaction.reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true }).catch(console.error);
      return;
    }

    if (interaction.user.id !== savedGame?.winner.id) {
      interaction.reply({
        content: 'ليس دورك في اللعبة، لذا لا يمكنك تنفيذ هذا الإجراء.',
        ephemeral: true,
      }).catch(console.error);
      return;
    }

    const currentPlayer = savedGame.players.find(player => player.user === interaction.user.id);

    if (currentPlayer.freezeUsed) {
      interaction.reply({
        content: 'يمكنك استخدام تجميد لاعب مرة واحدة فقط في اللعبة.',
        ephemeral: true,
      }).catch(console.error);
      return;
    }

    const maxButtons = 21;
    const freezeButtons = savedGame.players
      .filter(player => player.user !== interaction.user.id)
      .slice(0, maxButtons)
      .map(player =>
        new ButtonBuilder()
          .setCustomId(`select_player_freeze_${player.user}`)
          .setLabel(`${player.buttonNumber} - ${player.username}`)
          .setStyle(ButtonStyle.Secondary)
      );

    const components = createButtonRows(freezeButtons);

    const message = await interaction.reply({
      content: 'اختر لاعبًا لتجميده:',
      components: components,
      ephemeral: true,
      fetchReply: true,
    });

    savedGame.actionData = {
      action: 'freeze',
    };
    await Games.set(interaction.guildId, savedGame);
  } catch (error) {
    console.error('Error handling freeze action:', error);
    interaction.reply({ content: 'حدث خطأ أثناء تنفيذ إجراء التجميد.', ephemeral: true }).catch(console.error);
  }
}


async function freezePlayer(interaction, userId) {
  try {
    const savedGame = await Games.get(interaction.guildId);
    const allPlayers = AllPlayers.get(interaction.guildId);

    const currentPlayer = savedGame.players.find(player => player.user === interaction.user.id);

    if (currentPlayer.freezeUsed) {
      interaction.reply({
        content: 'يمكنك استخدام تجميد لاعب مرة واحدة فقط في اللعبة.',
        ephemeral: true,
      }).catch(console.error);
      return;
    }

    const playerToFreeze = savedGame.players.find(player => player.user === userId);

    if (!playerToFreeze) {
      interaction.reply({ content: 'لا يوجد لاعب بهذا الاسم في اللعبة.', ephemeral: true }).catch(console.error);
      return;
    }

    playerToFreeze.frozen = true;
    currentPlayer.freezeUsed = true;
    allPlayers.get(playerToFreeze.user).frozen = true;
    allPlayers.get(interaction.user.id).freezeUsed = true;

    await Games.set(interaction.guildId, savedGame);
    await AllPlayers.set(interaction.guildId, allPlayers);

    interaction.reply({
      content: `تم تجميد قدرات اللاعب ${playerToFreeze.username} لدوره القادم.`,
      ephemeral: true,
    }).catch(console.error);

    interaction.channel.send(`❄️ | <@${playerToFreeze.user}> تم تجميد قدراته للدور القادم.`).catch(console.error);

    savedGame.winner.id = '';
    await Games.set(interaction.guildId, savedGame);
    await startGame(interaction).catch(console.error);
  } catch (error) {
    console.error('Error freezing player:', error);
    interaction.reply({ content: 'حدث خطأ أثناء تجميد اللاعب.', ephemeral: true }).catch(console.error);
  }
}


async function handlePagination(interaction) {
}


async function startGame(source, start = false) {
  try {
    const guildId = source.guildId || source.guild.id;
    const savedData = await Games.get(guildId);

    if (!savedData) {
      return;
    }

    const { players } = savedData;
    if (players.length === 0) {
      await sleep(5);
      source.channel
        .send({ content: ':x: تم إلغاء اللعبة: لا يوجد لاعبون.' })
        .catch(console.error);
      await cleanUpGame(guildId);
      return;
    }
    if (start) {
      await source.channel
        .send({
          content: '✅ | تم توزيع الأرقام على كل لاعب. ستبدأ الجولة الأولى في غضون ثوانٍ قليلة...',
        })
        .catch(console.error);
    }
    await sleep(timeBetweenRounds);
    const colorsGradient = ['#32517f', '#4876a3', '#5d8ec7', '#74a6eb', '#8ac0ff'];

    const options = players.map((user, index) => ({
      user: user,
      label: user.username,
      color: colorsGradient[index % colorsGradient.length],
    }));

    const winnerOption = options[Math.floor(Math.random() * options.length)];
    const winnerIndex = options.indexOf(winnerOption);
    options[winnerIndex] = {
      ...winnerOption,
      winner: true,
    };

    const time = Date.now() + chooseTimeout * 1000;
    savedData.winner = { id: winnerOption.user.user, until: time };
    await Games.set(guildId, savedData);
    const image = await createWheel(options, winnerOption.user.avatar);

    const kickablePlayers = players.filter(user => user.user !== winnerOption.user.user);

    const kickButtons = kickablePlayers.map(player =>
      new ButtonBuilder()
        .setCustomId(`kick_${player.user}`)
        .setLabel(`${player.buttonNumber} - ${player.username}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(player.shield)
    );

    const kickButtonPages = paginateButtons(kickButtons, 'kick');

    const currentPlayer = players.find(player => player.user === winnerOption.user.user);

    const actionButtons = [
      new ButtonBuilder()
        .setCustomId('auto_kick')
        .setLabel('طرد تلقائي')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPlayer.frozen),
      new ButtonBuilder()
        .setCustomId('revive_player')
        .setLabel('انعاش اللاعب')
        .setStyle(ButtonStyle.Success)
        .setDisabled(currentPlayer.frozen || currentPlayer.reviveUsed),
      new ButtonBuilder()
        .setCustomId('protect_player')
        .setLabel('حماية لاعب')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPlayer.frozen || currentPlayer.shieldUsed),
      new ButtonBuilder()
        .setCustomId('switch_turn')
        .setLabel('تبادل دور')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPlayer.frozen || currentPlayer.switchUsed),
      new ButtonBuilder()
        .setCustomId('freeze_player')
        .setLabel('تجميد لاعب')
        .setStyle(ButtonStyle.Success)
        .setDisabled(currentPlayer.frozen || currentPlayer.freezeUsed),
      new ButtonBuilder()
        .setCustomId('withdrawal')
        .setLabel('انسحاب')
        .setStyle(ButtonStyle.Danger),
    ];

    const attachment = new AttachmentBuilder(image, { name: 'wheel.png' });

    if (players.length <= 2) {
      await source.channel
        .send({
          content: `**${winnerOption.user.buttonNumber} - <@${winnerOption.user.user}> **\n:crown: هذه هي الجولة الأخيرة! اللاعب المختار هو الفائز في اللعبة.`,
          files: [attachment],
        })
        .catch(console.error);

      await cleanUpGame(guildId);
      return;
    } else {
      const message = await source.channel
        .send({
          content: `**${winnerOption.user.buttonNumber} - <@${winnerOption.user.user}> **\n⏰ | لديك ${chooseTimeout} ثانية لاختيار لاعب للطرد`,
          files: [attachment],
          components: kickButtonPages[0],
        })
        .catch(console.error);

      savedData.pagination = {
        messageId: message.id,
        page: 0,
        totalPages: kickButtonPages.length,
        buttonsType: 'kick',
        buttons: kickButtons,
      };
      savedData.actionButtons = actionButtons;
      await Games.set(guildId, savedData);

      const actionRows = createActionRowFromButtons(actionButtons);

      const actionMessage = await source.channel.send({
        content: `**خيارات إضافية لـ <@${winnerOption.user.user}> **`,
        components: actionRows,
      });

      savedData.actionMessageId = actionMessage.id;
      await Games.set(guildId, savedData);

      setTimeout(async () => {
        try {
          const checkUser = await Games.get(guildId);
          if (
            checkUser &&
            checkUser.winner.id === winnerOption.user.user &&
            Date.now() >= checkUser.winner.until
          ) {
            checkUser.players = checkUser.players.filter(
              player => player.user !== winnerOption.user.user,
            );
            checkUser.winner.id = '';

            await Games.set(guildId, checkUser);

            source.channel
              .send(
                `⏰ | <@${winnerOption.user.user}> تم طرده من اللعبة بسبب انتهاء الوقت. ستبدأ الجولة التالية قريبًا...`,
              )
              .catch(console.error);

            await startGame(source).catch(console.error);
          }
        } catch (error) {
          console.error('Error during timeout handling:', error);
        }
      }, chooseTimeout * 1000);
    }

    if (currentPlayer.frozen) {
      currentPlayer.frozen = false;
      await Games.set(guildId, savedData);
    }

    savedData.players.forEach(player => {
      if (player.shield) {
        player.shield = false;
      }
    });
    await Games.set(guildId, savedData);
  } catch (error) {
    console.error('Error during game execution:', error);
    source.channel
      .send({ content: 'حدث خطأ أثناء تشغيل اللعبة. يرجى المحاولة مرة أخرى.' })
      .catch(console.error);
  }
}


function paginateButtons(buttons, buttonsType) {
  const maxButtonsPerRow = 5;
  const maxActionRows = 4;
  const buttonsPerPage = maxButtonsPerRow * maxActionRows;

  const totalPages = Math.ceil(buttons.length / buttonsPerPage);
  const pages = [];

  for (let i = 0; i < totalPages; i++) {
    const pageButtons = buttons.slice(i * buttonsPerPage, (i + 1) * buttonsPerPage);
    const components = [];

    let actionRow = new ActionRowBuilder();
    pageButtons.forEach((button, index) => {
      if (index % maxButtonsPerRow === 0 && index !== 0) {
        components.push(actionRow);
        actionRow = new ActionRowBuilder();
      }
      actionRow.addComponents(button);
    });
    if (actionRow.components.length > 0) {
      components.push(actionRow);
    }

    if (totalPages > 1) {
      const navigationRow = new ActionRowBuilder();
      const previousButton = new ButtonBuilder()
        .setCustomId(`paginate_${buttonsType}_previous`)
        .setLabel('السابق')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(i === 0);

      const nextButton = new ButtonBuilder()
        .setCustomId(`paginate_${buttonsType}_next`)
        .setLabel('التالي')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(i === totalPages - 1);

      navigationRow.addComponents(previousButton, nextButton);
      components.push(navigationRow);
    }

    pages.push(components);
  }

  return pages;
}


function createActionRowFromButtons(buttons) {
  const components = [];
  const maxButtonsPerRow = 5;

  let actionRow = new ActionRowBuilder();
  for (let i = 0; i < buttons.length; i++) {
    if (actionRow.components.length >= maxButtonsPerRow) {
      components.push(actionRow);
      actionRow = new ActionRowBuilder();
    }
    actionRow.addComponents(buttons[i]);
  }
  if (actionRow.components.length > 0) {
    components.push(actionRow);
  }

  return components;
}


async function cleanUpGame(guildId) {
  try {
    await Games.delete(guildId);
    await KickedPlayers.delete(guildId);
    await AllPlayers.delete(guildId);
  } catch (error) {
    console.error('Error cleaning up game:', error);
  }
}

client.login(token);
