import { Animation, AnimationController } from "@ionic/angular/standalone";

export const CreateEditMenuModalAnimation = (baseEl: HTMLElement, direction?: "enter" | "leave"): Animation => {
    const animationCtrl = new AnimationController();
    const duration = 400;

    const wrapper = baseEl.shadowRoot?.querySelector('[part="content"]');
    const wrapperAnimation = animationCtrl.create().addElement(wrapper!).fromTo("transform", "translateY(-150%)", "translateY(0)").fromTo("opacity", 0.5, 1).beforeClearStyles(["transform"]).beforeStyles({ opacity: 0.5 });
    const animation = animationCtrl.create().addElement(baseEl).easing("ease-out").duration(duration).addAnimation(wrapperAnimation);
    if (direction === "enter") {
        return animation;
    } else {
        return animation.direction("reverse");
    }
};
