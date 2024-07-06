"use strict";

class Vector {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  add(v) {
    return new Vector(this.x + v.x, this.y + v.y);
  }
  sub(v) {
    return new Vector(this.x - v.x, this.y - v.y);
  }
  mul(s) {
    return new Vector(this.x * s, this.y * s);
  }
  mod(s) {
    return new Vector(this.x % s, this.y % s);
  }
  mag() {
    return Math.hypot(this.x, this.y);
  }
  eq(v) {
    if (!(v instanceof Vector)) return false;
    return this.x === v.x && this.y === v.y;
  }
}

function vec(x, y) {
  return new Vector(x, y);
}

function t(text) {
  return document.createTextNode(text);
}

/**
 * a simple function to create HTML elements
 * @param {string} tag          HTML tag
 * @param {object} props        an object of attributes
 * @param {element[]} children  an array of child elements
 * @returns {element}           a new HTML element
 */
function h(tag, props, children) {
  const element = document.createElement(tag);
  Object.keys(props).forEach((name) => {
    element.setAttribute(name, props[name]);
  });
  children.forEach((child) => {
    const el =
      child instanceof Element ? child : document.createTextNode(child);
    element.appendChild(el);
  });
  return element;
}

/**
 * a simple function to create SVG elements
 * @param {string} tag          SVG tag
 * @param {object} props        an object of attributes
 * @param {element[]} children  an array of child elements
 * @returns {element}           a new SVG element
 */
function s(tag, props, children) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.keys(props).forEach((name) => {
    element.setAttribute(name, props[name]);
  });
  children.forEach((child) => {
    element.appendChild(child);
  });
  return element;
}

class Rectangle {
  constructor(center, dimensions) {
    this.center = center;
    this.dimensions = dimensions;
  }
  get topLeft() {
    return this.center.sub(this.dimensions.mul(1 / 2));
  }
  get bottomRight() {
    return this.center.add(this.dimensions.mul(1 / 2));
  }
  get topRight() {
    return this.center.add(vec(this.dimensions.x / 2, -this.dimensions.y / 2));
  }
  get bottomLeft() {
    return this.center.add(vec(-this.dimensions.x / 2, this.dimensions.y / 2));
  }
  contains(point) {
    const toPoint = this.center.sub(point.center);
    return (
      Math.abs(toPoint.x) < this.dimensions.x / 2 &&
      Math.abs(toPoint.y) < this.dimensions.y / 2
    );
  }
  intersects(other) {
    const toOther = this.center.sub(other.center);
    return (
      Math.abs(toOther.x) < (this.dimensions.x + other.dimensions.x) / 2 &&
      Math.abs(toOther.y) < (this.dimensions.y + other.dimensions.y) / 2
    );
  }
}

/*
The ARK scope is the parent of all objects in the world.
In this way, any ARK Object can respond to the methods in the ARK scope.

So to add a js function to the ARK world, add it to the ARK scope.
*/

class ARKScope {
  constructor({ name = "ARKScope" }) {
    this.name = name;
  }
  static new(name) {
    return new this({ name });
  }
  define(name, property) {
    Object.defineProperty(this, name, property);
  }
  get prototype() {
    return Object.getPrototypeOf(this);
  }
  set prototype(proto) {
    Object.setPrototypeOf(this, proto);
  }
  assign(things) {
    Object.defineProperties(this, Object.getOwnPropertyDescriptors(things));
    return this;
  }
  messages() {
    const acc = [];
    let obj = this;
    while (obj.name !== "ARKScope") {
      acc.push({ owner: obj, messages: obj.ownMessages() });
      obj = obj.prototype;
    }
    acc.push({ owner: obj, messages: obj.ownMessages() });
    return acc;
  }
  ownMessages() {
    // No state is hidden. To make a private state, use a closure.
    return Object.getOwnPropertyDescriptors(this);
  }
}

/*
The ARK screen holds information about the visual system, so that:

- an element is added to an appropriate root at most once
- an ARK Object can know the object it is dropped on
- the ARK hand can know which object is picked up
*/

