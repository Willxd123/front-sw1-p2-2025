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
  top: number;
  left: number;
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
  }
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
  // Métodos para la creación de widgets
  addContainer(parentId: string | null = null, top: number = 20, left: number = 20): CanvasComponent {
    const comp: CanvasComponent = {
      id: uuidv4(),
      type: 'Container',
      top: top,
      left: left,
      width: 100,
      height: 100,
      decoration: { color: '#ffffff', border: { color: '#000000', width: 1 }, borderRadius: 0 },
      parentId: parentId,
      children: [],
    };

    if (parentId) {
      this.addChildToParent(comp, parentId);
    } else {
      this.pantallas[this.currentPantalla].components.push(comp);
    }

    return comp;
  }

  addColumn(parentId: string | null = null, top: number = 20, left: number = 20): CanvasComponent {
    const comp: CanvasComponent = {
      id: uuidv4(),
      type: 'Column',
      top: top,
      left: left,
      width: 120,
      height: 150,
      decoration: { color: '#f0f0f0', border: { color: '#000000', width: 1 }, borderRadius: 0 },
      parentId: parentId,
      children: [],
    };

    if (parentId) {
      this.addChildToParent(comp, parentId);
    } else {
      this.pantallas[this.currentPantalla].components.push(comp);
    }

    return comp;
  }

  addText(parentId: string | null = null, top: number = 20, left: number = 20): CanvasComponent {
    const comp: CanvasComponent = {
      id: uuidv4(),
      type: 'Text',
      top: top,
      left: left,
      width: 100,
      height: 30,
      text: 'Texto',
      decoration: { color: 'transparent', border: { color: '#000000', width: 0 }, borderRadius: 0 },
      parentId: parentId,
      children: [],
    };

    if (parentId) {
      this.addChildToParent(comp, parentId);
    } else {
      this.pantallas[this.currentPantalla].components.push(comp);
    }

    return comp;
  }

  addDropdown(parentId: string | null = null, top: number = 20, left: number = 20): CanvasComponent {
    const comp: CanvasComponent = {
      id: uuidv4(),
      type: 'DropdownButton',
      top: top,
      left: left,
      width: 140,
      height: 40,
      decoration: { color: '#ffffff', border: { color: '#000000', width: 1 }, borderRadius: 4 },
      parentId: parentId,
      children: [],
    };

    if (parentId) {
      this.addChildToParent(comp, parentId);
    } else {
      this.pantallas[this.currentPantalla].components.push(comp);
    }

    return comp;
  }

  // Métodos del menú contextual
  onContextMenu(event: MouseEvent, comp: CanvasComponent): void {
    event.preventDefault();

    // Obtener la posición relativa del canvas
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();

    this.contextMenu = {
      visible: true,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      targetComponent: comp
    };

    this.cdr.detectChanges();
  }

  hideContextMenu(): void {
    this.contextMenu.visible = false;
    this.cdr.detectChanges();
  }

  // Agregar un widget hijo a través del menú contextual
  addChildWidget(type: string): void {
    if (!this.contextMenu.targetComponent) return;

    const parentId = this.contextMenu.targetComponent.id;

    // Agregar hijo con una posición relativa dentro del padre
    const offsetX = 10;
    const offsetY = 10;

    switch (type) {
      case 'Container':
        this.addContainer(parentId, offsetY, offsetX);
        break;
      case 'Column':
        this.addColumn(parentId, offsetY, offsetX);
        break;
      case 'Text':
        this.addText(parentId, offsetY, offsetX);
        break;
      case 'DropdownButton':
        this.addDropdown(parentId, offsetY, offsetX);
        break;
    }

    this.hideContextMenu();
  }

  // Método auxiliar para encontrar un componente por ID
  findComponentById(id: string): CanvasComponent | null {
    // Primero buscar en los componentes de nivel superior
    const rootComponent = this.pantallas[this.currentPantalla].components.find(c => c.id === id);
    if (rootComponent) return rootComponent;

    // Si no se encuentra en el nivel superior, buscar recursivamente en los hijos
    return this.findComponentInChildren(this.pantallas[0].components, id);
  }

  findComponentInChildren(components: CanvasComponent[], id: string): CanvasComponent | null {
    for (const component of components) {
      if (component.id === id) return component;

      if (component.children && component.children.length > 0) {
        const found = this.findComponentInChildren(component.children, id);
        if (found) return found;
      }
    }

    return null;
  }

  // Agregar un hijo a un componente padre
  addChildToParent(child: CanvasComponent, parentId: string): void {
    const parent = this.findComponentById(parentId);

    if (parent) {
      parent.children.push(child);
      child.parentId = parent.id;
    }
  }

  // Selección de componentes
  selectComponent(comp: CanvasComponent, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedComponent = comp;
  }

  // Funcionalidad de arrastrar y soltar
  onMouseDown(event: MouseEvent, comp: CanvasComponent): void {
    if (event.button !== 0) return; // Solo proceder con clic izquierdo

    event.preventDefault();
    event.stopPropagation();

    this.dragState.isDragging = true;
    this.dragState.component = comp;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.dragState.startX = event.clientX - rect.left;
    this.dragState.startY = event.clientY - rect.top;
    this.dragState.initialLeft = comp.left;
    this.dragState.initialTop = comp.top;

    // Seleccionar el componente que se está arrastrando
    this.selectedComponent = comp;
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.dragState.isDragging || !this.dragState.component) return;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const dx = event.clientX - rect.left - this.dragState.startX;
    const dy = event.clientY - rect.top - this.dragState.startY;

    this.dragState.component.left = this.dragState.initialLeft + dx;
    this.dragState.component.top = this.dragState.initialTop + dy;

    this.cdr.detectChanges();
  }

  onMouseUp(event: MouseEvent): void {
    this.dragState.isDragging = false;
    this.dragState.component = null;
  }

  // Método auxiliar para obtener la posición absoluta de un componente
  getAbsolutePosition(comp: CanvasComponent): { top: number, left: number } {
    let top = comp.top;
    let left = comp.left;

    // Si tiene un padre, agregar la posición del padre
    if (comp.parentId) {
      const parent = this.findComponentById(comp.parentId);
      if (parent) {
        const parentPos = this.getAbsolutePosition(parent);
        top += parentPos.top;
        left += parentPos.left;
      }
    }

    return { top, left };
  }

  // Generar estilos para la representación de componentes
  getComponentStyles(comp: CanvasComponent): any {
    // Para componentes raíz, usar su posición directa
    if (!comp.parentId) {
      return {
        top: comp.top + 'px',
        left: comp.left + 'px',
        width: comp.width + 'px',
        height: comp.height + 'px',
        backgroundColor: comp.decoration?.color,
        border: comp.decoration?.border?.width + 'px solid ' + comp.decoration?.border?.color,
        borderRadius: comp.decoration?.borderRadius + 'px'
      };
    }

    // Para componentes hijos, la posición es relativa al padre
    return {
      top: comp.top + 'px',
      left: comp.left + 'px',
      width: comp.width + 'px',
      height: comp.height + 'px',
      backgroundColor: comp.decoration?.color,
      border: comp.decoration?.border?.width + 'px solid ' + comp.decoration?.border?.color,
      borderRadius: comp.decoration?.borderRadius + 'px',
      position: 'absolute'
    };
  }

  getJsonCompleto(): string {
    const result: Record<string, CanvasComponent[]> = {};

    for (const pantalla of this.pantallas) {
      result[pantalla.name] = pantalla.components;
    }

    return JSON.stringify(result, null, 2);
  }
  generarCodigoFlutter(): string {
    const rootWidgets = this.pantallas[this.currentPantalla]?.components || [];

    const flutterCode = rootWidgets.map(c => this.generarWidget(c, true)).join(',\n');

    return `
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
  ${flutterCode.split('\n').map(line => '        ' + line).join('\n')}
        ],
      ),
    );
  }`.trim();
  }

  generarWidget(comp: CanvasComponent, esRaiz: boolean): string {
    const color = comp.decoration?.color ?? '#FFFFFF';
    const borderRadius = comp.decoration?.borderRadius ?? 0;
    const borderWidth = comp.decoration?.border?.width ?? 0;
    const borderColor = comp.decoration?.border?.color ?? '#000000';
  
    const width = comp.width;
    const height = comp.height;
  
    const childWidgets = (comp.children || []).map(child => this.generarWidget(child, false)).join(',\n');
  
    let baseWidget = '';
  
    switch (comp.type) {
      case 'Text':
        baseWidget = `Text('${comp.text || ''}')`;
        break;
  
      case 'DropdownButton':
        baseWidget = `DropdownButton(items: [], onChanged: (_) {}, hint: Text('Dropdown'))`;
        break;
  
      case 'Column':
        baseWidget = `Column(
          children: [
  ${childWidgets.split('\n').map(l => '          ' + l).join('\n')}
          ],
        )`;
        break;
  
      case 'Container':
      default:
        const childContent = comp.children && comp.children.length > 0
          ? `child: Stack(children: [\n${childWidgets.split('\n').map(l => '          ' + l).join('\n')}\n        ]),`
          : 'child: null,';
  
        baseWidget = `Container(
          width: ${width},
          height: ${height},
          decoration: BoxDecoration(
            color: Color(0xFF${color.replace('#', '')}),
            borderRadius: BorderRadius.circular(${borderRadius}),
            border: Border.all(color: Color(0xFF${borderColor.replace('#', '')}), width: ${borderWidth}),
          ),
          ${childContent}
        )`;
        break;
    }
  
    // Envolver en Positioned si tiene top/left definidos
    return `Positioned(
      top: ${comp.top},
      left: ${comp.left},
      child: ${baseWidget}
    )`;
  }
  



}
