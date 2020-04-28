'use strict';

import { GAME_LEVELS } from './gameLevels.js';

let Level = class Level {
  constructor(plan) {
    let rows = plan
      .trim()
      .split('\n')
      .map((line) => [...line]);
    this.height = rows.length;
    this.width = rows[0].length;
    this.startActors = [];
    this.rows = rows.map((row, y) => {
      return row.map((ch, x) => {
        let type = levelChars[ch];
        if (typeof type === 'string') return type;
        this.startActors.push(type.create(new Vec(x, y), ch));
        return 'empty';
      });
    });
  }
};

Level.prototype.touches = function (pos, size, type) {
  let xStart = Math.floor(pos.x);
  let xEnd = Math.ceil(pos.x + size.x);
  let yStart = Math.floor(pos.y);
  let yEnd = Math.ceil(pos.y + size.y);

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      let isOutSide = x < 0 || x >= this.width || y < 0 || y >= this.height;
      let here = isOutSide ? 'wall' : this.rows[y][x];
      if (here === type) return true;
    }
  }

  return false;
};

let State = class State {
  constructor(level, actors, status) {
    this.level = level;
    this.actors = actors;
    this.status = status;
  }

  static start(level) {
    return new State(level, level.startActors, 'playing');
  }

  get player() {
    return this.actors.find((a) => a.type === 'player');
  }
};

State.prototype.update = function (time, keys, touch) {
  // keys = keys that are being held down
  let actors = this.actors.map((actor) =>
    actor.update(time, this, keys, touch)
  );
  let newState = new State(this.level, actors, this.status);
  if (newState.status !== 'playing' && shieldActive) return newState;

  let player = newState.player;
  if (this.level.touches(player.pos, player.size, 'lava') && !shieldActive) {
    return new State(this.level, actors, 'lost');
  }

  for (let actor of actors) {
    if (actor !== player && overlap(actor, player)) {
      newState = actor.collide(newState, time);
    }
  }

  return newState;
};

function overlap(actor1, actor2) {
  return (
    actor1.pos.x + actor1.size.x > actor2.pos.x &&
    actor1.pos.x < actor2.pos.x + actor2.size.x &&
    actor1.pos.y + actor1.size.y > actor2.pos.y &&
    actor1.pos.y < actor2.pos.y + actor2.size.y
  );
}

let Vec = class Vec {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  plus(otherVec) {
    return new Vec(this.x + otherVec.x, this.y + otherVec.y);
  }
  times(factor) {
    return new Vec(this.x * factor, this.y * factor);
  }
};

let Player = class Player {
  constructor(pos, speed) {
    this.pos = pos;
    this.speed = speed;
  }

  get type() {
    return 'player';
  }

  static create(pos) {
    return new Player(pos.plus(new Vec(0, -0.5)), new Vec(0, 0));
  }
};

Player.prototype.size = new Vec(0.8, 1.5);
let playerXSpeed = 8;
const gravity = 30;
let jumpSpeed = 17;
let shieldActive = false;
Player.prototype.update = function (time, state, keys, touch) {
  let xSpeed = 0;
  if (keys.ArrowLeft || touch.Left) xSpeed -= playerXSpeed;
  if (keys.ArrowRight || touch.Right) xSpeed += playerXSpeed;
  let pos = this.pos;
  // xSpeed * time => the speed is proportional to time
  let movedX = pos.plus(new Vec(xSpeed * time, 0));
  if (!state.level.touches(movedX, this.size, 'wall')) {
    pos = movedX;
  }

  let ySpeed = this.speed.y + time * gravity;
  let movedY = pos.plus(new Vec(0, ySpeed * time));
  if (!state.level.touches(movedY, this.size, 'wall')) {
    pos = movedY;
  } else if ((keys.ArrowUp || touch.Up) && ySpeed > 0) {
    ySpeed = -jumpSpeed;
  } else {
    ySpeed = 0;
  }
  return new Player(pos, new Vec(xSpeed, ySpeed));
};

