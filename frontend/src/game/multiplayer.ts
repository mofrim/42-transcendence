import * as THREE from 'three';

// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Remote_Player } from './remote_player.js';

import { PlayerState } from 'ftr-common/sharedTypes';
import type { Character } from 'ftr-common/sharedTypes';

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

        player.setNetworkPositionTarget(this.desired);
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
            player.updateNetworkPosition(lifecycleDelta);
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
            id,
            character,
            nickname,
            this.mesh_RP
        );
        this.players.set(newPlayer.id, newPlayer);
        this.scene.add(newPlayer.group);
    }
}
