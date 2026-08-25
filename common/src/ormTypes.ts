import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { BaseUser, BaseEventLog, EventType } from 'common/sharedTypes';

@Entity('users')
export class ORMUser extends BaseUser {
    @PrimaryGeneratedColumn()
    declare id: number;

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

@Entity('event_logs')
export class ORMEventLog extends BaseEventLog {
    @PrimaryGeneratedColumn()
    declare id: number;

    @Column({ type: 'enum', enum: EventType })
    declare eventType: EventType;

    @Column({ type: 'text' })
    declare data: string;
}

