declare module 'isomorphic-dompurify' {
  interface Config {
    ALLOWED_TAGS?: string[];
    ALLOWED_ATTR?: string[];
    ALLOW_DATA_ATTR?: boolean;
    ADD_TAGS?: string[];
    ADD_ATTR?: string[];
    FORBID_TAGS?: string[];
    FORBID_ATTR?: string[];
    KEEP_CONTENT?: boolean;
    RETURN_DOM?: boolean;
    RETURN_DOM_FRAGMENT?: boolean;
    RETURN_TRUSTED_TYPE?: boolean;
    WHOLE_DOCUMENT?: boolean;
    SANITIZE_DOM?: boolean;
    IN_PLACE?: boolean;
  }

  interface DOMPurify {
    sanitize(dirty: string | Node, config?: Config): string;
    setConfig(config: Config): void;
    clearConfig(): void;
    isValidAttribute(tag: string, attr: string, value: string): boolean;
    addHook(
      entryPoint: 'beforeSanitizeElements' | 'uponSanitizeElement' | 'afterSanitizeElements' |
                  'beforeSanitizeAttributes' | 'uponSanitizeAttribute' | 'afterSanitizeAttributes' |
                  'beforeSanitizeShadowDOM' | 'uponSanitizeShadowNode' | 'afterSanitizeShadowDOM',
      hookFunction: (node: Node, data: any, config: Config) => void
    ): void;
    removeHook(entryPoint: string): void;
    removeHooks(entryPoint: string): void;
    removeAllHooks(): void;
  }

  const DOMPurify: DOMPurify;
  export default DOMPurify;
}
