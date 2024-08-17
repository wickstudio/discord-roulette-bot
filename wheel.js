const { join } = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

registerFont(join(__dirname, "assets", "Poppins", "Poppins-Bold.ttf"), {
  family: "PoppinsBold",
});

registerFont(join(__dirname, "assets", "Poppins", "Poppins-Regular.ttf"), {
  family: "PoppinsReg",
});

const loadImageWithFallback = async (url) => {
  try {
    return await loadImage(url);
  } catch (error) {
    console.error(`Failed to load image from ${url}, using fallback image.`);
    return await loadImage(join(__dirname, 'assets', 'fallback.png'));
  }
};

module.exports.createSpinWheel = async (data, returnCanvas) => {
  const canvas = createCanvas(1080, 1080);
  const ctx = canvas.getContext("2d");

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = 450;

  const colors = [
    ["#ff0000", "#ff8080"], // Red to Light Red
    ["#0003ff", "#8080ff"], // Dark Blue to Light Blue
    ["#cd00ff", "#e580ff"], // Purple to Light Purple
    ["#ff5500", "#ffb380"], // Orange to Light Orange
    ["#08ff00", "#80ff80"], // Green to Light Green
    ["#ff3900", "#ff9973"], // Dark Orange to Light Orange
    ["#0400ff", "#8080ff"], // Blue to Light Blue
    ["#670013", "#ff8fb1"], // Red-Orange to Light Pink
    ["#ff00bf", "#ff80df"], // Pink to Light Pink
    ["#00bfff", "#80e5ff"], // Light Blue to Very Light Blue
  ];

  const drawSegment = (startAngle, endAngle, gradientColors) => {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, gradientColors[0]);
    gradient.addColorStop(1, gradientColors[1]);

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle, false);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = "white";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle, false);
    ctx.stroke();
  };

  const drawText = (label, startAngle, endAngle, color) => {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((startAngle + endAngle) / 2);
    const [r, g, b] = color[0]
      .substring(1)
      .match(/.{2}/g)
      ?.map((x) => parseInt(x, 16));
    ctx.fillStyle = (r * 0.299 + g * 0.587 + b * 0.114 > 130) ? "black" : "white";
    ctx.font = "48px PoppinsReg";
    let textWidth = ctx.measureText(label).width;
    while (textWidth > radius * 0.65) {
      ctx.font = `${parseInt(ctx.font) - 1}px PoppinsReg`;
      textWidth = ctx.measureText(label).width;
    }
    ctx.fillText(label, radius / 3, 10);
    ctx.restore();
  };

  const angle = (2 * Math.PI) / data.length;

  const winnerItem = data.find((i) => i.winner);
  const beforeArray = data.slice(0, data.indexOf(winnerItem));
  const afterArray = data.slice(data.indexOf(winnerItem) + 1);
  data = [winnerItem, ...afterArray, ...beforeArray];

  let startAngle = -angle / 2;
  let endAngle = startAngle + angle;
  for (let i = 0; i < data.length; i++) {
    const color = colors[i % colors.length];
    const { label } = data[i];
    drawSegment(startAngle, endAngle, color);
    drawText(label, startAngle, endAngle, color);
    startAngle = endAngle;
    endAngle = startAngle + angle;
  }

  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.arc(centerX, centerY, 90, 0, 2 * Math.PI, false);
  ctx.fillStyle = "black";
  ctx.fill();

  if (returnCanvas) return canvas;

  return canvas.toBuffer("image/png");
};

module.exports.createWheel = async (data, userAvatar) => {
  let winnerIndex = data.findIndex((i) => i.winner);
  const winner = data[winnerIndex];
  const itemsBeforeWinner = data.slice(0, winnerIndex);
  const itemsAfterWinner = data.slice(winnerIndex + 1);

  const items = [winner, ...itemsAfterWinner, ...itemsBeforeWinner];

  const spinwheel = await module.exports.createSpinWheel(items, true);

  const canvas = createCanvas(1080, 1080);
  const ctx = canvas.getContext("2d");

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = 450;

  const pointer = await loadImage(
    join(__dirname, "assets", "pointer.png")
  );

  const drawWheel = async (angleInDegree, i) => {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((angleInDegree * Math.PI) / 180);
    ctx.drawImage(spinwheel, -centerX, -centerY, 1080, 1080);
    ctx.restore();

    ctx.save();
    ctx.translate(centerX + radius, centerY);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(pointer, -50, -50, 100, 100);
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, 90, 0, 2 * Math.PI, false);
    ctx.fillStyle = "black";
    ctx.fill();
    ctx.clip();

    const playbutton = await loadImageWithFallback(userAvatar);
    ctx.drawImage(playbutton, centerX - 90, centerY - 90, 180, 180);
    ctx.lineWidth = 0;
    ctx.strokeStyle = "black";
    ctx.beginPath();
    ctx.arc(centerX, centerY, 90, 0, 2 * Math.PI, false);
    ctx.stroke();
  };

  const segment_size = 360 / data.length;
  const min = segment_size / 2 - ((segment_size / 2) * 2);
  const max = segment_size / 2;
  let randomNum = Math.random() * (max - min) + min;
  await drawWheel(randomNum);

  return canvas.toBuffer('image/png');
};