let Lava = class Lava {
  constructor(pos, speed, reset, angle, direction) {
    this.pos = pos;
    this.speed = speed;
    this.reset = reset;
    this.angle = angle;
    this.direction = direction;
  }

  get type() {
    return 'lava';
  }

  static create(pos, ch) {
    if (ch === '=') {
      return new Lava(pos, new Vec(2, 0));
    } else if (ch === '|') {
      return new Lava(pos, new Vec(0, 2));
    } else if (ch === 'v') {
      return new Lava(pos, new Vec(0, 3), pos);
    } else if (ch === 'd') {
      return new Lava(pos, new Vec(2, -2));
    } else if (ch === 'c') {
      return new Lava(pos, new Vec(0, 0), pos, Math.PI);
    } else if (ch === 'e') {
      return new Lava(pos, new Vec(0, 0), pos, Math.PI, 1);
    }
  }
};

Lava.prototype.size = new Vec(1, 1);
Lava.prototype.update = function (time, state) {
  let newPos = this.pos.plus(this.speed.times(time));
  if (!this.angle && !state.level.touches(newPos, this.size, 'wall')) {
    return new Lava(newPos, this.speed, this.reset);
  } else if (this.direction) {
    const center = this.reset;
    const radius = 2;
    const speed = 1;
    let angle = this.angle;
    function findNewPosition(direction) {
      angle += time * speed * direction;
      let posX = Math.cos(angle) * radius;
      let posY = Math.sin(angle) * radius * 4;
      let newPos = center.plus(new Vec(posX, posY));
      return newPos;
    }
    let direction = this.direction;
    let newPos = findNewPosition(direction);
    direction = state.level.touches(newPos, this.size, 'wall')
      ? direction * -1
      : direction;
    newPos = findNewPosition(direction);
    return new Lava(newPos, this.speed, this.reset, angle, direction);
  } else if (this.angle) {
    const radius = 2;
    const speed = 3;
    let angle = this.angle + time * speed;
    let posX = Math.cos(angle) * radius;
    let posY = Math.sin(angle) * radius;
    let newPos = this.reset.plus(new Vec(posX, posY));
    return new Lava(newPos, this.speed, this.reset, angle);
  } else if (this.reset) {
    return new Lava(this.reset, this.speed, this.reset);
  } else {
    return new Lava(this.pos, this.speed.times(-1));
  }
};
Lava.prototype.collide = function (state) {
  if (shieldActive) {
    return new State(state.level, state.actors, state.status);
  } else {
    return new State(state.level, state.actors, 'lost');
  }
};

let Coin = class Coin {
  constructor(pos, basePos, wobble) {
    this.pos = pos;
    this.basePos = basePos;
    this.wobble = wobble;
  }

  get type() {
    return 'coin';
  }

  static create(pos) {
    let basePos = pos.plus(new Vec(0.2, 0.1));
    return new Coin(basePos, basePos, Math.random() * Math.PI * 2);
  }
};
let money = 0;
let totalMoney = 0;
Coin.prototype.size = new Vec(0.6, 0.6);
Coin.prototype.collide = function (state) {
  // toglie la moneta che è stata presa
  let filtered = state.actors.filter((a) => a !== this);
  money++;
  return new State(state.level, filtered, state.status);
};
Coin.prototype.update = function (time) {
  const wobbleSpeed = 8;
  const wobbleRadius = 0.07;
  let wobble = this.wobble + time * wobbleSpeed;
  let posY = Math.sin(wobble) * wobbleRadius;
  return new Coin(this.basePos.plus(new Vec(0, posY)), this.basePos, wobble);
};

let Monster = class Monster {
  constructor(pos) {
    this.pos = pos;
  }

  get type() {
    return 'monster';
  }

  static create(pos) {
    return new Monster(pos);
  }
};
Monster.prototype.size = new Vec(1, 1);
Monster.prototype.collide = function (state) {
  if (this.pos.y - this.size.y > state.player.pos.y) {
    let filtered = state.actors.filter((a) => a !== this);
    return new State(state.level, filtered, state.status);
  } else if (shieldActive) {
    return new State(state.level, state.actors, state.status);
  } else {
    return new State(state.level, state.actors, 'lost');
  }
};
const monsterSpeed = 4;
Monster.prototype.update = function (time, state) {
  let player = state.player;
  let speed = (player.pos.x < this.pos.x ? -1 : 1) * time * monsterSpeed;
  let newPos = new Vec(this.pos.x + speed, this.pos.y);
  if (state.level.touches(newPos, this.size, 'wall')) return this;
  return new Monster(newPos);
};

