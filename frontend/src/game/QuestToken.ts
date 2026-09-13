import * as THREE from 'three';
import {
    EventType,
    type GameEvent,
    QUESTS_OBJ,
    PlayerState,
    type QuestCompleteHandler,
} from 'ftr-common/sharedTypes';

import { CanvasTextSprite } from './CanvasTextSprite.js';
import { CHAT_BUBBLE_PREFIX, CHAT_BUBBLE_SIZE } from './FloatingTextSprite.js';
import { Interaction } from './interaction';
import type { PlayerAnimationState } from './player';

const LOST_TOKEN_POSITION = new THREE.Vector3(
    1.2922068884555726,
    0.0019360798741439034,
    -12.941452087852168
);
const LOST_TOKEN_MARKER_HEIGHT = 0.65;
const LOST_TOKEN_MARKER_SCALE = 0.5;
const LOST_TOKEN_SUCCESS_MESSAGE =
    'There it is 🔑! I found my lost campus token. Now I can finally unlock the frontdoor.';

export class LostTokenQuest {
    readonly interaction: Interaction;
    private readonly marker: CanvasTextSprite;

    constructor(scene: THREE.Scene, interactionRange: THREE.Vector3) {
        this.interaction = new Interaction(
            scene,
            QUESTS_OBJ.FIND_LOST_DROPPED_TOKEN_QUEST_ID,
            LOST_TOKEN_POSITION,
            interactionRange,
            true
        );

        /** TODO: leider kein 3D Modell für den Schlüssel habe */
        this.marker = new CanvasTextSprite('🔑', 64);
        this.marker.position
            .copy(LOST_TOKEN_POSITION)
            .setY(LOST_TOKEN_POSITION.y + LOST_TOKEN_MARKER_HEIGHT);
        this.marker.scale.multiplyScalar(LOST_TOKEN_MARKER_SCALE);
        scene.add(this.marker);
    }

    reset(): void {
        this.interaction.reset(true);
        this.marker.visible = true;
    }

    collect(): void {
        this.interaction.reset(false);
        this.marker.visible = false;
    }

    async handleInteraction(
        interaction: Interaction,
        completeQuest: QuestCompleteHandler<PlayerAnimationState>,
        onCollected?: () => void
    ): Promise<boolean> {
        if (
            interaction.typeID !== QUESTS_OBJ.FIND_LOST_DROPPED_TOKEN_QUEST_ID
        ) {
            return false;
        }

        await completeQuest(
            QUESTS_OBJ.FIND_LOST_DROPPED_TOKEN_QUEST_ID.id,
            LOST_TOKEN_SUCCESS_MESSAGE,
            PlayerState.ThumbsUp
        );
        this.collect();
        onCollected?.();
        return true;
    }
}

/** Als virtueller Name dieses Frontesk NPCs Nickname der im Chat angezeigt werden soll */
const FRONTDESK_NICKNAME = 'Frontdesk Staff:';
/** Solange er den Token noch nicht gefunden hat: */
const FRONTDESK_TOKEN_REQUIRED_TEXT =
    'Students must always have a valid Student IDs and token according to House Rules';
/** Wenn er den Token gefunden hat */
const FRONTDESK_TOKEN_FOUND_TEXT =
    'Please make sure to use your token when entering the building and make sure the door closes behind you';
/** nachdem man mit dem Token den Campus Enter quest erledigt hat */
const FRONTDESK_GREETING_TEXT = 'Welcome to 42 Wolfsburg Campus! 👋🏻';

type FrontdeskMessage =
    | typeof FRONTDESK_TOKEN_REQUIRED_TEXT
    | typeof FRONTDESK_TOKEN_FOUND_TEXT
    | typeof FRONTDESK_GREETING_TEXT;

const FRONTDESK_MESSAGE_BY_QUEST_ID: ReadonlyMap<string, FrontdeskMessage> =
    new Map<string, FrontdeskMessage>([
        [
            QUESTS_OBJ.FIND_LOST_DROPPED_TOKEN_QUEST_ID.id,
            FRONTDESK_TOKEN_FOUND_TEXT,
        ],
        [QUESTS_OBJ.ENTER_CAMPUS_TOKEN_QUEST_ID.id, FRONTDESK_GREETING_TEXT],
    ]);

/**
 * Es gibt einen Frontdesk NPC, dem sein Text sich ändert,
 * auch der hat so ne Chat Bubble und diese Value Nachricht
 */
export class TokenQuestFrontdesk {
    private readonly onGameEvent: ((event: GameEvent) => void) | undefined;
    private chatBubble: CanvasTextSprite | null = null;
    private message: FrontdeskMessage = FRONTDESK_TOKEN_REQUIRED_TEXT;

    constructor(onGameEvent?: (event: GameEvent) => void) {
        this.onGameEvent = onGameEvent;
    }

    get chatBubbleText(): string {
        return CHAT_BUBBLE_PREFIX + this.message;
    }

    setChatBubble(chatBubble: CanvasTextSprite): void {
        this.chatBubble = chatBubble;
    }

    handleQuestCompletion(questId: string): void {
        const message = FRONTDESK_MESSAGE_BY_QUEST_ID.get(questId);
        if (message === undefined) {
            return;
        }

        this.updateFrontdeskMessage(message);
    }

    reset(): void {
        this.updateFrontdeskMessage(FRONTDESK_TOKEN_REQUIRED_TEXT);
    }

    /**
     * Ergänzend diese Sprechblasentext Wechsel im Eventlog angezeigt werden.
     * Ähnlich wie eine Nachricht von einem anderen Spieler im Chat angezeigt wird.
     * */
    updateFrontdeskMessage(message: FrontdeskMessage): void {
        if (this.message === message) {
            return;
        }

        this.message = message;
        this.chatBubble?.setText(this.chatBubbleText, CHAT_BUBBLE_SIZE);

        this.onGameEvent?.({
            eventType: EventType.ChatMsg,
            data: {
                nickname: FRONTDESK_NICKNAME,
                chatmsg: message,
            },
            logtime: new Date(),
        });
    }
}
