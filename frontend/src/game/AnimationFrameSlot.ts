export class AnimationFrameSlot {
    private frameId: number | null = null;

    public constructor(private readonly canRun: () => boolean = () => true) {}

    public request(callback: () => void): void {
        this.cancel();
        if (!this.canRun()) {
            return;
        }

        this.frameId = requestAnimationFrame(() => {
            this.frameId = null;
            if (this.canRun()) {
                callback();
            }
        });
    }

    public cancel(): boolean {
        if (this.frameId === null) {
            return false;
        }

        cancelAnimationFrame(this.frameId);
        this.frameId = null;
        return true;
    }
}
