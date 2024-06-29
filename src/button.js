const ARKMessageDoc = `
An ARK message is an ARK Object, but is **not** a *Visual* ARK Object. 
It describes a message that an ARK object can understand, 
and can be represented with a button (to run the message)
or an inspector (to inspect the message's methods).

It's receiver may have methods not registered as ARKMessages. 
They are considered private, and the messageMenu does not show them.
`;

class ARKMessage {
  constructor(type, name, arity, doc, func) {
    if (type !== "get" && type !== "set" && type !== "send") {
      throw new Error(
        `Cannot set message type to ${type}. Allowed types are "get", "set" and "send".`
      );
    }

    this.type = type;
    this.name = name;
    this.arity = arity;
    this.doc = doc;
    this.func = func;
    this.ownMessages = [
      new ARKMessage(
        "get",
        "type",
        `The ARKMessage's type ("get", "set" or "send").`,
        () => this.type
      ),
      new ARKMessage(
        "get",
        "name",
        `Names for each parameter of the ARKMessage.`,
        () => this.name
      ),
      new ARKMessage(
        "get",
        "arity",
        `The number of parameters the ARKMessage takes.`,
        () => this.name
      ),
      new ARKMessage(
        "get",
        "doc",
        `A **mandatory** markdown doc string describing the ARKMessage.`,
        () => this.doc
      ),
      new ARKMessage(
        "get",
        "func",
        "The function to call (binding the sendee to `this`) when this message is sent.",
        () => this.func
      ),
      new ARKMessage(
        "send",
        "messages",
        "A list of all messages the ARKMessage understands.",
        this.messages
      ),
      new ARKMessage("send", "XEROX", "Clone the ARKMessage.", this.XEROX),
    ];
  }
  messages() {
    return this.ownMessages;
  }
  XEROX() {
    return new ARKMessage(this.type, this.name, this.arity, this.doc, this.func);
  }
}

const ARKPlugDoc = `
An ARK Plug is a Visual ARK object that represents a connection from one ARK object to another.
It is drawn as a line from a source position to a target position.
`
class ARCPlug {
  constructor(world, source, target) {
    this.world = world;
    this.source = source;
    this.target = target;
    this.root = document.getElementById("lines");
    this.element = h("div", { class: "plug" }, []);
  }
}

const ARKButtonDoc = `
An ARK button is a Visual ARK object that represents an ARK message,
which is actually an js function annotated with information.

It may attach to an ARK object and send the message when clicked.
\`this\` is bound to the object the button attaches to.
If the button is not on any object, the function is run as-is.
`;

class ARKButton {
  constructor(world, message, obj) {
    this.world = world;
    this.message = message;
    this.obj = obj;

    const name = message.name;
    const params = message
      .split(":")
      .slice(0, -1)
      .map((s) => s + ":"); // "from:To:Do:" => ["from:", "To:", "Do:"]

    this.plugs = [];

    this.root = document.body;
    this.element = h(
      "button",
      { class: "button" },
      params
        .map((param) => h("p", {}, [t(param)]))
        .concat([h("p", {}, [t(name)])])
    );

    this.element.onclick = () => {
      if (this.obj) {
        this.message.func.bind(this.obj)();
      } else {
        this.message.func();
      }
    };
  }
}