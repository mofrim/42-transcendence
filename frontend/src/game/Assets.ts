const GLB = '/glb/';
const USER_A = 'textures/UserA.png';
const USER_B = 'textures/UserB.png';

export const MAP = `${GLB}42WOB_v6.glb`;
export const DOOR_A = `${GLB}ES_DOOR_A.glb`;
export const DOOR_B = `${GLB}ES_DOOR_B.glb`;
export const CLOUDS = `${GLB}Clouds1.glb`;
export const ROCKS = `${GLB}RocksBorder4.glb`;
export const DUCK_DOWN = `${GLB}Duck_down.glb`;
export const DUCK_UP = `${GLB}Duck_up.glb`;
export const DISPLAY = `${GLB}Display.glb`;
export const NPC_MAN = `${GLB}NPC_Man_1.glb`;
export const MALE = `${GLB}Main_Male.glb`;
export const FEMALE = `${GLB}Main_Female.glb`;

/** all both gender */
export function getPlayerModelPath(character: boolean): string {
    if (character) {
        return MALE;
    }

    return FEMALE;
}

export function getPlayerImagePath(character: boolean): string {
    if (character) {
        return USER_A;
    }

    return USER_B;
}
