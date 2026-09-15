import { DataSource } from 'typeorm';
import { ORMUser } from 'ftr-common/ormTypes';
import { User } from 'ftr-common/sharedTypes';

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
        const exists = await db.manager.findOneBy(ORMUser, { id: userId });
        return exists === null ? null : exists;
    } catch (err) {
        console.error(err);
        return null;
    }
};

// get the id belonging to a UID return user without hashedPw field as this is
// needed nowhere
export const getUserByIdNoPw = async (
    db: DataSource,
    userId: number
): Promise<User | null> => {
    try {
        const exists = await db.manager.findOne(ORMUser, {
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
        return exists === null ? null : exists;
    } catch (err) {
        console.error(err);
        return null;
    }
};

// a little json status msg factory func.
export const mkStatus = (
    message: string,
    status: 'error' | 'success',
    id?: number
) => {
    return id !== undefined ? { message, status, id } : { message, status };
};
