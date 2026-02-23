import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

/**
 * JSON Depth Validator Middleware
 * 
 * Protects against CVE-2026-AsyncLocalStorage (Node.js January 2026)
 * Prevents DoS attacks via deeply nested JSON payloads that can crash
 * the server through stack overflow in AsyncLocalStorage.
 * 
 * @param maxDepth - Maximum allowed nesting depth (default: 10)
 * @param maxKeys - Maximum keys per object (default: 100)
 */
export function validateJsonDepth(maxDepth: number = 10, maxKeys: number = 100) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only validate JSON payloads
    if (!req.is('application/json') || !req.body) {
      return next();
    }

    try {
      // Validate depth and size
      const { isValid, error, depth, keys } = checkJsonComplexity(req.body, maxDepth, maxKeys);

      if (!isValid) {
        logger.warn(`JSON validation failed: ${error}`, {
          ip: req.ip,
          path: req.path,
          depth,
          keys,
        });

        return res.status(400).json({
          success: false,
          error: 'Invalid request payload',
          details: error,
          limits: {
            maxDepth,
            maxKeys,
          },
        });
      }

      next();
    } catch (error) {
      logger.error('JSON validation error:', error);
      return res.status(400).json({
        success: false,
        error: 'Malformed JSON payload',
      });
    }
  };
}

/**
 * Recursively check JSON complexity
 */
function checkJsonComplexity(
  obj: any,
  maxDepth: number,
  maxKeys: number,
  currentDepth: number = 0
): { isValid: boolean; error?: string; depth: number; keys: number } {
  // Base case: primitives are valid
  if (obj === null || typeof obj !== 'object') {
    return { isValid: true, depth: currentDepth, keys: 0 };
  }

  // Check depth limit
  if (currentDepth > maxDepth) {
    return {
      isValid: false,
      error: `JSON depth exceeds maximum (${maxDepth} levels)`,
      depth: currentDepth,
      keys: 0,
    };
  }

  // Count keys (works for both arrays and objects)
  const keys = Array.isArray(obj) ? obj.length : Object.keys(obj).length;

  // Check keys limit
  if (keys > maxKeys) {
    return {
      isValid: false,
      error: `Too many keys/items at depth ${currentDepth} (max: ${maxKeys})`,
      depth: currentDepth,
      keys,
    };
  }

  // Recursively check all children
  const values = Array.isArray(obj) ? obj : Object.values(obj);
  let maxChildDepth = currentDepth;
  let totalKeys = keys;

  for (const value of values) {
    const result = checkJsonComplexity(value, maxDepth, maxKeys, currentDepth + 1);

    if (!result.isValid) {
      return result;
    }

    maxChildDepth = Math.max(maxChildDepth, result.depth);
    totalKeys += result.keys;
  }

  return {
    isValid: true,
    depth: maxChildDepth,
    keys: totalKeys,
  };
}

/**
 * Strict JSON validator for critical endpoints (auth, payment, etc.)
 * Lower limits for maximum security
 */
export const strictJsonValidator = validateJsonDepth(5, 50);

/**
 * Standard JSON validator for regular API endpoints
 */
export const standardJsonValidator = validateJsonDepth(10, 100);

/**
 * Lenient JSON validator for data-heavy endpoints (import, bulk operations)
 */
export const lenientJsonValidator = validateJsonDepth(15, 500);
