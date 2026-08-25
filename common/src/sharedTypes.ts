// in this file we collect types that are shared at least among multiple files.
import type * as THREE from 'three';

// -------------------=[ database backend related types ]=------------------- //

export enum EventType {
    PlayerJoined = 'PlayerJoined',
    PlayerLeft = 'PlayerLeft',
    GameResult = 'GameResult',
    ChatMsg = 'ChatMsg',
    QuestProgress = 'QuestProgress',
    Blackholed = 'Blackholed',
    NickChange = 'NickChange',
    CharChange = 'CharChange',
}

// TODO eventId, userId (foreign relation), eventType (class), data (chat msg,
// playerID)
// This will be the foundation for a new table in `eventlog-service`
export abstract class BaseEventLog {
    abstract id: number;
    abstract eventType: EventType;
    abstract data: string;
}

// using an abstract class here in order to force implementation of _all_
// properties in children
// A `ORMUser` class is derived as child in backend services
export abstract class BaseUser {
    abstract id: number;
    // abstract firstName: string;
    // abstract lastName: string;
    abstract nickname: string;
    abstract character: boolean;
    abstract email: string;
    abstract hashedPw: string;
}

// this is the child class of BaseUser for use in frontend
export class User extends BaseUser {
    id: number = 0;
    // firstName: string = "";
    // lastName: string = "";
    nickname: string = '';
    email: string = '';
    character: boolean = true;
    hashedPw: string = '';
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

export interface SocketAuth {
    character: boolean;
    nickname: string;
}

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

export type PlayerData = {
    id: string;
    nickname: string;
    position: { x: 0; y: 0; z: 0 };
    state: PlayerState;
    gameID: string | null;
    inGame: boolean;
};

export type PlayerUpdatePayload = {
    type: 'player_update';
    id: string;
    x: number;
    y: number;
    z: number;
    state: PlayerState;
    character: Character;
};

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

export type RPSRequestDataPayload = {
    type: 'rps_accept' | 'rps_decline' | 'rps_request';
    id: string;
    requestedPlayerID: string;
    nickname?: string;
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
