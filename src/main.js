const timer = {
  tick: 0,
  step() {
    this.tick++;
    return this.tick
  }
};
const warehouse = {

}

window.timer = timer;
window.warehouse = warehouse;