import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { BaseUser } from '@common/types';

@Entity()
export class ORMUser extends BaseUser {
    @PrimaryGeneratedColumn()
    declare id: number;

    // @Column('text')
    // declare firstName: string;

    // @Column('text')
    // declare lastName: string;

    @Column({
        type: 'text',
        unique: true,
    })
    declare nickname: string;

    @Column('bool')
    declare character: boolean;

    @Column('text')
    declare email: string;

    @Column('text')
    declare hashedPw: string;

    constructor(data?: Partial<ORMUser>) {
        super();
        if (data) {
            Object.assign(this, data);
        }
    }
}
