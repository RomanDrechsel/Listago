import type { Animation, IonContentCustomEvent, ScrollDetail } from "@ionic/core";
import { Subscription } from "rxjs";
import { CreateListitemAnimation, type ListitemAnimationDirection } from "src/app/animations/listitem.animation";
import { EPrefProperty } from "../../services/storage/preferences.service";
import { ListPageBase } from "./list-page-base";

export abstract class AnimatedListPageBase extends ListPageBase {
    protected _initAnimationDone = false;
    protected _animationDirection: ListitemAnimationDirection = "left";

    private _animateItems = true;

    private _itemAnimations: Animation[] | undefined;

    private _animationSubscription?: Subscription;

    public get InitialAnimationDone(): boolean {
        return this._initAnimationDone;
    }

    public override async ionViewWillEnter() {
        await super.ionViewWillEnter();
        this._animateItems = await this.Preferences.Get(EPrefProperty.Animations, true);
        if (this._animateItems == false) {
            this._initAnimationDone = true;
        }

        this._animationSubscription = this.Preferences.onPrefChanged$.subscribe(prop => {
            if (prop.prop == EPrefProperty.Animations) {
                this._animateItems = prop.value;
            }
        });
    }

    public override async ionViewWillLeave() {
        await super.ionViewWillLeave();
        if (this._animationSubscription) {
            this._animationSubscription.unsubscribe();
            this._animationSubscription = undefined;
        }
    }

    public override onScroll(event: IonContentCustomEvent<ScrollDetail>) {
        super.onScroll(event);
        if (this._itemAnimations) {
            this._itemAnimations.forEach(a => a.progressEnd(1, 1));
            this.finishAnimation();
        }
    }

    protected async onItemsChanged() {
        await new Promise<void>(resolve => setTimeout(() => resolve(), 1));
        const content = document.querySelector("#main-content") as HTMLElement;
        const viewport = content?.offsetHeight ?? window.innerHeight;

        const all_items = Array.from((this._itemsListRef?.nativeElement as HTMLElement)?.querySelectorAll(".animated-item") ?? []);
        if (all_items.length == 0) {
            this.finishAnimation();
        }

        if (!this._initAnimationDone && this._animateItems) {
            all_items.forEach((el: Element, index: number) => {
                if (el.classList.contains("animating")) {
                    return;
                }

                const ref = this.refElement(el as HTMLElement);
                if (this.animateElement(ref, viewport)) {
                    el.classList.add("animating");
                    setTimeout(() => {
                        const animation = CreateListitemAnimation(el as HTMLElement, ref, this._animationDirection);
                        animation.afterAddWrite(() => {
                            this._itemAnimations = this._itemAnimations?.filter(a => a != animation);
                            if (this._itemAnimations?.length == 0) {
                                this.finishAnimation();
                            }
                        });
                        if (this._itemAnimations) {
                            this._itemAnimations.push(animation);
                        } else {
                            this._itemAnimations = [animation];
                        }
                        animation.play();
                    }, index * 50);
                } else {
                    el.classList.remove("pre-animation-state", "animating");
                }
            });
        } else {
            all_items.forEach(el => {
                el.classList.remove("pre-animation-state", "animating");
            });
            this.finishAnimation();
        }
    }

    private finishAnimation() {
        this._itemAnimations = undefined;
        this._initAnimationDone = true;
        this.reload();
    }

    private refElement(el?: HTMLElement): HTMLElement | undefined {
        for (let i = 0; i < 5; i++) {
            if (el && el.tagName.toLowerCase() == "ion-item-sliding") {
                return el;
            }
            el = el?.parentElement as HTMLElement;
        }
        return undefined;
    }

    private animateElement(el?: HTMLElement, viewport?: number): boolean {
        if (el) {
            return el.offsetTop < window.scrollY + (viewport ? viewport : window.innerHeight);
        }
        return false;
    }
}
