import { Router } from 'express';
import { storyController } from '../controllers/story.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---- THEME ENDPOINTS ----
router.get('/presets', storyController.getThemePresets.bind(storyController));
router.get('/classroom/:classroomId/theme', storyController.getClassroomTheme.bind(storyController));
router.put('/classroom/:classroomId/theme', authorize('TEACHER'), storyController.updateClassroomTheme.bind(storyController));
router.post('/classroom/:classroomId/theme/preset', authorize('TEACHER'), storyController.applyPreset.bind(storyController));
router.delete('/classroom/:classroomId/theme', authorize('TEACHER'), storyController.resetTheme.bind(storyController));
router.post('/classroom/:classroomId/theme/generate-ai', authorize('TEACHER'), storyController.generateAITheme.bind(storyController));
router.post('/scenes/generate-ai', authorize('TEACHER'), storyController.generateAIScene.bind(storyController));

// ---- STORIES CRUD (Teacher) ----
router.get('/classroom/:classroomId', storyController.getClassroomStories.bind(storyController));
router.post('/classroom/:classroomId', authorize('TEACHER'), storyController.createStory.bind(storyController));
router.get('/:storyId', storyController.getStory.bind(storyController));
router.put('/:storyId', authorize('TEACHER'), storyController.updateStory.bind(storyController));
router.delete('/:storyId', authorize('TEACHER'), storyController.deleteStory.bind(storyController));
router.post('/:storyId/activate', authorize('TEACHER'), storyController.activateStory.bind(storyController));
router.post('/:storyId/deactivate', authorize('TEACHER'), storyController.deactivateStory.bind(storyController));

// ---- CHAPTERS CRUD (Teacher) ----
router.post('/:storyId/chapters', authorize('TEACHER'), storyController.createChapter.bind(storyController));
router.put('/chapters/:chapterId', authorize('TEACHER'), storyController.updateChapter.bind(storyController));
router.delete('/chapters/:chapterId', authorize('TEACHER'), storyController.deleteChapter.bind(storyController));
router.post('/chapters/:chapterId/complete', authorize('TEACHER'), storyController.completeChapter.bind(storyController));

// ---- SCENES CRUD (Teacher) ----
router.post('/chapters/:chapterId/scenes', authorize('TEACHER'), storyController.createScene.bind(storyController));
router.put('/scenes/:sceneId', authorize('TEACHER'), storyController.updateScene.bind(storyController));
router.delete('/scenes/:sceneId', authorize('TEACHER'), storyController.deleteScene.bind(storyController));
router.put('/scenes/:sceneId/dialogues', authorize('TEACHER'), storyController.setDialogues.bind(storyController));

// ---- STUDENT ENDPOINTS ----
router.get('/classroom/:classroomId/student/:studentProfileId', authorize('STUDENT'), storyController.getStudentStoryData.bind(storyController));
router.get('/chapters/:chapterId/scenes/student', authorize('STUDENT'), storyController.getChapterScenesForStudent.bind(storyController));
router.get('/chapters/:chapterId/leaderboard', storyController.getChapterLeaderboard.bind(storyController));
router.get('/scenes/:sceneId/view', authorize('STUDENT'), storyController.getSceneForViewing.bind(storyController));
router.post('/scenes/:sceneId/viewed', authorize('STUDENT'), storyController.markSceneViewed.bind(storyController));

export default router;