let Life = class Life {
  constructor(pos) {
    this.pos = pos;
  }

  get type() {
    return 'life';
  }

  static create(pos) {
    return new Life(pos);
  }
};
Life.prototype.size = new Vec(1, 1);
Life.prototype.collide = function (state) {
  let filtered = state.actors.filter((a) => a !== this);
  lives++;
  console.log('New Life!: ' + lives);
  return new State(state.level, filtered, state.status);
};
Life.prototype.update = function (time) {
  return this;
};

let Shield = class Shield {
  constructor(pos, center, angle) {
    this.pos = pos;
    this.center = center;
    this.angle = angle;
  }

  get type() {
    return 'shield';
  }

  static create(pos) {
    return new Shield(pos, pos, Math.PI);
  }
};
Shield.prototype.size = new Vec(1, 1);
Shield.prototype.update = function (time) {
  let speed = 7;
  let radius = 0.04;
  let angle = this.angle + time * speed;
  let posX = Math.cos(angle) * radius;
  let posY = Math.sin(angle) * radius;
  let newPos = this.center.plus(new Vec(posX, posY));
  return new Shield(newPos, this.center, angle);
};
Shield.prototype.collide = function (state) {
  let filtered = state.actors.filter((a) => a !== this);
  shieldActive = true;
  setTimeout(() => {
    shieldActive = false;
  }, 5000);
  return new State(state.level, filtered, state.status);
};

let SpeedIncreaser = class SpeedIncreaser {
  constructor(pos) {
    this.pos = pos;
  }

  get type() {
    return 'speedIncreaser';
  }

  static create(pos) {
    return new SpeedIncreaser(pos);
  }
};

SpeedIncreaser.prototype.size = new Vec(1, 1);
SpeedIncreaser.prototype.update = function () {
  return this;
};
SpeedIncreaser.prototype.collide = function (state) {
  let filtered = state.actors.filter((a) => a !== this);
  playerXSpeed = 16;
  setTimeout(() => {
    playerXSpeed = 8;
  }, 8000);
  return new State(state.level, filtered, state.status);
};

let JumpIncreaser = class JumpIncreaser {
  constructor(pos) {
    this.pos = pos;
  }

  get type() {
    return 'jumpIncreaser';
  }

  static create(pos) {
    return new JumpIncreaser(pos);
  }
};

JumpIncreaser.prototype.size = new Vec(1, 1);
JumpIncreaser.prototype.update = function () {
  return this;
};
JumpIncreaser.prototype.collide = function (state) {
  let filtered = state.actors.filter((a) => a !== this);
  jumpSpeed = 25;
  setTimeout(() => {
    jumpSpeed = 17;
  }, 8000);
  return new State(state.level, filtered, state.status);
};

let Star = class Star {
  constructor(pos, blur, blurDir) {
    this.pos = pos;
    this.blur = blur;
    this.blurDir = blurDir;
  }

  get type() {
    return 'star';
  }

  static create(pos) {
    return new Star(pos, 25, 1);
  }
};

Star.prototype.size = new Vec(1, 1);
Star.prototype.update = function (time) {
  let newBlur = (this.blur -= time * 15 * this.blurDir);
  let newBlurDir = newBlur < 0 || newBlur > 25 ? -this.blurDir : this.blurDir;
  return new Star(this.pos, newBlur, newBlurDir);
};
Star.prototype.collide = function (state) {
  let filtered = state.actors.filter((a) => a !== this);
  let status = !filtered.some((a) => a.type === 'star') ? 'won' : state.status;
  return new State(state.level, filtered, status);
};

const levelChars = {
  '.': 'empty',
  '@': Player,
  '#': 'wall',
  '+': 'lava',
  '=': Lava,
  '|': Lava,
  c: Lava,
  d: Lava,
  e: Lava,
  h: Life,
  M: Monster,
  o: Coin,
  v: Lava,
  s: Shield,
  i: SpeedIncreaser,
  j: JumpIncreaser,
  S: Star,
};

const scale = 20;

