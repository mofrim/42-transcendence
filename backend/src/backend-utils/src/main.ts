import type { DataSource } from 'typeorm';
import { ORMUser } from 'ftr-common/ormTypes';
import type { ApiResponse, User } from 'ftr-common/sharedTypes';

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

// get the id belonging to a UID
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
                email: true,
                character: true,
                quests: true, // quests are needed for store/and load
                // NOTE eventlogs are never needed
                // QUESTION add friends here?!
            },
        });
    } catch (err) {
        console.error(err);
        return null;
    }
};

/**
 * Api-Response factory func. Can be called like
 * `mkApiResponse('your message', 'error'|'success')`
 * `mkApiResponse('your message', 'error'|'success', id)`,
 * or `mkApiResponse('your message', 'error'|'success', id | undefined, data)`
 */
export const mkApiResponse = <T>(
    message: string,
    status: 'error' | 'success',
    id?: number,
    data?: T
): ApiResponse<T> => {
    const baseRespo: ApiResponse<T> = { message, status };
    if (id !== undefined) baseRespo.id = id;
    if (data !== undefined) baseRespo.data = data;
    return baseRespo;
};
