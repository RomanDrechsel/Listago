import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShowlogsPage } from './showlogs.page';

describe('ShowlogsPage', () => {
    let component: ShowlogsPage;
    let fixture: ComponentFixture<ShowlogsPage>;

    beforeEach(() => {
        fixture = TestBed.createComponent(ShowlogsPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
