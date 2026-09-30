// in this file we collect types that are shared at least among multiple files.
import type * as THREE from 'three';

export const BLACK_HOLE_DURATION_SECONDS = 30 * 60;

// ----------------------------=[ quest types ]=---------------------------- //

// our _main_ quests list. in order to add / modify a quest this is the root
// struct to edit. types for backend are derived from this obj
export const QUESTS = Object.freeze({
    FIND_LOST_DROPPED_TOKEN_QUEST_ID: {
        id: 'FIND_LOST_DROPPED_TOKEN',
        text: 'Find lost dropped Token',
        completed: false,
    },
    ENTER_CAMPUS_TOKEN_QUEST_ID: {
        id: 'ENTER_CAMPUS_TOKEN',
        text: 'Enter 42 campus via token',
        completed: false,
    },
    RUBBER_DUCK_QUEST_ID: {
        id: 'RUBBER_DUCK',
        text: 'Find the Rubber Duck',
        completed: false,
    },
    COFFEE_QUEST_ID: {
        id: 'COFFEE',
        text: 'Get a Coffee',
        completed: false,
    },
    PAPER_QUEST_ID: {
        id: 'PAPER',
        text: 'Get a Piece of Paper',
        completed: false,
    },
    COMPUTER_LOGIN_QUEST_ID: {
        id: 'COMPUTER_LOGIN',
        text: 'Log In to Computer c2r12s6',
        completed: false,
    },
    BLACK_HOLE_QUEST_ID: {
        id: 'BLACK_HOLE',
        text: "Don't get blackholed",
        completed: false,
    },
    MEET_PLAYER_QUEST_ID: {
        id: 'MEET_PLAYER',
        text: 'Find another Student',
        completed: false,
    },
    RPS_WIN_QUEST_ID: {
        id: 'RPS_WIN',
        text: 'Win Rock-Paper-Scissors',
        completed: false,
    },
    EVALUATING_STUDENT_QUEST_ID: {
        id: 'EVALUATING_STUDENT',
        text: 'Find the Evaluating Student',
        completed: false,
    },
    START_EVALUATION_QUEST_ID: {
        id: 'START_EVALUATION',
        text: 'Start Evaluation',
        completed: false,
    },
    TTT_WIN_QUEST_ID: {
        id: 'TTT_WIN',
        text: 'Win Tic-Tac-Toe',
        completed: false,
    },
    ENTER_EVENT_SPACE_QUEST_ID: {
        id: 'ENTER_EVENT_SPACE',
        text: 'Enter the Event Space',
        completed: false,
    },
});

// use only the IDs for this one as this is the info that will be transfered
// between BE and FE (BackEnd & FrontEnd)
export type QuestStatus = {
    [K in keyof typeof QUESTS as (typeof QUESTS)[K]['id']]: boolean;
};

// An array with only the ID props from QUESTS -> useful when trying to check
// for valid questIds
export const QuestIDs = Object.freeze(Object.values(QUESTS).map((q) => q.id));

// the quests object with every boolean set to false.
export const InitialQuestStatus: QuestStatus = Object.fromEntries(
    Object.values(QUESTS).map((q) => [q.id, false])
) as QuestStatus;

export type QuestTuple = Record<string, boolean>;

export const PREPARATION_QUEST_IDS = [
    QUESTS.RUBBER_DUCK_QUEST_ID.id,
    QUESTS.COFFEE_QUEST_ID.id,
    QUESTS.PAPER_QUEST_ID.id,
    QUESTS.COMPUTER_LOGIN_QUEST_ID.id,
] as const;

// FIXME this is basically `string`... so we could just use this
export type PreparationQuestId = (typeof PREPARATION_QUEST_IDS)[number];

export type QuestLogEntry = {
    readonly id: string;
    readonly text: string;
    readonly completed?: boolean;
};

export type QuestCompleteHandler<TAnimation> = (
    questId: string,
    message: string,
    animation: TAnimation
) => Promise<void>;

export type QuestDialogHandler<TAnimation> = (
    message: string,
    animation: TAnimation
) => Promise<void>;

// ---------------------=[ eventlog types and classes ]=--------------------- //

export enum EventType {
    PlayerJoined = 'PlayerJoined',
    PlayerLeft = 'PlayerLeft',
    PlayerInRange = 'PlayerInRange',
    FriendRequest = 'FriendRequest',
    GameResult = 'GameResult',
    ChatMsg = 'ChatMsg',
    QuestCompleted = 'QuestCompleted',
    Blackholed = 'Blackholed',
    NickChange = 'NickChange',
    CharChange = 'CharChange',
    None = 'None',
}

