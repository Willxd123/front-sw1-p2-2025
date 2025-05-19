import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CanvasComponent } from '../../interface/canvas-component.interface';
import { SokectSevice } from '../../services/socket.service';

@Component({
  selector: 'app-sidebar-der',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar-der.component.html'
})
export class SidebarDerComponent {
  @Input() selectedComponent: CanvasComponent | null = null;
  @Input() roomCode: string = '';
  @Input() selectedPageId: string = '';

  constructor(private SokectSevice: SokectSevice) {}

  updateFlutterProperty(path: keyof CanvasComponent | string, value: any) {
    if (!this.selectedComponent) return;

    const parts = path.split('.');
    let target: any = this.selectedComponent;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!target[part]) target[part] = {};
      target = target[part];
    }

    target[parts[parts.length - 1]] = value;

    this.SokectSevice.updateComponentProperties(
      this.roomCode,
      this.selectedPageId!,
      this.selectedComponent.id,
      { [parts[0]]: this.selectedComponent[parts[0] as keyof CanvasComponent] }
    );
  }
}
