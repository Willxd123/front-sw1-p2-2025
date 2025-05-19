import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SokectSevice } from '../../../services/socket.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { v4 as uuidv4 } from 'uuid';

interface DragState {
  isDragging: boolean;
  component: CanvasComponent | null;
  startX: number;
  startY: number;
  initialLeft: number;
  initialTop: number;
}

interface pantalla {
  id: string;
  name: string;
  components: CanvasComponent[];
}

interface CanvasComponent {
  id: string;
  type: string;
  top?: number;
  left?: number;
  width: number;
  height: number;
  decoration: {
    color: string;
    border: {
      color: string;
      width: number;
    };
    borderRadius: number;
  };
  text?: string;
  alignment?: 'topLeft' | 'topCenter' | 'topRight' |
            'centerLeft' | 'center' | 'centerRight' |
            'bottomLeft' | 'bottomCenter' | 'bottomRight';

  options?: string[];

  children: CanvasComponent[];
  parentId: string | null;
}

interface ContextMenu {
  visible: boolean;
  x: number;
  y: number;
  targetComponent: CanvasComponent | null;
}

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    DragDropModule,
  ],
  templateUrl: './rooms.component.html',
  styleUrls: ['./rooms.component.css'],
})
export class RoomsComponent implements OnInit {
  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLDivElement>;

  pantallas: pantalla[] = [];
  selectedComponent: CanvasComponent | null = null;
  contextMenu: ContextMenu = {
    visible: false,
    x: 0,
    y: 0,
    targetComponent: null
  };
  components: CanvasComponent[] = [];
  private dragState: DragState = {
    isDragging: false,
    component: null,
    startX: 0,
    startY: 0,
    initialLeft: 0,
    initialTop: 0,
  };

 
  dropdownSelectionMap: Record<string, string> = {};

  currentPantalla = 0;
  isModalFlutterCodeOpen: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private sokectService: SokectSevice,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.pantallas = [{ id: uuidv4(), name: 'Página 1', components: [] }];

     // inicializar valores visibles por defecto si ya hay componentes cargados
  
  }

  //para el panel izquierdo para agregar widgets al canvas
  addPantalla(): void {
    const nueva: pantalla = {
      id: uuidv4(),
      name: `Pantalla ${this.pantallas.length + 1}`,
      components: []
    };
    this.pantallas.push(nueva);
    this.currentPantalla = this.pantallas.length - 1;
    this.selectedComponent = null;
  }

  changePantalla(index: number): void {
    this.currentPantalla = index;
    this.selectedComponent = null;
  }
  addContainer(): void {
    const newContainer: CanvasComponent = {
      id: uuidv4(),
      type: 'Container',
      top: 50,
      left: 50,
      width: 100,
      height: 100,
      decoration: {
        color: '#ffffff',
        border: {
          color: '#000000',
          width: 1
        },
        borderRadius: 4
      },
      children: [],
      parentId: null
    };
  
    this.pantallas[this.currentPantalla].components.push(newContainer);
    this.selectedComponent = newContainer;
  }
//fin

//para el panel derecho encargado de actualizar las propiedades de un widget
  updateProperty(key: keyof CanvasComponent | string, value: any): void {
    if (!this.selectedComponent) return;
  
    const keys = key.split('.');
    let target: any = this.selectedComponent;
  
    while (keys.length > 1) {
      const prop = keys.shift()!;
      if (!(prop in target)) target[prop] = {};
      target = target[prop];
    }
  
    target[keys[0]] = value;
    this.cdr.detectChanges();
  }

  getEventValue(event: Event): string {
    const target = event.target as HTMLInputElement | null;
    return target?.value || '';
  }
  getInputValue(event: Event): string {
    return (event.target as HTMLInputElement)?.value || '';
  }
  
  getInputNumberValue(event: Event): number {
    const value = (event.target as HTMLInputElement)?.value;
    return value !== undefined ? +value : 0;
  }

  
//fin

//para el drag and drop o movimiento
onMouseDown(event: MouseEvent, component: CanvasComponent): void {
  event.stopPropagation();
  this.selectedComponent = component;

  this.dragState = {
    isDragging: true,
    component,
    startX: event.clientX,
    startY: event.clientY,
    initialLeft: component.left ?? 0,
    initialTop: component.top ?? 0
  };
}

