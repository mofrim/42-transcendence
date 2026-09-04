import * as THREE from 'three';

// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Remote_Player } from './remote_player.js';
import { getPlayerModelPath } from './Assets.js';

import { PlayerState } from 'common/sharedTypes';
import type { Character } from 'common/sharedTypes';

export class MultiplayerManager {
    scene: THREE.Scene;
    mesh_RP: THREE.Mesh[];
    players: Map<string, Remote_Player>;
    private readonly departingPlayers: Set<Remote_Player>;
    private disposePromise: Promise<void> | null;
    private disposed: boolean;
    private readonly desired: THREE.Vector3;

    constructor(scene: THREE.Scene, mesh_RP: THREE.Mesh[]) {
        this.scene = scene;
        this.mesh_RP = mesh_RP;

        this.players = new Map<string, Remote_Player>();
        this.departingPlayers = new Set<Remote_Player>();
        this.disposePromise = null;
        this.disposed = false;

        this.desired = new THREE.Vector3();
    }

    // initMultiplayerTest() {
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
    // }

    multiplayerMovement(
        player: Remote_Player,
        x: number,
        y: number,
        z: number,
        state: PlayerState
    ) {
        //console.log("ID 1 " + playe.id + " to position: " + playe.group.position.y.toFixed(4) + " , y: " + y.toFixed(4));
        //if(player.id == 1)
        //    this.multiplayerMovementTest(player);
        //console.log("ID 1 " + player.id + " to position: " + player.group.position.y.toFixed(4));
        player.state = state;

        if (!player.isSpawned) {
            player.animateSpawn(x, y, z);
            return;
        }

        const pos = player.group.position;

        this.desired.set(x, y, z);

        if (state === PlayerState.Run)
            player.rotateCharacter(this.desired, pos);

        pos.copy(this.desired);
    }

    private trackDepartingPlayer(player: Remote_Player): Promise<void> {
        this.departingPlayers.add(player);
        const completion = player.startDespawn();

        void completion.then(() => {
            this.departingPlayers.delete(player);
        });

        return completion;
    }

    removePlayer(id: string): Promise<void> | null {
        const player = this.players.get(id);
        if (!player) {
            return null;
        }

        this.players.delete(id);
        return this.trackDepartingPlayer(player);
    }

    removeAllPlayers(): Promise<void> {
        const completions: Promise<void>[] = [];

        for (const id of [...this.players.keys()]) {
            const completion = this.removePlayer(id);
            if (completion) {
                completions.push(completion);
            }
        }

        return Promise.all(completions).then(() => undefined);
    }

    updateMultiplayer(
        animationDelta: number,
        lifecycleDelta: number = animationDelta
    ): void {
        if (this.disposed) {
            return;
        }

        for (const [id, player] of this.players) {
            if (!player.isActive()) {
                this.players.delete(id);
                this.trackDepartingPlayer(player);
                continue;
            }

            player.updateLifecycle(lifecycleDelta);
            player.updateAnimation(animationDelta);
        }

        for (const player of this.departingPlayers) {
            player.updateLifecycle(lifecycleDelta);
            if (player.lifecycleState === 'disposed') {
                this.departingPlayers.delete(player);
            }
        }
    }

    dispose(): Promise<void> {
        if (this.disposePromise) {
            return this.disposePromise;
        }

        this.disposed = true;
        const ownedPlayers = new Set<Remote_Player>([
            ...this.players.values(),
            ...this.departingPlayers,
        ]);
        this.players.clear();
        this.departingPlayers.clear();

        this.disposePromise = Promise.all(
            [...ownedPlayers].map((player) => player.forceDispose())
        ).then(() => undefined);

        return this.disposePromise;
    }

    spawnPlayer(
        id: string,
        character: Character = true,
        nickname: string = id
    ): void {
        if (this.disposed) {
            return;
        }

        const existingPlayer = this.players.get(id);
        if (existingPlayer) {
            if (existingPlayer.isActive()) {
                existingPlayer.setNickname(nickname);
                return;
            }

            this.players.delete(id);
            this.trackDepartingPlayer(existingPlayer);
        }

        const newPlayer = new Remote_Player(
            getPlayerModelPath(character),
            id,
            nickname,
            this.scene,
            this.mesh_RP
        );
        this.players.set(newPlayer.id, newPlayer);
        this.scene.add(newPlayer.group);
    }
}
