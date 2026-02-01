import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkolSlot } from './skol-slot';

describe('SkolSlot', () => {
  let component: SkolSlot;
  let fixture: ComponentFixture<SkolSlot>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SkolSlot]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SkolSlot);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
