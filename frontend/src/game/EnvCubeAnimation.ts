import * as THREE from 'three';

export class EnvCubeAnimation {
    private cubes: {
        mesh: THREE.Mesh;
        t: number;
        size: number;
    }[] = [];

    private readonly height = THREE.MathUtils.randFloat(30, 45);
    private readonly speed = THREE.MathUtils.randFloat(0.04, 0.08);
    private readonly rotationSpeed = THREE.MathUtils.randFloat(0.2, 0.9);

    constructor(
        private scene: THREE.Scene,
        private startPosition: THREE.Vector3,
        private cubeCount: number
    ) {
        this.createCubes(this.cubeCount);
    }

    private createCubes(count: number) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);

        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
        });

        const outlineMaterial = new THREE.LineBasicMaterial({
            color: 0x000000,
        });

        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(geometry, material);

            const edges = new THREE.EdgesGeometry(geometry, 50);

            const line = new THREE.LineSegments(edges, outlineMaterial);

            mesh.add(line);

            mesh.position.copy(this.startPosition);

            mesh.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );

            this.cubes.push({
                mesh,
                t: i / count,
                size: THREE.MathUtils.randFloat(1, 5),
            });

            this.scene.add(mesh);
        }
    }

    update(deltaTime: number) {
        for (const cube of this.cubes) {
            cube.t += this.speed * deltaTime;

            // Restart
            if (cube.t >= 1) {
                cube.t = 0;
            }

            const t = cube.t;

            const movement = t;

            cube.mesh.position.set(
                this.startPosition.x,
                this.startPosition.y + movement * this.height,
                this.startPosition.z
            );

            cube.mesh.rotation.x += this.rotationSpeed * deltaTime;

            cube.mesh.rotation.y += this.rotationSpeed * 0.7 * deltaTime;

            cube.mesh.rotation.z += this.rotationSpeed * 0.5 * deltaTime;

            // Stays bigger at first,
            // shrinks more near the end
            const scale = Math.pow(1 - t, 0.5);

            cube.mesh.scale.setScalar(cube.size * scale);
        }
    }
}
