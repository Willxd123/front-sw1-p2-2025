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
  icon?: string;           // Nombre del icono, ej. "home_outlined"
  tooltip?: string;        // Texto tooltip
  navigateTo?: string;     // Ruta de navegación, ej. "/pantalla2"

  children: CanvasComponent[];
  parentId: string | null;
}

interface ContextMenu {
  visible: boolean;
  x: number;
  y: number;
  targetId: string | null;
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
    targetId: null
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
  //instancias
  pantallaCustomRoute: string = '';

  isPreviewMode: boolean = false;
  previewPantallaIndex: number = 0;

  dropdownSelectionMap: Record<string, string> = {};

  currentPantalla = 0;
  isModalFlutterCodeOpen: boolean = false;

  copiedComponent: CanvasComponent | null = null;
  cutMode: boolean = false;

  //Find de instancias
  constructor(
    private route: ActivatedRoute,
    private sokectService: SokectSevice,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    /*     this.pantallas = [{ id: uuidv4(), name: 'Pantalla 1', components: [] }];
     */

    // Detectar tecla Escape
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    // Listener global para ocultar el menú contextual si se hace clic fuera
    document.addEventListener('click', this.handleDocumentClick.bind(this));
  }

  //para el panel izquierdo para agregar widgets al canvas
  getJsonCompleto(): string {
    // Limpia cada pantalla usando la misma lógica que para el código Dart
    const pantallasLimpias = this.pantallas.map((pantalla) => {
      const components = pantalla.components.map((comp) => {
        const clone: CanvasComponent = JSON.parse(JSON.stringify(comp));
        if (clone.alignment) {
          delete clone.top;
          delete clone.left;
        }
        return clone;
      });

      return {
        id: pantalla.id,
        name: pantalla.name,
        components
      };
    });

    return JSON.stringify(pantallasLimpias, null, 2);
  }
  //agregar pantalla
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

