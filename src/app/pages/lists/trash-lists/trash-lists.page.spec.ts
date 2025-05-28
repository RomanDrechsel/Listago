import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrashListsPage } from './trash-lists.page';

describe('TrashListsPage', () => {
  let component: TrashListsPage;
  let fixture: ComponentFixture<TrashListsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TrashListsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
