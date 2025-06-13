import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  viewChild,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SokectSevice } from '../../services/socket.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { v4 as uuidv4 } from 'uuid';
import { WidgetsComponent } from '../../components/widgets/widgets.component';
import { PropiedadesComponent } from '../../components/propiedades/propiedades.component';
import { CanvasComponent } from '../../interface/canvas-component.interface';
import { Page } from '../../interface/pantallas.interfaces';
import { DragState } from '../../interface/dragstate.interface';
import { ComponentDimensions } from '../../interface/dimencion.interface';
import { ContextMenu } from '../../interface/context-menu.interface';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    DragDropModule,
    WidgetsComponent,
    PropiedadesComponent,
  ],
  templateUrl: './rooms.component.html',
  styleUrls: ['./rooms.component.css'],
})
export class RoomsComponent implements OnInit {
  @ViewChild(WidgetsComponent) widgets!: WidgetsComponent;
  @ViewChild(PropiedadesComponent) propiedades!: PropiedadesComponent;
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

  // AI Assistant properties
  showAIHub: boolean = false;
  showTextModal: boolean = false;
  showImageModal: boolean = false;
  questionText: string = '';
  selectedImage: File | null = null;

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
    private socketService: SokectSevice,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {}
  roomCode: string = '';
  roomName: string = '';
  roomId: number = 0;
  errorMessage: string = '';
  usersInRoom: any[] = [];
  showParticipants: boolean = false;
  // propiedad para el estado de loading
  isInitializing: boolean = true;
  ngOnInit(): void {
    this.roomCode = this.route.snapshot.paramMap.get('code') || '';

    if (this.roomCode) {
      this.socketService.joinRoom(this.roomCode);
    }

    // Escucha el canvas inicial
    this.socketService.onInitialCanvasLoad().subscribe((pages) => {
      this.pages = pages;

      if (pages.length === 0) {
        this.addPage(); // Emitirá la creación por socket si es el primero
      } else {
        this.currentPantalla = 0;
      }
      // Finalizar loading cuando se cargan las páginas
      this.isInitializing = false;
      this.cdr.detectChanges();
    });

    // Escuchar cuando se limpia una página
    this.socketService.onPageCleared().subscribe(({ pageId }) => {
      const page = this.pages.find((p) => p.id === pageId);
      if (page) {
        // Limpiar componentes de la página
        page.components = [];

        // Si es la página actual, deseleccionar componente
        if (page.id === this.pages[this.currentPantalla]?.id) {
          this.selectedComponent = null;
        }

        console.log(`🧹 Página limpiada: ${page.name}`);
        this.cdr.detectChanges();
      }
    });
    // Esto se ejecutará si no se recibe onInitialCanvasLoad en 2 segundos
    setTimeout(() => {
      if (this.pages.length === 0) {
        console.log(
          '🚨 Inicialización de emergencia: No se recibieron páginas iniciales'
        );
        this.addPage(); // Crear página inicial si no hay ninguna
      }
      // 🎯 Siempre finalizar loading después del timeout
      this.isInitializing = false;
      this.cdr.detectChanges();
    }, 2000);

    // Escucha nuevas páginas agregadas por otros usuarios
    this.socketService.onPageAdded().subscribe((page: Page) => {
      const yaExiste = this.pages.some((p) => p.id === page.id);
      if (!yaExiste) {
        this.pages.push(page);
        this.currentPantalla = this.pages.length - 1;
        this.selectedComponent = null;
        // 🎯 Si no había páginas y ahora llega una, finalizar loading
        if (this.isInitializing) {
          this.isInitializing = false;
        }
        this.cdr.detectChanges();
      }
    });

    this.socketService.onPageRemoved().subscribe((pageId: string) => {
      this.pages = this.pages.filter((p) => p.id !== pageId);
      if (this.currentPantalla >= this.pages.length) {
        this.currentPantalla = this.pages.length - 1;
      }
      this.cdr.detectChanges();
    });
    // Escucha otras conexiones
    this.socketService.onUsersListUpdate().subscribe((users) => {
      this.usersInRoom = users;
      this.cdr.detectChanges();
    });
    //addconteiner
    this.socketService.onComponentAdded().subscribe(({ pageId, component }) => {
      const page = this.pages.find((p) => p.id === pageId);
      if (page) {
        page.components.push(component);
        this.selectedComponent = component;
        this.cdr.detectChanges();
      }
    });
    //actualizar propiedades de un widget
    this.socketService
      .onComponentPropertiesUpdated()
      .subscribe(({ pageId, componentId, updates }) => {
        const page = this.pages.find((p) => p.id === pageId);
        if (!page) return;

        const component = this.findComponentById(page.components, componentId);
        if (!component) return;

        // 1) Guardamos dimensiones previas
        const prevWidth = component.width;
        const prevHeight = component.height;

        // 2) Aplicamos los cambios
        const apply = (target: any, keys: string[], value: any) => {
          while (keys.length > 1) {
            const k = keys.shift()!;
            if (!(k in target)) target[k] = {};
            target = target[k];
          }
          target[keys[0]] = value;
        };

        let dimensionsChanged = false;
        Object.entries(updates).forEach(([key, value]) => {
          apply(component, key.split('.'), value);
          if (key === 'width' || key === 'height') {
            dimensionsChanged = true;
          }
        });

        if (dimensionsChanged) {
          const newWidth = component.width ?? 100; // Valor por defecto si width es undefined
          const newHeight = component.height ?? 100; // Valor por defecto si height es undefined
          const previousWidth = prevWidth ?? 100; // Si prevWidth puede ser undefined
          const previousHeight = prevHeight ?? 100; // Si prevHeight puede ser undefined
          const didGrow =
            (updates.width !== undefined && newWidth > previousWidth) ||
            (updates.height !== undefined && newHeight > previousHeight);
          const didShrink =
            (updates.width !== undefined && newWidth < previousWidth) ||
            (updates.height !== undefined && newHeight < previousHeight);

          // 3.a) Si es un HIJO que creció, hacemos crecer al padre (autoResizeParent nunca lo encoge)
          if (component.parentId && didGrow) {
            setTimeout(
              () => this.propiedades.autoResizeParent(component.parentId!),
              0
            );
          }

          // 3.b) Si es un PADRE que decreció, encogemos a sus hijos
          if (component.children?.length && didShrink) {
            setTimeout(
              () => this.propiedades.autoShrinkChildren(component.id),
              0
            );
          }
        }

        this.cdr.detectChanges();
      });

    //movimiento
    this.socketService
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
    this.socketService
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
    this.socketService
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

    //tabka
    this.socketService.onTableStructureUpdated().subscribe(({ pageId, tableId, children }) => {
      const page = this.pages.find(p => p.id === pageId);
      if (!page) return;
      
      const table = this.findComponentById(page.components, tableId);
      if (table && table.type === 'table') {
        // Actualizar la estructura de la tabla
        table.children = children;
        
        // Si la tabla seleccionada es la que se actualizó, refrescar vista
        if (this.selectedComponent?.id === tableId) {
          this.selectedComponent = table;
        }
        
        this.cdr.detectChanges();
      }
    });
    //para el modo previsualizacion
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('click', this.handleDocumentClick.bind(this));
  }

