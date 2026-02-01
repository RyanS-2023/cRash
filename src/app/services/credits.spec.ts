import { TestBed } from '@angular/core/testing';

import { Credits } from './credits';

describe('Credits', () => {
  let service: Credits;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Credits);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
