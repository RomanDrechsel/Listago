import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShowWatchLogsPage } from './show-watch-logs.page';

describe('ShowWatchLogsPage', () => {
  let component: ShowWatchLogsPage;
  let fixture: ComponentFixture<ShowWatchLogsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ShowWatchLogsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
