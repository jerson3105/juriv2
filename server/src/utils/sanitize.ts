import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitiza HTML para prevenir XSS
 */
export const sanitizeHtml = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href'],
  });
};

/**
 * Sanitiza texto plano (remueve HTML completamente)
 */
export const sanitizeText = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
};

/**
 * Sanitiza objeto recursivamente
 */
export const sanitizeObject = <T extends Record<string, any>>(obj: T): T => {
  const sanitized = {} as T;
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        sanitized[key] = sanitizeText(value) as any;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = sanitizeObject(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item: any) => 
          typeof item === 'string' ? sanitizeText(item) : 
          typeof item === 'object' ? sanitizeObject(item) : item
        ) as any;
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
};