// all possible EventData combinations in one union..
export type EventData =
    | null
    | {
          readonly playerId: string;
          readonly playerNickname: string;
      }
    | {
          readonly playerId: string;
          readonly remoteNick: string;
      }
    | {
          readonly playerId: string;
      }
    | {
          readonly friendNick: string;
          readonly friendRequestStatus: FriendStatus;
          readonly friendRequestReason?: FriendRequestRejectionReason;
      }
    | {
          readonly game: 'Tic-Tac-Toe' | 'Rock-Paper-Scissors';
          readonly outcome: 'won' | 'lost' | 'draw';
          readonly opponentNickname: string;
      }
    | {
          readonly chatmsg: string;
      }
    | {
          readonly questId: string;
          readonly questText?: string;
      };

// Partial EventData types...

export type EventDataPlayerInRange = Extract<
    EventData,
    { readonly remoteNick: string }
>;

export type EventDataChatMsg = Extract<EventData, { readonly chatmsg: string }>;

export type EventDataQuestCompleted = Extract<
    EventData,
    { readonly questId: string }
>;

export type EventDataGameResult = Extract<EventData, { readonly game: string }>;

export type EventDataFriendRequest = Extract<
    EventData,
    { readonly friendRequestStatus: FriendStatus }
>;

// This will be the foundation for a new table in `eventlog-service` every Event
// is emitted by some user => user must be part of every Event. This obsoletes
// specification of emitting users nickname in EventData for some events
export abstract class BaseEventLog {
    abstract id?: number;
    abstract eventType: EventType;
    abstract logtime: Date;
    abstract data: EventData;
    abstract user: BaseUser;
}

// GameEvent used wherever a event is generated in frontend
export class GameEvent extends BaseEventLog {
    id?: number;
    eventType: EventType = EventType.None;
    logtime: Date = new Date();
    data: EventData = null;
    user: User = new User();
}

// stripped version of BaseEventLog containing only necessary data for
// matchhist. used in /api/eventlog/matchhist and useMatchHistory in frontend
export type MatchHistResponse = {
    id: number;
    data: EventDataGameResult;
    logtime: Date;
};

// also used both in eventlog-service and frontend
export const MAX_MATCH_HISTORY_ENTRIES = 10;

// -----------------------=[ user types and classes ]=----------------------- //

// using an abstract class here in order to force implementation of _all_
// properties in children
// A `ORMUser` class is derived as child in backend services
export abstract class BaseUser {
    abstract id: number;
    abstract nickname: string;
    abstract TOSPPchecked: boolean;
    abstract character: boolean;
    abstract email: string;
    abstract hashedPw?: string;
    abstract blackholeTimer: number;
    abstract isLoggedIn: boolean;
    abstract position: PlayerPosition;
}

// this is the child class of BaseUser for use in frontend
export class User extends BaseUser {
    id: number = 0;
    nickname: string = '';
    email: string = '';
    TOSPPchecked = false;
    character: boolean = true;
    hashedPw?: string = '';
    blackholeTimer = BLACK_HOLE_DURATION_SECONDS;
    isLoggedIn = false;
    position = { x: 0, y: 0, z: 0 };

    constructor(data?: Partial<User>) {
        super();
        if (data) {
            Object.assign(this, data);
        }
    }
}

// region: API
// ------------=[ types related to the backend API in general ]=------------ //

/**
 * Unified ApiResponse data-type. If the response carries a payload aka `data`
 * the datatype can be set using generics.
 */
export type ApiResponse<T = unknown> = {
    message: string;
    status: 'error' | 'success';
    id?: number;
    data?: T;
};

const API_EVENTLOG_ROOT = '/api/eventlog' as const;

export const API_EVENTLOG = Object.freeze({
    root: API_EVENTLOG_ROOT,
    all: `${API_EVENTLOG_ROOT}/all`,
    matchHistory: `${API_EVENTLOG_ROOT}/matchhist`,
});

const API_USER_ROOT = '/api/user' as const;

export const API_USER = Object.freeze({
    root: API_USER_ROOT,
    all: `${API_USER_ROOT}/all`,
    health: `${API_USER_ROOT}/health`,
    uid: `${API_USER_ROOT}/:userId`,
    register: `${API_USER_ROOT}/register`,
    quests: `${API_USER_ROOT}/quests`,
    tospp: `${API_USER_ROOT}/tospp`,
});

// endregion
// ----------------------------=[ other types ]=---------------------------- //

