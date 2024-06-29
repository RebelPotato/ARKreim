const LawOfMotion = {
  isOn: false,
  toggle() {
    this.isOn = !this.isOn;
  },
  on() {
    this.isOn = true;
  },
  off() {
    this.isOn = false;
  },

  affecting: [],
  add(obj) {
    this.affecting.push(obj);
  },
  remove(obj) {
    this.affecting = this.affecting.filter((o) => o !== obj);
  },
  step() {
    if (!this.isOn) return;
    this.affecting.forEach((obj) => {
      obj.position = obj.position.add(obj.velocity);
    });
  },

  position: vec(0, 0),
  element: h("div", { class: "interactor" }, [h("p", {}, [t("Motion")])]),
};

class ARKBall {
  constructor(position, velocity) {
    this.position = position;
    this.velocity = velocity;
    this.element = h("div", { class: "ball" }, []);
    document.body.appendChild(this.element);
  }
}

const balls = [
  new ARKBall(vec(0, 0), vec(1, 1)),
  new ARKBall(vec(100, 0), vec(-1, 1)),
];
balls.forEach((ball) => LawOfMotion.add(ball));

const world = ARKWorld;
world.add(Viewport).toggle();
world.add(LawOfMotion).toggle();
balls.forEach((ball) => world.add(ball));
world.on();

