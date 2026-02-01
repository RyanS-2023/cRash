import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoPoker } from './video-poker';

describe('VideoPoker', () => {
  let component: VideoPoker;
  let fixture: ComponentFixture<VideoPoker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoPoker]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VideoPoker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
