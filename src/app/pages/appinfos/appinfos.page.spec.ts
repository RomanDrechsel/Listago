import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppinfosPage } from './appinfos.page';

describe('AppinfosPage', () => {
  let component: AppinfosPage;
  let fixture: ComponentFixture<AppinfosPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AppinfosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
