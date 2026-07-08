import * as THREE from 'three';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { Octree } from 'three/addons/math/Octree.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

import { MultiplayerManager } from './multiplayer.js';
import { NPC } from './npc.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { TTT_Game } from './ttt_game.js';
import { RPS_Game } from './rps_game.js';

import { io } from "socket.io-client";

/** all both gender */
const PLAYER_CHARACTER_MODELS = {
    true: '/glb/Male_Test.glb',
    false: '/glb/Female_Test.glb',
};

function normalizeCharacter(character) {
    if (typeof character === 'string') {
        const normalizedCharacter = character.toLowerCase();
        return normalizedCharacter !== 'false' && normalizedCharacter !== 'female';
    }

    return character !== false;
}

export function startGame(character = true) {

    character = normalizeCharacter(character);
    const playerModelPath = PLAYER_CHARACTER_MODELS[character];

    // for hard-coding socket addr, use:
    // const socket = io("http://192.168.1.116:3000");

    // should work in most cases. comment-out this & uncoment above otherwise
    const socket = io(import.meta.env.VITE_SOCKET_SERVER_URL || "http://localhost:3000", {
        auth: { character },
    });

    let player = null;
    let multiplayer = null;
    let camera = null;
    let tttGame = null;
    let rpsGame = null;

    socket.on("connect", () => {
        console.log("Your Player ID: " + socket.id);
        if (player) {
            player.id = socket.id;
            //tttGame.playerID = socket.id;
        }
    });

    socket.on("player_connected", (data) => {
        const id = typeof data === 'string' ? data : data.id;
        const character = typeof data === 'string' ? true : normalizeCharacter(data.character);

        console.log("someone joined:", id);
        if (id && multiplayer && !multiplayer.players.get(id))
            multiplayer.spawnPlayer(id, character);
    });

    socket.on("player_disconnected", (id) => {
        console.log("someone left:", id);
        const disconnectedPlayer = multiplayer.players.get(id);
        if (disconnectedPlayer)
            disconnectedPlayer.removePlayer()
    });

    socket.on("disconnect", (reason) => {
        for (const [id, player] of multiplayer.players)
            multiplayer.players.get(id).removePlayer()

        tttGame.endGame();
        console.log("Server Disconnect:", reason);
    });


    socket.on("initData", (data) => {
        console.log("Received initData from server.");
        tttGame.initGame(data);
    });

    socket.on("update", (data) => {
        //console.log("Received data:" + data.type + ":", data.state);
        //console.log("Received data:" + data.type);
        switch (data.type) {

            case "player_update":
                //console.log("Received player update:");
                handlePlayer(data);
                break;

            case "ttt_playerOne":
                tttGame.setPlayerOne(data.id);
                break;
            case "ttt_playerTwo":
                tttGame.setPlayerTwo(data.id);
                break;
            case "ttt_start":
                handleTTTstart(data);
                break;
            case "ttt_reset":
                tttGame.endGame();
                break;
            case "ttt_mark":
                //console.log("Marking: " + data.board);
                handleTTTupdate(data);
                break;
            case "ttt_win":
                //console.log("Marking: " + data.board);
                handleTTTwin(data);
                break;
            case "ttt_draw":
                //console.log("Marking: " + data.board);
                handleTTTdraw(data);
                break;


            case "rps_request":
                //console.log("RPS UPDATE");
                handleRPSRequest(data);
                break;
            case "rps_accept":
                //console.log("RPS UPDATE");
                handleRPSAccept(data);
                break;
            case "rps_decline":
                //console.log("RPS UPDATE");
                handleRPSDecline(data);
                break;

            case "rps_winner":
                //console.log("RPS Winner: " + data.winner);
                handleRPSWinner(data);
                break;
            case "rps_draw":
                //console.log("RPS Draw: " + data.playerOne + " and " + data.playerTwo);
                handleRPSDraw(data);
                break;
            case "rps_invalid":
                //console.log("RPS Invalid: " + data.playerOne + " and " + data.playerTwo);
                handleRPSInvalid(data);
                break;

            /* case "rps_choice":
                //console.log("RPS UPDATE");
                handleChoice(data);
                break; */

        }
    });

    function emitInitMap() {
        console.log("Emitting initData to server.");

        socket.emit("update", {
            type: "initData",
            id: socket.id
        });
    }

    function emitPosition(x, y, z, state) {
        //console.log("Received data:" + type);
        socket.emit("update", {
            type: "player_update",
            x,
            y,
            z,
            state,
            character,
        });
    }

    function emitBattleRequest(reqID) {
        //console.log("Received data:" + type);
        socket.emit("update", {
            type: "rps_request",
            id: socket.id,
            requestedPlayerID: reqID,
        });
    }

    function emitBattleAccept(reqID) {
        //console.log("Received data:" + type);
        socket.emit("update", {
            type: "rps_accept",
            id: socket.id,
            requestedPlayerID: reqID,
        });
    }

    function emitBattleDecline(reqID) {
        //console.log("Received data:" + type);
        socket.emit("update", {
            type: "rps_decline",
            id: socket.id,
            requestedPlayerID: reqID,
        });
    }

    function emitRPSInvalid() {
        socket.emit("update", {
            type: "rps_invalid",
        });
    }

    /* function emitBattleChoice(reqID, choice) {
        //console.log("Received data:" + type);
        socket.emit("update", {
            type: "rps_choice",
            id: socket.id,
            requestedPlayerID: reqID,
            choice: choice,
        });
    } */
    function emitBattleChoice(choice) {
        //console.log("Received data:" + type);
        socket.emit("update", {
            type: "rps_choice",
            id: socket.id,
            choice: choice,
        });
    }

    function emitTTTmark(obj) {
        //console.log("Received data:" + type);
        socket.emit("update", {
            type: "ttt_mark",
            fieldName: obj,
        });
    }

    function emitTTTstart() {
        //console.log("Received data:" + type);
        socket.emit("update", {
            type: "ttt_start",
        });
    }


    function handleRPSInvalid(data) {
        if (data.playerOne === player.id || data.playerTwo === player.id) {
            console.log("Invalid RPS choice received.");
            rpsGame.yourChoice = "";
            rpsGame.opponentChoice = "";

            //rpsGame.playChoiceAnimation = false;
            //rpsGame.solutionRPSAnimation();
            cancelAnimationFrame(rpsGame.animationLoop);
            rpsGame.solutionRPSAnimation();
        }
    }

    function handleRPSDraw(data) {
        console.log("RPS Draw: " + data.playerOne + " and " + data.playerTwo);

        if (data.playerOne === player.id || data.playerTwo === player.id) {
            console.log("The RPS game ended in a draw!");
            rpsGame.yourChoice = data.choice;
            rpsGame.opponentChoice = data.choice;

            cancelAnimationFrame(rpsGame.animationLoop);
            rpsGame.solutionRPSAnimation();
            /* if(rpsGame.playChoiceAnimation == false)
                rpsGame.solutionRPSAnimation();
            else
                rpsGame.playChoiceAnimation = false; */
        }
    }

    function handleRPSWinner(data) {
        if (data.winner === player.id) {
            console.log("You won the RPS game!");
            rpsGame.yourChoice = data.winnerChoice;
            rpsGame.opponentChoice = data.loserChoice;

            cancelAnimationFrame(rpsGame.animationLoop);
            rpsGame.solutionRPSAnimation();
            /* rpsGame.playChoiceAnimation = false;
            rpsGame.solutionRPSAnimation(); */
        }
        else if (data.loser === player.id) {
            console.log("You lost the RPS game!");
            rpsGame.yourChoice = data.loserChoice;
            rpsGame.opponentChoice = data.winnerChoice;

            cancelAnimationFrame(rpsGame.animationLoop);
            rpsGame.solutionRPSAnimation();
            /* rpsGame.playChoiceAnimation = false;
            rpsGame.solutionRPSAnimation(); */
        }
    }
    /* function handleChoice(data){
        if(data.requestedPlayerID !== player.id)
            return;

        rpsGame.opponentChoice = data.choice;
        console.log("Player " + data.id + " made a choice: " + data.choice);
    } */

    function handleRPSAccept(data) {
        if (data.requestedPlayerID !== player.id)
            return;

        rpsGame.readyForRequest = true;
        player.battleRequested = false;
        multiplayer.players.get(data.id).battleRequested = false;
        console.log("Battle accepted from player " + data.id);
        rpsGame.startRPSAnimation();
    }

    function handleRPSDecline(data) {
        if (data.requestedPlayerID !== player.id)
            return;

        rpsGame.readyForRequest = true;
        player.battleRequested = false;
        player.youSendRPGRequest = false;
        multiplayer.players.get(data.id).battleRequested = false;
        console.log("Battle declined from player " + data.id);
    }

    function handleRPSRequest(data) {
        //console.log("Marking 2: " + data.board);
        if (data.requestedPlayerID !== player.id)
            return;

        /* if(player.battleRequested){
            console.log("Player already in Request state, ignoring new request.");
            return;
        } */

        player.battleRequested = true;
        rpsGame.BattleRequest(data.id);
        //console.log("You accepted a battle with player " + rpsGame.playerInRange.id);
    }

    function handleTTTupdate(data) {
        //console.log("Marking 2: " + data.board);
        tttGame.markField(data.fieldName, data.id, data.mark);
    }

    function handleTTTstart(data) {
        tttGame.startGame(data.playerOne, data.playerTwo);
    }

    function handleTTTwin(data) {
        tttGame.drawWin(data.winner);
        tttGame.winner(data.id);
        tttGame.endGame();
    }

    function handleTTTdraw(data) {
        tttGame.draw();
        tttGame.endGame();
    }

    function handlePlayer(data) {
        // check if existing player/client, if not spawn new player
        if (multiplayer.players.get(data.id)) {
            //console.log("other player:", data.id, data.x.toFixed(4), data.y.toFixed(4), data.z.toFixed(4), data.state);
            multiplayer.updateMultiplayerID(data.id, data.x, data.y, data.z, data.state);
        }
        else {
            console.log("new player joined:", data.id);
            multiplayer.spawnPlayer(data.id, normalizeCharacter(data.character));
        }
    }

    let scene, renderer;
    let followGroup, timer;
    let dirLight;
    let dirLightLow;
    let composer;

    let npcs = new Map();

    const keyStates = {};

    const controls = {
        key: [0, 0],
    };

    const worldOctree = new Octree();
    const octreeDelete = new Octree();
    const OctreeSpawn = new Octree();

    const mesh_col = [];
    const mesh_RP = [];
    const tttBox = [];
    let tttStart = null;

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

        //player = new Player('glb/MainCharacterTest.glb', socket.id, scene, worldOctree);
        player = new Player(playerModelPath, socket.id, scene, worldOctree, 2);
        multiplayer = new MultiplayerManager(scene, mesh_RP);
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

        camera = new Camera(window, renderer, mesh_col);
        renderer.setAnimationLoop(animate);

        const startV = new THREE.Vector3(0, 1, 0);
        camDistance = startV.distanceTo(camera.camera.position);
        //console.log("Distance " + camDistance);

        // EVENTS

        window.addEventListener('resize', onWindowResize);
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        document.addEventListener('click', onClick);

        /* const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 5), new THREE.MeshStandardMaterial());
        cube.position.set(3, 0, 0);
        const edges = new THREE.EdgesGeometry(cube.geometry, 50);
        const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x000000 })
        );
        mesh_col.push(cube);
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
        mesh_col.push(cubeFloor);
        worldOctree.fromGraphNode( cubeFloor ); */

        tttGame = new TTT_Game(scene, player, tttBox, tttStart, renderer);
        rpsGame = new RPS_Game(scene, socket, player, multiplayer.players, renderer);

        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera.camera));
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.01,   // strength
            0.4,   // radius
            0.85   // threshold
        );
        composer.addPass(bloomPass);
    }




    const texture = new THREE.TextureLoader().load('textures/gradientMaps/twoTone2.jpg');
    const loader = new GLTFLoader();

    loadMesh('glb/42WOB_v3.glb', [0, 0, 0]);
    // const texture = new THREE.TextureLoader().load('textures/gradientMaps/twoTone2.jpg');

    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;

    function loadMesh(path, pos = [0, 0, 0]) {
        loader.load(path, (gltf) => {
            const obj = gltf.scene;

            //console.log("Adding collider for: " + obj.name);

            obj.position.set(...pos);
            obj.traverse((child) => {
                if (child.isMesh) {
                    if (!child.name.includes("NOCOL")) {
                        //console.log("Adding collider for: " + child.name);
                        mesh_col.push(child);
                    }

                    if (child.name.includes("TTT_Board"))
                        tttBox.push(child);
                    if (child.name.includes("TTT_Start"))
                        tttStart = child;

                    child.scale.set(1.15, 1.15, 1.15);


                    if (child.material.name === "Glass_mtl") {
                        child.material = new THREE.MeshToonMaterial({
                            color: 0xaaddff,
                            transparent: true,
                            opacity: 0.3
                        });
                        child.castShadow = false;
                        child.receiveShadow = false;

                    }
                    else if (child.material.name === "Glass_outside") {
                        child.material = new THREE.MeshToonMaterial({
                            color: 0xaaddff,
                            transparent: true,
                            opacity: 0.8
                        });
                        child.castShadow = false;
                        child.receiveShadow = false;

                    }
                    else if (child.material.name === "Glass_block") {
                        child.material = new THREE.MeshToonMaterial({
                            color: 0xaaddff,
                            transparent: false
                        });
                        child.castShadow = false;
                        child.receiveShadow = false;

                    }
                    else {
                        // outline
                        const edges = new THREE.EdgesGeometry(child.geometry, 50);
                        const line = new THREE.LineSegments(
                            edges,
                            new THREE.LineBasicMaterial({ color: 0x000000 })
                        );
                        child.add(line);

                        child.material = new THREE.MeshToonMaterial({
                            color: child.material.color,
                            map: child.material.map || null,
                            gradientMap: texture
                        });

                        child.castShadow = true;
                        child.receiveShadow = true;
                    }

                }
            });
            scene.add(obj);
            //mesh_col.push(obj);

            worldOctree.fromGraphNode(obj);
        });
    }

    function loadMeshTitel(path, pos = [0, 0, 0]) {
        loader.load(path, (gltf) => {
            const obj = gltf.scene;

            //console.log("Adding collider for: " + obj.name);

            obj.position.set(...pos);
            obj.traverse((child) => {
                if (child.isMesh) {
                    child.scale.set(1.15, 1.15, 1.15);


                    if (child.material.name === "Glass_mtl") {
                        child.material = new THREE.MeshToonMaterial({
                            color: 0xaaddff,
                            transparent: true,
                            opacity: 0.3
                        });
                        child.castShadow = false;
                        child.receiveShadow = false;

                    }
                    else if (child.material.name === "Glass_outside") {
                        child.material = new THREE.MeshToonMaterial({
                            color: 0xaaddff,
                            transparent: true,
                            opacity: 0.8
                        });
                        child.castShadow = false;
                        child.receiveShadow = false;

                    }
                    else if (child.material.name === "Glass_block") {
                        child.material = new THREE.MeshToonMaterial({
                            color: 0xaaddff,
                            transparent: true,
                            opacity: 1
                        });
                        child.castShadow = false;
                        child.receiveShadow = false;

                    }
                    else {
                        // outline
                        const edges = new THREE.EdgesGeometry(child.geometry, 50);
                        const line = new THREE.LineSegments(
                            edges,
                            new THREE.LineBasicMaterial({ color: 0x000000 })
                        );
                        child.add(line);

                        child.material = new THREE.MeshToonMaterial({
                            color: child.material.color,
                            map: child.material.map || null,
                            gradientMap: texture
                        });

                        child.castShadow = true;
                        child.receiveShadow = true;
                    }

                }
            });
            scene.add(obj);
            //mesh_col.push(obj);

            worldOctree.fromGraphNode(obj);
        });
    }

    //loadMesh('glb/42Sign.glb', [0,1,0]);

    //loadMesh('glb/42WOB_v3.glb', [0,0,0]);
    //loadMeshTitel('glb/Titelscreen_01.glb', [0,0,0]);
    //loadMesh('glb/Floor.glb', [0,0,0]);

    //tttGame.board = tttBox;

    function initNPC() {

        const npc1 = new NPC('glb/SpidermanMeme.glb', 2, scene, 1);
        const npc2 = new NPC('glb/SpidermanMeme.glb', 3, scene, 1);
        const npc3 = new NPC('glb/SpidermanMeme.glb', 4, scene, 1);


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

    function getTTTField(event) {
        let mousePosition = new THREE.Vector2();

        mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
        mousePosition.y = - (event.clientY / window.innerHeight) * 2 + 1;

        return mousePosition
    }

    function onPressAccept(event) {
        if (player.battleRequested) {

            player.battleRequested = false;
            rpsGame.playerInRange.battleRequested = false;
            rpsGame.removeText();
            if (rpsGame.battleRequestedPlayer) {
                console.log("Sending accept request to player " + rpsGame.battleRequestedPlayer);
                console.log("BATTLE START!");
                emitBattleAccept(rpsGame.battleRequestedPlayer);
                rpsGame.startRPSAnimation();
            }
            else
                console.log("Player ID empty, cannot send accept request.");
        }
        else {
            console.log("No battle request to accept.");
        }
    }

    function onPressDecline(event) {
        if (player.battleRequested) {

            player.battleRequested = false;
            rpsGame.playerInRange.battleRequested = false;
            rpsGame.removeText();
            if (rpsGame.battleRequestedPlayer) {
                console.log("Sending decline request to player " + rpsGame.battleRequestedPlayer);
                console.log("BATTLE DECLINED!");
                emitBattleDecline(rpsGame.battleRequestedPlayer);
            }
            else
                console.log("Player ID empty, cannot send decline request.");
        }
        else {
            console.log("No battle request to decline.");
        }
    }


    function rockKey(event) {
        if (rpsGame.rps_choiceMade)
            return;
        if (!player.inRPSBattleMode)
            return;
        if (!rpsGame.inBattleChooseMode)
            return;

        console.log("Rock key pressed");

        rpsGame.rps_choiceMade = true;
        //rpsGame.yourChoice = "rock";
        emitBattleChoice("rock");

        /* if(player.youSendRPGRequest && rpsGame.playerInRange.id){
            rpsGame.rps_choiceMade = true;
            rpsGame.yourChoice = "rock";
            emitBattleChoice(rpsGame.playerInRange.id, "rock");
        }
        else if(rpsGame.battleRequestedPlayer){
            rpsGame.rps_choiceMade = true;
            rpsGame.yourChoice = "rock";
            emitBattleChoice(rpsGame.battleRequestedPlayer, "rock");
        }
        else
            console.log("No player to send rock choice to."); */
    }

    function paperKey(event) {
        if (rpsGame.rps_choiceMade)
            return;
        if (!player.inRPSBattleMode)
            return;
        if (!rpsGame.inBattleChooseMode)
            return;

        console.log("Paper key pressed");

        rpsGame.rps_choiceMade = true;
        //rpsGame.yourChoice = "paper";
        emitBattleChoice("paper");

        /* if(player.youSendRPGRequest && rpsGame.playerInRange.id){
            rpsGame.rps_choiceMade = true;
            rpsGame.yourChoice = "paper";
            emitBattleChoice(rpsGame.playerInRange.id, "paper");
        }
        else if(rpsGame.battleRequestedPlayer){
            rpsGame.rps_choiceMade = true;
            rpsGame.yourChoice = "paper";
            emitBattleChoice(rpsGame.battleRequestedPlayer, "paper");
        }
        else
            console.log("No player to send paper choice to."); */
    }

    function scissorsKey(event) {
        if (rpsGame.rps_choiceMade)
            return;
        if (!player.inRPSBattleMode)
            return;
        if (!rpsGame.inBattleChooseMode)
            return;

        console.log("Scissors key pressed");

        rpsGame.rps_choiceMade = true;
        //rpsGame.yourChoice = "scissors";
        emitBattleChoice("scissors");

        /* if(player.youSendRPGRequest && rpsGame.playerInRange.id){
            rpsGame.rps_choiceMade = true;
            rpsGame.yourChoice = "scissors";
            emitBattleChoice(rpsGame.playerInRange.id, "scissors");
        }
        else if(rpsGame.battleRequestedPlayer){
            rpsGame.rps_choiceMade = true;
            rpsGame.yourChoice = "scissors";
            emitBattleChoice(rpsGame.battleRequestedPlayer, "scissors");
        }
        else
            console.log("No player to send scissors choice to."); */
    }


    function onPressB(event) {

        /* if(!rpsGame.inRange){
            console.log("No player in range to interact with.");
            return;
        }

        if(rpsGame.playerInRange.battleRequested){
            console.log("Player " + rpsGame.playerInRange.id + " is not ready for new battle.");
            return;
        }

        if(rpsGame.inBattleMode)
            return;

        player.youSendRPGRequest = true;
        console.log("Battle request send to player " + rpsGame.playerInRange.id);
        rpsGame.playerInRange.battleRequested = true; */

        if (!rpsGame.inRange) {
            console.log("No player in range to interact with.");
            return;
        }

        emitBattleRequest(rpsGame.playerInRange.id);
    }

    /* function onPressB ( event ) {

        if(!rpsGame.inRange){
            console.log("No player in range to interact with.");
            return;
        }

        if(rpsGame.playerInRange.battleRequested){
            console.log("Player " + rpsGame.playerInRange.id + " is not ready for new battle.");
            return;
        }

        if(rpsGame.inBattleMode)
            return;

        player.youSendRPGRequest = true;
        console.log("Battle request send to player " + rpsGame.playerInRange.id);
        rpsGame.playerInRange.battleRequested = true;
        emitBattleRequest(rpsGame.playerInRange.id);
    } */

    function onClick(event) {
        let mousePosition = getTTTField(event);

        const raycaster = new THREE.Raycaster();
        raycaster.far = 50.0;

        raycaster.setFromCamera(mousePosition, camera.camera);
        const hits = raycaster.intersectObjects(mesh_col, false);

        //console.log("hits.length: " + hits.length );

        if (hits.length > 0) {

            const hit = hits[0];
            //console.log("Clicked on TTT box:" + hits[0].object.name);
            //console.log("Clicked on: " + hits[0].object.name );
            if (hits[0].object.name.includes("TTT_Board")) {
                //tttGame.markField(hits[0].object.name, socket.id);
                emitTTTmark(hits[0].object.name);
                //console.log("Clicked on TTT box:" + hits[0].object.name);
            }
            else if (hits[0].object.name.includes("TTT_Start")) {
                //tttGame.startGame(socket.id);
                emitTTTstart();
                //console.log("Clicked on TTT box:" + hits[0].object.name);
            }

            // handle tic tac toe box click, e.g. send move to server
        }

        // const hitsRP = raycaster.intersectObjects(mesh_RP, true);
        // console.log("hitsRP.length: " + hitsRP.length , " , mesh_RP length: " + mesh_RP.length);

        mesh_RP.forEach(o => {
            console.log(o.name, o.isMesh);
        });

        if (hitsRP.length > 0) {
            const hit = hits[0];
            console.log("Clicked on PLAYER:" + hits[0].object.name);
        }
    }

    function onKeyDown(event) {

        keyStates[event.code] = true;
        const key = controls.key;
        player.controls.key = key;
        //console.log("Key pressed: " + event.code);
        switch (event.code) {
            // movement keys
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
            // movement keys
            case 'ArrowUp': case 'KeyW': key[0] = key[0] < 0 ? 0 : key[0]; break;
            case 'ArrowDown': case 'KeyS': key[0] = key[0] > 0 ? 0 : key[0]; break;
            case 'ArrowLeft': case 'KeyA': key[1] = key[1] < 0 ? 0 : key[1]; break;
            case 'ArrowRight': case 'KeyD': key[1] = key[1] > 0 ? 0 : key[1]; break;

            // battle request keys
            case 'KeyB': onPressB(event); break;
            case 'KeyZ': case 'KeyY': onPressAccept(event); break;
            case 'KeyX': onPressDecline(event); break;

            case 'Numpad1': case 'Digit1': rockKey(event); break;
            case 'Numpad2': case 'Digit2': paperKey(event); break;
            case 'Numpad3': case 'Digit3': scissorsKey(event); break;
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

        if (tttGame.tttCamera)
            camera.orbitControls.target.copy(player.group.position).add({ x: 0, y: 1.75, z: 0 });
        else
            camera.orbitControls.target.copy(player.group.position).add({ x: 0, y: 1, z: 0 });
        followGroup.position.copy(player.group.position);
        camera.orbitControls.update();

        onDeleteCollision();
        onSpawnCollision();

        camera.cameraCollisionRaycast(delta, player.group);

        renderer.clear();
        renderer.render(scene, camera.camera);
        tttGame.render();
        rpsGame.render();

        multiplayer.updateMultiplayer(delta);

        if (player.isSpawned)
            emitPosition(player.group.position.x, player.group.position.y, player.group.position.z, player.controls.current)

        rpsGame.updateCheck();

        for (const [id, player] of npcs) {
            player.updateAnimation(delta);
        }
        //console.log("Player ID: " + player.id);
        //composer.render()
    }
}
