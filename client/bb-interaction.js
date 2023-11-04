// @ts-check

class Pinch {
    /**
     * @param {THREE.Object3D} mover
     * @param {THREE.Object3D} target
     */
    constructor(mover, target) {
        this.mover = mover;
        this.target = target;
        this.target.matrixAutoUpdate = false;

        this.delta = this.mover.matrixWorld.clone();
        this.delta.invert();
        this.delta.multiply(this.target.matrixWorld);
    }

    update() {
        console.log('Pinch.update')
        this.target.matrix.multiplyMatrices(this.mover.matrixWorld, this.delta);
    }

    end() {
        this.target.matrixAutoUpdate = true;
    }
}

/**
 * @typedef {Object} HoverProps
 * @property {Set<string>} hits
 * @property {Map<string, Pinch>} pinch
 * @property {function} _update
 */

/**
 * @typedef {AFRAME.AComponent & HoverProps} Hover
 */

AFRAME.registerComponent("bb-interaction", {
    /**
     * @this Hover
     */
    init() {
        this.hits = new Set()
        this.pinch = new Map()

        this.el.addEventListener('bb-enter', evt => {
            // @ts-ignore
            const hand = /** @type {string} */ (evt.detail.hand);
            this.hits.add(hand)
            this._update()
        })
        this.el.addEventListener('bb-exit', evt => {
            // @ts-ignore
            const hand = /** @type {string} */ (evt.detail.hand);
            // @ts-ignore
            this.hits.delete(hand)
            this._update()
        })

        this.el.sceneEl?.addEventListener('pinchstarted', evt => {
            // @ts-ignore
            const hand = /** @type {string} */ (evt.detail.hand);
            if (this.hits.has(hand)) {
                this.pinch.set(hand, new Pinch(evt.detail.handElement.object3D, this.el.object3D));
                this._update()
            }
        })
        this.el.sceneEl?.addEventListener('pinchended', evt => {
            // @ts-ignore
            const hand = /** @type {string} */ (evt.detail.hand);
            if (this.pinch.has(hand)) {
                this.pinch.delete(hand);
                this._update()
            }
        })
    },

    /**
     * @this Hover
     */
    _update() {
        // console.log(this.hits.size)
        if (this.pinch.size > 0) {
            this.el.setAttribute('color', '#FF00FF')
        }
        else if (this.hits.size > 0) {
            this.el.setAttribute('color', '#FFFF00')
        }
        else {
            this.el.setAttribute('color', '#FFFFFF')
        }
    },

    /**
     * @this Hover
     */
    tick() {
        this.pinch.forEach(pinch => {
            pinch.update()
        })
    }
})

