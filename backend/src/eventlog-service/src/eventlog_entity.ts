import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { BaseEventLog, EventType } from '@common/types';

@Entity('event_logs')
export class EventLogEntity extends BaseEventLog {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'enum', enum: EventType })
    eventType!: EventType;

    @Column({ type: 'text' })
    data!: string;
}
