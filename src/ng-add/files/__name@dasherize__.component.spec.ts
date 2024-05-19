import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyTerminalComponent } from './my-terminal.component';

describe('<%= classify(name) %>Component', () => {
  let component: MyTerminalComponent;
  let fixture: ComponentFixture<<%= classify(name) %>Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [<%= classify(name) %>Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(<%= classify(name) %>Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
