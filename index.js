require('dotenv').config();
const {
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  REST,
  Routes,
  EmbedBuilder,
} = require('discord.js');
const { createButtonRows, editButton, commands, emojis, sleep } = require('./utils.js');
const {
  startTime,
  chooseTimeout,
  timeBetweenRounds,
  token,
  allowedRoleId,
} = require('./config.json');
const { createWheel } = require('./wheel.js');
const Discord = require('discord.js');
const client = new Discord.Client({
  intents: [Discord.IntentsBitField.Flags.Guilds],
});

const Games = new Map();
const KickedPlayers = new Map();
const ProtectYourselfCount = new Map();
const PlayerShieldUsage = new Map();
const PlayerReviveUsage = new Map();
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

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isCommand()) {
      if (interaction.commandName == 'roulette') {
        if (!interaction.member.roles.cache.has(allowedRoleId)) {
          interaction
            .reply({ content: 'ليس لديك الإذن لاستخدام هذا الأمر.', ephemeral: true })
            .catch(console.error);
          return;
        }

        if (await Games.get(interaction.guildId)) {
          interaction
            .reply({ content: 'هناك لعبة قيد التقدم بالفعل في هذا السيرفر.', ephemeral: true })
            .catch(console.error);
          return;
        }

        const buttons = Array.from(Array(20).keys()).map(i =>
          new ButtonBuilder()
            .setCustomId(`join_${i + 1}_roulette`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emojis[i]),
        );

        const randomButton = new ButtonBuilder()
          .setCustomId(`join_random_roulette`)
          .setLabel('انضم عشوائيًا')
          .setStyle(ButtonStyle.Success);

        const leaveButton = new ButtonBuilder()
          .setCustomId(`leave_roulette`)
          .setLabel('غادر اللعبة')
          .setStyle(ButtonStyle.Danger);

        const rows = createButtonRows([...buttons, randomButton, leaveButton]);

        const attachment = new AttachmentBuilder('./roulette.png');

        await interaction
          .reply({
            content: 'بدء لعبة الروليت',
            components: rows,
            files: [attachment],
          })
          .catch(console.error);

        Games.set(interaction.guildId, { players: [], protectedPlayers: [], shieldedPlayers: [] });
        KickedPlayers.set(interaction.guildId, { players: [] });
        ProtectYourselfCount.set(interaction.guildId, 0);
        PlayerShieldUsage.set(interaction.guildId, {});
        PlayerReviveUsage.set(interaction.guildId, {});
        AllPlayers.set(interaction.guildId, new Map());
        const repliedMessage = await interaction.fetchReply().catch(console.error);
        setTimeout(async () => {
          repliedMessage.edit({ components: [] }).catch(console.error);
          startGame(interaction, true).catch(console.error);
        }, startTime * 1000);
      }
    } else if (interaction.customId.startsWith('join')) {
      var [, number] = interaction.customId.split('_');

      const savedGame = await Games.get(interaction.guildId);
      const allPlayers = AllPlayers.get(interaction.guildId);

      if (!savedGame) {
        interaction
          .reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true })
          .catch(console.error);
        return;
      }

      if (savedGame.players.some(user => user.user == interaction.user.id)) {
        interaction
          .reply({
            content: 'لقد انضممت بالفعل. يرجى المغادرة قبل الانضمام مرة أخرى.',
            ephemeral: true,
          })
          .catch(console.error);
        return;
      }

      if (number == 'random') {
        do {
          number = Math.floor(Math.random() * 20) + 1;
        } while (savedGame.players.some(player => player.buttonNumber == number));
      }

      if (savedGame.players.some(user => user.buttonNumber === number)) {
        interaction
          .reply({ content: 'الرقم مأخوذ بالفعل، يرجى المحاولة مرة أخرى.', ephemeral: true })
          .catch(console.error);
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);

      const playerData = {
        user: interaction.user.id,
        buttonNumber: number,
        username: member.displayName,
        avatar: interaction.user.displayAvatarURL({ size: 256, extension: 'png' }),
        color: interaction.user.hexAccentColor,
        shield: false,
        shieldUsed: false,
        reviveUsed: false,
        kills: 0,
        deaths: 0,
      };

      savedGame.players.push(playerData);
      allPlayers.set(interaction.user.id, playerData);
      Games.set(interaction.guildId, savedGame);
      AllPlayers.set(interaction.guildId, allPlayers);

      const updatedRow = editButton(interaction.message, savedGame.players);
      interaction.message.edit({ components: updatedRow.components }).catch(console.error);

      interaction.reply({ content: 'انضممت بنجاح!', ephemeral: true }).catch(console.error);
    } else if (interaction.customId.startsWith('leave')) {
      const savedGame = await Games.get(interaction.guildId);

      if (!savedGame) {
        interaction
          .reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true })
          .catch(console.error);
        return;
      }

      if (!savedGame.players.some(user => user.user == interaction.user.id)) {
        interaction.reply({ content: 'لم تنضم إلى اللعبة.', ephemeral: true }).catch(console.error);
        return;
      }

      const user = savedGame.players.find(user => user.user == interaction.user.id);
      savedGame.players = savedGame.players.filter(user => user.user != interaction.user.id);
      await Games.set(interaction.guildId, savedGame);

      const updatedRow = editButton(interaction.message, savedGame.players, true, user);
      interaction.message.edit({ components: updatedRow.components }).catch(console.error);

      interaction.reply({ content: 'لقد غادرت اللعبة.', ephemeral: true }).catch(console.error);
    } else if (interaction.customId.startsWith('withdrawal')) {
      const savedGame = await Games.get(interaction.guildId);

      if (!savedGame) {
        interaction
          .reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true })
          .catch(console.error);
        return;
      }

      if (interaction.user.id != savedGame?.winner.id) {
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

      savedGame.players = savedGame.players.filter(player => player.user != interaction.user.id);
      savedGame.winner.id = '';

      await Games.set(interaction.guildId, savedGame);

      interaction
        .reply({ content: 'لقد انسحبت بنجاح من اللعبة.', ephemeral: true })
        .catch(console.error);
      interaction.channel
        .send(
          `💣 | <@${interaction.user.id}> انسحب من اللعبة، ستبدأ الجولة التالية في غضون ثوانٍ قليلة...`,
        )
        .catch(console.error);

      startGame(interaction).catch(console.error);
    } else if (interaction.customId.startsWith('kick_')) {
      const [, kickedUser] = interaction.customId.split('_');

      const savedGame = await Games.get(interaction.guildId);
      const kickedPlayers = await KickedPlayers.get(interaction.guildId);
      const allPlayers = AllPlayers.get(interaction.guildId);

      if (!savedGame) {
        interaction
          .reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true })
          .catch(console.error);
        return;
      }

      if (interaction.user.id != savedGame?.winner.id) {
        interaction
          .reply({ content: 'ليس دورك في اللعبة، لذا لا يمكنك طرد اللاعبين.', ephemeral: true })
          .catch(console.error);
        return;
      }
      if (Date.now() > savedGame.winner.until) {
        interaction.reply({ content: 'لقد فاتك دورك.', ephemeral: true }).catch(console.error);
        return;
      }

      const playerToKick = savedGame.players.find(player => player.user == kickedUser);

      if (playerToKick.shield) {
        interaction
          .reply({ content: 'لا يمكنك طرد هذا اللاعب لأنه محمي للدور القادم.', ephemeral: true })
          .catch(console.error);
        return;
      }

      kickedPlayers.players.push(playerToKick);
      playerToKick.deaths += 1;
      allPlayers.get(interaction.user.id).kills += 1;

      savedGame.players = savedGame.players.filter(player => player.user != kickedUser);
      savedGame.winner.id = '';

      await Games.set(interaction.guildId, savedGame);
      await KickedPlayers.set(interaction.guildId, kickedPlayers);
      await AllPlayers.set(interaction.guildId, allPlayers);

      interaction
        .reply({ content: 'تم طرد اللاعب من اللعبة.', ephemeral: true })
        .catch(console.error);
      interaction.channel
        .send(
          `💣 | <@${kickedUser}> تم طرده من اللعبة، ستبدأ الجولة التالية في غضون ثوانٍ قليلة...`,
        )
        .catch(console.error);
      startGame(interaction).catch(console.error);
    } else if (interaction.customId.startsWith('auto_kick')) {
      const savedGame = await Games.get(interaction.guildId);

      if (!savedGame) {
        interaction
          .reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true })
          .catch(console.error);
        return;
      }

      if (interaction.user.id != savedGame?.winner.id) {
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
        player => player.user != interaction.user.id && !player.shield,
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
      const kicker = savedGame.players.find(player => player.user == interaction.user.id);
      kicker.kills += 1;
      allPlayers.get(randomPlayer.user).deaths = randomPlayer.deaths;
      allPlayers.get(kicker.user).kills = kicker.kills;

      savedGame.players = savedGame.players.filter(player => player.user != randomPlayer.user);
      savedGame.winner.id = '';

      await Games.set(interaction.guildId, savedGame);
      await KickedPlayers.set(interaction.guildId, kickedPlayers);
      await AllPlayers.set(interaction.guildId, allPlayers);

      interaction
        .reply({ content: 'تم طرد اللاعب تلقائيًا من اللعبة.', ephemeral: true })
        .catch(console.error);
      interaction.channel
        .send(
          `💣 | <@${randomPlayer.user}> تم طرده من اللعبة تلقائيًا، ستبدأ الجولة التالية في غضون ثوانٍ قليلة...`,
        )
        .catch(console.error);

      startGame(interaction).catch(console.error);
    } else if (interaction.customId.startsWith('revive_player')) {
      const savedGame = await Games.get(interaction.guildId);
      const kickedPlayers = await KickedPlayers.get(interaction.guildId);
      const allPlayers = AllPlayers.get(interaction.guildId);

      if (!savedGame) {
        interaction
          .reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true })
          .catch(console.error);
        return;
      }

      if (interaction.user.id != savedGame?.winner.id) {
        interaction
          .reply({
            content: 'ليس دورك في اللعبة، لذا لا يمكنك تنفيذ هذا الإجراء.',
            ephemeral: true,
          })
          .catch(console.error);
        return;
      }

      if (!kickedPlayers || !kickedPlayers.players.length) {
        interaction
          .reply({ content: 'لا يوجد لاعبون لإعادتهم.', ephemeral: true })
          .catch(console.error);
        return;
      }

      const reviveButtons = kickedPlayers.players.map(player =>
        new ButtonBuilder()
          .setCustomId(`select_revive_${player.user}`)
          .setLabel(player.username)
          .setStyle(ButtonStyle.Secondary),
      );

      const rows = createButtonRows(reviveButtons);

      interaction
        .reply({ content: 'اختر لاعبًا لإعادته.', components: rows, ephemeral: true })
        .catch(console.error);
    } else if (interaction.customId.startsWith('select_revive_')) {
      const [, , userId] = interaction.customId.split('_');
      const savedGame = await Games.get(interaction.guildId);
      const kickedPlayers = await KickedPlayers.get(interaction.guildId);
      const playerReviveUsage = (await PlayerReviveUsage.get(interaction.guildId)) || {};
      const allPlayers = AllPlayers.get(interaction.guildId);

      if (!savedGame) {
        interaction
          .reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true })
          .catch(console.error);
        return;
      }

      if (interaction.user.id != savedGame?.winner.id) {
        interaction
          .reply({
            content: 'ليس دورك في اللعبة، لذا لا يمكنك تنفيذ هذا الإجراء.',
            ephemeral: true,
          })
          .catch(console.error);
        return;
      }

      if (playerReviveUsage[interaction.user.id]) {
        interaction
          .reply({
            content: 'يمكنك استخدام انعاش اللاعب مرة واحدة فقط في اللعبة.',
            ephemeral: true,
          })
          .catch(console.error);
        return;
      }

      const playerToRevive = kickedPlayers.players.find(player => player.user == userId);

      if (!playerToRevive) {
        interaction
          .reply({ content: 'لا يوجد لاعب بهذا الاسم في قائمة المطرودين.', ephemeral: true })
          .catch(console.error);
        return;
      }

      kickedPlayers.players = kickedPlayers.players.filter(player => player.user != userId);
      savedGame.players.push(playerToRevive);
      savedGame.winner.id = '';
      playerReviveUsage[interaction.user.id] = true;

      allPlayers.get(playerToRevive.user).reviveUsed = true;

      await Games.set(interaction.guildId, savedGame);
      await KickedPlayers.set(interaction.guildId, kickedPlayers);
      await PlayerReviveUsage.set(interaction.guildId, playerReviveUsage);
      await AllPlayers.set(interaction.guildId, allPlayers);

      interaction
        .reply({
          content: `تم إحياء اللاعب ${playerToRevive.username} بنجاح وإعادته إلى اللعبة.`,
          ephemeral: true,
        })
        .catch(console.error);
      interaction.channel
        .send(
          `💖 | <@${playerToRevive.user}> تم إحياؤه وإعادته إلى اللعبة، ستبدأ الجولة التالية في غضون ثوانٍ قليلة...`,
        )
        .catch(console.error);

      startGame(interaction).catch(console.error);
    } else if (interaction.customId.startsWith('protect_yourself')) {
      const savedGame = await Games.get(interaction.guildId);
      const playerShieldUsage = (await PlayerShieldUsage.get(interaction.guildId)) || {};
      const allPlayers = AllPlayers.get(interaction.guildId);

      if (!savedGame) {
        interaction
          .reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true })
          .catch(console.error);
        return;
      }

      if (interaction.user.id != savedGame?.winner.id) {
        interaction
          .reply({
            content: 'ليس دورك في اللعبة، لذا لا يمكنك تنفيذ هذا الإجراء.',
            ephemeral: true,
          })
          .catch(console.error);
        return;
      }

      if (playerShieldUsage[interaction.user.id]) {
        interaction
          .reply({ content: 'يمكنك استخدام حماية نفسك مرة واحدة فقط في اللعبة.', ephemeral: true })
          .catch(console.error);
        return;
      }

      const shieldButtons = savedGame.players.map(player =>
        new ButtonBuilder()
          .setCustomId(`select_shield_${player.user}`)
          .setLabel(player.username)
          .setStyle(ButtonStyle.Secondary),
      );

      const rows = createButtonRows(shieldButtons);

      interaction
        .reply({ content: 'اختر لاعبًا لتمنحه الحماية.', components: rows, ephemeral: true })
        .catch(console.error);
    } else if (interaction.customId.startsWith('select_shield_')) {
      const [, , userId] = interaction.customId.split('_');
      const savedGame = await Games.get(interaction.guildId);
      const playerShieldUsage = (await PlayerShieldUsage.get(interaction.guildId)) || {};
      const allPlayers = AllPlayers.get(interaction.guildId);

      if (!savedGame) {
        interaction
          .reply({ content: 'لا توجد لعبة قيد التشغيل حاليًا في هذا السيرفر.', ephemeral: true })
          .catch(console.error);
        return;
      }

      if (interaction.user.id != savedGame?.winner.id) {
        interaction
          .reply({
            content: 'ليس دورك في اللعبة، لذا لا يمكنك تنفيذ هذا الإجراء.',
            ephemeral: true,
          })
          .catch(console.error);
        return;
      }

      if (playerShieldUsage[interaction.user.id]) {
        interaction
          .reply({ content: 'يمكنك استخدام حماية نفسك مرة واحدة فقط في اللعبة.', ephemeral: true })
          .catch(console.error);
        return;
      }

      const playerToShield = savedGame.players.find(player => player.user == userId);

      if (!playerToShield) {
        interaction
          .reply({ content: 'لا يوجد لاعب بهذا الاسم في اللعبة.', ephemeral: true })
          .catch(console.error);
        return;
      }

      playerToShield.shield = true;
      playerShieldUsage[interaction.user.id] = true;

      allPlayers.get(playerToShield.user).shieldUsed = true;

      await Games.set(interaction.guildId, savedGame);
      await PlayerShieldUsage.set(interaction.guildId, playerShieldUsage);
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
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    interaction
      .reply({ content: 'حدث خطأ أثناء معالجة التفاعل. يرجى المحاولة مرة أخرى.', ephemeral: true })
      .catch(console.error);
  }
});

