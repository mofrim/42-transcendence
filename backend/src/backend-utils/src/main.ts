import type { DataSource } from 'typeorm';
import { ORMUser } from 'ftr-common/ormTypes';
import type { User } from 'ftr-common/sharedTypes';

// get the id belonging to a nickname string
export const getUserId = async (
    db: DataSource,
    nick: string
): Promise<number | null> => {
    try {
        const exists = await db.manager.findOneBy(ORMUser, { nickname: nick });
        return exists === null ? null : exists.id;
    } catch (err) {
        console.error(err);
        return null;
    }
};

/**
 * Get the full user record by UID.
 * CAUTION: can reveal sensitive info like the hashed PW! Therefore should only
 * be used in protected context and not exposed to frontend.
 */
export const getUserById = async (
    db: DataSource,
    userId: number
): Promise<User | null> => {
    try {
        return await db.manager.findOneBy(ORMUser, { id: userId });
    } catch (err) {
        console.error(err);
        return null;
    }
};

/*
 * Get User record excluding hashedPw as this sensible info is not needed by any
 * external functionality.
 */
export const getUserByIdNoPw = async (
    db: DataSource,
    userId: number
): Promise<User | null> => {
    try {
        return await db.manager.findOne(ORMUser, {
            where: {
                id: userId,
            },
            select: {
                id: true,
                nickname: true,
                TOSPPchecked: true,
                email: true, // NOTE: this is not optimal from a privacy persp
                character: true,
                quests: true,
                position: true,
                blackholeTimer: true,
                isLoggedIn: true,
            },
        });
    } catch (err) {
        console.error(err);
        return null;
    }
};
