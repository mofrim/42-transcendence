import * as THREE from 'three';
import { PREPARATION_QUEST_IDS } from 'ftr-common/sharedTypes';
import { Interaction, type InteractionTypeId } from './interaction';
import { FrontDoorQuest } from './QuestFrontDoor';
import { EvaluatingStudentQuest } from './QuestEvaluatingStudent';
import { EventSpaceQuest } from './QuestEventSpace';
import { PreparationQuest } from './QuestPreparation';
import { StartEvaluationQuest } from './QuestStartEvaluation';
import { LostTokenQuest } from './QuestToken';

const INTERACTION_RANGE = new THREE.Vector3(1, 2, 1);

export class InteractionManager {
    readonly interactions: readonly Interaction[];
    readonly preparationQuests: ReadonlyMap<
        InteractionTypeId,
        PreparationQuest
    >;
    readonly evaluatingStudentQuest: EvaluatingStudentQuest;
    readonly startEvaluationQuest: StartEvaluationQuest;
    readonly eventSpaceQuest: EventSpaceQuest;
    readonly lostTokenQuest: LostTokenQuest;
    readonly frontDoorQuest: FrontDoorQuest;

    constructor(scene: THREE.Scene) {
        this.preparationQuests = new Map<InteractionTypeId, PreparationQuest>(
            PREPARATION_QUEST_IDS.map(
                (questId) =>
                    [
                        questId,
                        new PreparationQuest(scene, questId, INTERACTION_RANGE),
                    ] as const
            )
        );
        this.evaluatingStudentQuest = new EvaluatingStudentQuest(
            scene,
            INTERACTION_RANGE
        );
        this.startEvaluationQuest = new StartEvaluationQuest(
            scene,
            INTERACTION_RANGE
        );
        this.eventSpaceQuest = new EventSpaceQuest(scene, INTERACTION_RANGE);
        this.lostTokenQuest = new LostTokenQuest(scene, INTERACTION_RANGE);
        this.frontDoorQuest = new FrontDoorQuest(scene, INTERACTION_RANGE);

        this.interactions = [
            ...Array.from(
                this.preparationQuests.values(),
                (quest) => quest.interaction
            ),
            ...this.evaluatingStudentQuest.interactions,
            this.startEvaluationQuest.interaction,
            ...this.eventSpaceQuest.interactions,
            this.lostTokenQuest.interaction,
            this.frontDoorQuest.interaction,
        ];

        this.interactionStartingState();
    }

    interactionStartingState(): void {
        for (const quest of this.preparationQuests.values()) {
            quest.interaction.reset(true);
        }
        this.evaluatingStudentQuest.reset();
        this.startEvaluationQuest.interaction.reset(false);
        this.eventSpaceQuest.reset();
        this.lostTokenQuest.reset();
        this.frontDoorQuest.interaction.reset(false);
    }

    OnActivatePress(playerPosition: THREE.Vector3): void {
        const interaction = this.interactions.find(
            (candidate) =>
                candidate.zone.containsPoint(playerPosition) &&
                candidate.enabled
        );
        if (interaction) {
            this.onInteraction?.(interaction);
        }
    }

    update(playerPosition: THREE.Vector3): Interaction | null {
        let interactionInZone: Interaction | null = null;

        for (const interaction of this.interactions) {
            const isInZone = interaction.zone.containsPoint(playerPosition);

            if (interactionInZone === null && isInZone) {
                interactionInZone = interaction;
            }

            if (isInZone && interaction.enabled) interaction.showEngageButton();
            else interaction.removeEngageButton();
        }

        return interactionInZone;
    }

    // Callback
    onInteraction?: (interaction: Interaction) => void;
}
