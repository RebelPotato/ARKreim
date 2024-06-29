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
  Object.keys(props).forEach((key) => {
    element.setAttribute(key, props[key]);
  });
  children.forEach((child) => {
    element.appendChild(child);
  });
  return element;
}

function t(text) {
  return document.createTextNode(text);
}

// a better way: each key in an ARK object holds metadata and data about this slot
// obj.key.value <=> obj.send(key)
// set all other objects' prototypes as the warehouse, and add functions to the warehouse
// then the message menu is just Object.keys(obj).map(key => obj[key])...

const ARKObjectDoc = `
An ARK object is a js object displayed in the world, annotated with information, such as:

- a name 
- a **mandatory** markdown doc string
  - because why write a program if others can't understand it?
- a list of information about messages it understands
  - this is used to construct buttons

A Visual ARK object also knows:
- its position in the world
- an HTML element to represent it

These are available at runtime, so users can view the documentation of any object when the program is running.

There are several essential messages that every ARK object must understand:

- get doc, returns the doc string of the object
- XEROX, clones the object
- messages, returns the list of messages the object understands

A Visual ARK object should also understand:

- vaporize, removes the object from the world
- get element, the HTML element representing the object
- get position, returns the position of the object as a Vector
- set position, sets the position of the object

An interactor should also understand \`step\`, a message sent to it every tick.
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
