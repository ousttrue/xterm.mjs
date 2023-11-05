const MAP = {
  'a': 0,
  'b': 1,
  'c': 2,
  'd': 3,
  'e': 4,
  'f': 5,
  'g': 6,
  'h': 7,
  'i': 8,
  'j': 9,
  'k': 10,
  'l': 11,
  'm': 12,
  'n': 13,
  'o': 14,
  'p': 15,
  'q': 16,
  'r': 17,
  's': 18,
  't': 19,
  'u': 20,
  'v': 21,
  'w': 22,
  'x': 23,
  'y': 24,
  'z': 25,
}

class BoxManager {
  boxies: HTMLElement[]
  lastBox: HTMLElement | null = null;

  constructor(component: AFRAME.AComponent) {
    this.boxies = []
    const scene = /** @type AFRAME.AEntity */ (component.el.sceneEl);
    const size = component.data.size;
    let i = 0;
    for (let x = -1; x <= 1; x += 0.5) {
      for (let y = 0; y <= 2; y += 0.5) {
        for (let z = -2; z <= 0; z += 0.5, ++i) {
          const box = document.createElement("a-box");
          this.boxies.push(box)
          box.setAttribute("width", size);
          box.setAttribute("height", size);
          box.setAttribute("depth", size);
          box.setAttribute("position", `${x} ${y} ${z}`);

          box.setAttribute('bb-hittest', '')
          box.setAttribute('bb-interaction', '')

          scene.appendChild(box);
        }
      }
    }

    document.body.addEventListener('keydown', (e) => this.onKeyDown(e));
  }

  onKeyDown(e) {
    if (this.lastBox) {
      this.lastBox.setAttribute('color', 'white');
    }
    const i = MAP[e.key];
    const box = this.boxies[i];
    // console.log(e, i, box);
    if (box) {
      box.setAttribute('color', 'red');
    }
    this.lastBox = box;
  }
}

// @ts-check
AFRAME.registerComponent("boxes", {
  schema: {
    size: { default: 0.08 },
  },

  init() {
    this.impl = new BoxManager(this);
  },
});
