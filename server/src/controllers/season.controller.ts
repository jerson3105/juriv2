import type { Request, Response } from 'express';
import { seasonService } from '../services/season.service.js';
import { requireClassroomTeacher } from '../utils/access.js';

class SeasonController {
  // GET /students/me/seasons — «Mis temporadas»: sus clases de años escolares cerrados (solo las propias).
  async mine(req: Request, res: Response) {
    try {
      const data = await seasonService.mine(req.user!.id);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting student seasons:', error);
      res.status(500).json({ success: false, message: 'Error al obtener tus temporadas' });
    }
  }

  // GET /classrooms/:id/rankings/season — la temporada de la clase para el modo «Temporada» de la gala (su docente;
  // también en una clase archivada, que se puede consultar).
  async classroom(req: Request, res: Response) {
    try {
      const classroomId = req.params.id;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      const data = await seasonService.classroom(classroomId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting classroom season:', error);
      res.status(500).json({ success: false, message: 'Error al obtener la temporada de la clase' });
    }
  }
}

export const seasonController = new SeasonController();
