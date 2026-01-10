import { Router } from 'express';
import authRoutes from './auth.routes.js';
import classroomRoutes from './classroom.routes.js';
import studentRoutes from './student.routes.js';
import behaviorRoutes from './behavior.routes.js';
import shopRoutes from './shop.routes.js';
import historyRoutes from './history.routes.js';
import eventsRoutes from './events.routes.js';
import battleRoutes from './battle.routes.js';
import avatarRoutes from './avatar.routes.js';
import adminRoutes from './admin.routes.js';
import attendanceRoutes from './attendance.routes.js';
import badgeRoutes from './badge.routes.js';
import clanRoutes from './clan.routes.js';
import questionBankRoutes from './questionBank.routes.js';
import timedActivityRoutes from './timedActivity.routes.js';
import studentBossBattleRoutes from './studentBossBattle.routes.js';
import missionRoutes from './mission.routes.js';
import loginStreakRoutes from './loginStreak.routes.js';
import schoolRoutes from './school.routes.js';
import scrollRoutes from './scroll.routes.js';
import expeditionRoutes from './expedition.routes.js';
import expeditionMapRoutes from './expeditionMap.routes.js';
import territoryRoutes from './territory.routes.js';
import bugReportRoutes from './bugReport.routes.js';
import tournamentRoutes from './tournament.routes.js';
import gradeRoutes from './grade.routes.js';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Juried API está funcionando',
    timestamp: new Date().toISOString(),
  });
});

// Rutas de la API
router.use('/auth', authRoutes);
router.use('/classrooms', classroomRoutes);
router.use('/students', studentRoutes);
router.use('/behaviors', behaviorRoutes);
router.use('/shop', shopRoutes);
router.use('/history', historyRoutes);
router.use('/events', eventsRoutes);
router.use('/battles', battleRoutes);
router.use('/avatars', avatarRoutes);
router.use('/admin', adminRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/badges', badgeRoutes);
router.use('/clans', clanRoutes);
router.use('/question-banks', questionBankRoutes);
router.use('/timed-activities', timedActivityRoutes);
router.use('/student-boss-battles', studentBossBattleRoutes);
router.use('/missions', missionRoutes);
router.use('/login-streak', loginStreakRoutes);
router.use('/schools', schoolRoutes);
router.use('/scrolls', scrollRoutes);
router.use('/expeditions', expeditionRoutes);
router.use('/expedition-maps', expeditionMapRoutes);
router.use('/territory', territoryRoutes);
router.use('/bug-reports', bugReportRoutes);
router.use('/tournaments', tournamentRoutes);
router.use('/grades', gradeRoutes);

export default router;
