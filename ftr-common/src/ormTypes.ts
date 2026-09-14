import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    ManyToOne,
} from 'typeorm';
import { BaseUser, BaseEventLog, EventType } from 'ftr-common/sharedTypes';
import type { EventData, QuestStatus } from 'ftr-common/sharedTypes';

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

    @OneToMany(() => ORMEventLog, (evlog) => evlog.user)
    declare eventLogs: ORMEventLog[];

    @Column('simple-json')
    declare quests: QuestStatus;

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

    @Column({ type: 'simple-json', nullable: true })
    declare data: EventData;

    @Column({ type: 'timestamptz', precision: 6 })
    declare logtime: Date;

    @ManyToOne(() => ORMUser, (user) => user.eventLogs)
    declare user: ORMUser;
}
