import { Animation, AnimationController } from "@ionic/angular/standalone";

export const PageTransitionAnimationDuration = 270;
export let UsePageTransitionAnimations = true; //TODO: preferences

export const PageTransitionAnimation = (baseEl: HTMLElement, opts?: any): Animation => {
    const animationCtrl = new AnimationController();
    if (opts && UsePageTransitionAnimations) {
        const animations: Animation[] = [];

        const entering_mainElement = (opts.enteringEl.querySelector("ion-content[role='main']") as HTMLElement) ?? opts.enteringEl;
        const leaving_mainElement = (opts.leavingEl.querySelector("ion-content[role='main']") as HTMLElement) ?? opts.leavingEl;
        const entering_toolbar = opts.enteringEl.querySelector("app-main-toolbar") as HTMLElement;

        if (entering_toolbar) {
            opts.enteringEl.classList.remove("ion-page-invisible");
            const entering_zindex = Number(opts.enteringEl.style.zIndex);
            const leaving_zindex = Number(opts.leavingEl.style.zIndex);
            const animation = animationCtrl.create().addElement(entering_toolbar).duration(PageTransitionAnimationDuration).iterations(1).fromTo("opacity", "0", "1");
            if (entering_zindex < leaving_zindex) {
                animation
                    .beforeAddWrite(() => {
                        opts.enteringEl.style.zIndex = `${leaving_zindex + 1}`;
                    })
                    .afterAddWrite(() => {
                        opts.enteringEl.style.zIndex = `${entering_zindex}`;
                    });
            }
            animations.push(animation);
        }

        try {
            if (opts.direction == "forward") {
                animations.push(animationCtrl.create().addElement(entering_mainElement).duration(PageTransitionAnimationDuration).iterations(1).fromTo("transform", "translateX(100%)", "translateX(0)").fromTo("opacity", "0", "1"));
                animations.push(animationCtrl.create().addElement(leaving_mainElement).duration(PageTransitionAnimationDuration).iterations(1).fromTo("transform", "translateX(0)", "translateX(-100%)").fromTo("opacity", "1", "0"));
            } else {
                animations.push(animationCtrl.create().addElement(entering_mainElement).duration(PageTransitionAnimationDuration).iterations(1).fromTo("transform", "translateX(-100%)", "translateX(0)").fromTo("opacity", "0", "1"));
                animations.push(animationCtrl.create().addElement(leaving_mainElement).duration(PageTransitionAnimationDuration).iterations(1).fromTo("transform", "translateX(0)", "translateX(100%)").fromTo("opacity", "1", "0"));
            }

            return animationCtrl.create().addAnimation(animations);
        } catch (error) {}
    }

    return animationCtrl.create();
};
