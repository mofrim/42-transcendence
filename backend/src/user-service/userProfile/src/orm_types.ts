import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum MatchResult {
    WIN = 'WIN',
    LOSS = 'LOSS',
    DRAW = 'DRAW',
}

@Entity('user_profiles')
export class ORMUserProfile {
    @PrimaryGeneratedColumn()
    declare id: number;

    @Index({ unique: true })
    @Column('integer')
    declare userId: number;

    @Column('boolean', {
        default: true,
    })
    declare character: boolean;

    @CreateDateColumn()
    declare createdAt: Date;

    @UpdateDateColumn()
    declare updatedAt: Date;

    constructor(data?: Partial<ORMUserProfile>) {
        if (data) {
            Object.assign(this, data);
        }
    }
}

@Entity('match_history')
@Index(['userId', 'matchId'], {
    unique: true,
})
export class ORMMatchHistory {
    @PrimaryGeneratedColumn()
    declare id: number;

    @Column('integer')
    declare userId: number;

    @Column('text')
    declare matchId: string;

    @Column({
        type: 'enum',
        enum: MatchResult,
    })
    declare result: MatchResult;

    @Column('integer', {
        default: 0,
    })
    declare score: number;

    @Column('integer', {
        default: 0,
    })
    declare kills: number;

    @Column('integer', {
        default: 0,
    })
    declare deaths: number;

    @Column('text')
    declare gameMode: string;

    @Column('integer', {
        default: 0,
    })
    declare playtime: number;

    @CreateDateColumn()
    declare createdAt: Date;

    @Column({
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
    })
    declare finishedAt: Date;

    constructor(data?: Partial<ORMMatchHistory>) {
        if (data) {
            Object.assign(this, data);
        }
    }
}
