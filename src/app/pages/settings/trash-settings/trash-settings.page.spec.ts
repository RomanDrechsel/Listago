import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrashSettingsPage } from './trash-settings.page';

describe('TrashPage', () => {
    let component: TrashSettingsPage;
    let fixture: ComponentFixture<TrashSettingsPage>;

    beforeEach(() => {
        fixture = TestBed.createComponent(TrashSettingsPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
