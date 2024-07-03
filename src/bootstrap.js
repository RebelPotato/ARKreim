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

function t(text) {
  return document.createTextNode(text);
}

class Rectangle {
  constructor(center, dimensions) {
    this.center = center;
    this.dimensions = dimensions;
  }
  get topLeft() {
    return this.center.sub(this.dimensions.div(2));
  }
  get bottomRight() {
    return this.center.add(this.dimensions.div(2));
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

const ARKScope = {
  name: "ARKScope",
  define(name, property) {
    Object.defineProperty(this, name, property);
  },
  get prototype() {
    return Object.getPrototypeOf(this);
  },
  set prototype(proto) {
    Object.setPrototypeOf(this, proto);
  },
  assign(things) {
    Object.defineProperties(this, Object.getOwnPropertyDescriptors(things));
    return this;
  },
  extendAs(name) {
    return Object.create(this).assign({ name });
  },
  messages() {
    const acc = [];
    let obj = this;
    while (obj.name !== "ARKScope") {
      acc.push({ owner: obj, messages: obj.ownMessages() });
      obj = obj.prototype;
    }
    acc.push({ owner: obj, messages: obj.ownMessages() });
    return acc;
  },
  ownMessages() {
    // No state is hidden. To make a private state, use a closure.
    return Object.getOwnPropertyDescriptors(this);
  },
};

/*
The ARK viewport manages the camera position and scale.
*/
const ARKViewport = ARKScope.extendAs("ARKViewport")
  .assign({
    reset() {
      this.rect = new Rectangle(
        vec(0, 0),
        vec(window.innerWidth, window.innerHeight)
      );
      this.scalePercent = 100;
      return this;
    },
    step() {
      this.rect.dimensions = vec(window.innerWidth, window.innerHeight);
      return this;
    },
    screenToWorldPos(screenPos) {
      return screenPos
        .sub(this.rect.dimensions.div(2))
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

/*
The ARK world holds information about the visual system, so that:

- an element is added to an appropriate root at most once
- an ARK Object can know the object it is dropped on
- the ARK hand can know which object is picked up
*/

const ARKWorld = ARKScope.extendAs("ARKWorld").assign({
  objects: new Map(),
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
});

function smartElement(el) {
  el.defineProperty("rect", {
    get() {
      return new Rectangle(
        vec(
          this.offsetLeft + this.offsetWidth / 2,
          this.offsetTop + this.offsetHeight / 2
        ),
        vec(this.offsetWidth, this.offsetHeight)
      );
    },
  });
  el.moveToWorldPos = function (worldPos) {
    const screenPos = ARKViewport.worldToScreenPos(worldPos);
    if (
      screenPos.x + this.offsetWidth / 2 < 0 ||
      screenPos.x - this.offsetWidth / 2 > this.dimensions.x ||
      screenPos.y + this.offsetHeight / 2 < 0 ||
      screenPos.y - this.offsetHeight / 2 > this.dimensions.y
    ) {
      this.style.display = "none";
    } else {
      this.style.transform = `translate(-50%, -50%) scale(${
        this.scalePercent / 100
      })`;
      this.style.left = `${screenPos.x}px`;
      this.style.top = `${screenPos.y}px`;
      this.style.display = "block";
    }
  };
}

/*
An ARK Object is a js object, represented by an HTML element on the screen.
It belongs to the ARK world and the ARK hand can move it around.

It has a position vector, an element, and a pointer to the world.

Every ARK Object may move in the world, so to construct one, 
you need to define a moveTo method that moves the object to a new position.
*/

const ARKObject = ARKScope.extendAs("ARKObject").assign({
  new(name, element, position = vec(0, 0)) {
    return Object.create(this).assign({ name, element, position });
  },
  XEROX() {
    // this method clones a visual object,
    // so that two identical things with the same function appear on the screen
    // e.g. cloning the law of gravity
    const copy = this.prototype.extendAs(this.name).assign(this);
    copy.element = this.element.cloneNode(true);
    return copy;
  },
  vaporize() {
    this.world.remove(this);
  },
});

/*
The ARK button represents a function.
*/


/*
The ARK Timer updates the objects' positions and sends them \`step\` messages every frame.
*/

const ARKTimer = ARKScope.extendAs("ARKTimer").assign({
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
The ARK warehouse is the main object for spawning other objects.
It understands:

- add, registers a new object to add to the world
- objectList, returns a list of all objects to spawn
- objectMenu, creates a menu of objects to spawn
  - if the object is not an ARK object (its prototype is not ARKObject), an representation is created instead
*/

const ARKWarehouse = {
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
    return h(
      "div",
      {},
      this.objectList().map((obj) => {
        return h(
          "button",
          {
            onclick: `ARKWarehouse.spawn(${obj.name})`,
          },
          [t(obj.name)]
        );
      })
    );
  },
  spawn(obj) {
    return ARKWorld.add(obj.XEROX());
  },
};

/*
The ARK Warehouse gives you all other objects in the world.

You can spawn any registered ARK object using the objectMenu,
or spawn an eval button and run any code you want.
*/