export enum PlayerState {
    Idle = 'Idle',
    Run = 'Run',
    Jump = 'Jump',
    Falling = 'Falling',
    Angry = 'Angry',
    ArmStretch = 'ArmStretch',
    Drinking = 'Drinking',
    Relieved = 'Relieved',
    Strong = 'Strong',
    Surprised = 'Surprised',
    ThumbsUp = 'ThumbsUp',
    Victory = 'Victory',
}

export enum CharacterModel {
    male = 'male',
    female = 'female',
}

export enum NPCState {
    Talking_1 = 'Talking_1',
    Talking_2 = 'Talking_2',
    Talking_3 = 'Talking_3',
    Standing = 'Standing',
    Nod = 'Nod',
    ComputerSitting = 'ComputerSitting',
    Pointing = 'Pointing',
}

export const SPECTATOR_NAME = '42Staff' as const;

/** 30 server fps */
export const PLAYER_NETWORK_UPDATE_RATE_HZ = 30;
export const PLAYER_NETWORK_UPDATE_INTERVAL_MS =
    1_000 / PLAYER_NETWORK_UPDATE_RATE_HZ;
export const PLAYER_NETWORK_UPDATE_INTERVAL_SECONDS =
    PLAYER_NETWORK_UPDATE_INTERVAL_MS / 1_000;

export type PlayerSocketAuth = {
    role?: 'player';
    userId: number;
    character: boolean;
    nickname: string;
};

export type SpectatorSocketAuth = {
    role: 'spectator';
    character?: never;
    nickname?: never;
};

export type SocketAuth = PlayerSocketAuth | SpectatorSocketAuth;

export type ChatSendPayload = {
    message: string;
};

export type ReceivedChatPayload = {
    messageId: string;
    senderId: string;
    senderName: string;
    message: string;
};

export type ClientChatPayload = ChatSendPayload;
export type ServerChatPayload = ReceivedChatPayload;

/** shared request or RPS and friends */
type PlayerTargetRequestPayload = {
    id: string;
    requestedPlayerID: string;
    nickname?: string;
};

export type FriendResponseType = 'friend_accept' | 'friend_decline';

export type FriendRequestPayload = PlayerTargetRequestPayload & {
    type: 'friend_request';
    friendUserId?: number;
};

type FriendUserPayload = {
    id: string;
    friendUserId: number;
    nickname?: string;
};

export type FriendResponsePayload = FriendUserPayload & {
    type: FriendResponseType;
};

export type FriendRemovePayload = FriendUserPayload & {
    type: 'friend_remove';
};

export type FriendRequestRejectionReason =
    | 'invalid_target'
    | 'same_account'
    | 'duplicate'
    | 'already_friends'
    | 'duplicate_request';

export type FriendRequestAcknowledgement =
    | {
          readonly accepted: true;
          readonly friendUserId: number;
      }
    | {
          readonly accepted: false;
          readonly reason: FriendRequestRejectionReason;
      };

export type FriendRemoveAcknowledgement =
    | {
          readonly removed: true;
      }
    | {
          readonly removed: false;
          readonly reason: 'invalid_target';
      };

export type FriendResponseStatus = 'accepted' | 'declined';

export type FriendRequestStatus =
    'sent' | 'incoming' | 'rejected' | FriendResponseStatus;

export type FriendStatus = FriendRequestStatus | 'removed';

export type FriendListEntry = {
    readonly playerId: string;
    readonly nickname: string;
};

export type FriendPendingRequest = FriendListEntry & {
    readonly direction: 'incoming' | 'outgoing';
};

export type FriendStateSnapshot = {
    readonly friends: readonly FriendListEntry[];
    readonly pendingRequest: FriendPendingRequest | null;
};

export type FriendStateSnapshotHandler = (
    snapshot: FriendStateSnapshot
) => void;

export type FriendRequestState = FriendListEntry & {
    readonly status: FriendStatus;
    readonly reason?: FriendRequestRejectionReason;
};

export type FriendRequestChangeHandler = (
    state: FriendRequestState | null
) => void;

/** all both gender */
export type Character = boolean;

export enum RPSChoice {
    None = '',
    Rock = 'rock',
    Paper = 'paper',
    Scissors = 'scissors',
}

export type GLBMesh = THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshStandardMaterial | THREE.MeshToonMaterial
>;

export type PlayerPosition = THREE.Vector3Like;

export type SaveGameSnapshot = {
    readonly position: PlayerPosition;
    readonly blackHoleSecondsRemaining: number;
    readonly blackHoleCountdownCompleted: boolean;
    readonly completedQuestIds: readonly string[];
};

