import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    ManyToOne,
} from 'typeorm';
import {
    BaseUser,
    BaseEventLog,
    EventType,
    InitialQuestStatus,
    type EventData,
    type QuestStatus,
} from 'ftr-common/sharedTypes';

// TODO add friends
@Entity('users')
export class ORMUser extends BaseUser {
    @PrimaryGeneratedColumn()
    declare id: number;

    @Column({
        type: 'text',
        unique: true,
        default: '',
    })
    declare nickname: string;

    @Column({
        type: 'bool',
        default: true,
    })
    declare character: boolean;

    @Column({
        type: 'text',
        default: '',
    })
    declare email: string;

    @Column({
        type: 'text',
        default: '',
    })
    declare hashedPw: string;

    @OneToMany(() => ORMEventLog, (evlog) => evlog.user)
    declare eventLogs: ORMEventLog[];

    @Column({
        type: 'simple-json',
        default: InitialQuestStatus,
    })
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
