import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { NPCState } from 'ftr-common/sharedTypes';
import { IMG_GRADIENT, MODEL_NPC } from './Assets.js';
import {
    CHAT_BUBBLE_HEIGHT,
    CHAT_BUBBLE_PREFIX,
    CHAT_BUBBLE_SCALE,
    CHAT_BUBBLE_SIZE,
    FloatingTextSprite,
} from './FloatingTextSprite.js';
import type { TokenQuestFrontdesk } from './QuestToken.js';

const ENTRY_NPC_CHAT_BUBBLE_TEXTS = [
    `${CHAT_BUBBLE_PREFIX}The Event Space opens after finishing evaluation`,
    `${CHAT_BUBBLE_PREFIX}Letting someone in without a token is not allowed`,
    `${CHAT_BUBBLE_PREFIX}I must evaluate before Blackhole`,
] as const;

/** ohne jump bisher */
type NPCAnimationActions = {
    Idle: THREE.AnimationAction;
    Run: THREE.AnimationAction;
};

const NPC_LOADER = new GLTFLoader();

export class NPC {
    static gradientTexture = (() => {
        const texture = new THREE.TextureLoader().load(IMG_GRADIENT);
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        return texture;
    })();

    scene: THREE.Scene;
    id: number;
    model: THREE.Group | null;
    group: THREE.Group;
    mixer: THREE.AnimationMixer | null;
    actions: NPCAnimationActions | null;

    constructor(
        path: string,
        id: number,
        scene: THREE.Scene,
        animation: NPCState
    ) {
        this.scene = scene;
        this.id = id;
        this.model = null;
        this.group = new THREE.Group();
        this.mixer = null;
        this.actions = null;

        this.loadEnemyCharacter(path, animation);
    }

    loadEnemyCharacter(path: string, animation: string): void {
        //console.log("Enemy character loading...");

        NPC_LOADER.load(path, (gltf) => {
            this.model = gltf.scene;

            this.group.add(this.model);

            //model.position.set(x, y, z);
            //model.rotation.y = rot;

            const meshes = this.model.getObjectsByProperty(
                'isMesh',
                true
            ) as THREE.Mesh[];
            for (const object of meshes) {
                object.castShadow = true;
                object.receiveShadow = true;

                const material = object.material as THREE.MeshStandardMaterial;

                // console.log("Material name: ", material.name);

                if (material.name === 'Outline') {
                    // console.log("OUTLINE MESH FOUND");
                    object.material = new THREE.MeshBasicMaterial({
                        color: 0x000000,
                    });
                    object.castShadow = false; // important: prevents shadow artifacts
                    continue;
                }
                // console.log("Material NOT OUTLINE: ");
                object.material = new THREE.MeshToonMaterial({
                    color: material.color,
                    gradientMap: NPC.gradientTexture,
                });
            }

            const mix = new THREE.AnimationMixer(this.model);

            /* for (const clip of gltf.animations) {
                console.log("NPC has animation:", clip.name);
            } */

            const clip = THREE.AnimationClip.findByName(
                gltf.animations,
                animation
            );

            if (!clip) {
                console.warn(`NPC Animation "${animation}" not found`);
                return;
            }

            const action = mix.clipAction(clip);

            action.play();

            const random = THREE.MathUtils.randFloat(0.8, 1.2);

            action.setEffectiveTimeScale(random);
            action.setEffectiveWeight(1);

            this.mixer = mix;
        });
    }

    updateAnimation(delta: number): void {
        this.mixer?.update(delta);
    }
}

export class NPCManager {
    private readonly scene: THREE.Scene;
    private readonly tokenQuestFrontdesk: TokenQuestFrontdesk;
    private readonly npcs = new Map<number, NPC>();

    constructor(scene: THREE.Scene, tokenQuestFrontdesk: TokenQuestFrontdesk) {
        this.scene = scene;
        this.tokenQuestFrontdesk = tokenQuestFrontdesk;
    }

    initialize(): void {
        const entry1 = new NPC(MODEL_NPC, 2, this.scene, NPCState.Nod);
        const entry2 = new NPC(MODEL_NPC, 3, this.scene, NPCState.Talking_2);
        const entry3 = new NPC(MODEL_NPC, 4, this.scene, NPCState.Nod);

        entry1.group.position.set(6.5, 0, 1);
        entry2.group.position.set(8, 0, 1.5);
        entry3.group.position.set(6.5, 0, 2.5);

        entry1.group.lookAt(entry2.group.position);
        entry2.group.lookAt(entry3.group.position);
        entry3.group.lookAt(entry2.group.position);

        this.scene.add(entry1.group, entry2.group, entry3.group);

        this.addChatBubble(entry1, ENTRY_NPC_CHAT_BUBBLE_TEXTS[0]);
        this.addChatBubble(entry2, ENTRY_NPC_CHAT_BUBBLE_TEXTS[1]);
        this.addChatBubble(entry3, ENTRY_NPC_CHAT_BUBBLE_TEXTS[2]);

        this.npcs.set(entry1.id, entry1);
        this.npcs.set(entry2.id, entry2);
        this.npcs.set(entry3.id, entry3);

        const frontdesk = new NPC(MODEL_NPC, 5, this.scene, NPCState.Standing);
        frontdesk.group.position.set(12.1, 0, -5.8);
        frontdesk.group.lookAt(
            frontdesk.group.position.x,
            frontdesk.group.position.y,
            frontdesk.group.position.z + 1
        );
        this.scene.add(frontdesk.group);
        const frontdeskChatBubble = this.addChatBubble(
            frontdesk,
            this.tokenQuestFrontdesk.chatBubbleText
        );
        this.tokenQuestFrontdesk.setChatBubble(frontdeskChatBubble);
        this.npcs.set(frontdesk.id, frontdesk);
    }

    addNPC(npc: NPC): void {
        this.scene.add(npc.group);
        this.npcs.set(npc.id, npc);
    }

    updateAnimations(delta: number): void {
        for (const npc of this.npcs.values()) {
            if (npc.group.visible) {
                npc.updateAnimation(delta);
            }
        }
    }

    private addChatBubble(npc: NPC, text: string): FloatingTextSprite {
        const chatBubble = new FloatingTextSprite(
            text,
            CHAT_BUBBLE_SIZE,
            new THREE.Vector3(0, CHAT_BUBBLE_HEIGHT, 0)
        );
        chatBubble.scale.multiplyScalar(CHAT_BUBBLE_SCALE);
        this.scene.add(chatBubble);
        chatBubble.follow(npc.group);
        return chatBubble;
    }
}
