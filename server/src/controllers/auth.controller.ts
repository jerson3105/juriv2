import { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { config_app } from '../config/env.js';

// Schema de validación de contraseña robusta
const passwordSchema = z.string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .regex(/[A-Z]/, 'Debe contener al menos una letra mayúscula')
  .regex(/[a-z]/, 'Debe contener al menos una letra minúscula')
  .regex(/[0-9]/, 'Debe contener al menos un número')
  .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un carácter especial (@$!%*?&#)');

// Schemas de validación
const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: passwordSchema,
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  role: z.enum(['TEACHER', 'STUDENT']),
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Token de actualización requerido'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: passwordSchema,
});

const updateProfileSchema = z.object({
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres').optional(),
  avatarUrl: z.string().url('URL de avatar inválida').nullable().optional(),
});

/**
 * POST /api/auth/register
 * Registrar nuevo usuario
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const result = await authService.register(validatedData);
    
    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: error.errors,
      });
      return;
    }
    
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * POST /api/auth/login
 * Iniciar sesión
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await authService.login(validatedData);
    
    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: error.errors,
      });
      return;
    }
    
    if (error instanceof Error) {
      res.status(401).json({
        success: false,
        message: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * POST /api/auth/refresh
 * Refrescar tokens
 */
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const tokens = await authService.refreshTokens(refreshToken);
    
    res.json({
      success: true,
      message: 'Tokens actualizados',
      data: tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: 'Token de actualización requerido',
      });
      return;
    }
    
    if (error instanceof Error) {
      res.status(401).json({
        success: false,
        message: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * POST /api/auth/logout
 * Cerrar sesión
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    
    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al cerrar sesión',
    });
  }
};

/**
 * POST /api/auth/logout-all
 * Cerrar todas las sesiones
 */
export const logoutAll = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }
    
    await authService.logoutAll(req.user.id);
    
    res.json({
      success: true,
      message: 'Todas las sesiones han sido cerradas',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al cerrar sesiones',
    });
  }
};

/**
 * GET /api/auth/me
 * Obtener perfil del usuario autenticado
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }
    
    const profile = await authService.getProfile(req.user.id);
    
    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * PUT /api/auth/change-password
 * Cambiar contraseña
 */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }
    
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user.id, currentPassword, newPassword);
    
    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente. Por favor, inicia sesión nuevamente.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: error.errors,
      });
      return;
    }
    
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * PUT /api/auth/profile
 * Actualizar perfil del usuario
 */
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }
    
    const data = updateProfileSchema.parse(req.body);
    const updatedUser = await authService.updateProfile(req.user.id, data);
    
    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: updatedUser,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: error.errors,
      });
      return;
    }
    
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * POST /api/auth/upload-avatar
 * Subir avatar del usuario
 */
export const uploadAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }
    
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No se proporcionó ninguna imagen',
      });
      return;
    }
    
    const avatarUrl = `/avatars/${req.file.filename}`;
    const updatedUser = await authService.updateProfile(req.user.id, { avatarUrl });
    
    res.json({
      success: true,
      message: 'Avatar actualizado exitosamente',
      data: updatedUser,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * PUT /api/auth/notifications
 * Actualizar preferencias de notificaciones
 */
export const updateNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }
    
    const { notifyBadges, notifyLevelUp } = req.body;
    const updatedUser = await authService.updateNotifications(req.user.id, {
      notifyBadges,
      notifyLevelUp,
    });
    
    res.json({
      success: true,
      message: 'Preferencias de notificaciones actualizadas',
      data: updatedUser,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * GET /api/auth/google/callback
 * Callback de autenticación con Google
 */
export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as any;
    
    if (!user) {
      res.redirect(`${config_app.clientUrl}/login?error=google_auth_failed`);
      return;
    }

    // Generar tokens JWT para el usuario
    const tokens = await authService.generateTokensForUser(user.id);
    
    // Redirigir al frontend con los tokens en la URL
    const redirectUrl = new URL(`${config_app.clientUrl}/auth/google/callback`);
    redirectUrl.searchParams.set('accessToken', tokens.accessToken);
    redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);
    
    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('Error en Google callback:', error);
    res.redirect(`${config_app.clientUrl}/login?error=google_auth_failed`);
  }
};
