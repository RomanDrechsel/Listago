import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FirstStartPage } from './first-start.page';

describe('FirstStartPage', () => {
  let component: FirstStartPage;
  let fixture: ComponentFixture<FirstStartPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(FirstStartPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
