import { Component, Input } from "@angular/core";
import { IonBadge } from "@ionic/angular/standalone";

@Component({
    selector: "app-icon-with-badge",
    imports: [IonBadge],
    templateUrl: "./icon-with-badge.component.html",
    styleUrl: "./icon-with-badge.component.scss",
})
export class IconWithBadgeComponent {
    @Input("src") src: string = "";
    @Input("badgeColor") badgeColor = "danger";
    @Input("iconColor") iconColor?: string;
}
