import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    ManyToOne,
    ManyToMany,
    JoinTable,
} from 'typeorm';
import {
    BaseUser,
    BaseEventLog,
    EventType,
    InitialQuestStatus,
    type EventData,
    type QuestStatus,
    type PlayerPosition,
    BLACK_HOLE_DURATION_SECONDS,
} from 'ftr-common/sharedTypes';

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
        default: false,
    })
    declare TOSPPchecked: boolean;

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

    @Column({
        type: 'bool',
        default: false,
    })
    declare isLoggedIn: boolean;

    @Column({
        type: 'integer',
        default: BLACK_HOLE_DURATION_SECONDS,
    })
    declare blackholeTimer: number;

    // in order to have friends list we need a jointable which will create an
    // extra table "user_friends" in the DB. for each friendship we will end up
    // with pairs Like `(uid1, uid2)` for each friendship. it will be up to the
    // backends implementation to make sure there are no duplicates like `(uid1,
    // uid2) AND (uid2, uid1)` or to handle things like that gracefully.
    @ManyToMany(() => ORMUser, (user) => user.friends)
    @JoinTable({
        name: 'user_friends',
        joinColumn: {
            name: 'user_id',
            referencedColumnName: 'id',
        },
        inverseJoinColumn: {
            name: 'friend_id',
            referencedColumnName: 'id',
        },
    })
    declare friends: ORMUser[];

    @Column({
        type: 'simple-json',
        default: { x: 0, y: 0, z: 0 },
    })
    declare position: PlayerPosition;

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
