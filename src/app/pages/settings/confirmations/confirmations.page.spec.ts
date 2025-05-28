import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationsPage } from './confirmations.page';

describe('ConfirmationsPage', () => {
  let component: ConfirmationsPage;
  let fixture: ComponentFixture<ConfirmationsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ConfirmationsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
