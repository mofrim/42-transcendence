import {
    EventType,
    type GameEvent,
    ENTER_CAMPUS_TOKEN_QUEST_ID,
    FIND_LOST_DROPPED_TOKEN_QUEST_ID,
} from 'ftr-common/sharedTypes';

import type { CanvasTextSprite } from './CanvasTextSprite.js';
import { CHAT_BUBBLE_PREFIX, CHAT_BUBBLE_SIZE } from './FloatingTextSprite.js';

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
        [FIND_LOST_DROPPED_TOKEN_QUEST_ID, FRONTDESK_TOKEN_FOUND_TEXT],
        [ENTER_CAMPUS_TOKEN_QUEST_ID, FRONTDESK_GREETING_TEXT],
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
