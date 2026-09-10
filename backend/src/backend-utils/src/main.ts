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

// get the id belonging to a nickname string
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
