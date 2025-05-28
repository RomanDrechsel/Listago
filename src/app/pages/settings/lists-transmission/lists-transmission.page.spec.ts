import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListsTransmissionPage } from './lists-transmission.page';

describe('ListsTransmissionPage', () => {
  let component: ListsTransmissionPage;
  let fixture: ComponentFixture<ListsTransmissionPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ListsTransmissionPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
