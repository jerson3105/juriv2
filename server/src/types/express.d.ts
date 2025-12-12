// Extensión de tipos para Express Request
// Este archivo extiende el tipo Request de Express para incluir el usuario autenticado

type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: UserRole;
      firstName: string;
      lastName: string;
    }
  }
}

export {};