const ARKScreen = ARKScope.new("ARKScreen").assign({
  objects: new Map(),
  mouse: vec(0, 0),
  pressedKeys: new Set(),
  add(obj) {
    if (this.objects.has(obj.element)) return false;
    this.objects.set(obj.element, obj);
    document.body.appendChild(obj.element);
    return true;
  },
  remove(obj) {
    if (!this.objects.has(obj.element)) return false;
    this.objects.delete(obj.element);
    document.body.removeChild(obj.element);
    return true;
  },
  findOwner(element) {
    return this.objects.get(element);
  },
  findIntersecting(obj) {
    const rect = obj.rect;
    const allObjs = [...this.objects.values()].sort(
      (a, b) => a.zHeight - b.zHeight
    );
    return allObjs.filter(
      (other) => other !== obj && rect.intersects(other.rect)
    );
  },
});
document.addEventListener("mousemove", (e) => {
  ARKScreen.mouse = vec(e.clientX, e.clientY);
});
document.addEventListener("keydown", (e) => {
  ARKScreen.pressedKeys.add(e.key);
});
document.addEventListener("keyup", (e) => {
  ARKScreen.pressedKeys.delete(e.key);
});

/*
The ARK Timer updates the objects' positions and sends them \`step\` messages every frame.
*/

const ARKTimer = ARKScope.new("ARKTimer").assign({
  name: "ARKTimer",
  tps: 40,
  tick: 0,
  running: false,
  objects: new Set(),
  add(obj) {
    this.objects.add(obj);
    return this;
  },
  remove(obj) {
    this.objects.delete(obj);
    return this;
  },
  has(obj) {
    return this.objects.has(obj);
  },
  step() {
    this.tick++;
    this.objects.forEach((obj) => {
      obj.step(this.tick);
    });
    return this.tick;
  },
  loop() {
    if (!this.running) return;
    const now = Date.now();
    const tickTime = 1000 / this.tps;
    this.step();
    const waitTime = Math.max(0, tickTime - (Date.now() - now));
    setTimeout(() => this.loop(), waitTime);
  },
  on() {
    this.running = true;
    setTimeout(() => this.loop(), 0);
  },
  off() {
    this.running = false;
  },
});

/*
The ARK viewport manages the camera position and scale.
*/
const ARKViewport = ARKScope.new("ARKViewport")
  .assign({
    reset(
      rect = new Rectangle(
        vec(0, 0),
        vec(window.innerWidth, window.innerHeight)
      ),
      scalePercent = 100
    ) {
      this.rect = rect;
      this.scalePercent = scalePercent;
      return this;
    },
    step() {
      this.rect.dimensions = vec(window.innerWidth, window.innerHeight);
      return this;
    },
    screenToWorldPos(screenPos) {
      return screenPos
        .sub(this.rect.dimensions.mul(1 / 2))
        .mul(100 / this.scalePercent)
        .add(this.rect.center);
    },
    worldToScreenPos(worldPos) {
      return worldPos
        .sub(this.rect.center)
        .mul(this.scalePercent / 100)
        .add(this.rect.dimensions.mul(1 / 2));
    },
  })
  .reset();
ARKTimer.add(ARKViewport);

/*
The ARK Hand is used to "lift" an ARK Object into the "meta" plane,
which stops the timer from sending it messages, and moves the object around the screen.
*/

const ARKHand = ARKScope.new("ARKHand").assign({
  state: "open",
  holding: null,
  step() {
    if (this.holding == null) return;
    const screenPos = ARKScreen.mouse;
    const worldPos = ARKViewport.screenToWorldPos(screenPos).add(this.delta);
    this.holding.moveTo(worldPos);
  },
});
document.addEventListener("mousedown", (e) => {
  // TODO: add one event listener to every object's element, making findOwner unnecessary
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const obj = ARKScreen.findOwner(el);
  if (obj && obj instanceof ARKThing) {
    console.log(obj);
    if (e.button === 0 && ARKScreen.pressedKeys.has("Shift")) {
      ARKHand.state = "moving";
    } else if (e.button === 1) {
      obj.onHold();
      ARKHand.state = "holding";
    } else return;
    ARKHand.holding = obj;
    ARKHand.delta = obj.position.sub(
      ARKViewport.screenToWorldPos(ARKScreen.mouse)
    );
  }
});
document.addEventListener("mouseup", (e) => {
  if (!ARKHand.holding) return;
  if (ARKHand.state === "holding") ARKHand.holding.onRelease();
  ARKHand.holding = null;
  ARKHand.state = "open";
});
ARKTimer.add(ARKHand);

