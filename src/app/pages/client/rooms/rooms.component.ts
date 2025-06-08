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
interface ComponentDimensions {
  width: number;
  height: number;
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
      width?: number;
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
  selectedOption?: string; // Opción actualmente seleccionada (para preview)

  fontSize?: number;
  textColor?: string; // Nueva propiedad para color de texto
  autoSize?: boolean; // Control para ajuste automático

  fontFamily?: string;
  textIndent?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';

  // Nuevas propiedades para checkbox:
  checked?: boolean;
  checkColor?: string; // Color del check (✓)
  labelPosition?: 'left' | 'right' | 'top' | 'bottom';
  labelGap?: number; // Espacio entre checkbox y texto
  checkSize?: number; // Tamaño interno del check (✓)
  onChangeAction?: string; // Nombre de la función a ejecutar al cambiar
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

        // Verificar si se actualizaron dimensiones
        let dimensionsChanged = false;
        Object.entries(updates).forEach(([key, value]) => {
          apply(component, key.split('.'), value);
          if (key === 'width' || key === 'height') {
            dimensionsChanged = true;
          }
        });

        // NUEVA LÓGICA: Si cambió el tamaño y tiene padre, ajustar padre
        if (dimensionsChanged && component.parentId) {
          setTimeout(() => {
            this.autoResizeParent(component.parentId!);
          }, 0);
        }

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
  togglePreviewMode(): void {
    if (!this.isPreviewMode) {
      // Estoy a punto de entrar a PREVIEW: forzo que previewPantallaIndex === currentPantalla
      this.previewPantallaIndex = this.currentPantalla;
    } else {
      // Al salir de PREVIEW, sincronizo currentPantalla con previewPantallaIndex
      this.currentPantalla = this.previewPantallaIndex;
    }
    this.isPreviewMode = !this.isPreviewMode;
    this.cdr.detectChanges(); // Aseguramos que los cambios se reflejen correctamente
  }
  changePantalla(index: number): void {
    this.currentPantalla = index;
    this.selectedComponent = null;

    // Sincronizar siempre el índice de previsualización
    if (this.isPreviewMode) {
      this.previewPantallaIndex = index;
    }
    this.cdr.detectChanges();
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

  addDropdownButton(): void {
    const newDropdown: CanvasComponent = {
      id: uuidv4(),
      type: 'DropdownButton',
      top: 50,
      left: 50,
      width: 120, // ancho inicial; puedes ajustar
      height: 40, // alto inicial
      decoration: {
        color: '#ffffff',
        border: { color: '#000000', width: 1 },
        borderRadius: 4,
      },
      options: ['Opción 1', 'Opción 2'], // dos opciones por defecto
      selectedOption: 'Opción 1', // selecciona la primera por defecto
      children: [],
      parentId: null,
    };

    const pageId = this.pages[this.currentPantalla].id;
    this.sokectService.addCanvasComponent(this.roomCode, pageId, newDropdown);
  }
  //checkbox
  addCheckbox(): void {
    const defaultCheckSize = 24;
    const defaultLabelGap = 8;
    const estimatedTextWidth = 60; // Ancho estimado para "Etiqueta"

    const newCheckbox: CanvasComponent = {
      id: uuidv4(),
      type: 'Checkbox',
      top: 50,
      left: 50,
      // Ajustar dimensiones según la posición de la etiqueta
      width: defaultCheckSize + defaultLabelGap + estimatedTextWidth, // Ancho para checkbox + gap + texto
      height: defaultCheckSize, // Alto del checkbox
      decoration: {
        color: 'transparent', // CONTENEDOR SIEMPRE TRANSPARENTE
        border: { color: 'transparent', width: 0 }, // Sin borde en el contenedor
        borderRadius: 0,
      },
      // Propiedades específicas del checkbox:
      checked: false,
      checkColor: '#000000',
      labelPosition: 'right',
      labelGap: defaultLabelGap,
      checkSize: defaultCheckSize,
      onChangeAction: '',
      text: 'Etiqueta',
      // Propiedades de texto (como en Text component)
      fontSize: 14,
      textColor: '#000000',
      fontFamily: 'inherit',
      textAlign: 'left',
      // Resto de propiedades comunes:
      children: [],
      parentId: null,
    };

    const pageId = this.pages[this.currentPantalla].id;
    this.sokectService.addCanvasComponent(this.roomCode, pageId, newCheckbox);
  }

  ///appbar
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
    const page =
      this.pages[
        this.isPreviewMode ? this.previewPantallaIndex : this.currentPantalla
      ];
  
    const parent = this.findComponentById(page.components, parentId);
    
    if (parent) {
      // Almacenar tamaño original del padre si no existe
      if (!this.originalParentSizes.has(parent.id)) {
        this.originalParentSizes.set(parent.id, {
          width: parent.width,
          height: parent.height
        });
      }
    }

    const padding = 0;
  
    const child: CanvasComponent = {
      id: uuidv4(),
      type: 'Text',
      text: 'Título',
      fontSize: 16,
      autoSize: true,
      width: (parent?.width ?? 100) - padding * 2,
      height: 30,
      top: padding,
      left: padding,
      decoration: {
        color: 'transparent',
        border: { color: '#000000', width: 0 },
        borderRadius: 0,
      },
      children: [],
      parentId,
    };
  
    this.sokectService.addChildComponent(this.roomCode, parentId, child, page.id);
    this.contextMenu.visible = false;

    // Ajustar tamaño del padre después de agregar hijo
    setTimeout(() => {
      this.autoResizeParent(parentId);
    }, 100);
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
      this.currentPantalla = index; // Sincronizar ambos índices
      this.cdr.detectChanges();
    }
  }
  //metodo par salir del modo previsualizacion con la tecla escape
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isPreviewMode) {
      this.isPreviewMode = false;
    }
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
    const page = this.pages[
      this.isPreviewMode ? this.previewPantallaIndex : this.currentPantalla
    ];
    const parent = this.findComponentById(page.components, parentId);
    
    if (parent) {
      // Almacenar tamaño original del padre si no existe
      if (!this.originalParentSizes.has(parent.id)) {
        this.originalParentSizes.set(parent.id, {
          width: parent.width,
          height: parent.height
        });
      }
    }

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

    const pageId = page.id;

    this.sokectService.addChildComponent(
      this.roomCode,
      parentId,
      child,
      pageId
    );

    this.contextMenu.visible = false;

    // Ajustar tamaño del padre después de agregar hijo
    setTimeout(() => {
      this.autoResizeParent(parentId);
    }, 100);
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













  //para el panel de previsualizacion
  getComponentStyle(comp: CanvasComponent): any {
    const bw = comp.decoration.border.width;
const bc = comp.decoration.border.color;
    /* const style: any = {
      width: comp.width + 'px',
      height: comp.height + 'px',
      backgroundColor: comp.decoration.color,
      border: `${comp.decoration.border.width}px solid ${comp.decoration.border.color}`,
      borderRadius: comp.decoration.borderRadius + 'px',
      position: 'absolute',
    }; */
    const inset = `inset 0 0 0 ${bw}px ${bc}`;
// ¿está seleccionado este componente?
const isSel = 
!this.isPreviewMode && 
this.selectedComponent?.id === comp.id;

// sombra externa “resalte azul”
const ring = isSel ? `0 0 0 2px #2563eb` : '';

// combinamos: primero inset, luego ring si corresponde
const boxShadow = ring ? `${inset}, ${ring}` : inset;

const style: any = {
  boxSizing: 'border-box',
  width: comp.width + 'px',
  height: comp.height + 'px',
  backgroundColor: comp.decoration.color,
  // quitamos border…
  // border: `${bw}px solid ${bc}`,
  // …y lo sustituimos por un inset-shadow
  boxShadow,
  borderRadius: comp.decoration.borderRadius + 'px',
  position: 'absolute',
  overflow: 'hidden',  // opcional, para recortar hijos que queden fuera
};

    // Estilos específicos para componentes de texto
    if (comp.type === 'Text') {
      style.fontSize = comp.fontSize + 'px';
      style.color = comp.textColor || '#000000';
      //  style.overflow = 'hidden'; // Evita que el texto se desborde
      style.textOverflow = 'ellipsis'; // Añade puntos suspensivos si es necesario
      // style.whiteSpace = 'nowrap'; // Para texto en una línea
      style.display = 'flex';
      style.alignItems = 'center'; // Centra verticalmente
      // style.padding_bottom = '20px'; // Añade un pequeño padding interno
      style.boxSizing = 'border-box'; // Incluye padding en las dimensiones

      // Si quieres permitir múltiples líneas, usa esto en lugar de whiteSpace: 'nowrap'
      // style.whiteSpace = 'normal';
      // style.wordWrap = 'break-word';
      style.overflowWrap = 'break-word';
    }

    const pageIndex = this.isPreviewMode
      ? this.previewPantallaIndex
      : this.currentPantalla;
    const currentPage = this.pages[pageIndex];

    // Buscar padre si el componente es hijo
    const parent = comp.parentId
      ? this.findComponentById(currentPage.components, comp.parentId)
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
    let left = pos.left;
    let top = pos.top;

    // Clamp horizontal
    const maxLeft = parentWidth - comp.width;
    if (left < 0) left = 0;
    if (left > maxLeft) left = maxLeft;

    // Clamp vertical
    const maxTop = parentHeight - comp.height;
    if (top < 0) top = 0;
    if (top > maxTop) top = maxTop;

    style.left = left + 'px';
    style.top = top + 'px';
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






















  //para el panel derecho encargado de actualizar las propiedades de un widget

  updateProperty(key: string, value: any): void {
    if (!this.selectedComponent || !this.roomCode) return;
    const pageId = this.pages[this.currentPantalla].id;
    const componentId = this.selectedComponent.id;

    // 1) Actualiza localmente para que la vista inmediata refleje ese cambio
    (this.selectedComponent as any)[key] = value;

    // 2) Luego envía al backend
    const updates: any = {};
    updates[key] = value;
    this.sokectService.updateComponentProperties(
      this.roomCode,
      pageId,
      componentId,
      updates
    );

    // 3) NUEVA LÓGICA: Si se cambió width o height y el componente tiene padre, ajustar padre
    if (
      (key === 'width' || key === 'height') &&
      this.selectedComponent.parentId
    ) {
      setTimeout(() => {
        this.autoResizeParent(this.selectedComponent!.parentId!);
      }, 0);
    }
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
  //DropdownButton
  dropdownNewOption: string = '';
  onDropdownChange(comp: CanvasComponent, newValue: string) {
    comp.selectedOption = newValue;
    // Si quieres persistir este cambio en el servidor, descomenta la línea siguiente:
    this.updateProperty('selectedOption', newValue);
  }
  addDropdownOption() {
    if (
      !this.selectedComponent ||
      this.selectedComponent.type !== 'DropdownButton'
    )
      return;

    const opts = this.selectedComponent.options || [];
    if (this.dropdownNewOption.trim()) {
      opts.push(this.dropdownNewOption.trim());
      // Enviamos el arreglo completo de opciones actualizado
      this.updateProperty('options', opts);
      // Limpiamos el input
      this.dropdownNewOption = '';
    }
  }

  removeDropdownOption(optToRemove: string) {
    if (
      !this.selectedComponent ||
      this.selectedComponent.type !== 'DropdownButton'
    )
      return;

    const opts = (this.selectedComponent.options || []).filter(
      (o) => o !== optToRemove
    );
    this.updateProperty('options', opts);
  }
  onDropdownOptionInput(index: number, event: Event) {
    const inputValue = (event.target as HTMLInputElement).value;

    if (
      !this.selectedComponent ||
      this.selectedComponent.type !== 'DropdownButton' ||
      !Array.isArray(this.selectedComponent.options)
    ) {
      return;
    }

    // Modificamos el array existente en lugar de crear uno nuevo
    this.selectedComponent.options[index] = inputValue;

    // Actualizamos usando el método existente
    const updates = { options: this.selectedComponent.options };
    this.sokectService.updateComponentProperties(
      this.roomCode,
      this.pages[this.currentPantalla].id,
      this.selectedComponent.id,
      updates
    );
  }
  trackByFn(index: number, item: any): any {
    return index; // O usa un ID único si tienes
  }
  //fin

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

  onCheckboxToggle(comp: CanvasComponent, event: Event) {
    // Obtiene si está chequeado o no
    const newChecked = (event.target as HTMLInputElement).checked;
    // Actualiza localmente (para que el cambio se vea al vuelo)
    comp.checked = newChecked;

    // Envía la actualización al servidor para sincronizar con otros usuarios
    const updates: any = { checked: newChecked };

    const pageId = this.pages[this.currentPantalla].id;
    const componentId = comp.id;
    this.sokectService.updateComponentProperties(
      this.roomCode,
      pageId,
      componentId,
      updates
    );
  }

  simulateCheckboxClick(comp: CanvasComponent, event: MouseEvent): void {
    if (!this.isPreviewMode) return;

    // Crear un evento sintético para simular el cambio del checkbox
    const syntheticEvent = {
      target: {
        checked: !comp.checked,
      } as HTMLInputElement,
    } as unknown as Event;

    // Usar tu método existente
    this.onCheckboxToggle(comp, syntheticEvent);

    // Si hay una acción definida, ejecutarla
    if (comp.onChangeAction && comp.onChangeAction.trim()) {
      this.executeCheckboxAction(comp, !comp.checked);
    }
  }

  private executeCheckboxAction(
    comp: CanvasComponent,
    newCheckedState: boolean
  ): void {
    const actionName = comp.onChangeAction;
    if (!actionName) return;

    console.log(
      `Ejecutando acción: ${actionName} - Checkbox ${
        newCheckedState ? 'marcado' : 'desmarcado'
      }`
    );

    // Ejemplo de acciones predefinidas
    switch (actionName.toLowerCase()) {
      case 'mostrarAlert':
        alert(
          `Checkbox ${newCheckedState ? 'marcado' : 'desmarcado'}: ${comp.text}`
        );
        break;
      case 'console':
        console.log(`Checkbox ${comp.text}: ${newCheckedState}`);
        break;
      // Agregar más casos según necesites
      default:
        // Intentar ejecutar función personalizada si existe
        if (typeof (window as any)[actionName] === 'function') {
          (window as any)[actionName](newCheckedState, comp);
        }
        break;
    }
  }

  recalculateCheckboxDimensions(): void {
    if (!this.selectedComponent || this.selectedComponent.type !== 'Checkbox')
      return;

    const checkSize = this.selectedComponent.checkSize || 24;
    const labelGap = this.selectedComponent.labelGap || 8;
    const estimatedTextWidth = (this.selectedComponent.text?.length || 8) * 8; // Estimación básica

    let newWidth = checkSize;
    let newHeight = checkSize;

    if (
      this.selectedComponent.labelPosition === 'right' ||
      this.selectedComponent.labelPosition === 'left'
    ) {
      newWidth = checkSize + labelGap + estimatedTextWidth;
    } else if (
      this.selectedComponent.labelPosition === 'top' ||
      this.selectedComponent.labelPosition === 'bottom'
    ) {
      newHeight = checkSize + labelGap + 20; // 20px estimado para el texto
      newWidth = Math.max(checkSize, estimatedTextWidth);
    }

    this.updateProperty('width', newWidth);
    this.updateProperty('height', newHeight);
  }











  //metodos necesario para que un widget padre nunca sea mas pequeño que sus hijos

  // Nueva propiedad para almacenar tamaños originales de padres
  private originalParentSizes: Map<string, ComponentDimensions> = new Map();
  private maxParentSizes: Map<string, ComponentDimensions> = new Map();
  // 3. NUEVO MÉTODO para calcular el tamaño mínimo requerido por los hijos
  private calculateMinimumParentSize(parent: CanvasComponent): ComponentDimensions {
    if (!parent.children || parent.children.length === 0) {
      // Si no hay hijos, mantener el tamaño máximo alcanzado
      return this.maxParentSizes.get(parent.id) || {
        width: parent.width,
        height: parent.height
      };
    }

    let maxRequiredWidth = 0;
    let maxRequiredHeight = 0;

    // Calcular el espacio mínimo requerido basado en los hijos
    parent.children.forEach(child => {
      const childRight = (child.left || 0) + child.width;
      const childBottom = (child.top || 0) + child.height;
      
      maxRequiredWidth = Math.max(maxRequiredWidth, childRight);
      maxRequiredHeight = Math.max(maxRequiredHeight, childBottom);
    });

    // Obtener el tamaño máximo alcanzado hasta ahora
    const currentMaxSize = this.maxParentSizes.get(parent.id) || {
      width: parent.width,
      height: parent.height
    };

    // El padre debe ser al menos tan grande como:
    // 1. Su tamaño máximo alcanzado anteriormente
    // 2. El espacio requerido por los hijos actuales
    const requiredWidth = Math.max(currentMaxSize.width, maxRequiredWidth + 10); // +10 padding
    const requiredHeight = Math.max(currentMaxSize.height, maxRequiredHeight + 10); // +10 padding

    return {
      width: requiredWidth,
      height: requiredHeight
    };
  }

  // 4. NUEVO MÉTODO para ajustar automáticamente el tamaño del padre
  private autoResizeParent(parentId: string): void {
    if (!parentId || !this.roomCode) return;

    const page = this.pages[this.currentPantalla];
    const parent = this.findComponentById(page.components, parentId);
    
    if (!parent) return;

    // Inicializar el tamaño máximo si no existe (primera vez)
    if (!this.maxParentSizes.has(parent.id)) {
      this.maxParentSizes.set(parent.id, {
        width: parent.width,
        height: parent.height
      });
    }

    // Calcular el nuevo tamaño requerido
    const newSize = this.calculateMinimumParentSize(parent);
    
    // Actualizar el tamaño máximo alcanzado si es necesario
    const currentMaxSize = this.maxParentSizes.get(parent.id)!;
    const updatedMaxSize = {
      width: Math.max(currentMaxSize.width, newSize.width),
      height: Math.max(currentMaxSize.height, newSize.height)
    };
    
    // Guardar el nuevo tamaño máximo
    this.maxParentSizes.set(parent.id, updatedMaxSize);
    
    // Solo actualizar si el tamaño cambió (solo puede crecer, nunca decrecer)
    if (parent.width < updatedMaxSize.width || parent.height < updatedMaxSize.height) {
      parent.width = updatedMaxSize.width;
      parent.height = updatedMaxSize.height;

      // Enviar actualización al servidor
      const updates = {
        width: updatedMaxSize.width,
        height: updatedMaxSize.height
      };

      this.sokectService.updateComponentProperties(
        this.roomCode,
        page.id,
        parent.id,
        updates
      );
    }
  }
  resetParentToOriginalSize(parentId: string): void {
    const originalSize = this.originalParentSizes.get(parentId);
    if (!originalSize || !this.roomCode) return;

    const page = this.pages[this.currentPantalla];
    const parent = this.findComponentById(page.components, parentId);
    
    if (!parent) return;

    // Solo resetear si no hay hijos que requieran más espacio
    const requiredSize = this.calculateMinimumParentSize(parent);
    
    if (requiredSize.width <= originalSize.width && requiredSize.height <= originalSize.height) {
      parent.width = originalSize.width;
      parent.height = originalSize.height;

      const updates = {
        width: originalSize.width,
        height: originalSize.height
      };

      this.sokectService.updateComponentProperties(
        this.roomCode,
        page.id,
        parent.id,
        updates
      );
    }
  }
  downloadAngularProject() {
    const url = `http://localhost:3000/api/export/flutter/${this.roomCode}`;
    window.open(url, '_blank'); // Abre la descarga del zip en otra pestaña
  }

  cargarJsonEjemploLocal() {
    const jsonEjemplo: CanvasComponent[] = [
     
    ];

    this.pages[this.currentPantalla].components = [...jsonEjemplo];
  }
}
