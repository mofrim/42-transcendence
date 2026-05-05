import * as THREE from 'three';

import { Octree } from 'three/addons/math/Octree.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

import { MultiplayerManager } from './multiplayer.js';
import { NPC } from './npc.js';
import { Player } from './player.js';
import { Camera } from './camera.js';

import { io } from "socket.io-client";

export function startGame() {

    // using a env-var or localhost here
    // TODO add env-var to dot-env
    const socket = io(import.meta.env.VITE_SOCKET_SERVER_URL || "http://localhost:3000");

    let player = null;
    let multiplayer = null;
    let camera = null;

    socket.on("connect", () => {
        console.log("Player ID: " + socket.id);
        if (player)
            player.id = socket.id;
    });

    socket.on("player_connected", (id) => {
        console.log("someone joined:", id);
        multiplayer.spawnPlayer(id);
    });

    socket.on("player_disconnected", (id) => {
        console.log("someone left:", id);
        multiplayer.players.get(id).removePlayer()
    });

    socket.on("disconnect", (reason) => {
        for (const [id, player] of multiplayer.players)
            multiplayer.players.get(id).removePlayer()

        console.log("Server Disconnect:", reason);
    });

    socket.on("update", (data) => {
        if (multiplayer.players.get(data.id)) {
            //console.log("other player:", data.id, data.x.toFixed(4), data.y.toFixed(4), data.z.toFixed(4), data.state);
            multiplayer.updateMultiplayerID(data.id, data.x, data.y, data.z, data.state);
        }
        else {
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

    let scene, renderer;
    let followGroup, timer;
    let dirLight;
    let dirLightLow;

    let npcs = new Map();

    const keyStates = {};

    const controls = {
        key: [0, 0],
    };

    const worldOctree = new Octree();
    const octreeDelete = new Octree();
    const OctreeSpawn = new Octree();

    const floors = [];

    let camDistance = 0;

    init();

    function init() {

        timer = new THREE.Timer();
        timer.connect(document);

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x999999);
        /* scene.fog = new THREE.Fog( 0x5b6470, 2, 30 ); */

        followGroup = new THREE.Group();
        scene.add(followGroup);

        dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
        // initial position (local to followGroup) - matches previous values
        //dirLight.position.set( - 2, 5, - 3 );
        dirLight.position.set(- 25, 15, - 15);
        dirLight.castShadow = true;
        const cam = dirLight.shadow.camera;
        cam.top = cam.right = 115;
        cam.bottom = cam.left = -115;
        cam.near = 1;
        cam.far = 50;
        /* dirLightLow = new THREE.DirectionalLight( 0xffffff, 2.5 );
        // initial position (local to followGroup) - matches previous values
        dirLightLow.position.set( - 2, 5, - 3 );
        dirLightLow.castShadow = true;
        const camLow = dirLightLow.shadow.camera;
        camLow.top = camLow.right = 15;
        camLow.bottom = camLow.left = -15;
        camLow.near = 1;
        camLow.far = 50; */

        dirLight.shadow.mapSize.set(16348, 16348);
        scene.add(dirLight);
        scene.add(dirLight.target);

        /* dirLightLow.shadow.mapSize.set( 1024, 1024 );
        followGroup.add( dirLightLow );
        followGroup.add( dirLightLow.target ); */

        // add a small ambient light to lift shadows slightly
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
        scene.add(ambientLight);

        //player = new Player('/glb/MainCharacterTest.glb', socket.id, scene, worldOctree);
        player = new Player('/glb/Male_Test.glb', socket.id, scene, worldOctree, 2);
        multiplayer = new MultiplayerManager(scene);
        multiplayer.initMultiplayerTest();

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        //renderer.setAnimationLoop( animate );
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.5;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        container.appendChild(renderer.domElement);

        camera = new Camera(window, renderer, floors);
        renderer.setAnimationLoop(animate);

        const startV = new THREE.Vector3(0, 1, 0);
        camDistance = startV.distanceTo(camera.camera.position);
        //console.log("Distance " + camDistance);

        // EVENTS

        window.addEventListener('resize', onWindowResize);
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        /* const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 5), new THREE.MeshStandardMaterial());
        cube.position.set(3, 0, 0);
        const edges = new THREE.EdgesGeometry(cube.geometry, 50);
        const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x000000 })
        );
        floors.push(cube);
        cube.add(line);
        scene.add(cube);
        worldOctree.fromGraphNode( cube );  */


        /* const cubeDelete = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 1), new THREE.MeshStandardMaterial({color: 0xff9999}));
        cubeDelete.position.set(-3, 0, -2);

        const cubeSpawn = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 1), new THREE.MeshStandardMaterial({color: 0x9999ff }));
        cubeSpawn.position.set(-3, 0, 2);

        scene.add(cubeDelete, cubeSpawn);
        octreeDelete.fromGraphNode( cubeDelete );
        OctreeSpawn.fromGraphNode( cubeSpawn ); */

        //initNPC();

        const plane = new THREE.Mesh(new THREE.BoxGeometry(35, 0.05, 35), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        plane.position.set(0, -0.025, 0);
        //const geometry = new THREE.PlaneGeometry(15, 15);
        //const material = new THREE.MeshToonMaterial({ color: 0xFFFFFF });
        //const plane = new THREE.Mesh(geometry, material);
        //plane.rotation.x = -Math.PI / 2;

        plane.receiveShadow = true;
        //scene.add(plane);
        worldOctree.fromGraphNode(plane);


        /* const dirLight1 = new THREE.DirectionalLight( 0xffffff, 2.5 );
        // initial position (local to followGroup) - matches previous values
        //dirLight.position.set( - 2, 5, - 3 );
        dirLight1.position.set( - 0.321, 2, - 0.321 );
        dirLight1.castShadow = true;
        const cam1 = dirLight1.shadow.camera;
        cam1.top = cam1.right = 15;
        cam1.bottom = cam1.left = -15;
        cam1.near = 1;
        cam1.far = 50;
        dirLight1.shadow.mapSize.set( 16348, 16348 );
        scene.add( dirLight1 );
        scene.add( dirLight1.target ); */



        /* const cubeFloor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 10), new THREE.MeshStandardMaterial());
        cubeFloor.position.set(0, -1, 0);
        scene.add(cubeFloor);
        floors.push(cubeFloor);
        worldOctree.fromGraphNode( cubeFloor ); */


    }


    const loader = new GLTFLoader();

    const texture = new THREE.TextureLoader().load('/textures/gradientMaps/twoTone2.jpg');
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;

    function loadMesh(path, pos = [0, 0, 0]) {
        loader.load(path, (gltf) => {
            const obj = gltf.scene;


            obj.position.set(...pos);
            obj.traverse((child) => {
                if (child.isMesh) {
                    floors.push(child);
                    child.scale.set(1.2, 1.2, 1.2);
                    // outline
                    const edges = new THREE.EdgesGeometry(child.geometry, 23);
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
            scene.add(obj);
            //floors.push(obj);
            worldOctree.fromGraphNode(obj);
        });
    }

    //loadMesh('/glb/42Sign.glb', [0,1,0]);

    loadMesh('/glb/42WOB_v2.glb', [0, 0, 0]);
    //loadMesh('/glb/Floor.glb', [0,0,0]);


    function initNPC() {

        const npc1 = new NPC('/glb/SpidermanMeme.glb', 2, scene, 1);
        const npc2 = new NPC('/glb/SpidermanMeme.glb', 3, scene, 1);
        const npc3 = new NPC('/glb/SpidermanMeme.glb', 4, scene, 1);


        npc1.group.position.set(5.5, -0.1, 5);
        npc2.group.position.set(7, -0.1, 6.5);
        npc3.group.position.set(5.5, -0.1, 8);

        npc1.rotateCharacter(npc1.group.position, npc2.group.position);
        npc2.rotateCharacter(npc2.group.position, npc3.group.position);
        npc3.rotateCharacter(npc3.group.position, npc1.group.position);

        scene.add(npc1.group, npc2.group, npc3.group);

        npcs.set(npc1.id, npc1);
        npcs.set(npc2.id, npc2);
        npcs.set(npc3.id, npc3);
    }

    function onDeleteCollision() {
        const result = octreeDelete.capsuleIntersect(player.playerCollider);
        if (result) {
            if (multiplayer.players.get(1)) {
                console.log("DELETE COLLISION");
                multiplayer.players.get(1).removePlayer();
            }
        }
    }

    function onSpawnCollision() {
        const result = OctreeSpawn.capsuleIntersect(player.playerCollider);
        if (result) {
            if (multiplayer.players.get(1) === undefined) {
                console.log("SPAWN COLLISION");
                multiplayer.spawnPlayer(1);
            }
        }
    }


    function keyControls(deltaTime) {
        // gives a bit of air control
        const speedDelta = deltaTime * player.controls.runVelocity;
        if (keyStates['KeyW'] || keyStates['ArrowUp']) {
            player.playerVelocity.add(player.getForwardVector(camera.camera).multiplyScalar(speedDelta));
        }
        if (keyStates['KeyS'] || keyStates['ArrowDown']) {
            player.playerVelocity.add(player.getForwardVector(camera.camera).multiplyScalar(- speedDelta));
        }
        if (keyStates['KeyA'] || keyStates['ArrowLeft']) {
            player.playerVelocity.add(player.getSideVector(camera.camera).multiplyScalar(- speedDelta));
        }
        if (keyStates['KeyD'] || keyStates['ArrowRight']) {
            player.playerVelocity.add(player.getSideVector(camera.camera).multiplyScalar(speedDelta));
        }
    }

    function onKeyDown(event) {

        keyStates[event.code] = true;
        const key = controls.key;
        player.controls.key = key;
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': key[0] = - 1; break;
            case 'ArrowDown': case 'KeyS': key[0] = 1; break;
            case 'ArrowLeft': case 'KeyA': key[1] = - 1; break;
            case 'ArrowRight': case 'KeyD': key[1] = 1; break;
        }
    }

    function onKeyUp(event) {

        keyStates[event.code] = false;
        const key = controls.key;
        player.controls.key = key;
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': key[0] = key[0] < 0 ? 0 : key[0]; break;
            case 'ArrowDown': case 'KeyS': key[0] = key[0] > 0 ? 0 : key[0]; break;
            case 'ArrowLeft': case 'KeyA': key[1] = key[1] < 0 ? 0 : key[1]; break;
            case 'ArrowRight': case 'KeyD': key[1] = key[1] > 0 ? 0 : key[1]; break;
        }
    }

    function onWindowResize() {

        camera.camera.aspect = window.innerWidth / window.innerHeight;
        camera.camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);

    }

    function animate() {

        timer.update();
        const delta = timer.getDelta();

        keyControls(delta);

        const prevPosition = new THREE.Vector3();
        prevPosition.copy(player.group.position);

        player.updateCharacter(delta);

        const deltaC = player.group.position.clone().sub(prevPosition);
        camera.camera.position.add(deltaC);

        camera.orbitControls.target.copy(player.group.position).add({ x: 0, y: 1, z: 0 });
        followGroup.position.copy(player.group.position);
        camera.orbitControls.update();

        onDeleteCollision();
        onSpawnCollision();

        camera.cameraCollisionRaycast(delta, player.group);

        renderer.render(scene, camera.camera);

        multiplayer.updateMultiplayer(delta);

        if (player.isSpawned)
            sendUpdate(player.group.position.x, player.group.position.y, player.group.position.z, player.controls.current)

        for (const [id, player] of npcs) {
            player.updateAnimation(delta);
        }
        //console.log("Player ID: " + player.id);
    }
}
