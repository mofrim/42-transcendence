// in this file we collect types that are shared at least among multiple files.
import * as THREE from "three";

export enum PlayerState {
    Idle = 'Idle',
    Run = 'Run',
    Jump = 'Jump',
}

export enum CharacterModel {
    male = 'male',
    female = 'female',
}

export interface SocketAuth {
    character: boolean;
}

/** all both gender */
export type Character = boolean;

export enum RPSChoice {
    None = '',
    Rock = 'rock',
    Paper = 'paper',
    Scissors = 'scissors',
}

// TODO: Important for main.ts (tttBox)
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
}


// ================================================
// RPS Game
// ================================================

export enum RPSGameState {
    Requested = 0,
    InGame = 1,
}

export type RPSGame = {
    gameID: string,
    playerOne: string,
    playerTwo: string,
    playerOneChoice: RPSChoice,
    playerTwoChoice: RPSChoice,
    state: RPSGameState;
}

// ================================================
// TTT Game
// ================================================

export type PlayerSlot = string | null;

export enum TTTMark {
    Empty = '',
    X = 'X',
    O = 'O'
}

// tuple type for the board state
export type TTTBoard = [
    TTTMark, TTTMark, TTTMark,
    TTTMark, TTTMark, TTTMark,
    TTTMark, TTTMark, TTTMark
]

export enum TTTGameState {
    WaitingForFirstPlayer = 0,
    WaitingForSecondPlayer = 1,
    InGame = 2,
    Finished = 3
}

type TTTBoardNames = [
    string, string, string,
    string, string, string,
    string, string, string
]

export type TTTGame = {
    players: [PlayerSlot, PlayerSlot];
    // Names need to match the names of the board objects in the scene (Blender file)
    boardNames: TTTBoardNames;
    board: TTTBoard;
    currentMark: TTTMark;
    state: TTTGameState;
}

// ================================================
// SOCKET.IO messages types
// ================================================

// RPS Game ---------------------------------------

export type RPSBattleChoicePayload = {
    type: 'rps_choice';
    id: string;
    choice: RPSChoice;
}

export type RPSRequestDataPayload = {
    type: 'rps_accept' | 'rps_decline' | 'rps_request';
    id: string;
    requestedPlayerID: string;
}

export type TTTInitGamePayload = {
    game: TTTGame;
}

export type RPSInvalidPayload = {
    type: 'rps_invalid';
    playerOne: string;
    playerTwo: string;
}

export type RPSDrawPayload = {
    type: 'rps_draw';
    playerOne: string;
    playerTwo: string;
    choice: RPSChoice;
}

export type RPSWinnerPayload = {
    type: 'rps_winner';
    winner: string;
    winnerChoice: RPSChoice;
    loser: string,
    loserChoice: RPSChoice,
}

export type RPSAcceptDeclinePayload = {
    type: 'rps_accept' | 'rps_decline';
    id: string;
    requestedPlayerID: string;
}

// TTT Game ---------------------------------------

export type TTTMarkPayload = {
    type: 'ttt_mark';
    id: string;
    fieldName: string;
    mark: TTTMark;
}

export type TTTPlayerPayload = {
    type: 'ttt_playerOne' | 'ttt_playerTwo';
    id: string;
}

export type TTTStartPayload = {
    type: 'ttt_start';
    playerOne: string;
    playerTwo: string;
}

export type TTTWinPayload = {
    type: 'ttt_win';
    id: string;
    winner: number;
}

export type TTTDrawPayload = {
    type: 'ttt_draw';
}

export class TTTMeshBoard {
    cells: GLBMesh[];
    size: number;
    cellCnt: number;

    constructor() {
        this.cells = Array(9).fill(null).map(() => this.createGLBMesh());
        this.size = 9;
        this.cellCnt = 0;
    };

    private createGLBMesh(): GLBMesh {
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.MeshStandardMaterial();
        return new THREE.Mesh(geometry, material) as GLBMesh;
    };

    // method needed to wrap the array access because with
    // `noUncheckedIndexedAccess` tsc is treating each array-acces as `... |
    // undefined` -> this enforces implementing getters!
    getCell(i: number): GLBMesh {
        const cell = this.cells[i];
        if (!cell) throw new Error(`TTTMeshBoard-cell ${i} not initialized!`);
        return cell;
    }
}