const startGame = async (interaction, start = false) => {
  try {
    const { players, protectedPlayers, shieldedPlayers } = (await Games.get(
      interaction.guildId,
    )) || { players: [], protectedPlayers: [], shieldedPlayers: [] };
    if (players.length == 0) {
      await sleep(5);
      interaction.channel
        .send({ content: ':x: تم إلغاء اللعبة: لا يوجد لاعبون.' })
        .catch(console.error);
      await cleanUpGame(interaction.guildId);
      return;
    }
    if (start) {
      await interaction.channel
        .send({
          content: `✅ | تم توزيع الأرقام على كل لاعب. ستبدأ الجولة الأولى في غضون ثوانٍ قليلة...`,
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

    const savedData = await Games.get(interaction.guildId);
    const time = Date.now() + chooseTimeout * 1000;
    savedData.winner = { id: winnerOption.user.user, until: time };
    await Games.set(interaction.guildId, savedData);
    const image = await createWheel(options, winnerOption.user.avatar);

    const buttons = players
      .filter(user => user.username != winnerOption.label)
      .map(user => {
        const button = new ButtonBuilder()
          .setCustomId(`kick_${user.user}`)
          .setStyle(ButtonStyle.Secondary)
          .setLabel(user.username)
          .setEmoji(emojis[Number(user.buttonNumber) - 1]);
        if (user.shield) {
          button.setDisabled(true);
        }
        return button;
      });

    const autoKickButton = new ButtonBuilder()
      .setCustomId(`auto_kick`)
      .setLabel('طرد تلقائي')
      .setStyle(ButtonStyle.Primary);
    const reviveButton = new ButtonBuilder()
      .setCustomId(`revive_player`)
      .setLabel('انعاش اللاعب')
      .setStyle(ButtonStyle.Success);
    const protectYourselfButton = new ButtonBuilder()
      .setCustomId(`protect_yourself`)
      .setLabel('حماية لاعب')
      .setStyle(ButtonStyle.Success);
    const leaveButton = new ButtonBuilder()
      .setCustomId(`withdrawal`)
      .setLabel('انسحاب')
      .setStyle(ButtonStyle.Danger);

    const rows = createButtonRows([
      ...buttons,
      autoKickButton,
      reviveButton,
      protectYourselfButton,
      leaveButton,
    ]);

    const attachment = new AttachmentBuilder(image, { name: 'wheel.png' });

    if (players.length <= 2) {
      await interaction.channel
        .send({
          content: `**${winnerOption.user.buttonNumber} - <@${winnerOption.user.user}> **\n:crown: هذه هي الجولة الأخيرة! اللاعب المختار هو الفائز في اللعبة.`,
          files: [attachment],
        })
        .catch(console.error);

      await sendGameStatisticsEmbed(interaction, savedData).catch(console.error);

      await cleanUpGame(interaction.guildId);
      return;
    } else {
      await interaction.channel
        .send({
          content: `**${winnerOption.user.buttonNumber} - <@${winnerOption.user.user}> **\n⏰ | لديك ${chooseTimeout} ثانية لاختيار لاعب للطرد`,
          files: [attachment],
          components: rows,
        })
        .catch(console.error);

      setTimeout(async () => {
        const checkUser = await Games.get(interaction.guildId);
        if (checkUser?.winner.id == winnerOption.user.user && checkUser.winner.until == time) {
          checkUser.players = checkUser.players.filter(
            player => player.user != winnerOption.user.user,
          );
          checkUser.winner.id = '';

          await Games.set(interaction.guildId, checkUser);

          interaction.channel
            .send(
              `⏰ | <@${winnerOption.user.user}> تم طرده من اللعبة بسبب انتهاء الوقت. ستبدأ الجولة التالية قريبًا...`,
            )
            .catch(console.error);

          startGame(interaction).catch(console.error);
        }
      }, chooseTimeout * 1000);
    }

    savedData.players.forEach(player => {
      if (player.shield) {
        player.shield = false;
      }
    });
    await Games.set(interaction.guildId, savedData);
  } catch (error) {
    console.error('Error during game execution:', error);
    interaction.channel
      .send({ content: 'حدث خطأ أثناء تشغيل اللعبة. يرجى المحاولة مرة أخرى.' })
      .catch(console.error);
  }
};

const cleanUpGame = async guildId => {
  await Games.delete(guildId);
  await KickedPlayers.delete(guildId);
  await ProtectYourselfCount.delete(guildId);
  await PlayerShieldUsage.delete(guildId);
  await PlayerReviveUsage.delete(guildId);
  await AllPlayers.delete(guildId);
};

const sendGameStatisticsEmbed = async (interaction, gameData) => {
  const allPlayers = AllPlayers.get(interaction.guildId);

  const embed = new EmbedBuilder()
    .setTitle('إحصائيات اللعبة')
    .setColor('#FFD700')
    .setDescription('إليكم الإحصائيات الخاصة بجميع اللاعبين الذين انضموا إلى اللعبة :')
    .setTimestamp()
    .setFooter({ text: 'Roulette Game', iconURL: interaction.guild.iconURL() });

  allPlayers.forEach((player, userId) => {
    embed.addFields({
      name: `Player ${player.buttonNumber}`,
      value: `<@${player.user}>\n**القتل :** ${player.kills}\n**الموت :** ${
        player.deaths
      }\n**تم انعاشه :** ${player.reviveUsed ? '✅' : '❌'}\n**استخدم الدرع :** ${
        player.shieldUsed ? '✅' : '❌'
      }`,
      inline: true,
    });
  });

  await interaction.channel.send({ embeds: [embed] }).catch(console.error);
};

client.login(token);

process.on('unhandledRejection', (reason, p) => {
  console.log(' [antiCrash] :: Unhandled Rejection/Catch');
  console.log(reason, p);
});
process.on('uncaughtException', (err, origin) => {
  console.log(' [antiCrash] :: Uncaught Exception/Catch');
  console.log(err, origin);
});
process.on('uncaughtExceptionMonitor', (err, origin) => {
  console.log(' [antiCrash] :: Uncaught Exception/Catch (MONITOR)');
  console.log(err, origin);
});