let startText = true;
function canvasFullScreen(event) {
  if (canvas.requestFullscreen) {
    canvas.requestFullscreen().catch(console.log);
    startText = false;
    canvas.removeEventListener('click', canvasFullScreen);
    if (screen.orientation.lock) {
      screen.orientation
        .lock('landscape')
        .catch(() =>
          console.log(
            'Screen orientation not supported... be sure to have the best view!'
          )
        );
    }
  }
}
let canvas = document.createElement('canvas');
canvas.addEventListener('click', canvasFullScreen);
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenEnabled) {
    canvas.addEventListener('click', canvasFullScreen);
  }
});

let parent = document.querySelector('main');
parent.appendChild(canvas);
let cx = canvas.getContext('2d', { alpha: false });

class CanvasDisplay {
  constructor(level) {
    canvas.width = Math.min(600, level.width * scale);
    canvas.height = Math.min(450, level.height * scale);
    this.cx = cx;

    this.flipPlayer = false;

    this.viewport = {
      left: 0,
      top: 0,
      width: canvas.width / scale,
      height: canvas.height / scale,
    };

    this.backgroundColor = this.cx.createLinearGradient(0, 0, 0, canvas.height);
    this.backgroundColor.addColorStop(0, 'rgb(45, 165, 255)');
    this.backgroundColor.addColorStop(1, 'rgb(0, 80, 140)');
  }
}

CanvasDisplay.prototype.syncState = function (state) {
  this.updateViewport(state);
  this.clearDisplay(state.status);
  this.drawBackground(state.level);
  this.drawActors(state);
};

// da capire MOLTO BENE
CanvasDisplay.prototype.updateViewport = function (state) {
  let view = this.viewport;
  let margin = view.width / 3;
  let player = state.player;
  let center = player.pos.plus(player.size.times(0.5));

  if (center.x < view.left + margin) {
    view.left = Math.max(center.x - margin, 0);
  } else if (center.x > view.left + view.width - margin) {
    view.left = Math.min(
      center.x + margin - view.width,
      state.level.width - view.width
    );
  }

  if (center.y < view.top + margin) {
    view.top = Math.max(center.y - margin, 0);
  } else if (center.y > view.top + view.height - margin) {
    view.top = Math.min(
      center.y + margin - view.height,
      state.level.height - view.height
    );
  }
};

CanvasDisplay.prototype.clearDisplay = function (status) {
  let color;
  if (status === 'won') {
    color = 'rgb(0, 115, 210)';
  } else if (status === 'lost') {
    color = 'rgb(0, 60, 100)';
  } else {
    color = this.backgroundColor;
  }
  this.cx.fillStyle = color;
  this.cx.fillRect(0, 0, canvas.width, canvas.height);
};

function createSprite(type) {
  let sprite = document.createElement('img');
  sprite.src = `./img/${type}.png`;
  return sprite;
}
let coin = createSprite('coin');
let lava = createSprite('lava');
let wall = createSprite('wall');
let monster = createSprite('monster');
let speedIncreaser = createSprite('speedIncreaser');
let jumpIncreaser = createSprite('jumpIncreaser');
let star = createSprite('star');
let heart = createSprite('heart');

let offScreenCanvas = document.createElement('canvas');
offScreenCanvas.width = 120;
offScreenCanvas.height = 60;
let offScreenCx = offScreenCanvas.getContext('2d');

function drawShield(cx, x, y) {
  let blurSpace = 20;
  let xStart = x + blurSpace;
  let yStart = y + blurSpace;
  cx.fillStyle = 'rgb(0, 145, 150)';
  cx.strokeStyle = 'rgb(0, 145, 150)';
  cx.shadowColor = 'white';
  cx.shadowBlur = 15;
  cx.beginPath();
  cx.moveTo(xStart, yStart);
  cx.lineTo(xStart + scale, yStart);
  cx.lineTo(xStart + scale, yStart + scale / 2);
  cx.arc(xStart + scale / 2, yStart + scale / 2, scale / 2, 0, Math.PI);
  cx.moveTo(xStart, yStart + scale / 2);
  cx.lineTo(xStart, yStart);
  cx.stroke();
  cx.fill();
  cx.shadowBlur = 0;
}

