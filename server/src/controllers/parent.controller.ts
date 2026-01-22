import { Request, Response } from 'express';
import { parentService } from '../services/parent.service.js';

interface AuthRequest extends Request {
  user?: Express.User;
}

class ParentController {
  // Registrar nuevo padre
  async register(req: Request, res: Response) {
    try {
      const { email, password, firstName, lastName, phone, relationship } = req.body;
      
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
      }
      
      const result = await parentService.registerParent({
        email,
        password,
        firstName,
        lastName,
        phone,
        relationship: relationship || 'GUARDIAN',
      });
      
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
  
  // Obtener perfil del padre autenticado
  async getProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'No autenticado' });
      }
      
      const profile = await parentService.getParentProfile(req.user.id);
      
      if (!profile) {
        return res.status(404).json({ error: 'Perfil no encontrado' });
      }
      
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
  
  // Vincular hijo con código
  async linkChild(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'No autenticado' });
      }
      
      const { linkCode } = req.body;
      
      if (!linkCode) {
        return res.status(400).json({ error: 'Código de vinculación requerido' });
      }
      
      const profile = await parentService.getParentProfile(req.user.id);
      
      if (!profile) {
        return res.status(404).json({ error: 'Perfil de padre no encontrado' });
      }
      
      const result = await parentService.linkChild(profile.id, linkCode);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
  
  // Obtener lista de hijos
  async getChildren(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'No autenticado' });
      }
      
      const profile = await parentService.getParentProfile(req.user.id);
      
      if (!profile) {
        return res.status(404).json({ error: 'Perfil de padre no encontrado' });
      }
      
      const children = await parentService.getChildren(profile.id);
      res.json(children);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
  
  // Obtener detalle de un hijo
  async getChildDetail(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'No autenticado' });
      }
      
      const { studentId } = req.params;
      
      const profile = await parentService.getParentProfile(req.user.id);
      
      if (!profile) {
        return res.status(404).json({ error: 'Perfil de padre no encontrado' });
      }
      
      const detail = await parentService.getChildDetail(profile.id, studentId);
      
      if (!detail) {
        return res.status(404).json({ error: 'Estudiante no encontrado o sin acceso' });
      }
      
      res.json(detail);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
  
  // Obtener calificaciones de un hijo
  async getChildGrades(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'No autenticado' });
      }
      
      const { studentId } = req.params;
      const { period } = req.query;
      
      const profile = await parentService.getParentProfile(req.user.id);
      
      if (!profile) {
        return res.status(404).json({ error: 'Perfil de padre no encontrado' });
      }
      
      const grades = await parentService.getChildGrades(
        profile.id, 
        studentId, 
        period as string | undefined
      );
      
      res.json(grades);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
  
  // Obtener historial de actividad de un hijo
  async getChildActivity(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'No autenticado' });
      }
      
      const { studentId } = req.params;
      const { startDate, endDate } = req.query;
      
      const profile = await parentService.getParentProfile(req.user.id);
      
      if (!profile) {
        return res.status(404).json({ error: 'Perfil de padre no encontrado' });
      }
      
      const activity = await parentService.getChildActivity(
        profile.id,
        studentId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      res.json(activity);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
  
  // Desvincular hijo
  async unlinkChild(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'No autenticado' });
      }
      
      const { studentId } = req.params;
      
      const profile = await parentService.getParentProfile(req.user.id);
      
      if (!profile) {
        return res.status(404).json({ error: 'Perfil de padre no encontrado' });
      }
      
      const result = await parentService.unlinkChild(profile.id, studentId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
  
  // Actualizar preferencias
  async updatePreferences(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'No autenticado' });
      }
      
      const profile = await parentService.getParentProfile(req.user.id);
      
      if (!profile) {
        return res.status(404).json({ error: 'Perfil de padre no encontrado' });
      }
      
      const { phone, relationship, notifyByEmail, notifyWeeklySummary, notifyAlerts } = req.body;
      
      const result = await parentService.updatePreferences(profile.id, {
        phone,
        relationship,
        notifyByEmail,
        notifyWeeklySummary,
        notifyAlerts,
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
  
  // Generar código de vinculación (para profesor)
  async generateParentLinkCode(req: AuthRequest, res: Response) {
    try {
      const { studentId } = req.params;
      
      const code = await parentService.generateParentLinkCode(studentId);
      res.json({ code });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // Generar informe IA del estudiante
  async generateAIReport(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'No autenticado' });
      }
      
      const profile = await parentService.getParentProfile(req.user.id);
      
      if (!profile) {
        return res.status(404).json({ error: 'Perfil de padre no encontrado' });
      }
      
      const { studentId } = req.params;
      
      const report = await parentService.generateAIReport(profile.id, studentId);
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

export const parentController = new ParentController();
