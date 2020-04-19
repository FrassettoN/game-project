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

function update(event) {
  directions = [];
  for (let i = 0; i < event.touches.length; i++) {
    let { pageX, pageY } = event.touches[i];
    let pos = new Vec(pageX, pageY);
    if (prevPos !== 'undefined') {
      console.log(pos);
    }
  }
}
let prevPos = [new Vec(2, 3)];
let directions = [];
window.addEventListener('touchstart', update);
window.addEventListener('touchmove', update);
const trackDirections = (keys) => {};
