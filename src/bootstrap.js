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
}

function vec(x, y) {
  return new Vector(x, y);
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
    element.appendChild(child);
  });
  return element;
}

function t(text) {
  return document.createTextNode(text);
}

// a better way: each name in an ARK object holds metadata and data about this slot
// obj.name.value <=> obj.send(name)
// set all other objects' prototypes as the warehouse, and add functions to the warehouse
// then the message menu is just Object.keys(obj).map(name => obj[name])...

const ARKObjectDoc = `
\`ARKObject\` is used to create objects in ARK.

An ARK object is a js object where each value is a "slot object",
with a value and metadata about the slot. 

Each slot is annotated with information, such as:

- a name 
- a **mandatory** markdown doc string
  - because why write a program if others can't understand it?
- a list of information about messages it understands
  - this is used to construct buttons

Any JS object can be annotated and transformed into an ARK object.
The original object is stored in the \`__original__\` field.

These are available at runtime, so users can view the documentation of any object when the program is running.

There are several essential messages that every ARK object must understand:

- get doc, returns the doc string of the object
- XEROX, clones the object
- messages, returns the list of messages the object understands

An interactor should also understand \`step\`, a message sent to it every tick.
`;

const PreARKObject = {
  new() {
    return Object.create(this);
  },
  addSlot(name, doc, value) {
    this.addMethod(name, "unary", doc, () => value);
    return this;
  },
  addSlotMut(name, getterDoc, setterDoc, value) {
    // crazy hack: store the value in a closure
    let store = value;
    this.addMethod(name, "unary", getterDoc, () => store);
    this.addMethod(`${name}:`, "keyword", setterDoc, function (v) {
      store = v;
      return this;
    });
    return this;
  },
  addMethod(name, type, doc, fn) {
    if (type !== "unary" && type !== "binary" && type !== "keyword") {
      throw new Error(
        `Invalid type: ${type}.\nAllowed types are "unary", "binary" and "keyword".`
      );
    }
    if (typeof fn !== "function") {
      throw new Error(`${fn} should be a function.`);
    }
    this[name] = { type, doc, value: fn.bind(this) };
    return this;
  },
  send(name, ...args) {
    if (!this[name]) {
      throw new Error(`Object does not understand message "${name}".`);
    }
    const type = this[name].type;
    if (type !== "unary" && type !== "binary" && type !== "keyword") {
      throw new Error(
        `Cannot send message "${name}" of type "${type}".\nAllowed types are "unary", "binary" and "keyword".`
      );
    }
    const arity =
      this[name].type === "unary"
        ? 0
        : this[name].type === "binary"
        ? 1
        : name.split(":").length - 1;

    if (args.length != arity) {
      throw new Error(`Expected ${arity} arguments, got ${args.length}.`);
    }
    return this[name].value(...args);
  },
};

function wrap(obj, objDoc, docs) {
  const wrapped = Object.create(PreARKObject);
  wrapped.__original__ = obj;
  wrapped.addSlot("doc", "The documentation of the object.", objDoc);
  Object.keys(docs).forEach((name) => {
    const metadata = docs[name];
    const methodName = name.split(":")[0];
    wrapped.addMethod(name, metadata.type, metadata.doc, obj[methodName]);
  });
  return wrapped;
}

const ARKObject = wrap(PreARKObject, ARKObjectDoc, {
  new: {
    type: "unary",
    doc: `Create a new ARK object.`,
  },
  "addSlot:doc:initially:": {
    type: "keyword",
    doc: `Add a slot to the ARK object with documentation and an initial value.`,
  },
  "addSlotMut:getterDoc:setterDoc:initially:": {
    type: "keyword",
    doc: `Add a mutable slot to the ARK object with documentation for a getter and a setter, and an initial value.`,
  },
  "addMethod:ofType:doc:fn:": {
    type: "keyword",
    doc: `Add a method to the ARK object with a type, documentation, and a function as its implementation.`,
  },
});

function logThis() {
  console.log(this);
}

const test1 = ARKObject.send("new").addMethod(
  "logThis",
  "unary",
  `A method that logs the "this" variable.`,
  logThis
);
test1.send("logThis");

const ARKVisualDoc = `
A Visual ARK object knows:
- its position in the world
- an HTML element to represent it

A Visual ARK object should also understand:

- vaporize, removes the object from the world
- get element, the HTML element representing the object
- get position, returns the position of the object as a Vector
- set position, sets the position of the object

`;

/*
The ARK world is an infinite 2D plane shown in a browser window.
A Viewport object manages the camera position and scale.
*/
const Viewport = {
  reset() {
    this.center = vec(0, 0);
    this.dimensions = vec(window.innerWidth, window.innerHeight);
    this.scalePercent = 100;
  },
  step() {
    this.dimensions = vec(window.innerWidth, window.innerHeight);
  },
  screenToWorld(screenPos) {
    return screenPos
      .sub(this.dimensions.div(2))
      .mul(100 / this.scalePercent)
      .add(this.center);
  },
  placeTo(el, position) {
    const screenPos = position
      .sub(this.center)
      .mul(this.scalePercent / 100)
      .add(this.dimensions.mul(1 / 2));
    if (
      screenPos.x + el.offsetWidth / 2 < 0 ||
      screenPos.x - el.offsetWidth / 2 > this.dimensions.x ||
      screenPos.y + el.offsetHeight / 2 < 0 ||
      screenPos.y - el.offsetHeight / 2 > this.dimensions.y
    ) {
      el.style.display = "none";
    } else {
      el.style.transform = `translate(-50%, -50%) scale(${
        this.scalePercent / 100
      })`;
      el.style.left = `${screenPos.x}px`;
      el.style.top = `${screenPos.y}px`;
      el.style.display = "block";
    }
  },
};
Viewport.reset();

/*
The ARK Warehouse gives you all other objects in the world.

You can spawn any registered ARK object using the objectMenu,
or spawn an eval button and run any code you want.
*/

/*
The ARK world updates the objects' positions and sends them \`step\` messages every frame.
*/

// a certificate of existence
class ARKTicket {
  constructor(world, obj) {
    this.world = world;
    this.obj = obj;
    this.permasending = false;
  }
  valid() {
    return this.world !== null;
  }
  throwIfInvalid() {
    if (!this.valid()) throw new Error("Cannot act on an invalid ticket");
  }
  remove() {
    this.throwIfInvalid();
    this.world.remove(this.obj);
    this.world = null;
  }
  toggle() {
    this.throwIfInvalid();
    this.world.toggle(this.obj);
    this.permasending = !this.permasending;
    return this.permasending;
  }
}
/*
Each browser window has one world.
*/
const ARKWorld = {
  tps: 40,
  tick: 0,
  running: false,
  objects: new Set(),
  interacting: new Set(),
  add(obj) {
    this.objects.add(obj);
    Viewport.placeTo(obj.element, obj.position);
    obj.root.appendChild(obj.element);
    return new ARKTicket(this, obj);
  },
  remove(obj) {
    if (this.interacting.has(obj)) {
      this.interacting.delete(obj);
    }
    this.objects.delete(obj);
    obj.root.removeChild(obj.element);
    return this;
  },
  toggle(obj) {
    if (this.interacting.has(obj)) {
      this.interacting.delete(obj);
    } else {
      this.interacting.add(obj);
    }
    return this;
  },
  step() {
    this.tick++;
    this.interacting.forEach((obj) => {
      obj.step(this.tick);
    });
    this.objects.forEach((obj) => {
      Viewport.placeTo(obj.element, obj.position);
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
};
