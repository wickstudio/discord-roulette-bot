const { ActionRowBuilder } = require('discord.js');

const commands = [
  {
    name: 'roulette',
    description: 'بدء لعبة الروليت',
    options: [],
  },
];

function createButtonRows(buttons) {
  const rows = [];
  let index = 0;

  while (index < buttons.length) {
    const row = new ActionRowBuilder();
    for (let i = 0; i < 5 && index < buttons.length; i++) {
      row.addComponents(buttons[index]);
      index++;
    }
    rows.push(row);
  }

  return rows;
}

function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

module.exports = { commands, createButtonRows, sleep };
