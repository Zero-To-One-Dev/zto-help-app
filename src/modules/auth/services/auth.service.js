import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { models } from '../models/index.js';
import logger from '../../../../logger.js';

const { User } = models;

// Configuración JWT (debería estar en .env)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

class AuthService {
  /**
   * Registrar nuevo usuario
   */
  async register(userData) {
    try {
      const { name, email, password } = userData;

      // Verificar si el email ya existe
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        throw new Error('Email already registered');
      }

      // Hash de la contraseña
      const hashedPassword = await bcrypt.hash(password, 10);

      // Crear usuario
      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        is_active: true
      });

      logger.info(`[AuthService] User registered: ${email}`);

      // Generar token
      const token = this.generateToken(user);

      return {
        user: this.sanitizeUser(user),
        token
      };
    } catch (error) {
      logger.error(`[AuthService] Registration error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Login de usuario
   */
  async login(email, password) {
    try {
      // Buscar usuario por email
      const user = await User.findOne({ where: { email } });
      
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Verificar si está activo
      if (!user.is_active) {
        throw new Error('User account is inactive');
      }

      // Verificar contraseña
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Actualizar último login
      await user.update({ last_login_at: new Date() });

      logger.info(`[AuthService] User logged in: ${email}`);

      // Generar token
      const token = this.generateToken(user);

      return {
        user: this.sanitizeUser(user),
        token
      };
    } catch (error) {
      logger.error(`[AuthService] Login error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verificar token JWT
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Obtener usuario por ID
   */
  async getUserById(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    if (!user.is_active) {
      throw new Error('User account is inactive');
    }
    return this.sanitizeUser(user);
  }

  /**
   * Generar token JWT
   */
  generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      name: user.name
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });
  }

  /**
   * Remover datos sensibles del usuario
   */
  sanitizeUser(user) {
    const userObj = user.toJSON ? user.toJSON() : user;
    const { password, ...sanitized } = userObj;
    return sanitized;
  }

  /**
   * Cambiar contraseña
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Verificar contraseña actual
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar
    await user.update({ password: hashedPassword });

    logger.info(`[AuthService] Password changed for user: ${user.email}`);

    return true;
  }

  /**
   * Actualizar perfil de usuario
   */
  async updateProfile(userId, updates) {
    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Solo permitir ciertos campos para actualizar
    const allowedFields = ['name'];
    const filteredUpdates = {};
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    });

    await user.update(filteredUpdates);

    logger.info(`[AuthService] Profile updated for user: ${user.email}`);

    return this.sanitizeUser(user);
  }

  /**
   * Listar todos los usuarios (para admin)
   */
  async listUsers(filters = {}) {
    const { page = 1, limit = 20, is_active } = filters;
    const offset = (page - 1) * limit;

    const where = {};
    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      attributes: { exclude: ['password'] }
    });

    return {
      users: rows,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit)
      }
    };
  }

  /**
   * Activar/Desactivar usuario
   */
  async toggleUserStatus(userId, isActive) {
    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    await user.update({ is_active: isActive });

    logger.info(`[AuthService] User ${user.email} status changed to ${isActive ? 'active' : 'inactive'}`);

    return this.sanitizeUser(user);
  }
}

export default AuthService;
