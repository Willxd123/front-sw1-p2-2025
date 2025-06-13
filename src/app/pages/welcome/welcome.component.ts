import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [FormsModule, CommonModule],
  providers: [ApiService],
  templateUrl: './welcome.component.html',
})
export class WelcomeComponent {
  joinErrorMessage: string = '';
  roomName: string = '';
  roomCode: string = '';
  errorMessage: string = '';
  
  // Estados de loading
  isCreatingRoom: boolean = false;
  isJoiningRoom: boolean = false;
  creationProgress: number = 0;
  currentLoadingStep: string = '';
  
  private loadingSteps = [
    { message: 'Creando sala...', duration: 1000 },
    { message: 'Configurando espacio de trabajo...', duration: 800 },
    { message: 'Preparando herramientas...', duration: 600 },
    { message: 'Iniciando colaboración...', duration: 400 }
  ];

  constructor(
    private apiService: ApiService,
    private router: Router,
  ) {}

  logout() {
    this.apiService.logout();
  }

  // Método mejorado para crear una sala con loading steps
  createRoom() {
    if (!this.roomName.trim()) {
      this.errorMessage = 'Por favor, ingresa un nombre para el proyecto';
      return;
    }

    this.isCreatingRoom = true;
    this.creationProgress = 0;
    this.errorMessage = '';

    const createRoomDto = { name: this.roomName };

    // Simular pasos de carga para mejor UX
    this.simulateLoadingSteps().then(() => {
      // Llamada real al API
      this.apiService.createRoom(createRoomDto).subscribe({
        next: (room) => {
          console.log('✅ Sala creada exitosamente:', room);
          
          // Completar loading
          this.creationProgress = 100;
          this.currentLoadingStep = '¡Listo! Redirigiendo...';
          
          // Pequeño delay para mostrar el éxito antes de redirigir
          setTimeout(() => {
            this.router.navigate([`/room/${room.code}`]);
          }, 500);
        },
        error: (err) => {
          console.error('❌ Error al crear la sala:', err);
          this.isCreatingRoom = false;
          this.creationProgress = 0;
          this.currentLoadingStep = '';
          this.errorMessage = 'No se pudo crear la sala. Inténtalo de nuevo.';
        },
      });
    });
  }

  // Unirse a una sala con loading
  joinRoom() {
    if (!this.roomCode.trim()) {
      this.joinErrorMessage = 'Por favor, ingresa un código de sala';
      return;
    }

    this.isJoiningRoom = true;
    this.joinErrorMessage = '';

    this.apiService.joinRoom(this.roomCode).subscribe({
      next: (response) => {
        console.log('Respuesta del servidor:', response);
        
        // Pequeño delay para mostrar feedback visual
        setTimeout(() => {
          this.router.navigate([`/room/${this.roomCode}`]);
        }, 800);
      },
      error: (err) => {
        console.error('Error al unirse a la sala:', err);
        this.isJoiningRoom = false;
        this.joinErrorMessage = 'No se pudo unir a la sala. Verifica el código e inténtalo de nuevo.';
      }
    });
  }

  // Simular pasos de loading para mejor percepción de UX
  private simulateLoadingSteps(): Promise<void> {
    return new Promise((resolve) => {
      let currentStep = 0;
      let totalProgress = 0;

      const executeStep = () => {
        if (currentStep >= this.loadingSteps.length) {
          this.creationProgress = 85; // 85% antes de la llamada real al API
          resolve();
          return;
        }

        const step = this.loadingSteps[currentStep];
        this.currentLoadingStep = step.message;

        // Animar progreso gradualmente
        const stepProgress = (100 * 0.8) / this.loadingSteps.length; // 80% del total
        const startProgress = totalProgress;
        const endProgress = totalProgress + stepProgress;
        
        this.animateProgress(startProgress, endProgress, step.duration).then(() => {
          totalProgress = endProgress;
          currentStep++;
          executeStep();
        });
      };

      executeStep();
    });
  }

  // Animar progreso suavemente
  private animateProgress(start: number, end: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const difference = end - start;

      const updateProgress = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function para suavizar la animación
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        
        this.creationProgress = start + (difference * easeOutQuart);

        if (progress < 1) {
          requestAnimationFrame(updateProgress);
        } else {
          this.creationProgress = end;
          resolve();
        }
      };

      requestAnimationFrame(updateProgress);
    });
  }

  // Cancelar creación (opcional)
  cancelCreation() {
    this.isCreatingRoom = false;
    this.creationProgress = 0;
    this.currentLoadingStep = '';
    this.errorMessage = '';
  }
}