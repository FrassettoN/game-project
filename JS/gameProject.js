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
  if (newState.status !== 'playing' && newState.status !== 'protected')
    return newState;

  let player = newState.player;
  if (
    this.level.touches(player.pos, player.size, 'lava') &&
    this.status !== 'protected'
  ) {
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
const playerXSpeed = 8;
const gravity = 30;
const jumpSpeed = 17;
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
  if (state.status !== 'protected') {
    return new State(state.level, state.actors, 'lost');
  } else {
    return new State(state.level, state.actors, 'protected');
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
Coin.prototype.size = new Vec(0.6, 0.6);
Coin.prototype.collide = function (state) {
  // toglie la moneta che è stata presa
  let filtered = state.actors.filter((a) => a !== this);

  let status = state.status;
  if (!filtered.some((a) => a.type === 'coin')) status = 'won';
  return new State(state.level, filtered, status);
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
  } else if (state.status !== 'protected') {
    return new State(state.level, state.actors, 'lost');
  } else {
    return new State(state.level, state.actors, 'protected');
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
  constructor(pos, basePos, wobble) {
    this.pos = pos;
    this.basePos = basePos;
    this.wobble = wobble;
  }

  get type() {
    return 'life';
  }

  static create(pos) {
    return new Life(pos, pos, Math.random() * Math.PI * 2);
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
  const wobbleSpeed = 4;
  const wobbleDist = 0.1;
  let wobble = this.wobble + time * wobbleSpeed;
  let wobblePosX = Math.cos(wobble) * wobbleDist;
  return new Life(
    this.basePos.plus(new Vec(wobblePosX, 0)),
    this.basePos,
    wobble
  );
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
  return new State(state.level, filtered, 'protected');
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
};

function elt(name, attrs, ...children) {
  let dom = document.createElement(name);
  for (let attr of Object.keys(attrs)) {
    dom.setAttribute(attr, attrs[attr]);
  }
  for (let child of children) {
    dom.appendChild(child);
  }
  return dom;
}

let DOMDisplay = class DOMDisplay {
  constructor(parent, level) {
    this.dom = elt('div', { class: 'game' }, drawGrid(level));
    this.actorLayer = null;
    parent.appendChild(this.dom);
  }

  clear() {
    this.dom.remove();
  }
};

const scale = 20;

function drawGrid(level) {
  return elt(
    'table',
    {
      class: 'background',
      style: `width: ${level.width * scale}px`,
    },
    ...level.rows.map((row) =>
      elt(
        'tr',
        { style: `height: ${scale}px` },
        ...row.map((type) => elt('td', { class: type }))
      )
    )
  );
}

function drawActors(actors) {
  return elt(
    'div',
    {},
    ...actors.map((actor) => {
      let rect = elt('div', { class: 'actor ' + actor.type });
      rect.style.width = `${actor.size.x * scale}px`;
      rect.style.height = `${actor.size.y * scale}px`;
      rect.style.left = `${actor.pos.x * scale}px`;
      rect.style.top = `${actor.pos.y * scale}px`;
      return rect;
    })
  );
}

DOMDisplay.prototype.syncState = function (state) {
  if (this.actorLayer) this.actorLayer.remove();
  this.actorLayer = drawActors(state.actors);
  this.dom.appendChild(this.actorLayer);
  this.dom.className = `game ${state.status}`;
  this.scrollPlayerIntoView(state);
};

// capire BENE come funziona
DOMDisplay.prototype.scrollPlayerIntoView = function (state) {
  let width = this.dom.clientWidth;
  let height = this.dom.clientHeight;
  let margin = width / 3;

  // The viewport
  let left = this.dom.scrollLeft;
  let right = left + width;
  let top = this.dom.scrollTop;
  let bottom = top + height;

  let player = state.player;
  let center = player.pos.plus(player.size.times(0.5)).times(scale);

  if (center.x < left + margin) {
    this.dom.scrollLeft = center.x - margin;
  } else if (center.x > right - margin) {
    this.dom.scrollLeft = center.x + margin - width;
  }
  if (center.y < top + margin) {
    this.dom.scrollTop = center.y - margin;
  } else if (center.y > bottom - margin) {
    this.dom.scrollTop = center.y + margin - height;
  }
};

function trackKeys(keys) {
  let down = Object.create(null);
  function track(event) {
    if (keys.includes(event.key)) {
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
    event.preventDefault();
  }

  function touchMove(event) {
    let newPos = getPos(event);
    dir['Up'] = newPos.y - startPos.y < -10;
    dir['Left'] = newPos.x - startPos.x < 0;
    dir['Right'] = newPos.x - startPos.x > 0;
    startPos.y = newPos.y;
    event.preventDefault();
  }

  function touchEnd(event) {
    dir['Up'] = false;
    dir['Left'] = false;
    dir['Right'] = false;
    event.preventDefault();
  }

  dir.unregister = () => {
    window.removeEventListener('touchstart', touchStart);
    window.removeEventListener('touchmove', touchMove);
    window.removeEventListener('touchend', touchEnd);
  };
  window.addEventListener('touchstart', touchStart);
  window.addEventListener('touchmove', touchMove);
  window.addEventListener('touchend', touchEnd);
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

function runLevel(level, Display) {
  let display = new Display(document.body, level);
  let state = State.start(level);
  let ending = 1;
  let endShield = 5;
  let running = 'yes';

  return new Promise((resolve) => {
    function escHandler(event) {
      if (event.key !== 'Escape') return;
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
    window.addEventListener('keydown', escHandler);
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
      else if (state.status === 'protected') {
        endShield -= time;
        if (endShield < 0) {
          state.status = 'playing';
        } else {
          console.log(Math.ceil(endShield));
        }
        return true;
      } else if (ending > 0) {
        ending -= time;
        return true;
      } else {
        display.clear();
        window.removeEventListener('keydown', escHandler);
        arrowKeys.unregister();
        touchesDirections.unregister();
        resolve(state.status);
        return false;
      }
    }
    runAnimation(frame);
  });
}

function restartGame() {
  lives = 3;
  runGame(GAME_LEVELS, DOMDisplay);
}

let lives = 3;
async function runGame(plans, Display) {
  for (let level = 0; level < plans.length; ) {
    console.log(`lives: ${lives}`);
    let status = await runLevel(new Level(plans[level]), Display);
    if (status === 'won') level++;
    else if (status === 'lost') lives--;
    if (lives === 0) break;
  }
  let result = lives > 0 ? "You've won!" : `lives: ${lives}... You've lost!`;
  console.log(result);
  restartGame();
}

runGame(GAME_LEVELS, DOMDisplay);