function drawDeadCircle(cx, x, y) {
  let radius = 20;
  let centerX = x + radius;
  let centerY = y + offScreenCanvas.height / 2;
  let radialGradient = cx.createRadialGradient(
    centerX,
    centerY,
    8,
    centerX,
    centerY,
    16
  );
  radialGradient.addColorStop(0, 'rgb(255, 115, 0)');
  radialGradient.addColorStop(1, 'rgb(255, 50, 50)');
  cx.beginPath();
  cx.fillStyle = radialGradient;
  cx.arc(centerX, centerY, radius, 0, 7);
  cx.fill();
}

drawShield(offScreenCx, 0, 0);
drawDeadCircle(offScreenCx, 70, 0);

CanvasDisplay.prototype.drawBackground = function (level) {
  if (startText) {
    this.cx.font = 'small-caps 30px Sans-serif';
    this.cx.fillStyle = 'white';
    this.cx.textBaseline = 'center';
    this.cx.textAlign = 'center';
    this.cx.fillText(
      'tap to play',
      canvas.width / 2,
      (canvas.height / 100) * 10
    );
  }
  let { left, top, width, height } = this.viewport;
  let xStart = Math.floor(left);
  let xEnd = Math.ceil(left + width);
  let yStart = Math.floor(top);
  let yEnd = Math.ceil(top + height);

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      let type = level.rows[y][x];
      if (type === 'empty') continue;
      let screenX = (x - left) * scale;
      let screenY = (y - top) * scale;
      if (type === 'wall') {
        this.cx.drawImage(wall, screenX, screenY);
      } else if (type === 'lava') {
        this.cx.drawImage(lava, screenX + 1, screenY + 1);
      }
    }
  }
};

let playerSprites = document.createElement('img');
playerSprites.src = 'img/player.png';
const playerXOverlap = 4;
function flipHorizontally(context, around) {
  context.translate(around, 0);
  context.scale(-1, 1);
  context.translate(-around, 0);
}
CanvasDisplay.prototype.drawPlayer = function (
  player,
  x,
  y,
  width,
  height,
  state
) {
  width += playerXOverlap * 2;
  x -= playerXOverlap;

  if (shieldActive) {
    this.cx.fillStyle = 'rgba(0, 145, 150, 0.9)';
    this.cx.beginPath();
    this.cx.arc(x + width / 2, y + height / 2, (width / 4) * 3, 0, Math.PI * 2);
    this.cx.fill();
  } else if (state.status === 'lost') {
    this.cx.drawImage(offScreenCanvas, 70, 10, 40, 40, x - 7, y - 6, 40, 40);
  }

  if (player.speed.x !== 0) {
    this.flipPlayer = player.speed.x < 0;
  }

  let tile = 8;
  if (player.speed.y !== 0) {
    tile = 9;
  } else if (player.speed.x !== 0) {
    tile = Math.floor(Date.now() / 60) % 8;
  }

  this.cx.save();
  if (this.flipPlayer) {
    flipHorizontally(this.cx, x + width / 2);
  }
  let tileX = tile * width;
  this.cx.drawImage(
    playerSprites,
    tileX,
    0,
    width,
    height,
    x,
    y,
    width,
    height
  );
  this.cx.restore();
};

CanvasDisplay.prototype.drawActors = function (state) {
  let actors = state.actors;
  for (let actor of actors) {
    let width = actor.size.x * scale;
    let height = actor.size.y * scale;
    let x = (actor.pos.x - this.viewport.left) * scale;
    let y = (actor.pos.y - this.viewport.top) * scale;
    if (actor.type === 'player') {
      this.drawPlayer(actor, x, y, width, height, state);
    } else if (actor.type === 'lava') {
      this.cx.drawImage(lava, x, y);
    } else if (actor.type === 'coin') {
      this.cx.drawImage(coin, x, y);
    } else if (actor.type === 'monster') {
      this.cx.drawImage(monster, x + 1, y);
    } else if (actor.type === 'life') {
      this.cx.drawImage(heart, x, y);
    } else if (actor.type === 'shield') {
      this.cx.drawImage(offScreenCanvas, 0, 0, 60, 60, x - 20, y - 20, 60, 60);
    } else if (actor.type === 'speedIncreaser') {
      this.cx.drawImage(speedIncreaser, x, y);
    } else if (actor.type === 'jumpIncreaser') {
      this.cx.drawImage(jumpIncreaser, x, y);
    } else if (actor.type === 'star') {
      this.cx.save();
      this.cx.shadowColor = 'yellow';
      this.cx.shadowBlur = actor.blur;
      this.cx.drawImage(star, x, y);
      this.cx.restore();
    }
  }
};

