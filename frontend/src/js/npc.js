import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class NPC {

    static gradientTexture = new THREE.TextureLoader().load('src/textures/gradientMaps/twoTone2.jpg');
    
    constructor(path, id, scene, defaultAnim = 0){
        this.scene = scene;
        this.id = id;
        this.model = null;
        this.group = new THREE.Group();
        this.mixer = null;
        this.actions = null;

        this.isLoaded = false;

        this.loadEnemyCharacter(path, defaultAnim);
    }

    loadEnemyCharacter(path, defaultAnim) {

        const loader = new GLTFLoader();
        //console.log("Enemy character loading...");

        loader.load(path, (gltf) => {

            this.model = gltf.scene;

            this.group.add(this.model);

            //model.position.set(x, y, z);
            //model.rotation.y = rot;

            this.model.traverse((object) => {

                if (object.isMesh) {

                    object.castShadow = true;
                    object.receiveShadow = true;

                    if (object.material.name === "Outline") {
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

            this.actions = {
                Idle: mix.clipAction( gltf.animations[ defaultAnim ] ),
                Run: mix.clipAction( gltf.animations[ 2 ] )
            };

            for ( const m in this.actions ) {
                this.actions[ m ].enabled = true;
                this.actions[ m ].setEffectiveTimeScale( 1 );
                if ( m !== 'Idle' ) 
                    this.actions[ m ].setEffectiveWeight( 0 );
            }

            this.actions.Idle.play();
            
            this.mixer = mix;
        });
        this.isLoaded = true;
    }

    unwrapRad( r ) {
        return Math.atan2( Math.sin( r ), Math.cos( r ) );
    }

    rotateCharacter(startPos, endPos){
        
        const rotate = new THREE.Quaternion();
        const up = new THREE.Vector3( 0, 1, 0 );

        const dir = new THREE.Vector3();
        dir.subVectors(endPos, startPos).normalize();

        const angle = this.unwrapRad( Math.atan2( dir.x, dir.z ) );
        rotate.setFromAxisAngle( up, angle );

        this.group.quaternion.copy(rotate);
    }

    updateAnimation( delta ){

        if(this.isLoaded && this.mixer != null && this.model != null)
            this.mixer.update(delta);
    }
}
