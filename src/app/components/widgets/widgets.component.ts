import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
  Output,
  EventEmitter,
} from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { ActivatedRoute, Router } from '@angular/router';
import { SokectSevice } from '../../services/socket.service';
import { Page } from '../../interface/pantallas.interfaces';
import { CanvasComponent } from '../../interface/canvas-component.interface';





@Component({
  selector: 'app-widgets',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './widgets.component.html',
  styleUrl: './widgets.component.css',
})
export class WidgetsComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private socketService: SokectSevice,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  @Input() roomCode: string = '';
  @Input() isPreviewMode: boolean = false;
  @Input() previewPantallaIndex: number = 0;
  @Input() currentPantalla = 0;
  @Input() pages: Page[] = [];
  @Input() selectedComponent: CanvasComponent | null = null;

  // Eventos para comunicación con el componente padre
  @Output() previewModeToggled = new EventEmitter<boolean>();
  @Output() pantallaChanged = new EventEmitter<number>();
  @Output() pageAdded = new EventEmitter<void>();
  @Output() pageRemoved = new EventEmitter<string>();
  @Output() addPage = new EventEmitter<void>();
  //agregar widgets unificaco

  roomName: string = '';
  errorMessage: string = '';
  usersInRoom: any[] = [];

  ngOnInit(): void {
    this.roomCode = this.route.snapshot.paramMap.get('code') || '';
    this.socketService.onJoinedRoom().subscribe((room) => {
      this.roomName = room.name;
    });
    this.socketService.onUsersListUpdate().subscribe((users) => {
      this.usersInRoom = users;
    });
  }

  // =============================================
  // MÉTODOS DE GESTIÓN DE PÁGINAS
  // =============================================

  /**
   * Alternar modo de previsualización
   */
  togglePreviewMode(): void {
    if (!this.isPreviewMode) {
      this.previewPantallaIndex = this.currentPantalla;
    } else {
      this.currentPantalla = this.previewPantallaIndex;
    }
    this.isPreviewMode = !this.isPreviewMode;
    this.previewModeToggled.emit(this.isPreviewMode);
    this.cdr.detectChanges();
  }

  /**
   * Cambiar pantalla activa
   */
  changePantalla(index: number): void {
    this.currentPantalla = index;
    this.selectedComponent = null;

    if (this.isPreviewMode) {
      this.previewPantallaIndex = index;
    }

    this.pantallaChanged.emit(index);
    this.cdr.detectChanges();
  }

  /**
   * Agregar nueva página
   */
  onAddPage() {
    this.addPage.emit();
  }

  /**
   * Eliminar página
   */
  removePage(pageId: string): void {
    if (!this.roomCode) return;

    // Confirmar eliminación
    const pageToRemove = this.pages.find((p) => p.id === pageId);
    if (
      pageToRemove &&
      confirm(`¿Estás seguro de que quieres eliminar "${pageToRemove.name}"?`)
    ) {
      this.socketService.removePage(this.roomCode, pageId);
      this.pageRemoved.emit(pageId);
    }
  }

  // =============================================
  // MÉTODOS PARA AGREGAR COMPONENTES
  // =============================================

  /**
   * Cargar JSON de ejemplo local
   */
  cargarJsonEjemploLocal(): void {
    const jsonEjemplo: CanvasComponent[] = [];
    this.pages[this.currentPantalla].components = [...jsonEjemplo];
  }

  /**
   * Agregar AppBar
   */
  addAppBar(): void {
    if (this.currentHasAppBar()) {
      return;
    }

    const newAppBar: CanvasComponent = {
      id: uuidv4(),
      type: 'AppBar',
      top: 0,
      left: 0,
      width: 360,
      height: 70,
      decoration: {
        color: '#2196f3',
        border: { color: '#000000', width: 0 },
        borderRadius: 0,
      },
      children: [],
      parentId: null,
    };

    const pageId = this.pages[this.currentPantalla].id;
    this.socketService.addCanvasComponent(this.roomCode, pageId, newAppBar);
  }

  /**
   * Agregar texto root
   */
  addTextRoot(): void {
    const pageId = this.pages[this.currentPantalla].id;

    const newText: CanvasComponent = {
      id: uuidv4(),
      type: 'Text',
      text: 'Título',
      fontSize: 16,
      autoSize: true,
      width: 44,
      height: 30,
      top: 10,
      left: 10,
      children: [],
      parentId: null,
    };

    this.socketService.addCanvasComponent(this.roomCode, pageId, newText);
  }

  /**
   * Agregar container
   */
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
      childrenLayout: '',
      gap: 8,
    };

    const pageId = this.pages[this.currentPantalla].id;
    this.socketService.addCanvasComponent(this.roomCode, pageId, newContainer);
  }

  /**
   * Agregar botón de texto
   */
  addTextButton(): void {
    const buttonId = uuidv4();
    const newTextButton: CanvasComponent = {
      id: buttonId,
      type: 'TextButton',
      top: 50,
      left: 50,
      width: 120,
      height: 48,
      decoration: {
        color: '#ffffff',
        border: { color: '#000000', width: 2 },
        borderRadius: 8,
      },
      navigateTo: '/pantalla2',
      text: 'Botón',
      textColor: '#000000',
      textAlign: 'center',
      fontSize: 16,
      fontFamily: 'inherit',
      children: [],
      parentId: null,
    };

    const pageId = this.pages[this.currentPantalla].id;
    this.socketService.addCanvasComponent(this.roomCode, pageId, newTextButton);
  }

  /**
   * Agregar checkbox
   */
  addCheckbox(): void {
    const defaultCheckSize = 24;
    const newCheckbox: CanvasComponent = {
      id: uuidv4(),
      type: 'Checkbox',
      checked: false,
      checkColor: '#FF0000',
      activeColor: '#FFFF00',
      borderColor: '#FF0000',
      borderWidth: 2,
      borderRadius: 0,
      scale: 2,
      checkSize: defaultCheckSize,
      children: [],
      parentId: null,
    };

    const pageId = this.pages[this.currentPantalla].id;
    this.socketService.addCanvasComponent(this.roomCode, pageId, newCheckbox);
  }

  /**
   * Agregar dropdown button
   */
  addDropdownButton(): void {
    const newDropdown: CanvasComponent = {
      id: uuidv4(),
      type: 'DropdownButton',
      top: 50,
      left: 50,
      width: 120,
      height: 40,
      decoration: {
        color: '#ffffff',
        border: { color: '#000000', width: 1 },
        borderRadius: 4,
      },
      options: ['Opción 1', 'Opción 2'],
      selectedOption: 'Opción 1',
      children: [],
      parentId: null,
    };

    const pageId = this.pages[this.currentPantalla].id;
    this.socketService.addCanvasComponent(this.roomCode, pageId, newDropdown);
  }

  /**
   * Agregar text field
   */
  addTextField(): void {
    const newTextField: CanvasComponent = {
      id: uuidv4(),
      type: 'TextField',
      top: 50,
      left: 50,
      width: 200,
      height: 56,
      decoration: {
        color: '#ffffff',
        border: {
          color: '#e0e0e0',
          width: 1,
        },
        borderRadius: 4,
      },
      hintText: 'Ingresa el texto aquí',
      value: '',
      inputType: 'text',
      enabled: true,
      borderType: 'outline',
      focusedBorderColor: '#2196f3',
      labelColor: '#757575',
      hintColor: '#9e9e9e',
      inputTextColor: '#212121',
      fontSize: 16,
      children: [],
      parentId: null,
    };

    const pageId = this.pages[this.currentPantalla].id;
    this.socketService.addCanvasComponent(this.roomCode, pageId, newTextField);
  }

  // =============================================
  // MÉTODOS UTILITARIOS
  // =============================================

  /**
   * Verificar si la pantalla actual tiene AppBar
   */
  currentHasAppBar(): boolean {
    const page = this.pages[this.currentPantalla];
    return page?.components?.some((c) => c.type === 'AppBar') || false;
  }

  /**
   * Obtener pantalla sin propiedades top y left
   */
  getPantallaSinTopLeft(): CanvasComponent[] {
    return (
      this.pages[this.currentPantalla]?.components?.map((comp) => {
        const clone: CanvasComponent = JSON.parse(JSON.stringify(comp));

        if (clone.alignment) {
          delete clone.top;
          delete clone.left;
        }

        return clone;
      }) || []
    );
  }

  /**
   * Obtener JSON completo de las páginas
   */
  getJsonCompleto(): string {
    const pantallasLimpias = this.pages.map((page) => {
      const components = page.components.map((comp) => {
        const clone: CanvasComponent = JSON.parse(JSON.stringify(comp));
        if (clone.alignment) {
          delete clone.top;
          delete clone.left;
        }
        return clone;
      });

      return {
        id: page.id,
        name: page.name,
        components,
      };
    });

    return JSON.stringify(pantallasLimpias, null, 2);
  }
}
