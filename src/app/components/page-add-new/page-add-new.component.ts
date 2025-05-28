import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonImg } from "@ionic/angular/standalone";
import { AppService } from "../../services/app/app.service";

@Component({
    selector: 'app-page-add-new',
    imports: [IonImg, CommonModule,],
    templateUrl: './page-add-new.component.html',
    styleUrl: './page-add-new.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageAddNewComponent {

    public get isDarkMode(): boolean {
        return AppService.Darkmode;
    }
}