export type SaveGameTimerPayload = {
    readonly type: 'save_game_timer';
    readonly blackHoleSecondsRemaining: number;
    readonly completed: boolean;
};

export type SaveGameQuestStatusPayload = {
    readonly type: 'save_game_quest_status';
} & Pick<SaveGameSnapshot, 'completedQuestIds'>;

export type PlayerData = {
    id: string;
    nickname: string;
    position: PlayerPosition;
    state: PlayerState;
    gameID: string | null;
    inGame: boolean;
};

export type PlayerMovementPayload = Pick<PlayerData, 'state'> &
    PlayerPosition & {
        type: 'player_update';
    };

export type PlayerUpdatePayload = PlayerMovementPayload &
    Pick<PlayerData, 'id'>;

export type PlayerConnectedPayload = Pick<PlayerData, 'id' | 'nickname'> & {
    character: Character;
    isInitialSnapshot: boolean;
} & Partial<PlayerPosition & Pick<PlayerData, 'state'>>;

// ================================================
// RPS Game
// ================================================

export enum RPSGameState {
    Requested = 0,
    InGame = 1,
}

export type RPSGame = {
    gameID: string;
    playerOne: string;
    playerTwo: string;
    playerOneChoice: RPSChoice;
    playerTwoChoice: RPSChoice;
    state: RPSGameState;
};

// ================================================
// TTT Game
// ================================================

export type PlayerSlot = string | null;

export enum TTTMark {
    Empty = '',
    X = 'X',
    O = 'O',
}

// tuple type for the board state
export type TTTBoard = [
    TTTMark,
    TTTMark,
    TTTMark,
    TTTMark,
    TTTMark,
    TTTMark,
    TTTMark,
    TTTMark,
    TTTMark,
];

export enum TTTGameState {
    WaitingForFirstPlayer = 0,
    WaitingForSecondPlayer = 1,
    InGame = 2,
    Finished = 3,
}

type TTTBoardNames = [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
];

export type TTTGame = {
    players: [PlayerSlot, PlayerSlot];
    // Names need to match the names of the board objects in the scene (Blender file)
    boardNames: TTTBoardNames;
    board: TTTBoard;
    currentMark: TTTMark;
    state: TTTGameState;
};

// ================================================
// SOCKET.IO messages types
// ================================================

// RPS Game ---------------------------------------

export type RPSBattleChoicePayload = {
    type: 'rps_choice';
    id: string;
    choice: RPSChoice;
};

export type RPSRequestDataPayload = PlayerTargetRequestPayload & {
    type: 'rps_accept' | 'rps_decline' | 'rps_request';
};

export type TTTInitGamePayload = {
    game: TTTGame;
};

export type RPSInvalidPayload = {
    type: 'rps_invalid';
    playerOne: string;
    playerTwo: string;
};

export type RPSDrawPayload = {
    type: 'rps_draw';
    playerOne: string;
    playerTwo: string;
    choice: RPSChoice;
};

export type RPSWinnerPayload = {
    type: 'rps_winner';
    winner: string;
    winnerChoice: RPSChoice;
    loser: string;
    loserChoice: RPSChoice;
};

export type RPSAcceptDeclinePayload = {
    type: 'rps_accept' | 'rps_decline';
    id: string;
    requestedPlayerID: string;
};

// TTT Game ---------------------------------------

export type TTTMarkPayload = {
    type: 'ttt_mark';
    id: string;
    fieldName: string;
    mark: TTTMark;
};

export type TTTPlayerPayload = {
    type: 'ttt_playerOne' | 'ttt_playerTwo';
    id: string;
};

export type TTTStartPayload = {
    type: 'ttt_start';
    playerOne: string;
    playerTwo: string;
    playerOneNickname: string;
    playerTwoNickname: string;
};

export type TTTWinPayload = {
    type: 'ttt_win';
    id: string;
    winner: number;
    nickname?: string;
};

export type TTTDrawPayload = {
    type: 'ttt_draw';
};

export class TTTMeshBoard {
    cells: GLBMesh[] = [];

    // method needed to wrap the array access because with
    // `noUncheckedIndexedAccess` tsc is treating each array-acces as `... |
    // undefined` -> this enforces implementing getters!
    getCell(i: number): GLBMesh {
        const cell = this.cells[i];
        if (!cell) throw new Error(`TTTMeshBoard-cell ${i} not initialized!`);
        return cell;
    }
}
