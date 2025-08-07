import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdvertisementPage } from './advertisement.page';

describe('AdvertisementPage', () => {
  let component: AdvertisementPage;
  let fixture: ComponentFixture<AdvertisementPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AdvertisementPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
