import { Animation, AnimationController } from "@ionic/angular/standalone";

export const ToastAnimationFadeIn = (baseEl: HTMLElement, opts?: any): Animation => {
    return ToastAnimation(baseEl, opts, "in");
};

export const ToastAnimationFadeOut = (baseEl: HTMLElement, opts?: any): Animation => {
    return ToastAnimation(baseEl, opts, "out");
};

const ToastAnimation = (baseEl: HTMLElement, opts?: any, direction?: "in" | "out"): Animation => {
    const animationCtrl = new AnimationController();
    const toastDuration = direction == "in" ? 150 : 200;

    try {
        const toast = baseEl.shadowRoot?.querySelector(".toast-wrapper");
        const animations: Animation[] = [];
        if (toast) {
            //fade in
            animations.push(animationCtrl.create().addElement(toast).duration(toastDuration).iterations(1).fromTo("opacity", "0", "1").easing("ease-in-out"));

            const finalpos = opts.top;

            if (opts.position === "top") {
                animations.push(animationCtrl.create().addElement(toast).duration(toastDuration).iterations(1).fromTo("transform", "translateY(-100%)", `translateY(${finalpos})`).easing("ease-in-out"));
            } else {
                animations.push(animationCtrl.create().addElement(toast).duration(toastDuration).iterations(1).fromTo("transform", "translateY(100%)", `translateY(${finalpos})`).easing("ease-in-out"));
            }

            if (direction == "out") {
                animations.map(ani => {
                    ani.direction("reverse");
                });
            }

            return animationCtrl.create().addAnimation(animations);
        }
    } catch {}

    return animationCtrl.create();
};
