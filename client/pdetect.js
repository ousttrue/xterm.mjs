// @ts-check
// https://polybaas.com/pbe/?D66nKnOoJ53uuv9kke1r

/**
 * @typedef {Object} PDetectProps
 * @property {number} count
 * @property {number} pf
 */

/**
 * @typedef {AFRAME.AComponent & PDetectProps} PDetect
 */

// WebXR Plane Detection Module sample component
AFRAME.registerComponent('pdetect', {
    /**
     * @this {PDetect}
     */
    init() {
        this.count = 0
    },

    /**
     * @this {PDetect}
     */
    tick() {
        const sc = this.el.sceneEl
        if (!sc) {
            return
        }
        const fr = /** @type {XRFrame} */ (sc.frame)
        if (!fr) return

        // 検知された面
        const p = (fr.detectedPlanes)
        if (!p) return
        if (p.size == this.count) return

        console.log(p.size)
        if (this.pf++ > 0) return
        const ref = sc.renderer.xr.getReferenceSpace()
        const pl = []
        p.forEach((/** @type {XRPlane} */ o) => {
            //面の向きのquaternionの取得
            const planePose = fr.getPose(o.planeSpace, ref)
            pl.push([o.polygon, planePose.transform.matrix])
        })
        setplanes(this.el.object3D, pl)
    },
})

/**
 * @param {THREE.Object3D<THREE.Object3DEventMap>} to
 * @param {any[]} pl
 */
function setplanes(to, pl) {
    console.log(pl.length)
    to.children = []
    pl.forEach(p => {
        const poly = p[0]
        const geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            poly[0].x, poly[0].y, poly[0].z,
            poly[1].x, poly[1].y, poly[1].z,
            poly[2].x, poly[2].y, poly[2].z,

            poly[2].x, poly[2].y, poly[2].z,
            poly[3].x, poly[3].y, poly[3].z,
            poly[4].x, poly[4].y, poly[4].z,
        ])
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        const material = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.FrontSide });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.matrix.elements = p[1];
        mesh.matrix.decompose(mesh.position, mesh.rotation, mesh.scale);
        mesh.renderOrder = -1;
        to.add(mesh)
    })
}
