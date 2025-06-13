export interface CanvasComponent {
  id: string;
  type: string;
  top?: number;
  left?: number;
  width?: number;
  height?: number;
  decoration?: {
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
  childrenLayout?: string; // Disposición de los hijos (row o column)
  gap?: number; // Espacio entre hijos (en px)
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
  activeColor?: string;
  borderColor?: string; // Color del borde del checkbox
  borderWidth?: number;
  borderRadius?: number; // Radio del borde del checkbox
  scale?: number; // Factor de escala para el checkbox
  // Nuevas propiedades específicas para TextField:
  labelText?: string; // Texto del label
  hintText?: string; // Texto placeholder
  value?: string; // Valor actual del input
  inputType?: 'text' | 'email' | 'password' | 'number' | 'tel'; // Tipo de input
  maxLength?: number; // Longitud máxima
  enabled?: boolean; // Si está habilitado o no
  obscureText?: boolean; // Para passwords (ocultar texto)
  borderType?: 'outline' | 'underline' | 'none'; // Tipo de borde
  focusedBorderColor?: string; // Color del borde al hacer focus
  labelColor?: string; // Color del label
  hintColor?: string; // Color del hint/placeholder
  inputTextColor?: string; // Color del texto de entrada
  backgroundColor?: string; // Color de fondo del input
  // Nuevas propiedades para padding
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  // O alternativamente, padding uniforme:
  paddingAll?: number;
  // Nuevas propiedades específicas para Table:
  right?: number; // Posición derecha (opcional)
  rows?: number; // Número de filas
  columns?: number; // Número de columnas
  tableBorder?: {
    color: string;
    width: number;
  };
  cellPadding?: number; // Padding interno de las celdas
  headerRow?: boolean; // Si la primera fila es encabezado
  headerBackgroundColor?: string; // Color de fondo del encabezado
  alternateRowColor?: string; // Color alternado para filas
  columnWidths?: number[]; // Anchos específicos de columnas
  defaultVerticalAlignment?: 'top' | 'middle' | 'bottom'; // Alineación vertical por defecto
  
  // Propiedades para celdas individuales (cuando type = 'tableCell')
  content?: string; // Contenido de la celda
  rowIndex?: number; // Índice de fila
  columnIndex?: number; // Índice de columna
  cellBackgroundColor?: string; // Color de fondo específico de la celda
}