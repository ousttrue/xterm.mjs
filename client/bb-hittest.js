// @ts-check

const INDEX_TIP_INDEX = 9;

class HitStatus {
    isEnter = false;

    /**
     * @param {AFRAME.AEntity} el
     */
    constructor(el) {
        this.el = el
    }

    /**
     * @param {THREE.Box3} bb
     * @param {THREE.Vector3} positionWorld
     * @return {{updated: boolean, isEnter: boolean}}
     */
    test(bb, positionWorld) {
        // world
        const p = positionWorld.clone();
        // to local
        p.applyMatrix4(this.el.object3D.matrixWorld.clone().invert());

        const isEnter = bb.containsPoint(p);
        const updated = this.isEnter != isEnter;
        this.isEnter = isEnter;
        return { updated, isEnter }
    }
}

/**
 * @typedef {Object} HitTestProps
 * @property {THREE.Box3} bb
 * @property {Map<any, HitStatus>} statusMap
 * @property {function} _test
 */

/**
 * @typedef {AFRAME.AComponent & HitTestProps} HitTest
 */

AFRAME.registerComponent("bb-hittest", {

    /**
     * @this HitTest
     */
    init() {
        this.statusMap = new Map();

        const sceneEl = /** @type {AFRAME.AEntity} */ (this.el.sceneEl);
        const p = new THREE.Vector3()
        sceneEl.addEventListener('handposeupdated',
            evt => {
                // 41, 42, 43
                // @ts-ignore
                p.fromArray(evt.detail.jointPoses, INDEX_TIP_INDEX * 16 + 12)
                // @ts-ignore
                this._test(evt.detail.hand, p);
            });
    },

    /**
     * @this HitTest
     * @param {string} hand
     * @param {THREE.Vector3} positionWorld
     */
    _test(hand, positionWorld) {
        if (!this.bb) {
            const obj = this.el.object3D;
            // @ts-ignore
            const geom = /** @type {THREE.BufferGeometry} */ (obj.children[0].geometry);
            geom.computeBoundingBox();
            const bb = /** @type {THREE.Box3} */ (geom.boundingBox);
            this.bb = bb.clone();
        }

        let status = this.statusMap.get(hand);
        if (!status) {
            console.log('new HitStatus')
            status = new HitStatus(this.el)
            this.statusMap.set(hand, status);
        }

        const { updated, isEnter } = status.test(this.bb, positionWorld)
        if (updated) {
            if (isEnter) {
                this.el.emit('bb-enter', { hand, handElement: this.el.object3D });
            }
            else {
                this.el.emit('bb-exit', { hand });
            }
        }
    }
})

