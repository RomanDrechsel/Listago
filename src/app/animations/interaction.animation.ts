export class InteractionAnimation {
    private _steps: InteractionAnimationStep[] = [];
    private _stop: boolean = false;
    private _isRunning = false;

    public get isRunning(): boolean {
        return this._isRunning;
    }

    public AddStep(step: InteractionAnimationStep) {
        this._steps.push(step);
    }

    public async Run(): Promise<boolean> {
        this._stop = false;
        this._isRunning = true;
        for (let i = 0; i < this._steps.length; i++) {
            if (this._stop) {
                this._isRunning = false;
                return false;
            }

            await new Promise(resolve => setTimeout(resolve, this._steps[i].duration));

            if (!(await this._steps[i].do())) {
                return false;
            }
        }
        this._isRunning = false;
        return true;
    }

    public async Stop() {
        this._stop = true;
    }
}

export type InteractionAnimationStep = {
    duration: number;
    do: () => Promise<boolean>;
};
