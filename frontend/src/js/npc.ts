import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** ohne jump bisher */
type NPCAnimationActions = {
    Idle: THREE.AnimationAction;
    Run: THREE.AnimationAction;
};

export class NPC {

    static gradientTexture = new THREE.TextureLoader().load('src/textures/gradientMaps/twoTone2.jpg');

    scene: THREE.Scene;
    id: number;
    model: THREE.Group | null;
    group: THREE.Group;
    mixer: THREE.AnimationMixer | null;
    actions: NPCAnimationActions | null;
    isLoaded: boolean;

    constructor(path: string, id: number, scene: THREE.Scene, defaultAnim: number = 0){
        this.scene = scene;
        this.id = id;
        this.model = null;
        this.group = new THREE.Group();
        this.mixer = null;
        this.actions = null;

        this.isLoaded = false;

        this.loadEnemyCharacter(path, defaultAnim);
    }

    loadEnemyCharacter(path: string, defaultAnim: number): void {

        const loader = new GLTFLoader();
        //console.log("Enemy character loading...");

        loader.load(path, (gltf) => {

            this.model = gltf.scene;

            this.group.add(this.model);

            //model.position.set(x, y, z);
            //model.rotation.y = rot;

            this.model.traverse((object) => {

                if (object instanceof THREE.Mesh) {

                    object.castShadow = true;
                    object.receiveShadow = true;

                    if (!Array.isArray(object.material) && object.material.name === "Outline") {
                        object.material = new THREE.MeshBasicMaterial({
                            color: 0x000000
                        });
                        object.castShadow = false;
                        return;
                    }

                    object.material = new THREE.MeshToonMaterial({
                        color: 0xffffff,
                        gradientMap: NPC.gradientTexture
                    });
                }
            });

            const mix = new THREE.AnimationMixer(this.model);

            const actions: NPCAnimationActions = {
                Idle: mix.clipAction( gltf.animations[ defaultAnim ] ),
                Run: mix.clipAction( gltf.animations[ 2 ] )
            };
            this.actions = actions;

            for ( const [ m, action ] of Object.entries(actions) ) {
                action.enabled = true;
                action.setEffectiveTimeScale( 1 );
                if ( m !== 'Idle' )
                    action.setEffectiveWeight( 0 );
            }

            actions.Idle.play();

            this.mixer = mix;
        });
        this.isLoaded = true;
    }

    unwrapRad( r: number ): number {
        return Math.atan2( Math.sin( r ), Math.cos( r ) );
    }

    rotateCharacter(startPos: THREE.Vector3, endPos: THREE.Vector3): void {

        const rotate = new THREE.Quaternion();
        const up = new THREE.Vector3( 0, 1, 0 );

        const dir = new THREE.Vector3();
        dir.subVectors(endPos, startPos).normalize();

        const angle = this.unwrapRad( Math.atan2( dir.x, dir.z ) );
        rotate.setFromAxisAngle( up, angle );

        this.group.quaternion.copy(rotate);
    }

    updateAnimation( delta: number ): void {

        if(this.isLoaded && this.mixer != null && this.model != null)
            this.mixer.update(delta);
    }
}