onMouseMove(event: MouseEvent): void {
  if (!this.dragState.isDragging || !this.dragState.component) return;

  const deltaX = event.clientX - this.dragState.startX;
  const deltaY = event.clientY - this.dragState.startY;

  this.dragState.component.left = this.dragState.initialLeft + deltaX;
  this.dragState.component.top = this.dragState.initialTop + deltaY;

  this.cdr.detectChanges();
}

onMouseUp(event: MouseEvent): void {
  if (this.dragState.isDragging) {
    this.dragState.isDragging = false;
    this.dragState.component = null;
  }
}

//fin
getComponentStyle(comp: CanvasComponent): any {
  const style: any = {
    width: comp.width + 'px',
    height: comp.height + 'px',
    backgroundColor: comp.decoration.color,
    border: `${comp.decoration.border.width}px solid ${comp.decoration.border.color}`,
    borderRadius: comp.decoration.borderRadius + 'px',
    position: 'absolute'
  };

  if (!comp.alignment) {
    style.top = comp.top + 'px';
    style.left = comp.left + 'px';
    return style;
  }

  // Canvas dimensions
  const canvasWidth = 360;
  const canvasHeight = 812;

  const x = {
    left: 0,
    center: (canvasWidth - comp.width) / 2,
    right: canvasWidth - comp.width
  };

  const y = {
    top: 0,
    center: (canvasHeight - comp.height) / 2,
    bottom: canvasHeight - comp.height
  };

  const alignmentMap: Record<string, { top: number; left: number }> = {
    topLeft: { top: y.top, left: x.left },
    topCenter: { top: y.top, left: x.center },
    topRight: { top: y.top, left: x.right },
    centerLeft: { top: y.center, left: x.left },
    center: { top: y.center, left: x.center },
    centerRight: { top: y.center, left: x.right },
    bottomLeft: { top: y.bottom, left: x.left },
    bottomCenter: { top: y.bottom, left: x.center },
    bottomRight: { top: y.bottom, left: x.right }
  };

  const pos = alignmentMap[comp.alignment];
  style.top = pos.top + 'px';
  style.left = pos.left + 'px';

  return style;
}
getPantallaSinTopLeft(): CanvasComponent[] {
  return this.pantallas[this.currentPantalla].components.map((comp) => {
    const clone: CanvasComponent = JSON.parse(JSON.stringify(comp));

    if (clone.alignment) {
      delete clone.top;
      delete clone.left;
    }

    return clone;
  });
}

//exportar flutter codigo en el modal
generateFlutterCode(): string {
  const components = this.getPantallaSinTopLeft();

  const widgets = components.map((comp) => {
    const props = [];

    props.push(`width: ${comp.width}`);
    props.push(`height: ${comp.height}`);
    props.push(`color: Color(0xFF${comp.decoration.color.replace('#', '')})`);
    props.push(`borderRadius: BorderRadius.circular(${comp.decoration.borderRadius})`);
    props.push(`decoration: BoxDecoration(
      color: Color(0xFF${comp.decoration.color.replace('#', '')}),
      border: Border.all(color: Color(0xFF${comp.decoration.border.color.replace('#', '')}), width: ${comp.decoration.border.width}),
      borderRadius: BorderRadius.circular(${comp.decoration.borderRadius}),
    )`);

    const container = `Container(
  width: ${comp.width},
  height: ${comp.height},
  decoration: BoxDecoration(
    color: Color(0xFF${comp.decoration.color.replace('#', '')}),
    border: Border.all(color: Color(0xFF${comp.decoration.border.color.replace('#', '')}), width: ${comp.decoration.border.width}),
    borderRadius: BorderRadius.circular(${comp.decoration.borderRadius}),
  ),
)`;

    if (comp.alignment) {
      return `Align(
  alignment: Alignment.${comp.alignment},
  child: ${container},
)`;
    } else {
      return `Positioned(
  top: ${comp.top},
  left: ${comp.left},
  child: ${container},
)`;
    }
  }).join(',\n\n');

  return `@override
Widget build(BuildContext context) {
  return Scaffold(
    body: Stack(
      children: [
${widgets.split('\n').map(line => '        ' + line).join('\n')}
      ],
    ),
  );
}`;
}

}
