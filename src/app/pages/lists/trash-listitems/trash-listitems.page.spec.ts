import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrashListitemsPage } from './trash-listitems.page';

describe('TrashListitemsPage', () => {
  let component: TrashListitemsPage;
  let fixture: ComponentFixture<TrashListitemsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TrashListitemsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