/*
An ARK Object is a js object, represented by an HTML element on the screen.
The ARK hand can move it around.

It has a position vector, an element, and a name.
*/

class ARKThing extends ARKScope {
  #position;
  #zHeight;
  constructor({ name, element, position = vec(0, 0), zHeight = 1 }) {
    super({ name });
    this.element = element;
    this.position = position;
    this.zHeight = zHeight;
    ARKScreen.add(this);
  }
  static new({ name, element, position = vec(0, 0) }) {
    return new this({ name, element, position });
  }
  get position() {
    return this.#position;
  }
  set position(pos) {
    this.moveTo(pos);
  }
  get zHeight() {
    return this.#zHeight;
  }
  set zHeight(z) {
    this.#zHeight = z;
    this.element.style.zIndex = z;
  }
  get rect() {
    const clientRect = this.element.getBoundingClientRect();
    return new Rectangle(
      vec(
        clientRect.left + clientRect.right,
        clientRect.top + clientRect.bottom
      ).mul(1 / 2),
      vec(clientRect.width, clientRect.height)
    );
  }
  // called whenever the position is set
  moveTo(worldPos) {
    this.#position = worldPos;
    this.#setVisual();
  }
  #setVisual() {
    const el = this.element;
    const screenPos = ARKViewport.worldToScreenPos(this.#position);
    if (
      screenPos.x + el.offsetWidth / 2 < 0 ||
      screenPos.x - el.offsetWidth / 2 > ARKViewport.rect.x ||
      screenPos.y + el.offsetHeight / 2 < 0 ||
      screenPos.y - el.offsetHeight / 2 > ARKViewport.rect.y
    ) {
      // the element is totally off screen
      el.style.display = "none";
    } else {
      el.style.transform = `translate(-50%, -50%) scale(${
        this.scalePercent / 100
      })`;
      el.style.left = `${screenPos.x}px`;
      el.style.top = `${screenPos.y}px`;
      el.style.display = "block";
    }
  }
  XEROX() {
    // this method clones a visual object,
    // so that two identical things with the same function appear on the screen
    // e.g. cloning the law of gravity
    return ARKThing.new({
      name: this.name,
      element: this.element.cloneNode(true),
      position: this.position.add(vec(10, 10)),
    });
  }
  vaporize() {
    this.world.remove(this);
  }
  onHold() {
    // called when the object is picked up
    this.element.style.zIndex = 10000;
    this.element.classList.add("held");
  }
  onRelease() {
    // called when the object is dropped
    this.element.style.zIndex = this.zHeight;
    this.element.classList.remove("held");
  }
  receiver() {
    // this method returns the object that a button should send to.
    return this;
  }
}

/*
An ARK Object that represents another JS Object.
*/
class ARKRepresentative extends ARKThing {
  constructor({ name, object, position = vec(0, 0) }) {
    super({
      name,
      element: h("div", { class: "representative" }, [name]),
      position,
    });
    this.object = object;
  }
  receiver() {
    return this.object;
  }
}

class ARKActiveThing extends ARKThing {
  constructor({ name, element, position = vec(0, 0) }) {
    super({ name, element, position });
    ARKTimer.add(this);
  }
  XEROX() {
    return ARKActiveThing.new({
      name: this.name,
      element: this.element.cloneNode(true),
      position: this.position.add(vec(10, 10)),
    });
  }
  step() {}
  onHold() {
    super.onHold();
    ARKTimer.remove(this);
  }
  onRelease() {
    super.onRelease();
    ARKTimer.add(this);
  }
}

/*
ARK Objects that other objects can stick to.
*/
class ARKStickableThing extends ARKThing {
  constructor({ name, element, position = vec(0, 0) }) {
    super({ name, element, position });
    this.stuck = new Map();
  }
  XEROX() {
    return ARKStickableThing.new({
      name: this.name,
      element: this.element.cloneNode(true),
      position: this.position.add(vec(10, 10)),
    });
  }
  canStick(obj) {
    return !this.stuck.has(obj);
  }
  stick(obj) {
    if (!this.canStick(obj)) return false;
    this.stuck.set(obj, { delta: obj.position.sub(this.position) });
    return true;
  }
  peel(obj) {
    if (!this.stuck.has(obj)) return false;
    this.stuck.delete(obj);
    return true;
  }
  // moving an StickableThing moves all stuck objects
  moveTo(worldPos) {
    if (worldPos.eq(this.position)) return;
    super.moveTo(worldPos);
    if (!this.stuck) return;
    this.stuck.forEach((data, obj) => {
      obj.moveTo(this.position.add(data.delta));
    });
  }
}

