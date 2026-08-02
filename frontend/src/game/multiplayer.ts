import * as THREE from 'three';

// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Remote_Player } from './remote_player.js';

import { PlayerState, CharacterModel } from '@common/types';
import type { Character, GLBMesh } from '@common/types';

/**
 * all both gender
 * Typisiert die Modellpfade vollständig nach CharacterModel und behebt TS7053.
 */
const PLAYER_CHARACTER_MODELS: Readonly<Record<CharacterModel, string>> = {
    [CharacterModel.male]: '/glb/Male_Test.glb',
    [CharacterModel.female]: '/glb/Female_Test.glb',
};

function normalizeCharacter(character: Character): CharacterModel {
    return character ? CharacterModel.male : CharacterModel.female;
}

function getRemotePlayerModelPath(character: Character): string {
    return PLAYER_CHARACTER_MODELS[normalizeCharacter(character)];
}

export class MultiplayerManager {
    scene: THREE.Scene;
    mesh_RP: GLBMesh[];
    players: Map<string, Remote_Player>;
    count: number;
    desired: THREE.Vector3;
    old: THREE.Vector3;
    nx: number;
    ny: number;
    nz: number;
    step: number;

    constructor(scene: THREE.Scene, mesh_RP: GLBMesh[]) {
        this.scene = scene;
        this.mesh_RP = mesh_RP;

        this.players = new Map<string, Remote_Player>();

        this.count = 0;

        this.desired = new THREE.Vector3(0, 0, 0);
        this.old = new THREE.Vector3(0, 0, 0);
        this.nx = 0;
        this.ny = 0;
        this.nz = 0;
        this.step = 0;
    }

    initMultiplayerTest() {
        //const player1 = new Remote_Player('src/glb/MainCharacterTest.glb', 1, this.scene);
        /* const player2 = new Remote_Player('src/glb/SpidermanMeme.glb', 2, this.scene, 1);
        const player3 = new Remote_Player('src/glb/SpidermanMeme.glb', 3, this.scene, 1);
        const player4 = new Remote_Player('src/glb/SpidermanMeme.glb', 4, this.scene, 1); */
        /* this.loadEnemyCharacter('src/glb/MainCharacterTest.glb', 0,0,0, 0, 0, player1);

        this.loadEnemyCharacter('src/glb/SpidermanMeme.glb', 5.5, -0.1, 5,   1, 0, player2);
        this.loadEnemyCharacter('src/glb/SpidermanMeme.glb', 7,   -0.1, 6.5, 1, Math.PI*1.3, player3);
        this.loadEnemyCharacter('src/glb/SpidermanMeme.glb', 5.5, -0.1, 8,   1, Math.PI, player4); */
        /* player2.group.position.set(5.5, -0.1, 5);
        player3.group.position.set(7, -0.1, 6.5);
        player4.group.position.set(5.5, -0.1, 8);

        player2.group.rotation.y = 0;
        player3.group.rotation.y = Math.PI*1.3;
        player4.group.rotation.y = Math.PI;

        //this.players.set(player1.id, player1);
        this.players.set(player2.id, player2);
        this.players.set(player3.id, player3);
        this.players.set(player4.id, player4);

        this.scene.add(player2.group, player3.group, player4.group ); */
    }

    multiplayerMovement(
        player: Remote_Player,
        x: number,
        y: number,
        z: number,
        state: PlayerState
    ) {
        //console.log("ID 1 " + player.id + " to position: " + player.group.position.y.toFixed(4));
        player.animateSpawn(x, y, z);

        if (player.isSpawned) {
            const pos = player.group.position;

            this.old = new THREE.Vector3(pos.x, pos.y, pos.z);
            this.desired = new THREE.Vector3(x, y, z);
            player.state = state;

            this.nx = (this.old.x - this.desired.x) / 1;
            this.ny = (this.old.y - this.desired.y) / 1;
            this.nz = (this.old.z - this.desired.z) / 1;

            if (state === PlayerState.Run)
                player.rotateCharacter(this.desired, pos);

            pos.set(pos.x - this.nx, pos.y - this.ny, pos.z - this.nz);
        }
    }

    // FIXME is this function obsolete?
    updateMultiplayerID(
        id: string,
        x: number,
        y: number,
        z: number,
        state: PlayerState
    ) {
        const playe = this.players.get(id);
        //console.log("ID 1 " + playe.id + " to position: " + playe.group.position.y.toFixed(4) + " , y: " + y.toFixed(4));

        if (playe) {
            this.multiplayerMovement(playe, x, y, z, state);
        }
    }

    multiplayerMovementTest(player: Remote_Player) {
        const updateHZ = 50;
        this.count++;

        const pos = player.group.position;

        if (this.count % updateHZ == 0) {
            this.old = new THREE.Vector3(pos.x, pos.y, pos.z);

            if (this.step === 0) {
                this.desired = new THREE.Vector3(pos.x - 1.5, pos.y, pos.z);
                player.state = 'Run';
            }

            if (this.step === 1)
                this.desired = new THREE.Vector3(pos.x, pos.y, pos.z - 1.5);

            if (this.step === 2) {
                player.state = 'Idle';
                this.desired = new THREE.Vector3(pos.x, pos.y, pos.z);
            }

            if (this.step === 3) {
                player.state = 'Run';
                this.desired = new THREE.Vector3(pos.x + 1.5, pos.y, pos.z);
            }

            if (this.step === 4) {
                this.desired = new THREE.Vector3(pos.x, pos.y, pos.z + 1.5);
            }

            if (this.count % 100 == 0) this.step = (this.step + 1) % 5;

            this.nx = (this.old.x - this.desired.x) / updateHZ;
            this.ny = (this.old.y - this.desired.y) / updateHZ;
            this.nz = (this.old.z - this.desired.z) / updateHZ;

            player.rotateCharacter(this.desired, pos);
        }

        pos.set(pos.x - this.nx, pos.y - this.ny, pos.z - this.nz);
    }

    updateMultiplayer(delta: number) {
        for (const [id, player] of this.players) {
            if (player.mixer != null) player.updateAnimation(delta);
            //if(player.id == 1)
            //    this.multiplayerMovementTest(player);
            if (player && player.id === '-1') {
                player.destroy();
                this.players.delete(id);
            }
        }
    }

    spawnPlayer(
        id: string,
        character: Character = true,
        nickname: string = id
    ) {
        const existingPlayer = this.players.get(id);
        if (existingPlayer) {
            existingPlayer.setNickname(nickname);
            return;
        }

        //const newPlayer = new Remote_Player('src/glb/MainCharacterTest.glb', id, this.scene);
        //const newPlayer = new Remote_Player('glb/Male_Test.glb', id, this.scene);
        const newPlayer = new Remote_Player(
            getRemotePlayerModelPath(character),
            id,
            nickname,
            this.scene,
            this.mesh_RP
        );
        this.players.set(newPlayer.id, newPlayer);
        this.scene.add(newPlayer.group);
    }
}
