import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { CanvasComponent } from '../../interface/canvas-component.interface';
import { ActivatedRoute, Router } from '@angular/router';
import { SokectSevice } from '../../services/socket.service';
import { FormsModule } from '@angular/forms';
import { Page } from '../../interface/pantallas.interfaces';
import { ComponentDimensions } from '../../interface/dimencion.interface';
import { v4 as uuidv4 } from 'uuid';
@Component({
  selector: 'app-propiedades',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './propiedades.component.html',
  styleUrl: './propiedades.component.css',
})
export class PropiedadesComponent implements OnInit {
  roomName: string = ''; // Nombre de la sala que obtenemos del backend
  errorMessage: string = ''; // Para manejar errores
  usersInRoom: any[] = []; // Almacena los usuarios que se unen

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

  //instancias
  @Input() pantallaCustomRoute: string = '';
  ngOnInit(): void {
    this.roomCode = this.route.snapshot.paramMap.get('code') || '';
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

  /**
   * Calcula el padding efectivo de un componente
   */
  getEffectivePadding(comp: any): {
    top: number;
    right: number;
    bottom: number;
    left: number;
  } {
    // Prioridad: paddingAll -> valores individuales
    if (comp.paddingAll !== undefined && comp.paddingAll > 0) {
      return {
        top: comp.paddingAll,
        right: comp.paddingAll,
        bottom: comp.paddingAll,
        left: comp.paddingAll,
      };
    }

    return {
      top: comp.padding?.top ?? 0,
      right: comp.padding?.right ?? 0,
      bottom: comp.padding?.bottom ?? 0,
      left: comp.padding?.left ?? 0,
    };
  }
  // Agregar este método para manejar cambios de childrenLayout
  //metodos auxiliares para ajustar tamaños
  /**
   * Valida y ajusta los tamaños de los hijos cuando el padre cambia de tamaño
   * considerando si tiene childrenLayout o no
   */
  validateAndAdjustChildrenSizes(parentId: string): void {
    if (!parentId || !this.roomCode) return;

    const page = this.pages[this.currentPantalla];
    const parent = this.findComponentById(page.components, parentId);

    if (!parent || !parent.children?.length) return;

    const parentWidth = parent.width ?? 100;
    const parentHeight = parent.height ?? 100;
    const borderWidth = parent.decoration?.border?.width ?? 0;

    // Calcular padding efectivo
    const effectivePadding = this.getEffectivePadding(parent);

    // Espacio interior disponible considerando bordes y padding
    const availableWidth =
      parentWidth -
      borderWidth * 2 -
      effectivePadding.left -
      effectivePadding.right;
    const availableHeight =
      parentHeight -
      borderWidth * 2 -
      effectivePadding.top -
      effectivePadding.bottom;

    if (parent.childrenLayout === 'row') {
      this.validateRowLayoutChildren(parent, availableWidth, availableHeight);
    } else if (parent.childrenLayout === 'column') {
      this.validateColumnLayoutChildren(
        parent,
        availableWidth,
        availableHeight
      );
    } else {
      // Layout null/stack - usar validación de posicionamiento absoluto
      this.validateStackLayoutChildren(
        parent,
        availableWidth,
        availableHeight,
        effectivePadding,
        borderWidth
      );
    }
  }
  /**
   * Valida hijos en layout stack/null (posicionamiento absoluto)
   */
  validateStackLayoutChildren(
    parent: any,
    availableWidth: number,
    availableHeight: number,
    padding: { top: number; right: number; bottom: number; left: number },
    borderWidth: number
  ): void {
    parent.children.forEach((child: any) => {
      let updated = false;
      const currentWidth = child.width ?? 100;
      const currentHeight = child.height ?? 100;
      const childLeft = child.left ?? 0;
      const childTop = child.top ?? 0;

      // Calcular espacio máximo disponible considerando posición
      const maxWidthFromPosition = availableWidth - childLeft;
      const maxHeightFromPosition = availableHeight - childTop;

      // Ajustar ancho si se sale del contenedor
      if (currentWidth > maxWidthFromPosition && maxWidthFromPosition > 0) {
        child.width = Math.max(20, maxWidthFromPosition);
        updated = true;
      }

      // Ajustar altura si se sale del contenedor
      if (currentHeight > maxHeightFromPosition && maxHeightFromPosition > 0) {
        child.height = Math.max(20, maxHeightFromPosition);
        updated = true;
      }

      if (updated) {
        this.emitChildSizeUpdate(child);
      }
    });
  }

  /**
   * Valida hijos en layout row
   */
  validateRowLayoutChildren(
    parent: any,
    availableWidth: number,
    availableHeight: number
  ): void {
    const gap = parent.gap ?? 8;
    const flexChildren = parent.children.filter(
      (child: any) => child.type !== 'Text'
    );

    if (flexChildren.length === 0) return;

    // Calcular ancho máximo por hijo considerando gaps
    const totalGaps = gap * (flexChildren.length - 1);
    const maxWidthPerChild = (availableWidth - totalGaps) / flexChildren.length;

    flexChildren.forEach((child: any) => {
      let updated = false;
      const currentWidth = child.width ?? 100;
      const currentHeight = child.height ?? 100;

      // Ajustar ancho si excede el espacio disponible
      if (currentWidth > maxWidthPerChild && maxWidthPerChild > 0) {
        child.width = Math.max(20, maxWidthPerChild); // Mínimo 20px
        updated = true;
      }

      // Ajustar altura si excede el espacio disponible
      if (currentHeight > availableHeight && availableHeight > 0) {
        child.height = Math.max(20, availableHeight);
        updated = true;
      }

      if (updated) {
        this.emitChildSizeUpdate(child);
      }
    });
  }
  /**
   * Emite la actualización de tamaño del hijo al servidor
   */
  emitChildSizeUpdate(child: any): void {
    const pageId = this.pages[this.currentPantalla].id;
    this.socketService.updateComponentProperties(
      this.roomCode,
      pageId,
      child.id,
      {
        width: child.width,
        height: child.height,
      }
    );
  }
  /**
   * Valida hijos en layout column
   */
  validateColumnLayoutChildren(
    parent: any,
    availableWidth: number,
    availableHeight: number
  ): void {
    const gap = parent.gap ?? 8;
    const flexChildren = parent.children.filter(
      (child: any) => child.type !== 'Text'
    );

    if (flexChildren.length === 0) return;

    // Calcular altura máxima por hijo considerando gaps
    const totalGaps = gap * (flexChildren.length - 1);
    const maxHeightPerChild =
      (availableHeight - totalGaps) / flexChildren.length;

    flexChildren.forEach((child: any) => {
      let updated = false;
      const currentWidth = child.width ?? 100;
      const currentHeight = child.height ?? 100;

      // Ajustar ancho si excede el espacio disponible
      if (currentWidth > availableWidth && availableWidth > 0) {
        child.width = Math.max(20, availableWidth);
        updated = true;
      }

      // Ajustar altura si excede el espacio disponible
      if (currentHeight > maxHeightPerChild && maxHeightPerChild > 0) {
        child.height = Math.max(20, maxHeightPerChild);
        updated = true;
      }

      if (updated) {
        this.emitChildSizeUpdate(child);
      }
    });
  }
  updateChildrenLayout(value: string): void {
    if (!this.selectedComponent || !this.roomCode) return;

    const pageId = this.pages[this.currentPantalla].id;
    const comp = this.selectedComponent;

    // Actualizar local
    comp.childrenLayout = value || '';

    // Enviar al servidor
    this.socketService.updateComponentProperties(
      this.roomCode,
      pageId,
      comp.id,
      { childrenLayout: value || '' }
    );

    // Cuando cambia el layout, necesitamos:
    // 1. Recalcular el tamaño del contenedor padre
    // 2. Validar y ajustar los hijos
    if (comp.children?.length) {
      setTimeout(() => {
        this.validateAndAdjustChildrenSizes(comp.id);

        // Si tiene padre, también reajustar
        if (comp.parentId) {
          this.autoResizeParent(comp.parentId);
        }
      }, 0);
    }
  }
  updateProperty(key: string, value: any): void {
    if (!this.selectedComponent || !this.roomCode) return;
    const pageId = this.pages[this.currentPantalla].id;
    const comp = this.selectedComponent;

    // 1) Actualizar local
    const keys = key.split('.');
    let target = comp as any;
    while (keys.length > 1) {
      const k = keys.shift()!;
      if (!(k in target)) target[k] = {};
      target = target[k];
    }
    target[keys[0]] = value;

    // 2) Enviar al servidor
    this.socketService.updateComponentProperties(
      this.roomCode,
      pageId,
      comp.id,
      { [key]: value }
    );

    // 3) Validaciones especiales según el tipo de cambio
    if (key === 'width' || key === 'height') {
      // Si cambiaron dimensiones del componente actual
      if (comp.parentId) {
        setTimeout(() => this.autoResizeParent(comp.parentId!), 0);
      }
      if (comp.children?.length) {
        setTimeout(() => this.validateAndAdjustChildrenSizes(comp.id), 0);
      }
    } else if (key === 'childrenLayout') {
      // Usar el método específico para childrenLayout
      this.updateChildrenLayout(value);
      return; // Salir temprano ya que updateChildrenLayout ya maneja todo
    } else if (key === 'gap') {
      // Si cambió gap, validar hijos
      if (comp.children?.length) {
        setTimeout(() => this.validateAndAdjustChildrenSizes(comp.id), 0);
      }
    }
  }

  updatePaddingProperty(
    side: 'top' | 'right' | 'bottom' | 'left' | 'paddingAll',
    value: number
  ): void {
    if (!this.selectedComponent || !this.roomCode) return;

    const pageId = this.pages[this.currentPantalla].id;
    const comp = this.selectedComponent;

    let updates: any = {};

    if (side === 'paddingAll') {
      // Actualizar paddingAll y limpiar padding individual
      comp.paddingAll = value;

      // Si se establece paddingAll, limpiar padding individual
      if (value > 0) {
        delete comp.padding;
        updates = {
          paddingAll: value,
          padding: undefined,
        };
      } else {
        updates = { paddingAll: value };
      }
    } else {
      // Actualizar padding individual
      if (!comp.padding) {
        comp.padding = {};
      }

      comp.padding[side] = value;

      // Si se está usando padding individual, limpiar paddingAll
      if (value > 0 && comp.paddingAll !== undefined) {
        delete comp.paddingAll;
        updates = {
          padding: comp.padding,
          paddingAll: undefined,
        };
      } else {
        updates = {
          [`padding.${side}`]: value,
        };
      }
    }

    // Enviar al servidor
    this.socketService.updateComponentProperties(
      this.roomCode,
      pageId,
      comp.id,
      updates
    );

    // Validar y ajustar hijos después del cambio de padding
    if (comp.children?.length) {
      setTimeout(() => this.validateAndAdjustChildrenSizes(comp.id), 0);
    }

    // Si tiene padre, también podría necesitar reajuste
    if (comp.parentId) {
      setTimeout(() => this.autoResizeParent(comp.parentId!), 0);
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
    this.socketService.updateComponentProperties(
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
    this.socketService.updateComponentProperties(
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

  executeCheckboxAction(comp: CanvasComponent, newCheckedState: boolean): void {
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
  originalParentSizes: Map<string, ComponentDimensions> = new Map();
  maxParentSizes: Map<string, ComponentDimensions> = new Map();
  // 3. NUEVO MÉTODO para calcular el tamaño mínimo requerido por los hijos
  calculateMinimumParentSize(parent: CanvasComponent): ComponentDimensions {
    if (!parent.children || parent.children.length === 0) {
      // Si no hay hijos, mantener el tamaño máximo alcanzado
      return (
        this.maxParentSizes.get(parent.id) || {
          width: parent.width ?? 100,
          height: parent.height ?? 100,
        }
      );
    }

    let maxRequiredWidth = 0;
    let maxRequiredHeight = 0;

    // Calcular el espacio mínimo requerido basado en los hijos
    parent.children.forEach((child) => {
      const childWidth = child.width ?? 100; // Valor por defecto para child.width
      const childHeight = child.height ?? 100; // Valor por defecto para child.height

      const childRight = (child.left || 0) + childWidth;
      const childBottom = (child.top || 0) + childHeight;

      maxRequiredWidth = Math.max(maxRequiredWidth, childRight);
      maxRequiredHeight = Math.max(maxRequiredHeight, childBottom);
    });

    // Obtener el tamaño máximo alcanzado hasta ahora
    const currentMaxSize = this.maxParentSizes.get(parent.id) || {
      width: parent.width ?? 100, // Valor por defecto si width es undefined
      height: parent.height ?? 100, // Valor por defecto si height es undefined
    };

    // El padre debe ser al menos tan grande como:
    // 1. Su tamaño máximo alcanzado anteriormente
    // 2. El espacio requerido por los hijos actuales
    const requiredWidth = Math.max(currentMaxSize.width, maxRequiredWidth + 10); // +10 padding
    const requiredHeight = Math.max(
      currentMaxSize.height,
      maxRequiredHeight + 10
    ); // +10 padding

    return {
      width: requiredWidth,
      height: requiredHeight,
    };
  }

  /**
   * Valida el tamaño mínimo del padre basado en sus hijos y layout
   */
  calculateMinimumParentSizeForLayout(parent: any): ComponentDimensions {
    if (!parent.children || parent.children.length === 0) {
      return (
        this.maxParentSizes.get(parent.id) || {
          width: parent.width ?? 100,
          height: parent.height ?? 100,
        }
      );
    }

    const borderWidth = parent.decoration?.border?.width ?? 0;
    const effectivePadding = this.getEffectivePadding(parent);
    const gap = parent.gap ?? 8;

    let requiredWidth = 0;
    let requiredHeight = 0;

    if (parent.childrenLayout === 'row') {
      // En row: sumar anchos + gaps, tomar altura máxima
      const flexChildren = parent.children.filter(
        (child: any) => child.type !== 'Text'
      );
      const totalChildrenWidth = flexChildren.reduce(
        (sum: number, child: any) => sum + (child.width ?? 100),
        0
      );
      const totalGaps = gap * Math.max(0, flexChildren.length - 1);
      const maxChildHeight = Math.max(
        ...flexChildren.map((child: any) => child.height ?? 100)
      );

      requiredWidth =
        totalChildrenWidth +
        totalGaps +
        effectivePadding.left +
        effectivePadding.right +
        borderWidth * 2;
      requiredHeight =
        maxChildHeight +
        effectivePadding.top +
        effectivePadding.bottom +
        borderWidth * 2;
    } else if (parent.childrenLayout === 'column') {
      // En column: sumar alturas + gaps, tomar ancho máximo
      const flexChildren = parent.children.filter(
        (child: any) => child.type !== 'Text'
      );
      const totalChildrenHeight = flexChildren.reduce(
        (sum: number, child: any) => sum + (child.height ?? 100),
        0
      );
      const totalGaps = gap * Math.max(0, flexChildren.length - 1);
      const maxChildWidth = Math.max(
        ...flexChildren.map((child: any) => child.width ?? 100)
      );

      requiredWidth =
        maxChildWidth +
        effectivePadding.left +
        effectivePadding.right +
        borderWidth * 2;
      requiredHeight =
        totalChildrenHeight +
        totalGaps +
        effectivePadding.top +
        effectivePadding.bottom +
        borderWidth * 2;
    } else {
      // Stack/null: calcular basado en posiciones absolutas
      parent.children.forEach((child: any) => {
        const childRight = (child.left || 0) + (child.width || 100);
        const childBottom = (child.top || 0) + (child.height || 100);

        requiredWidth = Math.max(
          requiredWidth,
          childRight + effectivePadding.right + borderWidth
        );
        requiredHeight = Math.max(
          requiredHeight,
          childBottom + effectivePadding.bottom + borderWidth
        );
      });

      // Agregar padding izquierdo/superior y borde
      requiredWidth += effectivePadding.left + borderWidth;
      requiredHeight += effectivePadding.top + borderWidth;
    }

    // Obtener el tamaño máximo alcanzado hasta ahora
    const currentMaxSize = this.maxParentSizes.get(parent.id) || {
      width: parent.width ?? 100,
      height: parent.height ?? 100,
    };

    return {
      width: Math.max(currentMaxSize.width, requiredWidth, 50), // Mínimo 50px
      height: Math.max(currentMaxSize.height, requiredHeight, 50), // Mínimo 50px
    };
  }

  // MÉTODO para ajustar automáticamente el tamaño del padre
  autoResizeParent(parentId: string): void {
    if (!parentId || !this.roomCode) return;

    const page = this.pages[this.currentPantalla];
    const parent = this.findComponentById(page.components, parentId);

    if (!parent) return;

    // Inicializar el tamaño máximo si no existe
    if (!this.maxParentSizes.has(parent.id)) {
      this.maxParentSizes.set(parent.id, {
        width: parent.width ?? 100,
        height: parent.height ?? 100,
      });
    }

    // Calcular nuevo tamaño considerando el layout
    const newSize = this.calculateMinimumParentSizeForLayout(parent);

    // Actualizar el tamaño máximo alcanzado
    const currentMaxSize = this.maxParentSizes.get(parent.id)!;
    const updatedMaxSize = {
      width: Math.max(currentMaxSize.width, newSize.width),
      height: Math.max(currentMaxSize.height, newSize.height),
    };

    this.maxParentSizes.set(parent.id, updatedMaxSize);

    const currentParentWidth = parent.width ?? 100;
    const currentParentHeight = parent.height ?? 100;

    // Solo actualizar si el tamaño cambió (solo puede crecer)
    if (
      currentParentWidth < updatedMaxSize.width ||
      currentParentHeight < updatedMaxSize.height
    ) {
      parent.width = updatedMaxSize.width;
      parent.height = updatedMaxSize.height;

      const updates = {
        width: updatedMaxSize.width,
        height: updatedMaxSize.height,
      };

      this.socketService.updateComponentProperties(
        this.roomCode,
        page.id,
        parent.id,
        updates
      );

      // Validar hijos después del cambio de tamaño del padre
      setTimeout(() => this.validateAndAdjustChildrenSizes(parent.id), 0);
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

    if (
      requiredSize.width <= originalSize.width &&
      requiredSize.height <= originalSize.height
    ) {
      parent.width = originalSize.width;
      parent.height = originalSize.height;

      const updates = {
        width: originalSize.width,
        height: originalSize.height,
      };

      this.socketService.updateComponentProperties(
        this.roomCode,
        page.id,
        parent.id,
        updates
      );
    }
  }

  //border
  // 5.b) NUEVO MÉTODO para ajustar automáticamente el tamaño de los hijos
  autoShrinkChildren(parentId: string): void {
    if (!parentId || !this.roomCode) return;
    const page = this.pages[this.currentPantalla];
    const parent = this.findComponentById(page.components, parentId);
    if (!parent || !parent.children?.length) return;

    const padding = 10; // el mismo padding que usas en autoResizeParent
    const parentWidth = parent.width ?? 100; // Valor por defecto para parent.width
    const parentHeight = parent.height ?? 100; // Valor por defecto para parent.height

    parent.children.forEach((child) => {
      let updated = false;
      const childWidth = child.width ?? 100; // Valor por defecto para child.width
      const childHeight = child.height ?? 100; // Valor por defecto para child.height

      // ancho máximo permitido por el padre
      const maxW = parentWidth - (child.left || 0) - padding;
      if (childWidth > maxW) {
        child.width = Math.max(0, maxW);
        updated = true;
      }

      // alto máximo permitido por el padre
      const maxH = parentHeight - (child.top || 0) - padding;
      if (childHeight > maxH) {
        child.height = Math.max(0, maxH);
        updated = true;
      }

      // si cambiamos algo, enviamos la actualización al servidor
      if (updated) {
        this.socketService.updateComponentProperties(
          this.roomCode,
          page.id,
          child.id,
          { width: child.width, height: child.height }
        );
      }
    });
  }

  // Método para salir de la sala
  leaveRoom() {
    this.socketService.leaveRoom(this.roomCode);

    // Escuchar el evento cuando el usuario ha salido correctamente
    this.socketService.onLeftRoom().subscribe({
      next: () => {
        console.log(`Saliste de la sala ${this.roomCode}`);
        this.router.navigate(['/client']); // Redirigir
      },
      error: (err) => {
        console.error('Error al salir de la sala:', err);
        this.errorMessage = 'No se pudo salir de la sala.';
      },
    });
  }

  downloadAngularProject() {
    const url = `http://localhost:3000/api/export/flutter/${this.roomCode}`;
    window.open(url, '_blank'); // Abre la descarga del zip en otra pestaña
  }

  // =============================================
  // MÉTODOS PARA GESTIÓN DE TABLAS
  // =============================================

  /**
   * Actualizar estructura de tabla
   */
  // Agregar estos métodos en propiedades.component.ts

/**
 * Actualiza la estructura de la tabla (filas/columnas)
 */
updateTableStructure(property: 'rows' | 'columns', newValue: number): void {
  if (!this.selectedComponent || this.selectedComponent.type !== 'table') return;
  
  const table = this.selectedComponent;
  const currentRows = table.rows || 3;
  const currentColumns = table.columns || 3;
  
  // Actualizar la estructura según la propiedad
  if (property === 'rows') {
    this.updateTableRows(table, newValue, currentColumns);
  } else {
    this.updateTableColumns(table, currentRows, newValue);
  }
  
  // Actualizar las propiedades de la tabla
  this.updateProperty('rows', property === 'rows' ? newValue : currentRows);
  this.updateProperty('columns', property === 'columns' ? newValue : currentColumns);
  
  // Emitir los cambios a través del socket
  this.emitTableStructureUpdate(table);
}

/**
 * Agrega una fila a la tabla
 */
addTableRow(): void {
  if (!this.selectedComponent || this.selectedComponent.type !== 'table') return;
  
  const table = this.selectedComponent;
  const columns = table.columns || 3;
  const newRowIndex = table.children.length;
  
  // Agregar la nueva fila
  this.addTableRowAtIndex(table, newRowIndex, columns);
  
  // Actualizar propiedades
  this.updateProperty('rows', newRowIndex + 1);
  
  // Emitir actualización de estructura completa
  this.emitTableStructureUpdate(table);
}

/**
 * Elimina la última fila de la tabla
 */
removeTableRow(): void {
  if (!this.selectedComponent || this.selectedComponent.type !== 'table') return;
  
  const table = this.selectedComponent;
  if (table.children.length <= 1) return; // No eliminar si solo hay una fila
  
  // Eliminar la última fila
  table.children.pop();
  
  // Actualizar propiedades
  this.updateProperty('rows', table.children.length);
  
  // Emitir actualización de estructura completa
  this.emitTableStructureUpdate(table);
}

/**
 * Agrega una columna a la tabla
 */
addTableColumn(): void {
  if (!this.selectedComponent || this.selectedComponent.type !== 'table') return;
  
  const table = this.selectedComponent;
  const newColumnIndex = table.columns || 3;
  
  // Agregar celda a cada fila
  table.children.forEach((row, rowIndex) => {
    this.addTableCellAtPosition(row, rowIndex, newColumnIndex);
  });
  
  // Actualizar propiedades
  this.updateProperty('columns', newColumnIndex + 1);
  
  // Emitir actualización de estructura completa
  this.emitTableStructureUpdate(table);
}

/**
 * Elimina la última columna de la tabla
 */
removeTableColumn(): void {
  if (!this.selectedComponent || this.selectedComponent.type !== 'table') return;
  
  const table = this.selectedComponent;
  const currentColumns = table.columns || 3;
  if (currentColumns <= 1) return; // No eliminar si solo hay una columna
  
  // Eliminar última celda de cada fila
  table.children.forEach(row => {
    if (row.children.length > 0) {
      row.children.pop();
    }
  });
  
  // Actualizar propiedades
  this.updateProperty('columns', currentColumns - 1);
  
  // Emitir actualización de estructura completa
  this.emitTableStructureUpdate(table);
}

/**
 * Actualiza las filas de la tabla
 */
private updateTableRows(table: CanvasComponent, newRows: number, columns: number): void {
  const currentRows = table.children.length;
  
  if (newRows > currentRows) {
    // Agregar filas
    for (let rowIndex = currentRows; rowIndex < newRows; rowIndex++) {
      this.addTableRowAtIndex(table, rowIndex, columns);
    }
  } else if (newRows < currentRows) {
    // Eliminar filas
    table.children = table.children.slice(0, newRows);
  }
}

/**
 * Actualiza las columnas de la tabla
 */
private updateTableColumns(table: CanvasComponent, rows: number, newColumns: number): void {
  table.children.forEach((row, rowIndex) => {
    const currentColumns = row.children.length;
    
    if (newColumns > currentColumns) {
      // Agregar columnas
      for (let colIndex = currentColumns; colIndex < newColumns; colIndex++) {
        this.addTableCellAtPosition(row, rowIndex, colIndex);
      }
    } else if (newColumns < currentColumns) {
      // Eliminar columnas
      row.children = row.children.slice(0, newColumns);
    }
  });
}

/**
 * Agrega una fila en un índice específico
 */
private addTableRowAtIndex(table: CanvasComponent, rowIndex: number, columns: number): void {
  const rowId = this.generateUniqueId();
  const tableCells: CanvasComponent[] = [];
  
  for (let colIndex = 0; colIndex < columns; colIndex++) {
    const cellId = this.generateUniqueId();
    const isHeaderRow = rowIndex === 0 && table.headerRow;
    
    const tableCell: CanvasComponent = {
      id: cellId,
      type: 'tableCell',
      content: isHeaderRow ? `Encabezado ${colIndex + 1}` : `Celda ${rowIndex + 1}-${colIndex + 1}`,
      rowIndex,
      columnIndex: colIndex,
      fontSize: isHeaderRow ? 14 : 12,
      textColor: isHeaderRow ? '#000000' : '#333333',
      fontFamily: 'inherit',
      textAlign: 'center',
      cellBackgroundColor: isHeaderRow ? '#f0f0f0' : '#ffffff',
      children: [],
      parentId: rowId,
    };
    
    tableCells.push(tableCell);
  }
  
  const tableRow: CanvasComponent = {
    id: rowId,
    type: 'tableRow',
    rowIndex,
    children: tableCells,
    parentId: table.id,
  };
  
  table.children.push(tableRow);
}

/**
 * Agrega una celda en una posición específica
 */
private addTableCellAtPosition(row: CanvasComponent, rowIndex: number, colIndex: number): void {
  const cellId = this.generateUniqueId();
  const isHeaderRow = rowIndex === 0 && this.selectedComponent?.headerRow;
  
  const tableCell: CanvasComponent = {
    id: cellId,
    type: 'tableCell',
    content: isHeaderRow ? `Encabezado ${colIndex + 1}` : `Celda ${rowIndex + 1}-${colIndex + 1}`,
    rowIndex,
    columnIndex: colIndex,
    fontSize: isHeaderRow ? 14 : 12,
    textColor: isHeaderRow ? '#000000' : '#333333',
    fontFamily: 'inherit',
    textAlign: 'center',
    cellBackgroundColor: isHeaderRow ? '#f0f0f0' : '#ffffff',
    children: [],
    parentId: row.id,
  };
  
  row.children.push(tableCell);
}

/**
 * Emite la actualización de estructura de tabla al servidor
 */
private emitTableStructureUpdate(table: CanvasComponent): void {
  if (!this.roomCode) return;
  
  const pageId = this.pages[this.currentPantalla].id;
  
  // Emitir el cambio completo de la estructura
  this.socketService.updateTableStructure(
    this.roomCode,
    pageId,
    table.id,
    table.children
  );
}

/**
 * Genera un ID único para nuevos elementos
 */
private generateUniqueId(): string {
  return uuidv4();
}
}
