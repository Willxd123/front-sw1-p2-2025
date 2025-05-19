import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { v4 as uuidv4 } from 'uuid';
import { SokectSevice } from '../../services/socket.service';
import { CanvasComponent } from '../../interface/canvas-component.interface';
import { ActivatedRoute, Router } from '@angular/router';

interface Page {
  id: string;
  name: string;
  components: CanvasComponent[];
}

@Component({
  selector: 'app-sidebar-izq',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar-izq.component.html'
})
export class SidebarIzqComponent implements OnInit {
  // propiedades y entradas originales
  @Input() pages: Page[] = [];
  @Input() selectedPageId: string | null = null;
  @Input() components: CanvasComponent[] = [];
  @Input() roomCode: string = '';
  @Input() contextMenu: any;
  @Input() isModalOpen: boolean = false;
  @Input() isPreview: boolean = false;

  @Output() selectPage = new EventEmitter<string>();
  @Output() addPage = new EventEmitter<void>();
  @Output() togglePreview = new EventEmitter<void>();

  constructor(
    private route: ActivatedRoute,
    public SokectSevice: SokectSevice,
    private router: Router
  ) { }

  roomName: string = '';
  showParticipants: boolean = false;
  usersInRoom: any[] = [];

  ngOnInit(): void {
    this.roomCode = this.route.snapshot.paramMap.get('code') || '';
    this.SokectSevice.onJoinedRoom().subscribe((room) => {
      this.roomName = room.name;
    });
    this.SokectSevice.onUsersListUpdate().subscribe((users) => {
      this.usersInRoom = users;
    });
  }

  get currentComponents(): CanvasComponent[] {
    return this.components;
  }

  addContainerFlutter() {
    const newComponent: CanvasComponent = {
      id: uuidv4(),
      type: 'Container',
      top: 50,
      left: 50,
      width: 120,
      height: 80,
      decoration: {
        color: '#ffeecc',
        border: { color: '#000000', width: 1 },
        borderRadius: 8
      },
      children: [],
      parentId: null
    };
    this.SokectSevice.addCanvasComponent(this.roomCode, this.selectedPageId!, newComponent);
    this.contextMenu.visible = false;
  }

  addTextFlutter() {
    const newComponent: CanvasComponent = {
      id: uuidv4(),
      type: 'Text',
      top: 120,
      left: 100,
      text: 'Texto ejemplo',
      textAlign: 'center',
      parentId: null
    };
    this.SokectSevice.addCanvasComponent(this.roomCode, this.selectedPageId!, newComponent);
    this.contextMenu.visible = false;
  }

  addColumnFlutter() {
    const newComponent: CanvasComponent = {
      id: uuidv4(),
      type: 'Column',
      top: 200,
      left: 100,
      width: 160,
      height: 200,
      decoration: {
        color: '#e0f7fa',
        border: { color: '#00796b', width: 2 },
        borderRadius: 10
      },
      mainAxisAlignment: 'center',
      children: [],
      parentId: null
    };
    this.SokectSevice.addCanvasComponent(this.roomCode, this.selectedPageId!, newComponent);
    this.contextMenu.visible = false;
  }

  exportFlutterCode(): string {
    const renderWidget = (comp: CanvasComponent): string => {
      const props: string[] = [];
      const children = comp.children?.map(child => renderWidget(child)).join(',\n') || '';

      if (comp.width) props.push(`width: ${comp.width}`);
      if (comp.height) props.push(`height: ${comp.height}`);

      if (comp.decoration) {
        const decProps: string[] = [];
        if (comp.decoration.color)
          decProps.push(`color: Color(0xFF${comp.decoration.color.replace('#', '')})`);
        if (comp.decoration.border)
          decProps.push(`border: Border.all(color: Color(0xFF${comp.decoration.border.color.replace('#', '')}), width: ${comp.decoration.border.width})`);
        if (comp.decoration.borderRadius !== undefined)
          decProps.push(`borderRadius: BorderRadius.circular(${comp.decoration.borderRadius})`);
        props.push(`decoration: BoxDecoration(\n  ${decProps.join(',\n  ')}\n)`);
      }

      if (comp.alignment) props.push(`alignment: ${comp.alignment}`);
      if (comp.textAlign) props.push(`textAlign: TextAlign.${comp.textAlign}`);
      if (comp.mainAxisAlignment) props.push(`mainAxisAlignment: MainAxisAlignment.${comp.mainAxisAlignment}`);
      if (comp.crossAxisAlignment) props.push(`crossAxisAlignment: CrossAxisAlignment.${comp.crossAxisAlignment}`);

      switch (comp.type) {
        case 'Container':
          return `Container(\n  ${props.join(',\n  ')}${children ? ',\n  child: ${children}' : ''}\n)`;
        case 'Text':
          return `Text('${comp.text || ''}'${props.length ? ',\n  ' + props.join(',\n  ') : ''})`;
        case 'Column':
          return `Column(\n  ${props.join(',\n  ')},\n  children: [\n    ${comp.children?.map(c => renderWidget(c)).join(',\n    ') || ''}\n  ]\n)`;
        default:
          return `Container(child: Text('No soportado: ${comp.type}'))`;
      }
    };

    const widgets = this.currentComponents.map(c => `          ${renderWidget(c)}`).join(',\n');

    return `import 'package:flutter/material.dart';

class GeneratedPage extends StatelessWidget {
  const GeneratedPage({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: Stack(
          children: [
${widgets}
          ],
        ),
      ),
    );
  }
}
`;
  }
}
