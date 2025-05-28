import { Animation, AnimationController } from "@ionic/angular/standalone";

export const CreateListitemAnimation = (baseEl?: HTMLElement, ref?: HTMLElement, direction: ListitemAnimationDirection = "top"): Animation => {
    const animationCtrl = new AnimationController();
    const duration = 400;

    if (!baseEl) {
        return animationCtrl.create();
    }

    let from, to;
    switch (direction) {
        default:
        case "top":
            const top = ref ? `-${ref.offsetHeight + ref.offsetTop}px` : "-100vh";
            from = `translateY(${top}`;
            to = "translateY(0)";
            break;
        case "bottom":
            from = "translateY(100vh)";
            to = "translateY(0)";
            break;
        case "left":
            from = "translateX(-100vw)";
            to = "translateX(0)";
            break;
        case "right":
            from = "translateX(100vw)";
            to = "translateX(0)";
            break;
    }

    const slide = animationCtrl.create().addElement(baseEl).duration(duration).easing("ease-out").iterations(1).fromTo("transform", from, to);
    const fade = animationCtrl.create().addElement(baseEl).duration(duration).iterations(1).fromTo("opacity", 0, 1).delay(0);

    return animationCtrl.create().addAnimation([slide, fade]).beforeAddClass("animating").afterRemoveClass(["animating", "pre-animation-state"]).afterClearStyles(["transform", "opacity"]);
};

export type ListitemAnimationDirection = "top" | "bottom" | "left" | "right";