/*
The ARK button represents an action, whether a function or a message call.
*/

class ARKButton extends ARKStickableThing {
  constructor({ position, action }) {
    super({
      name: `${action.verb} ${action.name}`,
      element: h("button", { class: "button" }, [
        h("em", {}, [`${action.verb} `]),
        action.name,
      ]),
      position,
    });
    this.action = action;
    this.stuckTo = null;
    this.element.addEventListener("click", () => {
      let receiver = this;
      if (this.stuckTo) receiver = this.stuckTo.receiver();
      const result = this.action.run(receiver);
      // TODO: spawn result in the world
      console.log(result);
    });
  }
  XEROX() {
    return new ARKButton({
      position: this.position.add(vec(10, 10)),
      name: this.name,
      action: this.action,
    });
  }
  canStick(obj) {
    if (!super.canStick(obj)) return false;
    // walk the "stuckTo" chain to see if we are already stuck to this object
    for (let o = this.stuckTo; o && o instanceof ARKButton; o = o.stuckTo) {
      if (o === obj) return false;
    }
    return this.action.canActOn(obj.receiver());
  }
  stickTo(other) {
    if (!other.stick(this)) return false;
    this.stuckTo = other;
    this.zHeight = other.zHeight + 1;
    this.element.classList.add("stuck");
    return true;
  }
  onHold() {
    super.onHold();
    if (this.stuckTo) {
      this.stuckTo.peel(this);
      this.stuckTo = null;
      this.element.classList.remove("stuck");
    }
  }
  onRelease() {
    super.onRelease();
    const objs = ARKScreen.findIntersecting(this);
    for (const other of objs) {
      if (other instanceof ARKStickableThing){
        if(this.stickTo(other)) return;
        this.zHeight = other.zHeight - 1;
      }
    }
    this.stuckTo = null;
    this.zHeight = 0;
  }
}

class ARKFunctionAction {
  constructor(fn) {
    this.fn = fn;
    this.verb = "do";
    this.name = fn.name;
  }
  run(receiver) {
    return this.fn.bind(receiver)();
  }
  canActOn(_receiver) {
    // a function can bind "this" to any object
    return true;
  }
}

class ARKMessageAction {
  constructor(messageName) {
    this.messageName = messageName;
    this.verb = "send";
    this.name = messageName;
  }
  run(receiver) {
    return receiver[this.messageName]();
  }
  canActOn(receiver) {
    // send a message only if the receiver has the method
    return typeof receiver[this.messageName] === "function";
  }
}

function logThis() {
  console.log("This is", this);
}
function helloWorld() {
  console.log("Hello, world!");
}
const bTest = new ARKButton({
  position: vec(100, 100),
  action: new ARKFunctionAction(helloWorld),
});
const bLog = new ARKButton({
  position: vec(200, 100),
  action: new ARKFunctionAction(logThis),
});
const XEROX = new ARKButton({
  position: vec(300, 100),
  action: new ARKMessageAction("XEROX"),
});

// TODO: an interactor is an Active and Stickable thing. Inheritence bad, composition good!
// factor the "active" into a "resource" object

/*
The ARK warehouse is the main object for spawning other objects.
It understands:

- add, registers a new object to add to the world
- objectList, returns a list of all objects to spawn
- objectMenu, creates a menu of objects to spawn
  - if the object is not an ARK object (its prototype is not ARKThing), an representation is created instead
*/

const ARKWarehouse = ARKThing.new({
  name: "ARKWarehouse",
  element: h(
    "p",
    {
      style: "position: absolute; top: 0; left: 0; background-color: white",
    },
    ["I'm a war horse"]
  ),
}).assign({
  objects: new Set(),
  add(obj) {
    this.objects.add(obj);
  },
  objectList() {
    return Array.from(this.objects).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  },
  objectMenu() {
    // TODO
  },
  spawn(obj) {
    return ARKScreen.add(obj.XEROX());
  },
});

/*
The ARK Warehouse gives you all other objects in the world.

You can spawn any registered ARK object using the objectMenu,
or spawn an eval button and run any code you want.
*/

ARKTimer.on();
