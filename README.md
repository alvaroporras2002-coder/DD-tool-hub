# DD Tool Hub

Identidad monocromática basada en la propuesta visual de DD Tool Hub: monograma DD, contenedor de línea fina, tipografía limpia, tarjetas de grafito y jerarquía editorial. El inicio reúne DTT de hoy, seguimientos y las cuatro herramientas. Se conservan el almacenamiento y los formatos de datos existentes.

**Sitio:** https://alvaroporras2002-coder.github.io/DD-tool-hub/

- **DTT Tracker:** importa el CSV de llamadas, calcula tiempo base y bono, permite tiempos manuales, metas e historial por día.
- **Video Studio:** editor completo incorporado desde `video-corrector`, con proyectos, biblioteca, texto, audio, capas y exportación. Cabezal de reproducción arrastrable con mouse, touch o lápiz, zoom y scroll; flechas para avanzar por cuadros, Shift para segundos, Home/End. En proyectos vacíos se puede recorrer una regla de 20 segundos antes de importar archivos, sin agregar duración al contenido ni a la exportación.
- **Call Notes:** las 11 preguntas y sus respuestas originales, instrucciones contextuales, nota en inglés en vivo, copia, descarga, borrador automático e historial editable.
- **Follow-up Map:** calendario mensual, agenda diaria, creación/edición, prioridades, pendientes/completados, búsqueda, filtros, copia JSON y exportación .ics. Una nota puede convertirse en seguimiento.

## DTT: regla conservada del archivo original

El CSV debe incluir `Duration in Seconds` y `State`. Se suman **todas las duraciones válidas** y **60 segundos adicionales solo si State es Completed** (sin distinguir mayúsculas o espacios exteriores). Un cero válido Completed también recibe el bono, igual que el archivo original. Otros resultados, como Left Message y Missed, no reciben bono.

Cada nueva carga **reemplaza** el reporte CSV del día, preservando los tiempos manuales. No se acumulan cargas repetidas. Cambia el día del reporte si el CSV pertenece a otra fecha; el archivo no se filtra automáticamente por fecha.

## Calidad de exportación de video

La exportación usa resolución **Automática · detalle de origen** y calidad **Alta** por defecto. Selecciona las dimensiones a partir del archivo visual principal, conserva la proporción del proyecto y limita el lado mayor a 3840 px. También permite resolución del proyecto o salidas de hasta 1080p/720p. El diálogo muestra las dimensiones de salida, FPS y tamaño estimado antes de exportar.

La calidad y el bitrate objetivo se adaptan a resolución, FPS y formato. Se ofrece MP4 cuando el navegador lo admite, con alternativas WebM; los contenedores mantienen su extensión real. La rasterización del compositor conserva el detalle disponible al hacer zoom y vuelve a dibujar textos y formas a la resolución de salida.

La captura sigue realizándose en tiempo real en el navegador. Se comprueban decodificación inicial, cierre y cabecera del archivo, errores, cancelación y pérdidas de ritmo; no se descarga un resultado parcial cuando falla. Mantén la pestaña visible. El hub bloquea el cambio a otra herramienta durante la exportación; puedes cancelarla desde el editor.

Las pruebas de píxeles ejecutan el compositor real con un patrón de detalle nativo. El compositor anterior perdió ese detalle al hacer zoom (error medio 127,50/255); la versión corregida coincide con la referencia en ese patrón (error 0/255). **Esto comprueba la composición, no la calidad de un códec real del navegador.** Las pruebas de MediaRecorder usan dobles de las API; la codificación y sincronización reales requieren las pruebas de navegador incluidas.

## Datos y uso

No necesita cuentas, claves de API ni servidor para las funciones de DTT, notas, calendario y edición local. Abre el sitio con un navegador actual. Los archivos de video se procesan en el navegador; el editor conserva proyectos en IndexedDB.

Los datos se guardan por **navegador, dispositivo y origen web**. No hay sincronización entre equipos o usuarios ni notificaciones automáticas. Los proyectos de video existentes en `video-corrector`, bajo el mismo origen GitHub Pages, comparten el almacenamiento original del editor. Conserva respaldos antes de limpiar los datos del navegador.

El inicio permite exportar e importar un respaldo del DTT, notas y seguimientos. La importación valida los datos y pide confirmar el reemplazo. **Los proyectos de video se respaldan e importan dentro de Video Studio**. El calendario también tiene sus propios archivos JSON e ICS.

La importación opcional de reels conserva el servicio existente `https://video-corrector.onrender.com`, configurable en `tools/config.json`. Depende de la disponibilidad del servicio y de Instagram; la edición de archivos locales no depende de él.

## Desarrollo y publicación

Sitio estático sin compilación ni dependencias de producción. GitHub Pages sirve la raíz de `main`; `.nojekyll` conserva las rutas.

Para desarrollo local:

```sh
python3 -m http.server 8000
```

Abre http://localhost:8000. Servir por HTTP evita restricciones de almacenamiento y origen de `file://`.

## Pruebas

Las pruebas de lógica principales no necesitan instalar paquetes. La verificación de píxeles usa `@napi-rs/canvas` (dependencia de desarrollo):

```sh
npm test
npm run test:export
```

Comprueban el cálculo y persistencia del DTT, reglas de notas y seguimientos, ICS y secuenciación del arrastre del cabezal. Las pruebas DOM usan `basichtml` con adaptadores para eventos/formularios; no sustituyen pruebas visuales de un navegador.

```sh
npm install
npm run test:render
npm run test:dom
npx playwright install chromium
npm run test:browser
```

Se puede indicar un Chromium disponible con `CHROMIUM_EXECUTABLE`. El flujo `Hub and video quality` de GitHub Actions instala Chromium y ejecuta las pruebas de navegador, incluida una exportación real de video con audio y su decodificación. Guarda capturas de escritorio/móvil, un archivo exportado y metadatos en el artefacto `hub-video-verification`. Las pruebas locales de MediaRecorder usan dobles de las API; las verificaciones con Chromium se ejecutan por separado. La compatibilidad de formatos depende de los códecs del navegador.
