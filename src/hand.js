const Hand = {
  lifting: null,
  lift(obj) {
    this.lifting = obj;
  },
  drop() {
    const obj = this.lifting;
    const target = objectAtMousePosition();
    target.accepts(obj);
  },
  step() {
    this.pos = getMousePosition();
    if (this.lifting === null) return;
    this.lifting.pos = this.pos;
  },
};

window.Hand = Hand;
