// in this file we collect types that are shared at least among multiple files.
import type * as THREE from 'three';

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
        id: 'ENTER_42_CAMPUS_VIA_TOKEN',
        text: 'Enter 42 campus via token',
        completed: false,
    },
    RUBBER_DUCK_QUEST_ID: {
        id: 'FIND_RUBBERDUCK',
        text: 'Find the Rubber Duck',
        completed: false,
    },
    COFFEE_QUEST_ID: {
        id: 'GET_COFFEE',
        text: 'Get a Coffee',
        completed: false,
    },
    PAPER_QUEST_ID: {
        id: 'GET_PAPER',
        text: 'Get a Piece of Paper',
        completed: false,
    },
    COMPUTER_LOGIN_QUEST_ID: {
        id: 'LOGIN_COMPUTER',
        text: 'Log In to Computer c2r12s6',
        completed: false,
    },
    BLACK_HOLE_QUEST_ID: {
        id: 'avoid-blackhole',
        text: "Don't get blackholed",
        completed: false,
    },
    MEET_PLAYER_QUEST_ID: {
        id: 'meet-player',
        text: 'Find another Student',
        completed: false,
    },
    RPS_WIN_QUEST_ID: {
        id: 'win-rps-minigame',
        text: 'Win Rock-Paper-Scissors',
        completed: false,
    },
    EVALUATING_STUDENT_QUEST_ID: {
        id: 'FIND_EVALUATING_STUDENT',
        text: 'Find the Evaluating Student',
        completed: false,
    },
    START_EVALUATION_QUEST_ID: {
        id: 'START_EVALUATION',
        text: 'Start Evaluation',
        completed: false,
    },
    TTT_WIN_QUEST_ID: {
        id: 'win-ttt-minigame',
        text: 'Win Tic-Tac-Toe',
        completed: false,
    },
    ENTER_EVENT_SPACE_QUEST_ID: {
        id: 'ENTER_EVENT_SPACE',
        text: 'Enter the Event Space',
        completed: false,
    },
});

// generate a `type` from the above object.. awesome TS feature BTW
export type QuestStatus = {
    [K in keyof typeof QUESTS]: boolean;
};

// the quests object with every boolean set to false.
export const InitialQuestStatus: QuestStatus = Object.fromEntries(
    Object.keys(QUESTS).map((key) => [key, false])
) as QuestStatus;

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
          readonly friendRequestStatus: FriendRequestStatus;
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

export type EventDataPlayerInRange = {
    readonly playerId: string;
    readonly remoteNick: string;
};

export type EventDataChatMsg = {
    readonly chatmsg: string;
};

export type EventDataQuestCompleted = {
    readonly questId: string;
    readonly questText?: string;
};

export type EventDataGameResult = {
    readonly game: 'Tic-Tac-Toe' | 'Rock-Paper-Scissors';
    readonly outcome: 'won' | 'lost' | 'draw';
    readonly opponentNickname: string;
};

export type EventDataFriendRequest = {
    readonly friendNick: string;
    readonly friendRequestStatus: FriendRequestStatus;
};

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
    abstract character: boolean;
    abstract email: string;
    abstract hashedPw?: string;
}

// this is the child class of BaseUser for use in frontend
export class User extends BaseUser {
    id: number = 0;
    nickname: string = '';
    email: string = '';
    character: boolean = true;
    hashedPw?: string = '';

    constructor(data?: Partial<User>) {
        super();
        if (data) {
            Object.assign(this, data);
        }
    }
}

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
    type: 'friend_request' | FriendResponseType;
};

export type FriendResponseStatus = 'accepted' | 'declined';

export type FriendRequestStatus = 'sent' | 'incoming' | FriendResponseStatus;

export type FriendRequestState = {
    readonly status: FriendRequestStatus;
    readonly playerId: string;
    readonly nickname: string;
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

export type PlayerPosition = {
    x: number;
    y: number;
    z: number;
};

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
} & Partial<Pick<PlayerUpdatePayload, 'x' | 'y' | 'z' | 'state'>>;

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
    cells: GLBMesh[];
    size: number;
    cellCnt: number;

    constructor() {
        this.cells = [];
        this.size = 9;
        this.cellCnt = 0;
    }

    // method needed to wrap the array access because with
    // `noUncheckedIndexedAccess` tsc is treating each array-acces as `... |
    // undefined` -> this enforces implementing getters!
    getCell(i: number): GLBMesh {
        const cell = this.cells[i];
        if (!cell) throw new Error(`TTTMeshBoard-cell ${i} not initialized!`);
        return cell;
    }
}