function trackKeys(keys) {
  let down = Object.create(null);
  function track(event) {
    if (keys.includes(event.key) && !startText) {
      down[event.key] = event.type === 'keydown';
      event.preventDefault();
    }
  }
  window.addEventListener('keydown', track);
  window.addEventListener('keyup', track);
  down.unregister = () => {
    window.removeEventListener('keydown', track);
    window.removeEventListener('keyup', track);
  };
  return down;
}

function trackTouch() {
  let startPos;
  let dir = Object.create(null);

  function getPos(touchEvent) {
    let touch = touchEvent.changedTouches[0];
    let { pageX, pageY } = touch;
    return new Vec(pageX, pageY);
  }

  function touchStart(event) {
    startPos = getPos(event);
  }

  function touchMove(event) {
    let newPos = getPos(event);
    if (startPos && !startText) {
      dir['Up'] = newPos.y - startPos.y < -10;
      dir['Left'] = newPos.x - startPos.x < -10;
      dir['Right'] = newPos.x - startPos.x > 10;
      startPos.y = newPos.y;
    }
  }

  function touchEnd(event) {
    dir['Up'] = false;
    dir['Left'] = false;
    dir['Right'] = false;
  }

  window.addEventListener('touchstart', touchStart);
  window.addEventListener('touchmove', touchMove);
  window.addEventListener('touchend', touchEnd);
  dir.unregister = () => {
    window.removeEventListener('touchstart', touchStart);
    window.removeEventListener('touchmove', touchMove);
    window.removeEventListener('touchend', touchEnd);
  };
  return dir;
}

function runAnimation(frameFun) {
  let lastTime = null;
  function frame(time) {
    if (lastTime !== null) {
      let timeStep = Math.min(time - lastTime, 100) / 1000;
      if (frameFun(timeStep) === false) return;
    }
    lastTime = time;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function resetVariables() {
  playerXSpeed = 8;
  jumpSpeed = 17;
  money = 0;
  shieldActive = false;
}

function runLevel(level, Display) {
  let display = new Display(level);
  let state = State.start(level);
  let ending = 1;
  let running = 'yes';

  return new Promise((resolve) => {
    function pHandler(event) {
      if (event.key !== 'p' && event.key !== 'P') return;
      event.preventDefault();
      if (running === 'no') {
        running = 'yes';
        runAnimation(frame);
      } else if (running === 'yes') {
        running = 'pausing';
      } else {
        running = 'yes';
      }
    }
    window.addEventListener('keydown', pHandler);
    let arrowKeys = trackKeys(['ArrowUp', 'ArrowLeft', 'ArrowRight']);
    let touchesDirections = trackTouch();
    function frame(time) {
      if (running === 'pausing') {
        running = 'no';
        return false;
      }
      state = state.update(time, arrowKeys, touchesDirections);
      display.syncState(state);
      if (state.status === 'playing') return true;
      else if (ending > 0) {
        ending -= time;
        return true;
      } else {
        window.removeEventListener('keydown', pHandler);
        arrowKeys.unregister();
        touchesDirections.unregister();
        resolve(state.status);
        return false;
      }
    }
    runAnimation(frame);
  });
}

function restartGame(Display) {
  lives = 3;
  runGame(GAME_LEVELS, Display);
}

let lives = 3;
async function runGame(plans, Display) {
  for (let level = 0; level < plans.length; ) {
    console.log(`lives: ${lives}`);
    let status = await runLevel(new Level(plans[level]), Display);
    if (status === 'won') {
      totalMoney += money;
      console.log(`money earned: ${money}`);
      level++;
    } else if (status === 'lost') lives--;
    resetVariables();
    if (lives === 0) break;
  }
  let result = lives > 0 ? "You've won!" : `lives: ${lives}... You've lost!`;
  totalMoney += 100 * lives;
  console.log(`total money: ${totalMoney}`);
  console.log(result);
  restartGame(Display);
}

runGame(GAME_LEVELS, CanvasDisplay);
