
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
    selector: 'app-page-empty',
    imports: [],
    templateUrl: './page-empty.component.html',
    styleUrl: './page-empty.component.scss',
    encapsulation: ViewEncapsulation.ShadowDom,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageEmptyComponent { }
