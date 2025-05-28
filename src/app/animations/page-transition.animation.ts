import { Animation, AnimationController } from "@ionic/angular/standalone";

export const PageTransitionAnimation = (baseEl: HTMLElement, opts?: any): Animation => {
    const animationCtrl = new AnimationController();
    const duration = 270;

    try {
        if (opts.direction == "forward") {
            const fadeAnimation = animationCtrl
                .create()
                .addElement(opts.enteringEl)
                .duration(duration * 1.5)
                .iterations(1)
                .fromTo("opacity", 0, 1);

            const forwardAnimation = animationCtrl.create().addElement(opts.enteringEl).duration(duration).iterations(1).fromTo("transform", "translateX(100%)", "translateX(0)");

            const leavingAnimation = animationCtrl.create().addElement(opts.leavingEl).duration(duration).iterations(1).fromTo("transform", "translateX(0)", "translateX(-100%)");

            return animationCtrl.create().addAnimation([fadeAnimation, forwardAnimation, leavingAnimation]);
        } else {
            const fadeAnimation = animationCtrl
                .create()
                .addElement(opts.enteringEl)
                .duration(duration * 1.5)
                .iterations(1)
                .fromTo("opacity", 0, 1);

            const backwardsAnimation = animationCtrl.create().addElement(opts.enteringEl).duration(duration).iterations(1).fromTo("transform", "translateX(-100%)", "translateX(0)");

            const leavingAnimation = animationCtrl.create().addElement(opts.leavingEl).duration(duration).iterations(1).fromTo("transform", "translateX(0)", "translateX(100%)").fromTo("opacity", 1, 0);

            return animationCtrl.create().addAnimation([fadeAnimation, backwardsAnimation, leavingAnimation]);
        }
    } catch (error) {
        return animationCtrl.create();
    }
};