  //para el panel izquierdo para agregar widgets al canvas
  getJsonCompleto() {
    this.widgets.getJsonCompleto();
  }

  //agregar Page
  addPage(): void {
    const newPage: Page = {
      id: uuidv4(),
      name: `Pantalla ${this.pages.length + 1}`,
      components: [],
    };

    if (this.roomCode) {
      this.socketService.addPage(this.roomCode, newPage);
    }
  }
  togglePreviewMode(): void {
    if (!this.isPreviewMode) {
      this.previewPantallaIndex = this.currentPantalla;
    } else {
      this.currentPantalla = this.previewPantallaIndex;
    }
    this.isPreviewMode = !this.isPreviewMode;
    this.cdr.detectChanges();
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

    this.socketService.removePage(this.roomCode, pageId);
    this.cdr.detectChanges();
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
  private originalParentSizes: Map<string, ComponentDimensions> = new Map();
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
          width: parent.width ?? 100, // Valor por defecto si width es undefined
          height: parent.height ?? 100, // Valor por defecto si height es undefined
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
      width: 44,
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

    this.socketService.addChildComponent(
      this.roomCode,
      parentId,
      child,
      page.id
    );
    this.contextMenu.visible = false;

    // Ajustar tamaño del padre después de agregar hijo
    setTimeout(() => {
      this.propiedades.autoResizeParent(parentId);
    }, 100);
  }
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
        this.socketService.moveComponent(
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

    this.socketService.removeCanvasComponent(this.roomCode, pageId, id);
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
      this.socketService.addChildComponent(
        this.roomCode,
        parentId,
        pasted,
        pageId
      );
    } else {
      this.socketService.addCanvasComponent(this.roomCode, pageId, pasted);
    }

