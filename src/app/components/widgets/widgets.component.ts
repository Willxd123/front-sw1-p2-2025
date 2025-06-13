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
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-widgets',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './widgets.component.html',
  styleUrl: './widgets.component.css',
})
export class WidgetsComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private socketService: SokectSevice,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
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
  dropdownOpen: boolean = false;
  showParticipants: boolean = false;
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
  /**
   * Cargar JSON de ejemplo local y sincronizar con BD
   */
  cargarJsonEjemploLocal(): void {
    const jsonEjemplo: CanvasComponent[] = [
     
    ];

    // Obtener el ID de la página actual
    const pageId = this.pages[this.currentPantalla].id;

    // Limpiar componentes actuales localmente (opcional, para pruebas)
    // this.pages[this.currentPantalla].components = [];

    // Agregar cada componente usando el servicio socket para sincronizar
    jsonEjemplo.forEach((component, index) => {
      // Generar nuevo ID para evitar conflictos si se ejecuta múltiples veces
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

    console.log(
      '🎯 Cargando JSON de ejemplo...',
      jsonEjemplo.length,
      'componentes'
    );
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
      top: 200,
      left: 100,
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
/**
 * Agregar tabla
 */
addTable(): void {
  const tableId = uuidv4();

  // ========== FILA 0 (ENCABEZADOS) ==========
  const row0Id = uuidv4();
  
  // Celda 0,0 - Encabezado 1
  const cell_0_0: CanvasComponent = {
    id: uuidv4(),
    type: 'tableCell',
    content: 'Encabezado 1',
    rowIndex: 0,
    columnIndex: 0,
    fontSize: 14,
    textColor: '#000000',
    fontFamily: 'inherit',
    textAlign: 'center',
    cellBackgroundColor: '#f0f0f0',
    children: [],
    parentId: row0Id,
  };

  // Celda 0,1 - Encabezado 2
  const cell_0_1: CanvasComponent = {
    id: uuidv4(),
    type: 'tableCell',
    content: 'Encabezado 2',
    rowIndex: 0,
    columnIndex: 1,
    fontSize: 14,
    textColor: '#000000',
    fontFamily: 'inherit',
    textAlign: 'center',
    cellBackgroundColor: '#f0f0f0',
    children: [],
    parentId: row0Id,
  };

  // Celda 0,2 - Encabezado 3
  const cell_0_2: CanvasComponent = {
    id: uuidv4(),
    type: 'tableCell',
    content: 'Encabezado 3',
    rowIndex: 0,
    columnIndex: 2,
    fontSize: 14,
    textColor: '#000000',
    fontFamily: 'inherit',
    textAlign: 'center',
    cellBackgroundColor: '#f0f0f0',
    children: [],
    parentId: row0Id,
  };

  const tableRow0: CanvasComponent = {
    id: row0Id,
    type: 'tableRow',
    rowIndex: 0,
    children: [cell_0_0, cell_0_1, cell_0_2],
    parentId: tableId,
  };

  // ========== FILA 1 ==========
  const row1Id = uuidv4();

  // Celda 1,0 - Celda 1.1
  const cell_1_0: CanvasComponent = {
    id: uuidv4(),
    type: 'tableCell',
    content: 'Celda 1.1',
    rowIndex: 1,
    columnIndex: 0,
    fontSize: 12,
    textColor: '#333333',
    fontFamily: 'inherit',
    textAlign: 'center',
    cellBackgroundColor: '#ffffff',
    children: [],
    parentId: row1Id,
  };

  // Celda 1,1 - Celda 1.2
  const cell_1_1: CanvasComponent = {
    id: uuidv4(),
    type: 'tableCell',
    content: 'Celda 1.2',
    rowIndex: 1,
    columnIndex: 1,
    fontSize: 12,
    textColor: '#333333',
    fontFamily: 'inherit',
    textAlign: 'center',
    cellBackgroundColor: '#ffffff',
    children: [],
    parentId: row1Id,
  };

  // Celda 1,2 - Celda 1.3
  const cell_1_2: CanvasComponent = {
    id: uuidv4(),
    type: 'tableCell',
    content: 'Celda 1.3',
    rowIndex: 1,
    columnIndex: 2,
    fontSize: 12,
    textColor: '#333333',
    fontFamily: 'inherit',
    textAlign: 'center',
    cellBackgroundColor: '#ffffff',
    children: [],
    parentId: row1Id,
  };

  const tableRow1: CanvasComponent = {
    id: row1Id,
    type: 'tableRow',
    rowIndex: 1,
    children: [cell_1_0, cell_1_1, cell_1_2],
    parentId: tableId,
  };

  // ========== FILA 2 ==========
  const row2Id = uuidv4();

  // Celda 2,0 - Celda 2.1
  const cell_2_0: CanvasComponent = {
    id: uuidv4(),
    type: 'tableCell',
    content: 'Celda 2.1',
    rowIndex: 2,
    columnIndex: 0,
    fontSize: 12,
    textColor: '#333333',
    fontFamily: 'inherit',
    textAlign: 'center',
    cellBackgroundColor: '#ffffff',
    children: [],
    parentId: row2Id,
  };

  // Celda 2,1 - Celda 2.2
  const cell_2_1: CanvasComponent = {
    id: uuidv4(),
    type: 'tableCell',
    content: 'Celda 2.2',
    rowIndex: 2,
    columnIndex: 1,
    fontSize: 12,
    textColor: '#333333',
    fontFamily: 'inherit',
    textAlign: 'center',
    cellBackgroundColor: '#ffffff',
    children: [],
    parentId: row2Id,
  };

  // Celda 2,2 - Celda 2.3
  const cell_2_2: CanvasComponent = {
    id: uuidv4(),
    type: 'tableCell',
    content: 'Celda 2.3',
    rowIndex: 2,
    columnIndex: 2,
    fontSize: 12,
    textColor: '#333333',
    fontFamily: 'inherit',
    textAlign: 'center',
    cellBackgroundColor: '#ffffff',
    children: [],
    parentId: row2Id,
  };

  const tableRow2: CanvasComponent = {
    id: row2Id,
    type: 'tableRow',
    rowIndex: 2,
    children: [cell_2_0, cell_2_1, cell_2_2],
    parentId: tableId,
  };

  // ========== TABLA COMPLETA ==========
  const newTable: CanvasComponent = {
    id: tableId,
    type: 'table',
    top: 100,
    left: 50,
    width: 260,
    height: 150,
    rows: 3,
    columns: 3,
    tableBorder: {
      color: '#cccccc',
      width: 1,
    },
    cellPadding: 8,
    headerRow: true,
    headerBackgroundColor: '#f0f0f0',
    alternateRowColor: '#f9f9f9',
    defaultVerticalAlignment: 'middle',
    columnWidths: [1, 1, 1],
    decoration: {
      color: '#ffffff',
      border: {
        color: '#cccccc',
        width: 1,
      },
      borderRadius: 4,
    },
    children: [tableRow0, tableRow1, tableRow2],
    parentId: null,
  };

  const pageId = this.pages[this.currentPantalla].id;
  this.socketService.addCanvasComponent(this.roomCode, pageId, newTable);
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
  // Agregar estos métodos auxiliares en widgets.component.ts

  /**
   * Obtener iniciales del nombre de usuario
   */
  getUserInitials(name: string): string {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (
      words[0].charAt(0) + words[words.length - 1].charAt(0)
    ).toUpperCase();
  }

  /**
   * TrackBy function para optimizar *ngFor de usuarios
   */
  trackByUserEmail(index: number, user: any): string {
    return user.email || index;
  }

  /**
   * TrackBy function para optimizar *ngFor de páginas
   */
  trackByPageId(index: number, page: any): string {
    return page.id || index;
  }

  // Agregar este método en widgets.component.ts

  /**
   * Limpiar toda la pantalla actual
   */
  clearCurrentPage(): void {
    const currentPage = this.pages[this.currentPantalla];

    if (!currentPage || !this.roomCode) {
      console.warn('No hay página actual o código de sala');
      return;
    }

    // Confirmar la acción
    const confirmClear = confirm(
      `¿Estás seguro de que quieres limpiar toda la pantalla "${currentPage.name}"?\n\nEsta acción eliminará todos los componentes y no se puede deshacer.`
    );

    if (!confirmClear) {
      return;
    }

    // Emitir evento para limpiar la página
    this.socketService.clearPage(this.roomCode, currentPage.id);

    // Deseleccionar cualquier componente seleccionado
    this.selectedComponent = null;

    console.log(`🧹 Limpiando página: ${currentPage.name} (${currentPage.id})`);
  }

}
