import * as THREE from 'three';

import { Capsule } from 'three/addons/math/Capsule.js';
import { Octree } from 'three/addons/math/Octree.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

import { MultiplayerManager } from './multiplayer.js';

import { io } from "socket.io-client";

export function startGame() {
    
    let player_id = null;

    const socket = io("http://10.12.11.3:3000");

    socket.on("connect", () => {
        console.log(socket.id);
        player_id = socket.id;
    });

    socket.on("player_connected", (id) => {
        console.log("someone joined:", id);
        multiplayer.spawnPlayer(id);
    });

    socket.on("player_disconnected", (id) => {
        console.log("someone left:", id);
        multiplayer.players.get(id).removePlayer()
    });

    socket.on("update", (data) => {
        if(multiplayer.players.get(data.id))
        {
            console.log("other player:", data.id, data.x, data.y, data.z, data.state);
            multiplayer.updateMultiplayerID(data.id, data.x, data.y, data.z, data.state);
        }
        else
        {
            console.log("someone new player joined:", data.id);
            multiplayer.spawnPlayer(data.id);
        }
    });

    function sendUpdate(x, y, z, state) {
        socket.emit("update", {
            x,
            y,
            z,
            state,
        });
    }

    let scene, renderer, camera, orbitControls;
    let group, followGroup, model, mixer, timer;
    let dirLight;

    let actions;

    const PI = Math.PI;
    const PI90 = Math.PI / 2;

    let playerOnFloor = false;
    const keyStates = {};
    const playerVelocity = new THREE.Vector3();
    const playerDirection = new THREE.Vector3();
    

    const capsuleMaterial = new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: true});

    const C1 = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), capsuleMaterial);
    const C2 = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), capsuleMaterial);
    const C3 = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), capsuleMaterial);
    const C4 = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), capsuleMaterial);
    const C5 = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), capsuleMaterial);

    const raycaster = new THREE.Raycaster();
    const dir = new THREE.Vector3();
    const rayPos = new THREE.Vector3();

    raycaster.far = 5.1; 



    const controls = {
        key: [ 0, 0 ],
        up: new THREE.Vector3( 0, 1, 0 ),
        rotate: new THREE.Quaternion(),
        current: 'Idle',
        fadeDuration: 0.5,
        runVelocity: 15,
        turnSmoothness: 4.0,

    };

    const colRad = 0.35;
    const colStartY = 0.35;
    const colEndY = 1;
    const playerCollider = new Capsule( new THREE.Vector3( 0, colStartY, 0 ), new THREE.Vector3( 0, colEndY, 0 ), colRad );
    const offset = ((colEndY - colStartY) / 2) + colRad;
    // apply lift
    playerCollider.translate(new THREE.Vector3(0, offset, 0));

    const worldOctree = new Octree();
    const octreeDelete = new Octree();
    const OctreeSpawn = new Octree();
    const GRAVITY = 30;
    const floors = [];

    let camDistance = 0;

    init();

    function init() {

        //const container = document.getElementById( 'container' );

        camera = new THREE.PerspectiveCamera( 50
            , window.innerWidth / window.innerHeight, 0.1, 100 );
        camera.position.set( 0, 2, -5 );
        const startV = new THREE.Vector3(0, 1, 0);
        camDistance = startV.distanceTo(camera.position);
        console.log("Distance " + camDistance);

        timer = new THREE.Timer();
        timer.connect( document );

        scene = new THREE.Scene();
        scene.background = new THREE.Color( 0x999999 );
        /* scene.fog = new THREE.Fog( 0x5b6470, 2, 30 ); */

        group = new THREE.Group();
        scene.add( group );

        followGroup = new THREE.Group();
        scene.add( followGroup );

        dirLight = new THREE.DirectionalLight( 0xffffff, 5 );
        // initial position (local to followGroup) - matches previous values
        dirLight.position.set( - 2, 5, - 3 );
        dirLight.castShadow = true;
        const cam = dirLight.shadow.camera;
        cam.top = cam.right = 15;
        cam.bottom = cam.left = -15;
        cam.near = 1;
        cam.far = 50;

        dirLight.shadow.mapSize.set( 4096, 4096 );
        followGroup.add( dirLight );
        followGroup.add( dirLight.target );

        // add a small ambient light to lift shadows slightly
        const ambientLight = new THREE.AmbientLight( 0xffffff, 2.0 );
        scene.add( ambientLight );

        //scene.add( new THREE.CameraHelper( cam ) );

        renderer = new THREE.WebGLRenderer( { antialias: true } );
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( window.innerWidth, window.innerHeight );
        renderer.setAnimationLoop( animate );
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.5;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        container.appendChild( renderer.domElement );

        orbitControls = new OrbitControls( camera, renderer.domElement );
        orbitControls.target.set( 0, 1, 0 );
        orbitControls.enableDamping = true;
        orbitControls.enablePan = false;
        orbitControls.enableZoom = false;
        orbitControls.maxPolarAngle = PI90 + 0.15//PI90 - .05;
        orbitControls.update();

        // EVENTS

        window.addEventListener( 'resize', onWindowResize );
        document.addEventListener( 'keydown', onKeyDown );
        document.addEventListener( 'keyup', onKeyUp );


        // DEMO

        /* new HDRLoader()
            .setPath( 'textures/equirectangular/' )
            .load( 'lobe.hdr', function ( texture ) {

                texture.mapping = THREE.EquirectangularReflectionMapping;
                scene.environment = texture;
                scene.environmentIntensity = 1.5;

                // loadModel();

            } ); */

        
        
        /* const plane = new THREE.Mesh(new THREE.BoxGeometry(5, 0.01, 5), new THREE.MeshStandardMaterial());
        plane.position.set(0, 0.0, 0);
        scene.add(plane); */

        const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 5), new THREE.MeshStandardMaterial());
        cube.position.set(3, 0, 0);
        const edges = new THREE.EdgesGeometry(cube.geometry, 50);
        const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x000000 })
        );
        floors.push(cube);
        cube.add(line);
        scene.add(cube);
        worldOctree.fromGraphNode( cube );  


        const cubeDelete = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 1), new THREE.MeshStandardMaterial({color: 0xff9999}));
        cubeDelete.position.set(-3, 0, -2);

        const cubeSpawn = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 1), new THREE.MeshStandardMaterial({color: 0x9999ff }));
        cubeSpawn.position.set(-3, 0, 2);

        scene.add(cubeDelete, cubeSpawn);
        octreeDelete.fromGraphNode( cubeDelete );
        OctreeSpawn.fromGraphNode( cubeSpawn );

        /* const cubeFloor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 10), new THREE.MeshStandardMaterial());
        cubeFloor.position.set(0, -1, 0);
        scene.add(cubeFloor);
        floors.push(cubeFloor);
        worldOctree.fromGraphNode( cubeFloor ); */

        scene.add(C1, C2, C3, C4, C5);
    }

    const multiplayer = new MultiplayerManager(scene);
    multiplayer.initMultiplayerTest();

    const loader = new GLTFLoader();

    function loadMesh(path, pos = [0, 0, 0]) {
        loader.load(path, (gltf) => {
            const obj = gltf.scene;

  
            obj.position.set(...pos);
            obj.traverse((child) => {
                if (child.isMesh) {
                    child.scale.set(3, 3, 3);
                    // outline
                    const edges = new THREE.EdgesGeometry(child.geometry, 50);
                    const line = new THREE.LineSegments(
                        edges,
                        new THREE.LineBasicMaterial({ color: 0x000000 })
                    );
                    child.add(line);

                    child.material = new THREE.MeshToonMaterial({
                        color: child.material.color,
                        gradientMap: texture
                    });

                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            // worldOctree.fromGraphNode( obj );
            scene.add(obj);
            //floors.push(obj);
            worldOctree.fromGraphNode( obj );
        });
    }


    //loadMesh('/glb/42WOBTest.glb', [0,0,0]);
    loadMesh('/glb/Floor.glb', [0,0,0]);


    const texture = new THREE.TextureLoader().load('/textures/gradientMaps/twoTone2.jpg');
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;

    function loadModel() {

        const loader = new GLTFLoader();
        loader.load( '/glb/MainCharacterTest.glb', function ( gltf ) {

            model = gltf.scene;
            
            group.add( model );
            model.rotation.y = PI;
            group.rotation.y = PI;
            
        
            model.traverse( function ( object ) {
                
                if ( object.isMesh ) {
                    
                    object.castShadow = true;
                    object.receiveShadow = true;
                    
                    if (object.material.name === "Outline") {
                        //console.log("OUTLINE MESH FOUND");
                        object.castShadow = false; // important: prevents shadow artifacts
                        return;
                    }
                    object.material = new THREE.MeshToonMaterial({
                        color: 0xffffff,
                        gradientMap: texture
                    });
                }

            } );


            const animations = gltf.animations;

            mixer = new THREE.AnimationMixer( model );

            actions = {
                Idle: mixer.clipAction( animations[ 0 ] ),
                Run: mixer.clipAction( animations[ 2 ] )
            };

            for ( const m in actions ) {

                actions[ m ].enabled = true;
                actions[ m ].setEffectiveTimeScale( 1 );
                if ( m !== 'Idle' ) actions[ m ].setEffectiveWeight( 0 );

            }

            actions.Idle.play();
            
            animate();

        } );

    }

    loadModel();
    

    
    let countC = 0;
    function testDirect(start, end, camPos){
        //countC++;    
        //if (countC % 50 == 0)
        //{
            //dir.subVectors(end, start) == (1, 3, 2)
            dir.subVectors(end, start).normalize();

            C1.position.copy(start);
            //C1.position.addScaledVector(dir, 0.5);

            C2.position.copy(camPos);
            //C2.position.addScaledVector(dir, 0.5);

            C3.position.copy(rayPos);
            C3.position.addScaledVector(dir, 1.0);

            C4.position.copy(rayPos);
            C4.position.addScaledVector(dir, 1.5);

            C5.position.copy(end);
            //C5.position.addScaledVector(dir, 0.5);
        //}
    }


    function CamCollisionAdjust(delta, start, end, direction){
        const distHit = start.distanceTo(end);
        //const distCam = start.distanceTo(camera.position);
        const newPos = start.clone().addScaledVector(direction.normalize(), distHit);
        //console.log("dist cam: " + distCam + " dist hit: " + distHit);
        camera.position.copy(newPos);
        /* if (distCam > distHit) {
            camera.position.addScaledVector(direction, -delta*8);
        } */

    }
    
    function CamColisionReset(delta, start, end, direction){
        const dist = start.distanceTo(end);

        const epsilon = 0.05;
        if (Math.abs(dist - camDistance) > epsilon) 
        {
            if (dist < camDistance) {
                //console.log("RESET 1");
                camera.position.addScaledVector(direction, delta*2);
            }
            if (dist > camDistance) {
                //console.log("RESET 2");
                camera.position.addScaledVector(direction, -delta*2);
            }
        }
    }

    function cameraCollisionRaycast(delta) {
        rayPos.copy(group.position);
        rayPos.y += 1;

        // will be the direction vector - pointing from rayPos to the camera.
        dir.subVectors(camera.position, rayPos).normalize();
        raycaster.set(rayPos, dir);
        raycaster.firstHitOnly = true;
        const hits = raycaster.intersectObject(floors[0], false);
        
        if (hits.length === 0)
            CamColisionReset(delta, rayPos, camera.position, dir);
        else{
            CamCollisionAdjust(delta, rayPos, hits[0].point, dir);
            testDirect(rayPos, hits[0].point, camera.position);
        }
        
    }


    function playerCollisions() {
        const result = worldOctree.capsuleIntersect( playerCollider );
        playerOnFloor = false;
        if ( result ) {
            // determine if the surface we bumped into is something we can stand on
            playerOnFloor = result.normal.y >= 0.15; // allow slopes up to ~81° but ignore sheer vertical walls
            if ( ! playerOnFloor ) {
                //console.log("WALL COLLISION");
                playerVelocity.addScaledVector( result.normal, - result.normal.dot( playerVelocity ) );
            }
            if ( result.depth >= 1e-10 ) {
                //console.log("FLOOR COLLISION");
                playerCollider.translate( result.normal.multiplyScalar( result.depth ) );
            }
        }
    }

    function onDeleteCollision() {
        const result = octreeDelete.capsuleIntersect( playerCollider );
        if( result ) {
            if(multiplayer.players.get(1)){
                console.log("DELETE COLLISION");
                multiplayer.players.get(1).removePlayer();
            }
        }
    }

    function onSpawnCollision() {
        const result = OctreeSpawn.capsuleIntersect( playerCollider );
        if( result ) {
            if(multiplayer.players.get(1) === undefined ){
                console.log("SPAWN COLLISION");
                multiplayer.spawnPlayer(1);
            }
        }
    }

    let count = 0;

    function updateCharacter( delta ) {

        const fade = controls.fadeDuration;
        const key = controls.key;
        const up = controls.up;
        const rotate = controls.rotate;
        //const azimuth = orbitControls.getAzimuthalAngle();
        const active = key[ 0 ] === 0 && key[ 1 ] === 0 ? false : true;
        const play = active ? 'Run' : 'Idle';

        // change animation
        if ( controls.current != play ) {

            //console.log("In Change");

            const current = actions[ play ];
            const old = actions[ controls.current ];
            controls.current = play;

            current.reset();
            current.weight = 1.0;
            current.stopFading();
            old.stopFading();
            // synchro if not idle
            if ( play !== 'Idle' ) 
                current.time = old.time * ( current.getClip().duration / old.getClip().duration );
            old._scheduleFading( fade, old.getEffectiveWeight(), 0 );
            current._scheduleFading( fade, current.getEffectiveWeight(), 1 );
            current.play();
        }

        // move object
        if ( controls.current !== 'Idle' ) {

            let damping = Math.exp( - 4 * delta ) - 1;
            if ( ! playerOnFloor ) {
                playerVelocity.y -= GRAVITY * delta;
                // small air resistance
                damping *= 0.01;
            }
            //console.log(damping);
            playerVelocity.addScaledVector( playerVelocity, damping );
            const deltaPosition = playerVelocity.clone().multiplyScalar( delta );
            playerCollider.translate( deltaPosition );
            playerCollisions();

            const newPos = new THREE.Vector3()
                .addVectors(playerCollider.start, playerCollider.end)
                .multiplyScalar(0.5) ;
            newPos.y -= offset;

            camera.position.add( newPos.clone().sub(group.position) );
            group.position.copy( newPos );
            
            // calculate camera direction and rotate input into world
            const dir = deltaPosition.normalize();
            const angle = unwrapRad( Math.atan2( dir.x, dir.z ) );
            rotate.setFromAxisAngle( up, angle );

            // smooth rotation toward camera/movement direction using slerp
            const t = 1 - Math.exp( -controls.turnSmoothness * delta );
            if ( isFinite( rotate.x ) && isFinite( rotate.y ) && isFinite( rotate.z ) && isFinite( rotate.w ) ) {
                rotate.normalize();
                group.quaternion.normalize();
                group.quaternion.slerp( rotate, t );
            } 
            else {
                group.quaternion.copy( rotate );
            }

            orbitControls.target.copy( newPos ).add( { x: 0, y: 1, z: 0 } );
            followGroup.position.copy( newPos ); 
        }

        if ( mixer ) mixer.update( delta );

        orbitControls.update();
        cameraCollisionRaycast(delta);

        onDeleteCollision();
        onSpawnCollision();

        let updateHZ = 1;
        count++;

        if (count % updateHZ == 0){
            sendUpdate(group.position.x, group.position.y, group.position.z, controls.current)
        }

    }

    function unwrapRad( r ) {

        return Math.atan2( Math.sin( r ), Math.cos( r ) );

    }

    function keyControls( deltaTime ) {
        // gives a bit of air control
        const speedDelta = deltaTime * controls.runVelocity;
        if ( keyStates[ 'KeyW' ] || keyStates[ 'ArrowUp' ] ) {
            playerVelocity.add( getForwardVector().multiplyScalar( speedDelta ) );
        }
        if ( keyStates[ 'KeyS' ] || keyStates[ 'ArrowDown' ] ) {
            playerVelocity.add( getForwardVector().multiplyScalar( - speedDelta ) );
        }
        if ( keyStates[ 'KeyA' ] || keyStates[ 'ArrowLeft' ] ) {
            playerVelocity.add( getSideVector().multiplyScalar( - speedDelta ) );
        }
        if ( keyStates[ 'KeyD' ] || keyStates[ 'ArrowRight' ] ) {
            playerVelocity.add( getSideVector().multiplyScalar( speedDelta ) );
        }
    }
    
    function getForwardVector() {
        camera.getWorldDirection( playerDirection );
        playerDirection.y = 0;
        playerDirection.normalize();
        return playerDirection;
    }

    function getSideVector() {
        camera.getWorldDirection( playerDirection );
        playerDirection.y = 0;
        playerDirection.normalize();
        playerDirection.cross( camera.up );

        return playerDirection;
    }

    function onKeyDown( event ) {

        keyStates[ event.code ] = true;
        const key = controls.key;
        switch ( event.code ) {
            case 'ArrowUp': case 'KeyW': key[ 0 ] = - 1; break;
            case 'ArrowDown': case 'KeyS': key[ 0 ] = 1; break;
            case 'ArrowLeft': case 'KeyA': key[ 1 ] = - 1; break;
            case 'ArrowRight': case 'KeyD': key[ 1 ] = 1; break;
        }
    }

    function onKeyUp( event ) {

        keyStates[ event.code ] = false;
        const key = controls.key;
        switch ( event.code ) {
            /* case 'ArrowUp': case 'KeyW': key[ 0 ] = 0; break;
            case 'ArrowDown': case 'KeyS': key[ 0 ] = 0; break;
            case 'ArrowLeft': case 'KeyA': key[ 1 ] = 0; break;
            case 'ArrowRight': case 'KeyD': key[ 1 ] = 0; break; */

            case 'ArrowUp': case 'KeyW': key[ 0 ] = key[ 0 ] < 0 ? 0 : key[ 0 ]; break;
            case 'ArrowDown': case 'KeyS': key[ 0 ] = key[ 0 ] > 0 ? 0 : key[ 0 ]; break;
            case 'ArrowLeft': case 'KeyA': key[ 1 ] = key[ 1 ] < 0 ? 0 : key[ 1 ]; break;
            case 'ArrowRight': case 'KeyD': key[ 1 ] = key[ 1 ] > 0 ? 0 : key[ 1 ]; break;
        }
    }

    function onWindowResize() {

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize( window.innerWidth, window.innerHeight );

    }

    function animate() {
        
        timer.update();
        const delta = timer.getDelta();

        keyControls( delta );

        updateCharacter( delta );

        renderer.render( scene, camera );

        multiplayer.updateMultiplayer(delta);

    }
}
