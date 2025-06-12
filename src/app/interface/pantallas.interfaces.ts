import { CanvasComponent } from "./canvas-component.interface";

export interface Page {
  id: string;
  name: string;
  components: CanvasComponent[];
}