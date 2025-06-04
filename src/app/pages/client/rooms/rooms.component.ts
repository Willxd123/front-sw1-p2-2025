import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
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

interface Page {
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
  alignment?:
    | 'topLeft'
    | 'topCenter'
    | 'topRight'
    | 'centerLeft'
    | 'center'
    | 'centerRight'
    | 'bottomLeft'
    | 'bottomCenter'
    | 'bottomRight';

  options?: string[];
  icon?: string; // Nombre del icono, ej. "home_outlined"
  tooltip?: string; // Texto tooltip
  navigateTo?: string; // Ruta de navegación, ej. "/pantalla2"

  // NUEVAS para AppBar
  title?: string;
  centerTitle?: boolean;
  leading?: CanvasComponent | null;
  actions?: CanvasComponent[];

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
  imports: [CommonModule, FormsModule, RouterModule, DragDropModule],
  templateUrl: './rooms.component.html',
  styleUrls: ['./rooms.component.css'],
})
export class RoomsComponent implements OnInit {
  @ViewChild('canvas', { static: false })
  canvasRef!: ElementRef<HTMLDivElement>;

  pages: Page[] = [];
  selectedComponent: CanvasComponent | null = null;
  contextMenu: ContextMenu = {
    visible: false,
    x: 0,
    y: 0,
    targetId: null,
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
  currentUserId: number = 0;

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
    private cdr: ChangeDetectorRef
  ) {}
  roomCode: string = '';
  roomName: string = '';
  roomId: number = 0;
  errorMessage: string = '';
  usersInRoom: any[] = [];
  showParticipants: boolean = false;
  ngOnInit(): void {
    this.roomCode = this.route.snapshot.paramMap.get('code') || '';

    if (this.roomCode) {
      this.sokectService.joinRoom(this.roomCode);
    }

    // Escucha el canvas inicial
    this.sokectService.onInitialCanvasLoad().subscribe((pages) => {
      this.pages = pages;

      if (pages.length === 0) {
        this.addPage(); // Emitirá la creación por socket si es el primero
      } else {
        this.currentPantalla = 0;
      }

      this.cdr.detectChanges();
    });

    // Escucha nuevas páginas agregadas por otros usuarios
    this.sokectService.onPageAdded().subscribe((page: Page) => {
      const yaExiste = this.pages.some((p) => p.id === page.id);
      if (!yaExiste) {
        this.pages.push(page);
        this.currentPantalla = this.pages.length - 1;
        this.selectedComponent = null;
        this.cdr.detectChanges();
      }
    });
    this.sokectService.onPageRemoved().subscribe((pageId: string) => {
      this.pages = this.pages.filter((p) => p.id !== pageId);
      if (this.currentPantalla >= this.pages.length) {
        this.currentPantalla = this.pages.length - 1;
      }
      this.cdr.detectChanges();
    });
    // Escucha otras conexiones
    this.sokectService.onUsersListUpdate().subscribe((users) => {
      this.usersInRoom = users;
      this.cdr.detectChanges();
    });
    //addconteiner
    this.sokectService.onComponentAdded().subscribe(({ pageId, component }) => {
      const page = this.pages.find((p) => p.id === pageId);
      if (page) {
        page.components.push(component);
        this.selectedComponent = component;
        this.cdr.detectChanges();
      }
    });
    //actualizar propiedades de un widget
    this.sokectService
      .onComponentPropertiesUpdated()
      .subscribe(({ pageId, componentId, updates }) => {
        const page = this.pages.find((p) => p.id === pageId);
        if (!page) return;

        const component = this.findComponentById(page.components, componentId);
        if (!component) return;

        const apply = (target: any, keys: string[], value: any) => {
          while (keys.length > 1) {
            const key = keys.shift()!;
            if (!(key in target)) target[key] = {};
            target = target[key];
          }
          target[keys[0]] = value;
        };

        Object.entries(updates).forEach(([key, value]) => {
          apply(component, key.split('.'), value);
        });

        this.cdr.detectChanges();
      });
    //movimiento
    this.sokectService
      .onComponentMoved()
      .subscribe(({ pageId, componentId, newPosition }) => {
        const page = this.pages.find((p) => p.id === pageId);
        if (!page) return;

        const comp = this.findComponentById(page.components, componentId);

        if (!comp) return;

        // Actualizar posición visual
        comp.left = newPosition.left;
        comp.top = newPosition.top;

        this.cdr.detectChanges();
      });
    //eliminar widget;
    this.sokectService
      .onComponentRemoved()
      .subscribe(({ pageId, componentId }) => {
        console.log('🧨 Recibido componentRemoved', { pageId, componentId });

        const page = this.pages.find((p) => p.id === pageId);
        if (page) {
          this.removeRecursive(page.components, componentId);
        }

        if (this.selectedComponent?.id === componentId) {
          this.selectedComponent = null;
        }

        this.contextMenu.visible = false;
        this.contextMenu.targetId = null;
        this.cdr.detectChanges();
      });
    //hijos
    this.sokectService
      .onChildComponentAdded()
      .subscribe(({ parentId, childComponent }) => {
        const page =
          this.pages[
            this.isPreviewMode
              ? this.previewPantallaIndex
              : this.currentPantalla
          ];

        const parent = this.findComponentById(page.components, parentId);
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(childComponent);
          this.cdr.detectChanges();
        }
      });
    //fin hijos
    //para el modo previsualizacion
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('click', this.handleDocumentClick.bind(this));
  }

  //para el panel izquierdo para agregar widgets al canvas
  getJsonCompleto(): string {
    // Limpia cada Page usando la misma lógica que para el código Dart
    const pantallasLimpias = this.pages.map((Page) => {
      const components = Page.components.map((comp) => {
        const clone: CanvasComponent = JSON.parse(JSON.stringify(comp));
        if (clone.alignment) {
          delete clone.top;
          delete clone.left;
        }
        return clone;
      });

      return {
        id: Page.id,
        name: Page.name,
        components,
      };
    });

    return JSON.stringify(pantallasLimpias, null, 2);
  }
  //agregar Page
  addPage(): void {
    const newPage: Page = {
      id: uuidv4(),
      name: `Pantalla ${this.pages.length + 1}`,
      components: [],
    };

    if (this.roomCode) {
      this.sokectService.addPage(this.roomCode, newPage);
    }
  }

  changePantalla(index: number): void {
    this.currentPantalla = index;
    this.selectedComponent = null;
  }

  removePage(pageId: string): void {
    if (!this.roomCode) return;

    // Eliminar la página localmente
    this.pages = this.pages.filter((p) => p.id !== pageId);

    // Ajustar índice actual si es necesario
    if (this.currentPantalla >= this.pages.length) {
      this.currentPantalla = Math.max(this.pages.length - 1, 0);
    }

    this.sokectService.removePage(this.roomCode, pageId);
    this.cdr.detectChanges();
  }
  addAppBar(): void {
    const newAppBar: CanvasComponent = {
      id: uuidv4(),
      type: 'AppBar',
      top: 0,
      left: 0,
      width: 360,
      height: 56,
      decoration: {
        color: '#2196f3',
        border: { color: '#000000', width: 0 },
        borderRadius: 0,
      },
      children: [],
      parentId: null,
    };

    const pageId = this.pages[this.currentPantalla].id;
    this.sokectService.addCanvasComponent(this.roomCode, pageId, newAppBar);
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
          width: 1,
        },
        borderRadius: 4,
      },
      children: [],
      parentId: null,
    };
    const pageId = this.pages[this.currentPantalla].id;

    this.sokectService.addCanvasComponent(this.roomCode, pageId, newContainer);
  }
  addTextChild(parentId: string): void {
    const child: CanvasComponent = {
      id: uuidv4(),
      type: 'Text',
      text: 'Título',
      width: 100,
      height: 30,
      top: 10,
      left: 10,
      decoration: {
        color: 'transparent',
        border: { color: '#000000', width: 0 },
        borderRadius: 0,
      },
      children: [],
      parentId,
    };

    const pageId =
      this.pages[
        this.isPreviewMode ? this.previewPantallaIndex : this.currentPantalla
      ].id;

    this.sokectService.addChildComponent(
      this.roomCode,
      parentId,
      child,
      pageId
    );
    this.contextMenu.visible = false;
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
          width: 0,
        },
        borderRadius: 8,
      },
      icon: 'home_outlined',
      tooltip: 'Ir a Page 2',
      navigateTo: '/pantalla2',
      children: [],
      parentId: null,
    };

    const pageId = this.pages[this.currentPantalla].id;

    this.sokectService.addCanvasComponent(this.roomCode, pageId, newIconButton);
  }
  goToPantalla(ruta: string): void {
    const nombreRuta = ruta.replace('/', '');
    const index = this.pages.findIndex(
      (p) => p.name.toLowerCase().replace(/ /g, '') === nombreRuta
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

  updateProperty(key: string, value: any): void {
    if (!this.selectedComponent || !this.roomCode) return;

    const pageId = this.pages[this.currentPantalla].id;
    const componentId = this.selectedComponent.id;

    const updates: any = {};
    updates[key] = value;

    this.sokectService.updateComponentProperties(
      this.roomCode,
      pageId,
      componentId,
      updates
    );
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
      initialTop: component.top ?? 0,
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
  /*  onMouseMove(event: MouseEvent): void {
    if (!this.dragState.isDragging || !this.dragState.component) return;

    const comp = this.dragState.component;

    // Solo mover si no tiene alignment
    if (!comp.alignment) {
      const deltaX = event.clientX - this.dragState.startX;
      const deltaY = event.clientY - this.dragState.startY;

      comp.left = this.dragState.initialLeft + deltaX;
      comp.top = this.dragState.initialTop + deltaY;

      // Emitir al socket en tiempo real
      this.SokectSevice.moveComponent(
        this.roomCode,
        this.currentPageId,
        comp.id,
        {
          left: comp.left,
          top: comp.top,
          userId: this.currentUserId,
        }
      );

      this.cdr.detectChanges();
    }
  } */

  get currentPageId(): string {
    return this.pages[this.currentPantalla]?.id || '';
  }
  onMouseUp(event: MouseEvent): void {
    if (this.dragState.isDragging && this.dragState.component) {
      const comp = this.dragState.component;

      // Solo emitir si no hay alignment (se puede mover)
      if (!comp.alignment) {
        this.sokectService.moveComponent(
          this.roomCode,
          this.currentPageId,
          comp.id,
          {
            left: comp.left ?? 0,
            top: comp.top ?? 0,
            userId: this.currentUserId, // si lo necesitas en el backend
          }
        );
      }

      this.dragState.isDragging = false;
      this.dragState.component = null;
    }
  }

  //metodo par seleccionar un widget
  selectComponent(comp: CanvasComponent, event: MouseEvent): void {
    event.stopPropagation(); // evita que un hijo sobreescriba la selección del padre
    this.selectedComponent = comp;
    this.contextMenu.visible = false;
  }

  //metodos para el menu contextual donde se elimina el widget y otras opciones
  pastePosition: { x: number; y: number } | null = null;

  onRightClick(
    event: MouseEvent,
    component: CanvasComponent | null = null
  ): void {
    event.preventDefault();
    event.stopPropagation();

    const canvasRect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - canvasRect.left;
    const y = event.clientY - canvasRect.top;

    this.contextMenu = {
      visible: true,
      x,
      y,
      targetId: component?.id ?? null,
    };

    // Guardamos la posición del mouse para pegado libre
    this.pastePosition = component ? null : { x, y };
  }

  //metodo para cerrar el menu contextual
  handleDocumentClick(event: MouseEvent): void {
    // Si el menú está abierto y el clic no fue dentro del menú, lo cerramos
    const menu = document.getElementById('context-menu');
    if (
      this.contextMenu.visible &&
      menu &&
      !menu.contains(event.target as Node)
    ) {
      this.contextMenu.visible = false;
      this.contextMenu.targetId = null;
      this.cdr.detectChanges();
    }
  }

  //metodo recursivo para eliminar un widget

  removeComponent(id: string): void {
    const page = this.pages[this.currentPantalla];
    const pageId = page.id;

    this.sokectService.removeCanvasComponent(this.roomCode, pageId, id);
  }

  removeRecursive(list: CanvasComponent[], id: string): boolean {
    const index = list.findIndex((c) => c.id === id);
    if (index !== -1) {
      list.splice(index, 1);
      return true;
    }

    for (const comp of list) {
      if (comp.children) {
        const removed = this.removeRecursive(comp.children, id);
        if (removed) {
          return false;
        }
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
  onCanvasRightClick(event: MouseEvent): void {
    event.preventDefault();

    const canvasRect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - canvasRect.left;
    const y = event.clientY - canvasRect.top;

    this.contextMenu = {
      visible: true,
      x,
      y,
      targetId: null, // 👈 Sin componente objetivo → es canvas
    };
  }

  pasteComponent(parentId: string | null = null): void {
    if (!this.copiedComponent) return;

    const pasted = JSON.parse(JSON.stringify(this.copiedComponent));
    pasted.id = uuidv4();
    pasted.parentId = parentId;
    pasted.top = this.pastePosition?.y ?? 1;
    pasted.left = this.pastePosition?.x ?? 1;

    const pageId =
      this.pages[
        this.isPreviewMode ? this.previewPantallaIndex : this.currentPantalla
      ].id;

    // 🧩 Si hay parentId, es hijo → usamos addChildComponent
    if (parentId && parentId !== '') {
      this.sokectService.addChildComponent(
        this.roomCode,
        parentId,
        pasted,
        pageId
      );
    } else {
      this.sokectService.addCanvasComponent(this.roomCode, pageId, pasted);
    }

    // 🗑️ Si fue cortado, también emitir removeComponent
    if (this.cutMode) {
      this.sokectService.removeCanvasComponent(
        this.roomCode,
        pageId,
        this.copiedComponent.id
      );
      this.cutMode = false;
    }

    this.copiedComponent = null;
    this.contextMenu.visible = false;
    this.pastePosition = null;
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
      parentId,
    };

    const pageId =
      this.pages[
        this.isPreviewMode ? this.previewPantallaIndex : this.currentPantalla
      ].id;

    this.sokectService.addChildComponent(
      this.roomCode,
      parentId,
      child,
      pageId
    );

    this.contextMenu.visible = false;
  }

  findComponentById(
    list: CanvasComponent[],
    id: string
  ): CanvasComponent | null {
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
      position: 'absolute',
    };

    // Buscar padre si el componente es hijo
    const parent = comp.parentId
      ? this.findComponentById(
          this.pages[this.currentPantalla].components,
          comp.parentId
        )
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
      right: parentWidth - comp.width,
    };

    const y = {
      top: 0,
      center: (parentHeight - comp.height) / 2,
      bottom: parentHeight - comp.height,
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
      bottomRight: { top: y.bottom, left: x.right },
    };

    const pos = alignmentMap[comp.alignment];
    style.top = pos.top + 'px';
    style.left = pos.left + 'px';

    return style;
  }

  getPantallaSinTopLeft(): CanvasComponent[] {
    return this.pages[this.currentPantalla].components.map((comp) => {
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

  private generateFlutterWidget(comp: any): string {
    // Extrae ancho, alto y decoración básica de cualquier widget Container/IconButton
    const width = comp.width ?? 50;
    const height = comp.height ?? 50;
    const bgColor = comp.decoration?.color?.replace('#', '') ?? 'ffffff';
    const borderColor =
      comp.decoration?.border?.color?.replace('#', '') ?? '000000';
    const borderWidth = comp.decoration?.border?.width ?? 0;
    const borderRadius = comp.decoration?.borderRadius ?? 0;
  
    const decoration = `BoxDecoration(
        color: Color(0xFF${bgColor}),
        border: Border.all(
          color: Color(0xFF${borderColor}),
          width: ${borderWidth},
        ),
        borderRadius: BorderRadius.circular(${borderRadius}),
      )`;
  
    let innerWidget = '';
  
    if (comp.type === 'IconButton') {
      // Si es IconButton, lo envolvemos en un Container para respetar width/height/decoración.
      const tooltip = comp.tooltip ?? '';
      const icon = comp.icon ?? 'help_outline';
      const route = comp.navigateTo ?? '/';
  
      innerWidget = `Container(
          width: ${width},
          height: ${height},
          decoration: ${decoration},
          child: IconButton(
            tooltip: '${tooltip}',
            icon: const Icon(Icons.${icon}),
            onPressed: () {
              Navigator.pushNamed(context, '${route}');
            },
          ),
        )`;
    } else {
      // Para Container u otros widgets que usen BoxDecoration (por ejemplo, si comp.type === 'Container')
      innerWidget = `Container(
          width: ${width},
          height: ${height},
          decoration: ${decoration},
        )`;
    }
  
    // Si el propio comp tiene alignment, lo envuelvo en Align; de lo contrario, en Positioned.
    if (comp.alignment) {
      return `Align(
          alignment: Alignment.${comp.alignment},
          child: ${innerWidget},
        )`;
    } else {
      const top = comp.top ?? 0;
      const left = comp.left ?? 0;
      return `Positioned(
          top: ${top},
          left: ${left},
          child: ${innerWidget},
        )`;
    }
  }
  
  
  generateFlutterCode(): string {
    // 1) Tomo todos los componentes de la página (sin top/left globales)
    const components = this.getPantallaSinTopLeft();
  
    // 2) Detecto si existe un AppBar en la lista
    const appBarComp = components.find(c => c.type === 'AppBar');
  
    // 3) Si hay AppBar, construyo la sección appBar con su color y título
    let appBarCode = '';
    if (appBarComp) {
      const bgColor = `Color(0xFF${appBarComp.decoration.color.replace('#', '')})`;
  
      // Busco el Text que esté dentro de appBarComp.children para extraer el título
      const titleChild = (appBarComp.children ?? []).find(ch => ch.type === 'Text');
      const titleText = titleChild ? titleChild.text : '';
  
      appBarCode = `
        appBar: AppBar(
          backgroundColor: ${bgColor},
          title: Text('${titleText}'),
          centerTitle: true,
        ),`;
    }
  
    // 4) Filtro la lista para obtener solo los widgets que irán en el Stack:
    //    elimino AppBar y cualquier hijo de AppBar
    const filtered = components.filter(c => {
      if (c.type === 'AppBar') return false;
      if (appBarComp && c.parentId === appBarComp.id) return false;
      return true;
    });
  
    // 5) Genero cada widget para el Stack
    const widgets = filtered
      .map(comp => {
        // A) Primero extraigo únicamente los Text que estén dentro de comp.children
        const textChildren = (comp.children ?? []).filter(ch => ch.type === 'Text');
  
        // B) Si NO hay hijos Text, delego completamente a generateFlutterWidget(comp)
        if (textChildren.length === 0) {
          return this.generateFlutterWidget(comp);
        }
  
        // C) Si llegamos aquí, comp tiene al menos un hijo Text.
        //    Debo reconstruir el “widget base” sin el wrapper Positioned/Align de generateFlutterWidget,
        //    para luego insertar un Stack interno con cada Text en su posición/align correspondiente.
  
        // C.1) Extraigo ancho/alto y decoración del comp
        const width = comp.width ?? 50;
        const height = comp.height ?? 50;
        const bgColor = comp.decoration?.color?.replace('#', '') ?? 'ffffff';
        const borderColor = comp.decoration?.border?.color?.replace('#', '') ?? '000000';
        const borderWidth = comp.decoration?.border?.width ?? 0;
        const borderRadius = comp.decoration?.borderRadius ?? 0;
  
        const decoration = `BoxDecoration(
          color: Color(0xFF${bgColor}),
          border: Border.all(
            color: Color(0xFF${borderColor}),
            width: ${borderWidth},
          ),
          borderRadius: BorderRadius.circular(${borderRadius}),
        )`;
  
        // C.2) Construyo el widget base que luego tendrá un Stack interno:
        let baseWidget = '';
        if (comp.type === 'IconButton') {
          // Si es IconButton, reproduzco el Container + IconButton
          const tooltip = comp.tooltip ?? '';
          const icon = comp.icon ?? 'help_outline';
          const route = comp.navigateTo ?? '/';
          baseWidget = `Container(
            width: ${width},
            height: ${height},
            decoration: ${decoration},
            child: IconButton(
              tooltip: '${tooltip}',
              icon: const Icon(Icons.${icon}),
              onPressed: () {
                Navigator.pushNamed(context, '${route}');
              },
            ),
          )`;
        } else {
          // Caso Container (u otro tipo que use BoxDecoration)
          baseWidget = `Container(
            width: ${width},
            height: ${height},
            decoration: ${decoration},
          )`;
        }
  
        // C.3) Dentro del Stack interno, genero cada Text respetando su propio estilo
        //      (ancho, alto, color de fondo, borde, borderRadius) y luego centraré el texto
        const innerStack = textChildren
          .map(child => {
            // Extraigo propiedades de estilo del texto
            const tWidth = child.width ?? 50;
            const tHeight = child.height ?? 20;
            const tBgColor = child.decoration?.color?.replace('#', '') ?? 'ffffff';
            const tBorderColor =
              child.decoration?.border?.color?.replace('#', '') ?? '000000';
            const tBorderWidth = child.decoration?.border?.width ?? 0;
            const tBorderRadius = child.decoration?.borderRadius ?? 0;
  
            const tDecoration = `BoxDecoration(
              color: Color(0xFF${tBgColor}),
              border: Border.all(
                color: Color(0xFF${tBorderColor}),
                width: ${tBorderWidth},
              ),
              borderRadius: BorderRadius.circular(${tBorderRadius}),
            )`;
  
            // Si el texto hijo tiene alignment, lo envuelvo en Align; si no, en Positioned:
            if (child.alignment) {
              return `Align(
        alignment: Alignment.${child.alignment},
        child: Container(
          width: ${tWidth},
          height: ${tHeight},
          decoration: ${tDecoration},
          child: Center(
            child: Text(
              '${child.text}',
            ),
          ),
        ),
      )`;
            } else {
              const top = child.top ?? 0;
              const left = child.left ?? 0;
              return `Positioned(
        top: ${top},
        left: ${left},
        child: Container(
          width: ${tWidth},
          height: ${tHeight},
          decoration: ${tDecoration},
          child: Center(
            child: Text(
              '${child.text}',
            ),
          ),
        ),
      )`;
            }
          })
          .join(',\n');
  
        // C.4) Finalmente, a todo el Container+Stack interno lo envuelvo en Align o Positioned
        //      según que el propio comp tenga comp.alignment o no.
        if (comp.alignment) {
          // Si el padre define alignment, uso Align para todo el bloque.
          return `Align(
    alignment: Alignment.${comp.alignment},
    child: Container(
      width: ${width},
      height: ${height},
      decoration: ${decoration},
      child: Stack(
        children: [
  ${innerStack
    .split('\n')
    .map(line => '        ' + line)
    .join('\n')}
        ],
      ),
    ),
  )`;
        } else {
          // Si el padre no define alignment, uso Positioned en pantalla
          const top = comp.top ?? 0;
          const left = comp.left ?? 0;
          return `Positioned(
    top: ${top},
    left: ${left},
    child: Container(
      width: ${width},
      height: ${height},
      decoration: ${decoration},
      child: Stack(
        children: [
  ${innerStack
    .split('\n')
    .map(line => '        ' + line)
    .join('\n')}
        ],
      ),
    ),
  )`;
        }
      })
      .join(',\n\n');
  
    // 6) Ensamblamos el Scaffold completo
    return `@override
  Widget build(BuildContext context) {
    return Scaffold(${appBarCode}
      body: Stack(
        children: [
  ${widgets
    .split('\n')
    .map(line => '        ' + line)
    .join('\n')}
        ],
      ),
    );
  }`;
  }
  
  
  
  
  
  

  downloadAngularProject() {
    const url = `http://localhost:3000/api/export/flutter/${this.roomCode}`;
    window.open(url, '_blank'); // Abre la descarga del zip en otra pestaña
  }
}
