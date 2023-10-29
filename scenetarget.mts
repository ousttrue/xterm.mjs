import * as THREE from "three";

export default class SceneTarget {
    Scene: THREE.Scene;
    Camera: THREE.PerspectiveCamera;
    Target: THREE.WebGLRenderTarget<THREE.Texture>;
    constructor() {
        this.Scene = new THREE.Scene();
        this.Scene.background = new THREE.Color('pink');
        this.Camera = new THREE.PerspectiveCamera(75, 1,
            0.1, 1000);
        this.Camera.position.z = 5;

        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const cube = new THREE.Mesh(geometry, material);
        this.Scene.add(cube);

        this.Target = new THREE.WebGLRenderTarget(400, 300);
    }

    Update(w: number, h: number) {
        this.Target.setSize(w, h)
        this.Camera.aspect = w / h;
        this.Camera.updateProjectionMatrix();
    }
}