    // 🗑️ Si fue cortado, también emitir removeComponent
    if (this.cutMode) {
      this.socketService.removeCanvasComponent(
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
    const page =
      this.pages[
        this.isPreviewMode ? this.previewPantallaIndex : this.currentPantalla
      ];
    const parent = this.findComponentById(page.components, parentId);

    if (parent) {
      // Almacenar tamaño original del padre si no existe
      if (!this.originalParentSizes.has(parent.id)) {
        this.originalParentSizes.set(parent.id, {
          width: parent.width ?? 100, // Valor por defecto si width es undefined
          height: parent.height ?? 100, // Valor por defecto si height es undefined
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

    this.socketService.addChildComponent(
      this.roomCode,
      parentId,
      child,
      pageId
    );

    this.contextMenu.visible = false;

    // Ajustar tamaño del padre después de agregar hijo
    setTimeout(() => {
      this.propiedades.autoResizeParent(parentId);
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

  /** Altura del AppBar si existe, o 0 */
  getReservedAppBarHeight(): number {
    const page =
      this.pages[
        this.isPreviewMode ? this.previewPantallaIndex : this.currentPantalla
      ];
    const appBar = page.components.find((c) => c.type === 'AppBar');
    return appBar ? appBar.height ?? 0 : 0;
  }
  hasParentLayout(comp: CanvasComponent): boolean {
    if (!comp.parentId) return false;
    const page = this.pages[this.currentPantalla];
    const parent = this.findComponentById(page.components, comp.parentId);
    return !!parent?.childrenLayout;
  }

  //metodo para previsualizar en el render, igualar el front con lo exportado en flutter
  getComponentStyle(comp: CanvasComponent): any {
    // ——— Valores por defecto para propiedades opcionales ———————————————————
    const compWidth = comp.width ?? 100;
    const compHeight = comp.height ?? 100;

    // ——— 1) Datos de borde y sombra con decoration opcional ————————————————
    const decoration = comp.decoration ?? {
      color: 'transparent',
      border: { color: 'transparent', width: 0 },
      borderRadius: 0,
    };

    const border = decoration.border ?? { color: 'transparent', width: 0 };
    const bw = border.width ?? 0;
    const bc = border.color ?? 'transparent';
    const inset = `inset 0 0 0 ${bw}px ${bc}`;

    const isSel = !this.isPreviewMode && this.selectedComponent?.id === comp.id;
    const ring = isSel ? `0 0 0 2px #2563eb` : '';
    const boxShadow = ring ? `${inset}, ${ring}` : inset;

    // ——— 2) Estilos base del contenedor ————————————————————————————————————
    const style: any = {
      boxSizing: 'border-box',
      width: compWidth + 'px',
      height: compHeight + 'px',
      backgroundColor: decoration.color ?? 'transparent',
      boxShadow,
      borderRadius: (decoration.borderRadius ?? 0) + 'px',
      position: 'absolute',
      overflow: 'hidden',
      zIndex: comp.type === 'AppBar' ? 999 : 1,
    };

    // ——— 3) Estilos específicos por tipo ——————————————————————————————————
    if (comp.type === 'Text') {
      style.fontSize = (comp.fontSize ?? 16) + 'px';
      style.color = comp.textColor || '#000000';
      style.display = 'flex';
      style.alignItems = 'center';
      style.textOverflow = 'ellipsis';
      style.overflowWrap = 'break-word';
    }

    if (comp.type === 'Checkbox') {
      const baseSize = comp.checkSize || 24;
      const scale = comp.scale || 1;
      const scaledSize = baseSize * scale;
      style.width = scaledSize + 'px';
      style.height = scaledSize + 'px';
    }

    if (comp.type === 'TextField') {
      const minWidth = 120;
      const minHeight = 56;
      style.width = Math.max(compWidth, minWidth) + 'px';
      style.height = Math.max(compHeight, minHeight) + 'px';
      style.display = 'flex';
      style.flexDirection = 'column';
      style.justifyContent = 'center';
    }

    if (comp.type === 'table') {
      // Para tablas, usamos dimensiones mínimas en lugar de fijas
      const minWidth = comp.width || 260;
      const minHeight = comp.height || 150;
      
      // Calcular el tamaño real necesario basado en el contenido
      const rows = comp.rows || 3;
      const columns = comp.columns || 3;
      const cellPadding = comp.cellPadding || 8;
      const borderWidth = comp.tableBorder?.width || 1;
      
      // Estimar el ancho necesario
      const estimatedCellWidth = Math.max(80, minWidth / columns);
      const calculatedWidth = Math.max(minWidth, estimatedCellWidth * columns + borderWidth * (columns + 1));
      
      // Estimar la altura necesaria
      const estimatedRowHeight = 40; // Altura base por fila
      const calculatedHeight = Math.max(minHeight, estimatedRowHeight * rows + borderWidth * (rows + 1));
      
      style.width = calculatedWidth + 'px';
      style.height = calculatedHeight + 'px';
      style.minWidth = minWidth + 'px';
      style.minHeight = minHeight + 'px';
      style.backgroundColor = 'transparent';
      style.border = 'none';
      style.borderRadius = '0px';
      style.overflow = 'visible'; // Permitir que la tabla se vea completa
      
      // NO hacer return aquí - permitir que continúe con el posicionamiento normal
    }
    // ——— 4) Buscar padre ———————————————————————————————————————————————————
    const pageIndex = this.isPreviewMode
      ? this.previewPantallaIndex
      : this.currentPantalla;
    const currentPage = this.pages[pageIndex];
    const parent = comp.parentId
      ? this.findComponentById(currentPage.components, comp.parentId)
      : null;

    // ——— 5) LÓGICA PARA ELEMENTOS HIJOS ————————————————————————————————————
    if (parent) {
      const parentWidth = parent.width ?? 100;
      const parentHeight = parent.height ?? 100;

      // Información del padre
      const parentDecoration = parent.decoration ?? {
        color: 'transparent',
        border: { color: 'transparent', width: 0 },
        borderRadius: 0,
      };
      const parentBorder = parentDecoration.border ?? {
        color: 'transparent',
        width: 0,
      };
      const borderW = parentBorder.width ?? 0;

      // *** APLICAR PADDINGALL CORRECTAMENTE ***
      // Prioridad: paddingAll -> padding individual
      let paddingTop, paddingRight, paddingBottom, paddingLeft;

      if (parent.paddingAll !== undefined && parent.paddingAll > 0) {
        paddingTop =
          paddingRight =
          paddingBottom =
          paddingLeft =
            parent.paddingAll;
      } else {
        paddingTop = parent.padding?.top || 0;
        paddingRight = parent.padding?.right || 0;
        paddingBottom = parent.padding?.bottom || 0;
        paddingLeft = parent.padding?.left || 0;
      }

      // Espacio interior del padre
      const innerW = parentWidth - borderW * 2 - paddingLeft - paddingRight;
      const innerH = parentHeight - borderW * 2 - paddingTop - paddingBottom;

      // ——— CASO A: Padre SIN childrenLayout (posicionamiento absoluto tradicional) ———
      if (!parent.childrenLayout) {
        // Limitar tamaño para que no sobresalga
        if (!comp.alignment) {
          const maxW = Math.max(0, innerW - (comp.left ?? 0));
          const maxH = Math.max(0, innerH - (comp.top ?? 0));
          style.width = Math.min(compWidth, maxW) + 'px';
          style.height = Math.min(compHeight, maxH) + 'px';
        } else {
          style.width = Math.min(compWidth, innerW) + 'px';
          style.height = Math.min(compHeight, innerH) + 'px';
        }

        // Calcular posición considerando padding
        let rawLeft: number, rawTop: number;
        if (!comp.alignment) {
          rawLeft = comp.left ?? 0;
          rawTop = comp.top ?? 0;
        } else {
          const usedWidth = parseFloat(style.width);
          const usedHeight = parseFloat(style.height);

          const x = {
            left: 0,
            center: (innerW - usedWidth) / 2,
            right: innerW - usedWidth,
          };
          const y = {
            top: 0,
            center: (innerH - usedHeight) / 2,
            bottom: innerH - usedHeight,
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
          rawLeft = pos.left;
          rawTop = pos.top;
        }

        // Aplicar posición final considerando borde + padding del padre
        const finalLeft = borderW + paddingLeft + rawLeft;
        const finalTop = borderW + paddingTop + rawTop;

        // Clamp para mantener dentro del padre
        const usedW = parseFloat(style.width);
        const usedH = parseFloat(style.height);
        const maxLeft = parentWidth - usedW;
        const maxTop = parentHeight - usedH;

        style.left = Math.min(Math.max(finalLeft, borderW), maxLeft) + 'px';
        style.top = Math.min(Math.max(finalTop, borderW), maxTop) + 'px';
      }

      // ——— CASO B: Padre CON childrenLayout (flexbox) ————————————————————————
      else {
        // *** EXCEPCIÓN ESPECIAL PARA ELEMENTOS TEXT ***
        if (comp.type === 'Text') {
          // Los elementos Text mantienen posicionamiento absoluto incluso en contenedores flex
          style.width = Math.min(compWidth, innerW) + 'px';
          style.height = Math.min(compHeight, innerH) + 'px';
          style.position = 'absolute';

          let rawLeft: number, rawTop: number;

          if (!comp.alignment) {
            rawLeft = comp.left ?? 0;
            rawTop = comp.top ?? 0;
          } else {
            const usedWidth = parseFloat(style.width);
            const usedHeight = parseFloat(style.height);

            const x = {
              left: 0,
              center: (innerW - usedWidth) / 2,
              right: innerW - usedWidth,
            };
            const y = {
              top: 0,
              center: (innerH - usedHeight) / 2,
              bottom: innerH - usedHeight,
            };

            const alignmentMap: Record<string, { top: number; left: number }> =
              {
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

            const pos = alignmentMap[comp.alignment] || { top: 0, left: 0 };
            rawLeft = pos.left;
            rawTop = pos.top;
          }

          // Aplicar posición considerando padding
          const finalLeft = borderW + paddingLeft + rawLeft;
          const finalTop = borderW + paddingTop + rawTop;

          const usedW = parseFloat(style.width);
          const usedH = parseFloat(style.height);
          const maxLeft = parentWidth - usedW;
          const maxTop = parentHeight - usedH;

          style.left = Math.min(Math.max(finalLeft, borderW), maxLeft) + 'px';
          style.top = Math.min(Math.max(finalTop, borderW), maxTop) + 'px';
          style.zIndex = 10;

          return style;
        }

        // *** RESTO DE ELEMENTOS (NO TEXT) - COMPORTAMIENTO FLEX NORMAL ***

        // Calcular tamaño máximo disponible considerando gaps
        const gap = parent.gap || 8;
        const siblings = parent.children || [];
        const flexSiblings = siblings.filter(
          (sibling) => sibling.type !== 'Text'
        );
        const flexSiblingCount = flexSiblings.length;

        let maxAvailableW = innerW;
        let maxAvailableH = innerH;

        if (parent.childrenLayout === 'row' && flexSiblingCount > 1) {
          const totalGap = gap * (flexSiblingCount - 1);
          maxAvailableW = Math.max(0, (innerW - totalGap) / flexSiblingCount);
        } else if (parent.childrenLayout === 'column' && flexSiblingCount > 1) {
          const totalGap = gap * (flexSiblingCount - 1);
          maxAvailableH = Math.max(0, (innerH - totalGap) / flexSiblingCount);
        }

        // Aplicar límites de tamaño
        style.width = Math.min(compWidth, maxAvailableW) + 'px';
        style.height = Math.min(compHeight, maxAvailableH) + 'px';

        // Configurar como elemento flex
        style.position = 'relative';
        delete style.left;
        delete style.top;

        // Si este elemento también es contenedor flex
        if (comp.children && comp.children.length > 0 && comp.childrenLayout) {
          style.display = 'flex';
          style.flexDirection = comp.childrenLayout;
          style.justifyContent = this.getFlexJustifyContent(comp);
          style.alignItems = this.getFlexAlignItems(comp);
          style.gap = (comp.gap || 8) + 'px';

          // Padding del contenedor (respetando los bordes propios)
          const ownBorderW = bw;

          // Aplicar paddingAll correctamente para este contenedor
          let ownPaddingTop, ownPaddingRight, ownPaddingBottom, ownPaddingLeft;

          if (comp.paddingAll !== undefined && comp.paddingAll > 0) {
            ownPaddingTop =
              ownPaddingRight =
              ownPaddingBottom =
              ownPaddingLeft =
                comp.paddingAll;
          } else {
            ownPaddingTop = comp.padding?.top || 0;
            ownPaddingRight = comp.padding?.right || 0;
            ownPaddingBottom = comp.padding?.bottom || 0;
            ownPaddingLeft = comp.padding?.left || 0;
          }

          style.paddingTop = ownPaddingTop + ownBorderW + 'px';
          style.paddingRight = ownPaddingRight + ownBorderW + 'px';
          style.paddingBottom = ownPaddingBottom + ownBorderW + 'px';
          style.paddingLeft = ownPaddingLeft + ownBorderW + 'px';
        }

        // Alineación individual dentro del padre
        if (comp.alignment) {
          const flexAlignment = this.getFlexAlignment(
            comp.alignment,
            parent.childrenLayout
          );
          Object.assign(style, flexAlignment);
        }
      }

      return style;
    }

    // ——— 6) LÓGICA PARA ELEMENTOS PADRE (sin parentId) ————————————————————
    const reserved =
      comp.type === 'AppBar' ? 0 : this.getReservedAppBarHeight();

    if (!comp.alignment) {
      style.left = (comp.left ?? 0) + 'px';
      style.top = (comp.top ?? 0) + reserved + 'px';
    } else {
      const canvasWidth = 360;
      const canvasHeight = 812;
      const availableHeight = canvasHeight - reserved;

      const x = {
        left: 0,
        center: (canvasWidth - compWidth) / 2,
        right: canvasWidth - compWidth,
      };
      const y = {
        top: reserved,
        center: reserved + (availableHeight - compHeight) / 2,
        bottom: canvasHeight - compHeight,
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
      let left = Math.max(0, Math.min(pos.left, canvasWidth - compWidth));
      let top = Math.max(0, Math.min(pos.top, canvasHeight - compHeight));

      style.left = left + 'px';
      style.top = top + 'px';
    }

    return style;
  }
  getTableCellStyle(
    table: CanvasComponent,
    cell: CanvasComponent,
    rowIndex: number,
    colIndex: number
  ): any {
    const cellStyle: any = {
      padding: (table.cellPadding || 8) + 'px',
      border: `${table.tableBorder?.width || 1}px solid ${
        table.tableBorder?.color || '#cccccc'
      }`,
      fontSize: (cell.fontSize || 12) + 'px',
      color: cell.textColor || '#333333',
      fontFamily: cell.fontFamily || 'inherit',
      textAlign: cell.textAlign || 'center',
      verticalAlign: this.getVerticalAlignment(table),
      backgroundColor: this.getCellBackgroundColor(table, cell, rowIndex),
      cursor: this.isPreviewMode ? 'default' : 'pointer',
      transition: 'background-color 0.2s ease',
      minWidth: this.getColumnWidth(table, colIndex) + 'px',
      maxWidth: this.getColumnWidth(table, colIndex) + 'px',
      wordWrap: 'break-word',
      lineHeight: '1.4',
    };

    // Agregar hover effect si no está en modo preview
    if (!this.isPreviewMode) {
      cellStyle[':hover'] = {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
      };
    }

    // Estilo especial para encabezados
    if (rowIndex === 0 && table.headerRow) {
      cellStyle.fontWeight = 'bold';
      cellStyle.fontSize = (cell.fontSize || 14) + 'px';
    }

    return cellStyle;
  }
  // ——— MÉTODOS AUXILIARES PARA FLEXBOX ———————————————————————————————————————

  /* Método para obtener justify-content del contenedor padre en este caso por mas 
que el padre este aliniado en cualquier posicion, sus hijos siempre estaran en el centro */
  getFlexJustifyContent(comp: CanvasComponent): string {
    if (!comp.alignment) return 'center'; // default

    if (comp.childrenLayout === 'row') {
      // En row, justify-content controla la alineación horizontal
      if (comp.alignment.includes('Left')) return 'center';
      if (comp.alignment.includes('Center')) return 'center';
      if (comp.alignment.includes('Right')) return 'center';
    } else if (comp.childrenLayout === 'column') {
      // En column, justify-content controla la alineación vertical
      if (comp.alignment.includes('top')) return 'center';
      if (comp.alignment.includes('center')) return 'center';
      if (comp.alignment.includes('bottom')) return 'center';
    }

    return 'center';
  }

  // Método para obtener align-items del contenedor padre
  getFlexAlignItems(comp: CanvasComponent): string {
    if (!comp.alignment) return 'center'; // default

    if (comp.childrenLayout === 'row') {
      // En row, align-items controla la alineación vertical
      if (comp.alignment.startsWith('top')) return 'flex-start';
      if (comp.alignment.startsWith('center')) return 'center';
      if (comp.alignment.startsWith('bottom')) return 'flex-end';
    } else if (comp.childrenLayout === 'column') {
      // En column, align-items controla la alineación horizontal
      if (comp.alignment.includes('Left')) return 'flex-start';
      if (comp.alignment.includes('Center')) return 'center';
      if (comp.alignment.includes('Right')) return 'flex-end';
    }

    return 'center';
  }

  // Método para obtener align-self de elementos hijos individuales
  private getFlexAlignment(alignment: string, parentLayout: string): any {
    const flexStyles: any = {};

    if (parentLayout === 'row') {
      // En layout horizontal (row), align-self controla la alineación vertical del elemento individual
      switch (alignment) {
        case 'topLeft':
        case 'topCenter':
        case 'topRight':
          flexStyles.alignSelf = 'flex-start';
          break;
        case 'centerLeft':
        case 'center':
        case 'centerRight':
          flexStyles.alignSelf = 'center';
          break;
        case 'bottomLeft':
        case 'bottomCenter':
        case 'bottomRight':
          flexStyles.alignSelf = 'flex-end';
          break;
      }
    } else if (parentLayout === 'column') {
      // En layout vertical (column), align-self controla la alineación horizontal del elemento individual
      switch (alignment) {
        case 'topLeft':
        case 'centerLeft':
        case 'bottomLeft':
          flexStyles.alignSelf = 'flex-start';
          break;
        case 'topCenter':
        case 'center':
        case 'bottomCenter':
          flexStyles.alignSelf = 'center';
          break;
        case 'topRight':
        case 'centerRight':
        case 'bottomRight':
          flexStyles.alignSelf = 'flex-end';
          break;
      }
    }

    return flexStyles;
  }

  //metodos auxiliares para agregar el componente textlabel
  // Agregar estas propiedades en tu componente
  private textFieldPreviewValues: Map<string, string> = new Map();

  // Métodos para manejar valores temporales en modo previsualización
  getTextFieldPreviewValue(componentId: string): string {
    return this.textFieldPreviewValues.get(componentId) || '';
  }

  setTextFieldPreviewValue(componentId: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    this.textFieldPreviewValues.set(componentId, target.value);
  }

  // Opcional: Limpiar valores temporales cuando se sale del modo previsualización
  clearTextFieldPreviewValues(): void {
    this.textFieldPreviewValues.clear();
  }

  // Si tienes un método que se ejecuta al cambiar de modo, puedes llamar clear allí
  onPreviewModeChange(): void {
    if (!this.isPreviewMode) {
      this.clearTextFieldPreviewValues();
    }
  }
  getPantallaSinTopLeft() {
    this.widgets.getPantallaSinTopLeft(); // Llama al método del componente Widgets
  }

  /**
   * Obtiene solo los hijos que participan en el flujo flex (excluye Text)
   */
  getFlexChildren(children: CanvasComponent[]): CanvasComponent[] {
    if (!children) return [];
    return children.filter((child) => child.type !== 'Text');
  }

  /**
   * Obtiene solo los hijos de tipo Text
   */
  getTextChildren(children: CanvasComponent[]): CanvasComponent[] {
    if (!children) return [];
    return children.filter((child) => child.type === 'Text');
  }

  //tabla--------------------------
  /**
   * Selecciona el componente tabla completo (un clic)
   */
  selectTableComponent(table: CanvasComponent, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedComponent = table;
    this.contextMenu.visible = false;
    console.log('🔵 Tabla seleccionada:', table.id);
  }

  /**
   * Selecciona una celda específica de la tabla
   */
  selectTableCell(cell: CanvasComponent, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedComponent = cell;
  }

  /**
   * Habilita la edición de una celda
   */
  editTableCell(cell: CanvasComponent, event: MouseEvent): void {
    event.stopPropagation();
    const target = event.target as HTMLElement;
    target.focus();
  }

  /**
   * Actualiza el contenido de una celda cuando termina la edición
   */
  updateCellContent(cell: CanvasComponent, event: Event): void {
    const target = event.target as HTMLElement;
    const newContent = target.textContent || '';

    if (cell.content !== newContent) {
      const pageId = this.pages[this.currentPantalla].id;
      this.socketService.updateComponentProperties(
        this.roomCode,
        pageId,
        cell.id,
        { content: newContent }
      );
    }
  }



  /**
   * Maneja el clic en una celda - evita que se seleccione la tabla cuando se hace clic en celda
   */
  handleCellClick(
    cell: CanvasComponent,
    table: CanvasComponent,
    event: MouseEvent
  ): void {
    event.stopPropagation(); // Evita que se propague al click de la tabla
    // En un clic simple, no hacemos nada especial, solo prevenimos la propagación
    // La tabla seguirá seleccionada si ya lo estaba
  }


  /**
   * Obtiene el color de fondo de una celda según su posición y configuración de la tabla
   */
  getCellBackgroundColor(
    table: CanvasComponent,
    cell: CanvasComponent,
    rowIndex: number
  ): string {
    // Prioridad 1: Color específico de la celda
    if (cell.cellBackgroundColor && cell.cellBackgroundColor !== '#ffffff') {
      return cell.cellBackgroundColor;
    }

    // Prioridad 2: Primera fila como encabezado
    if (rowIndex === 0 && table.headerRow && table.headerBackgroundColor) {
      return table.headerBackgroundColor;
    }

    // Prioridad 3: Color alternado para filas (excluyendo encabezado)
    if (table.alternateRowColor && rowIndex > 0 && rowIndex % 2 === 0) {
      return table.alternateRowColor;
    }

    // Color por defecto
    return '#ffffff';
  }

  /**
   * Obtiene la alineación vertical de las celdas
   */
  getVerticalAlignment(table: CanvasComponent): string {
    switch (table.defaultVerticalAlignment) {
      case 'top':
        return 'top';
      case 'bottom':
        return 'bottom';
      case 'middle':
      default:
        return 'middle';
    }
  }

  /**
   * Obtiene el ancho de una columna específica
   */
  getColumnWidth(table: CanvasComponent, columnIndex: number): number {
    // Si hay anchos específicos definidos
    if (table.columnWidths && table.columnWidths[columnIndex]) {
      const totalWidth = table.width || 260;
      const totalProportion = table.columnWidths.reduce(
        (sum, width) => sum + width,
        0
      );
      return Math.max(
        60,
        (totalWidth * table.columnWidths[columnIndex]) / totalProportion
      );
    }

    // Ancho igual para todas las columnas
    const totalWidth = table.width || 260;
    const numColumns = table.columns || 3;
    return Math.max(60, totalWidth / numColumns); // Mínimo 60px por columna
  }
// Agregar estos métodos a tu componente rooms.component.ts

/**
 * Maneja el click específico en celdas de tabla
 */
handleTableCellClick(cell: CanvasComponent, table: CanvasComponent, event: MouseEvent): void {
  if (this.isPreviewMode) return;
  
  // Detener propagación para evitar que se active el click de la tabla
  event.stopPropagation();
  event.preventDefault();
  
  console.log(`🔸 Click en celda: ${cell.id} - Fila: ${(cell.rowIndex || 0) + 1}, Columna: ${(cell.columnIndex || 0) + 1}`);
  
  // Seleccionar la celda
  this.selectedComponent = cell;
  this.contextMenu.visible = false;
  
  // Forzar detección de cambios
  this.cdr.detectChanges();
}

/**
 * Maneja el mousedown específico para celdas de tabla
 */
onTableCellMouseDown(event: MouseEvent, cell: CanvasComponent, table: CanvasComponent): void {
  if (this.isPreviewMode) return;
  
  // Detener propagación
  event.stopPropagation();
  
  // No iniciar drag para celdas individuales, solo para la tabla completa
  // Las celdas se seleccionan pero no se mueven individualmente
  this.selectedComponent = cell;
  
  console.log(`🔸 MouseDown en celda: ${cell.id}`);
}

/**
 * Selecciona la tabla completa (mejorado)
 */
selectTable(table: CanvasComponent, event: MouseEvent): void {
  if (this.isPreviewMode) return;
  
  // Solo seleccionar la tabla si el click fue directamente en ella
  // y no en una celda
  const target = event.target as HTMLElement;
  const isDirectTableClick = target.tagName.toLowerCase() === 'table' || 
                            target.classList.contains('table-container');
  
  if (isDirectTableClick) {
    event.stopPropagation();
    this.selectedComponent = table;
    this.contextMenu.visible = false;
    console.log('🔵 Tabla seleccionada:', table.id);
    this.cdr.detectChanges();
  }
}

/**
 * Actualiza el método selectCell existente
 */
selectCell(cell: CanvasComponent, event: MouseEvent): void {
  if (this.isPreviewMode) return;
  
  event.stopPropagation();
  event.preventDefault();
  
  this.selectedComponent = cell;
  this.contextMenu.visible = false;
  
  console.log(
    '🔸 Celda seleccionada (doble click):',
    cell.id,
    'Tipo:',
    cell.type,
    `Fila: ${(cell.rowIndex || 0) + 1}, Columna: ${(cell.columnIndex || 0) + 1}`,
    'Contenido:',
    cell.content
  );
  
  this.cdr.detectChanges();
}


//exportar proyecto
  //fin border
  downloadAngularProject() {
    const url = `http://localhost:3000/api/export/flutter/${this.roomCode}`;
    window.open(url, '_blank'); // Abre la descarga del zip en otra pestaña
  }

  cargarJsonEjemploLocal() {
    this.widgets.cargarJsonEjemploLocal();
  }

  //metodos auxiliares para la ia
  openTextPrompt(): void {
    this.showAIHub = false;
    this.showTextModal = true;
  }

  openImageUpload(): void {
    this.showAIHub = false;
    this.showImageModal = true;
  }

  closeTextModal(): void {
    this.showTextModal = false;
    this.questionText = '';
  }

  closeImageModal(): void {
    this.showImageModal = false;
    this.selectedImage = null;
  }

  onImageSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    
    // Verificar que el input tenga archivos
    if (input.files && input.files.length > 0) {
      this.selectedImage = input.files[0];
      this.imagePrompt = ''; // Limpiar el prompt anterior
      
      console.log('Imagen seleccionada:', this.selectedImage.name);
      
      // Procesar la imagen automáticamente
      this.sendImageToBackend();
    }
  }

  generateFromText(): void {
    if (!this.questionText.trim()) return;

    this.makeHttpRequest();
    this.closeTextModal();
  }

  generateFromImage(): void {
    if (!this.selectedImage) {
      console.warn('No hay imagen seleccionada');
      return;
    }
  
    console.log('Procesando imagen:', this.selectedImage.name);
    
    // Procesar la imagen
    this.sendImageToBackend();
    
    // Cerrar modal
    this.closeImageModal();
  }
  showResponseModal = false;
  httpResponse: any;

  showQuestionModal = false;

  makeHttpRequest() {
    const body = { question: this.questionText };
    this.http.post('http://localhost:5000/query', body).subscribe({
      next: (response: any) => {
        try {
          // Parsear la respuesta y asignarla a jsonEjemplo
          const components = JSON.parse(response.response);

          // Obtener el ID de la página actual
          const pageId = this.pages[this.currentPantalla].id;

          // 🧹 PASO 1: Limpiar la pantalla actual usando socket service
          this.socketService.clearPage(this.roomCode, pageId);

          // 🎯 PASO 2: Agregar nuevos componentes después de un pequeño delay
          // para asegurar que la limpieza se complete primero
          setTimeout(() => {
            components.forEach((component: any, index: number) => {
              // Generar nuevo ID para evitar conflictos
              const componentWithNewId = {
                ...component,
                id: uuidv4(),
              };

              // Agregar con un pequeño delay para evitar conflictos
              setTimeout(() => {
                this.socketService.addCanvasComponent(
                  this.roomCode,
                  pageId,
                  componentWithNewId
                );
              }, index * 100); // 100ms entre cada componente
            });
          }, 200); // 200ms de delay inicial para que la limpieza se complete

          this.showResponseModal = true;
          this.httpResponse = `Diseño cargado exitosamente - ${components.length} componentes agregados`;
          console.log(
            '🤖 Componentes de IA cargados:',
            components.length,
            'elementos'
          );
          console.log('🧹 Pantalla limpiada y nuevos componentes agregados');
        } catch (error) {
          this.httpResponse = 'Error al procesar la respuesta: ' + error;
          this.showResponseModal = true;
        }
      },
      error: (error) => {
        this.httpResponse = error;
        this.showResponseModal = true;
      },
    });
  }
  //imagen
  imagePrompt: string = ''; 

  cargarimagenia(promptText: string) {
    const body = { question: promptText };
    // this.http.post('http://localhost:5000/query', body).subscribe({
    this.http.post('http://localhost:5000/query', body).subscribe({
      next: (response: any) => {
        try {
          const components = JSON.parse(response.response);
          const pageId = this.pages[this.currentPantalla].id;
  
          this.socketService.clearPage(this.roomCode, pageId);
  
          setTimeout(() => {
            components.forEach((component: any, index: number) => {
              const componentWithNewId = {
                ...component,
                id: uuidv4()
              };
  
              setTimeout(() => {
                this.socketService.addCanvasComponent(this.roomCode, pageId, componentWithNewId);
              }, index * 100);
            });
          }, 200);
  
          this.showResponseModal = true;
          this.httpResponse = "Diseño cargado exitosamente' - ${components.length} 'componentes agregados'";
          console.log('🤖 Componentes de IA cargados:', components.length, 'elementos');
          console.log('🧹 Pantalla limpiada y nuevos componentes agregados');
  
        } catch (error) {
          this.httpResponse = "Error al procesar la respuesta: " + error;
          this.showResponseModal = true;
        }
      },
      error: (error) => {
        this.httpResponse = error;
        this.showResponseModal = true;
      }
    });
  }


  sendImageToBackend() {
    if (!this.selectedImage) return;
    console.log('Enviando imagen al backend...');
    const formData = new FormData();
    formData.append('image', this.selectedImage);
    formData.append('prompt', this.imagePrompt || 'Describe la imagen');

    // this.http.post<any>('http://localhost:5000/analyze-image', formData).subscribe({
    this.http.post<any>('http://localhost:5000/analyze-image', formData).subscribe({
      next: (response) => {
        this.httpResponse = response.response;
        // this.showResponseModal = true;
        this.showImageModal = false;
        this.cargarimagenia(response.response);
      },
      error: (error) => {
        this.httpResponse = error.error?.error || 'Error al analizar la imagen';
        this.showResponseModal = true;
        //this.showImageModal = false;
      }
    });
  }
}
