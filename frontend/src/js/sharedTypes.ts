// in this file we collect types that are shared at least among multiple files.

export enum PlayerState {
    Idle = 'Idle',
    Run = 'Run',
    Jump = 'Jump',
}

export enum CharacterModel {
    male = 'male',
    female = 'female',
}

// types

/** all both gender */
export type Character = boolean;
