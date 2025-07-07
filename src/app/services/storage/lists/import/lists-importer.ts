import type { PreferencesService } from "../../preferences.service";

export class ListsImporter {
    public get isRunning(): boolean {
        return this._running;
    }

    private _running: boolean = false;

    public async Initialize(archive: string) {}

    public async Analyse(): Promise<string[]> {
        return ["lists", "trash", "settings"];
    }

    public async ImportLists(listener: ProgressListener): Promise<boolean> {
        this._running = true;
        listener.Init(2);
        listener.oneDone();
        await new Promise(resolve => setTimeout(resolve, 1000));
        listener.oneDone();
        return true;
    }

    public async ImportTrash(listener: ProgressListener): Promise<boolean> {
        this._running = true;
        listener.Init(2);
        listener.oneDone();
        await new Promise(resolve => setTimeout(resolve, 1000));
        listener.oneDone();
        return true;
    }

    public async ImportSettings(preferences: PreferencesService): Promise<boolean> {
        this._running = true;
        return true;
    }

    public async CleanUp() {
        this._running = false;
    }
}

export abstract class ProgressListener {
    protected _total: number = -1;
    protected _done: number = 0;
    public Init(total: number) {
        this._done = 0;
        this._total = total;
    }

    public oneDone() {
        this._done++;
        if (this._total > 0) {
            this.onProgress(this._done / this._total);
        }
    }

    protected abstract onProgress(done: number): Promise<void>;
}

export function ProgressListenerFactory(onProgressCallback: (progress: number) => void | Promise<void>): ProgressListener {
    return new (class extends ProgressListener {
        protected override async onProgress(done: number): Promise<void> {
            console.log("DONE:", done);

            await onProgressCallback(done);
        }
    })();
}
