import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImExportPage } from './im-export.page';

describe('ImExportPage', () => {
  let component: ImExportPage;
  let fixture: ComponentFixture<ImExportPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ImExportPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
