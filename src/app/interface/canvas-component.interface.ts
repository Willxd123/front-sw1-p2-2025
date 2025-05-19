export interface CanvasComponent {
  id: string;
  type: string; // Ej: 'Container', 'Text', 'Column', etc.

  // Posición solo para widgets posicionados manualmente (como Positioned)
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;

  // Dimensiones
  width?: number;
  height?: number;

  // Decoración visual
  decoration?: {
    color?: string; // Background color
    border?: {
      color: string;
      width: number;
    };
    borderRadius?: number;
  };

  // Texto para widgets tipo Text, DropdownButton, etc.
  text?: string;

  // Alineaciones y layout
  alignment?: string; // Ej: 'Alignment.center'
  mainAxisAlignment?: string; // Para Column o Row
  crossAxisAlignment?: string;
  textAlign?: string; // Para Text

  // Contenido lógico
  value?: string | boolean;
  rows?: number;
  icon?: string;

  // Relaciones
  parentId?: string | null;
  children?: CanvasComponent[];
}
