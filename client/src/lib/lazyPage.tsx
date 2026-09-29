import { lazy, Suspense, type ComponentType } from 'react';

/** Indicador mientras se descarga el código de una página (mismo estilo que los spinners de la app). */
export const RouteLoader = () => (
  <div className="flex items-center justify-center py-24">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
  </div>
);

/**
 * Carga una página bajo demanda (code splitting por ruta). El Suspense va dentro de la propia
 * página para que, al navegar, el layout (menú, cabecera de la clase) siga visible y solo el
 * contenido muestre el indicador.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- las páginas no reciben props del router
export function lazyPage(loader: () => Promise<{ default: ComponentType<any> }>) {
  const LazyComponent = lazy(loader);
  return function LazyPage(props: Record<string, unknown>) {
    return (
      <Suspense fallback={<RouteLoader />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}