  addIconButton(): void {
    const newIconButton: CanvasComponent = {
      id: uuidv4(),
      type: 'IconButton',
      top: 50,
      left: 50,
      width: 48,
      height: 48,
      decoration: {
        color: '#ffffff',
        border: {
          color: '#000000',
          width: 0
        },
        borderRadius: 8
      },
      icon: 'home_outlined',
      tooltip: 'Ir a pantalla 2',
      navigateTo: '/pantalla2',
      children: [],
      parentId: null
    };

    this.pantallas[this.currentPantalla].components.push(newIconButton);
    this.selectedComponent = newIconButton;
  }
  goToPantalla(ruta: string): void {
    const nombreRuta = ruta.replace('/', '');
    const index = this.pantallas.findIndex(p =>
      p.name.toLowerCase().replace(/ /g, '') === nombreRuta
    );
    if (index !== -1) {
      this.previewPantallaIndex = index;
    }
  }
  //metodo par salir del modo previsualizacion con la tecla escape
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isPreviewMode) {
      this.isPreviewMode = false;
    }
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

  //petodo par seleccionar un widget
  selectComponent(comp: CanvasComponent, event: MouseEvent): void {
    event.stopPropagation(); // evita que un hijo sobreescriba la selección del padre
    this.selectedComponent = comp;
    this.contextMenu.visible = false;
  }
  

  //metodos para el menu contextual donde se elimina el widget y otras opciones
  onRightClick(event: MouseEvent, component: CanvasComponent): void {
    event.preventDefault();

    const canvasRect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - canvasRect.left;
    const y = event.clientY - canvasRect.top;

    this.contextMenu = {
      visible: true,
      x,
      y,
      targetId: component.id
    };
  }
  //metodo para cerrar el menu contextual
  handleDocumentClick(event: MouseEvent): void {
    // Si el menú está abierto y el clic no fue dentro del menú, lo cerramos
    const menu = document.getElementById('context-menu');
    if (this.contextMenu.visible && menu && !menu.contains(event.target as Node)) {
      this.contextMenu.visible = false;
      this.contextMenu.targetId = null;
      this.cdr.detectChanges();
    }
  }

  //metodo recursivo para eliminar un widget
  removeComponent(id: string): void {
    const pantalla = this.pantallas[this.isPreviewMode ? this.previewPantallaIndex : this.currentPantalla];

    this.removeRecursive(pantalla.components, id);

    if (this.selectedComponent?.id === id) {
      this.selectedComponent = null;
    }

    this.contextMenu.visible = false;
    this.contextMenu.targetId = null;
    this.cdr.detectChanges();
  }

  removeRecursive(list: CanvasComponent[], id: string): boolean {
    const index = list.findIndex(c => c.id === id);
    if (index !== -1) {
      list.splice(index, 1);
      return true;
    }
    for (const comp of list) {
      if (comp.children && this.removeRecursive(comp.children, id)) {
        return true;
      }
    }
    return false;
  }

  copyComponent(comp: CanvasComponent): void {
    this.copiedComponent = JSON.parse(JSON.stringify(comp));
    this.cutMode = false;
    this.contextMenu.visible = false;
  }
  
  cutComponent(comp: CanvasComponent): void {
    this.copiedComponent = JSON.parse(JSON.stringify(comp));
    this.cutMode = true;
    this.contextMenu.visible = false;
  }
  
  pasteComponent(parentId: string): void {
    if (!this.copiedComponent) return;
  
    const pasted = JSON.parse(JSON.stringify(this.copiedComponent));
    pasted.id = uuidv4(); // nueva ID
    pasted.parentId = parentId;
  
    const pantalla = this.pantallas[this.isPreviewMode ? this.previewPantallaIndex : this.currentPantalla];
    const parent = this.findComponentById(pantalla.components, parentId);
    if (parent) {
      parent.children.push(pasted);
    }
  
    if (this.cutMode) {
      this.removeRecursive(pantalla.components, this.copiedComponent.id);
      this.cutMode = false;
    }
  
    this.copiedComponent = null;
    this.contextMenu.visible = false;
    this.cdr.detectChanges();
  }
  
  addChild(parentId: string): void {
    const child: CanvasComponent = {
      id: uuidv4(),
      type: 'Container',
      width: 80,
      height: 80,
      top: 10,
      left: 10,
      decoration: {
        color: '#f0f0f0',
        border: { color: '#888888', width: 1 },
        borderRadius: 4,
      },
      children: [],
      parentId
    };
  
    const pantalla = this.pantallas[this.isPreviewMode ? this.previewPantallaIndex : this.currentPantalla];
    const parent = this.findComponentById(pantalla.components, parentId);
    if (parent) {
      parent.children.push(child);
    }
  
    this.contextMenu.visible = false;
    this.cdr.detectChanges();
  }
  
  findComponentById(list: CanvasComponent[], id: string): CanvasComponent | null {
    for (const comp of list) {
      if (comp.id === id) return comp;
      if (comp.children?.length) {
        const found = this.findComponentById(comp.children, id);
        if (found) return found;
      }
    }
    return null;
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
  
    // Buscar padre si el componente es hijo
    const parent = comp.parentId
      ? this.findComponentById(this.pantallas[this.currentPantalla].components, comp.parentId)
      : null;
  
    const parentWidth = parent?.width || 360;
    const parentHeight = parent?.height || 812;
  
    if (!comp.alignment) {
      style.top = (comp.top ?? 0) + 'px';
      style.left = (comp.left ?? 0) + 'px';
      return style;
    }
  
    const x = {
      left: 0,
      center: (parentWidth - comp.width) / 2,
      right: parentWidth - comp.width
    };
  
    const y = {
      top: 0,
      center: (parentHeight - comp.height) / 2,
      bottom: parentHeight - comp.height
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
  handleNavigateToChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (!this.selectedComponent) return;

    if (value === 'custom') {
      this.updateProperty('navigateTo', 'custom');
    } else {
      this.updateProperty('navigateTo', value);
      this.pantallaCustomRoute = value;
    }
  }
  getRutaPantalla(nombre: string): string {
    return '/' + nombre.toLowerCase().replace(/ /g, '');
  }

  //exportar flutter codigo en el modal
  generateFlutterCode(): string {
    const components = this.getPantallaSinTopLeft();

    const widgets = components.map((comp) => {
      // Si es IconButton
      if (comp.type === 'IconButton') {
        const tooltip = comp.tooltip ?? '';
        const icon = comp.icon ?? 'help_outline';
        const route = comp.navigateTo ?? '/';

        if (comp.alignment) {
          return `Align(
  alignment: Alignment.${comp.alignment},
  child: IconButton(
    tooltip: '${tooltip}',
    icon: const Icon(Icons.${icon}),
    onPressed: () {
      Navigator.pushNamed(context, '${route}');
    },
  ),
)`;
        } else {
          return `Positioned(
  top: ${comp.top ?? 0},
  left: ${comp.left ?? 0},
  child: IconButton(
    tooltip: '${tooltip}',
    icon: const Icon(Icons.${icon}),
    onPressed: () {
      Navigator.pushNamed(context, '${route}');
    },
  ),
)`;
        }
      }

      // Si es Container
      const container = `Container(
  width: ${comp.width},
  height: ${comp.height},
  decoration: BoxDecoration(
    color: Color(0xFF${comp.decoration.color.replace('#', '')}),
    border: Border.all(
      color: Color(0xFF${comp.decoration.border.color.replace('#', '')}),
      width: ${comp.decoration.border.width}
    ),
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
  top: ${comp.top ?? 0},
  left: ${comp.left ?? 0},
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
