# DD Tool Hub

Un espacio minimalista con fondo negro, texto claro y cuatro herramientas para el trabajo diario. Se retiraron el aviso superior de guardado, el botón de ayuda y los pies de página. El inicio prioriza DTT de hoy, seguimientos de hoy y vencidos.

**Sitio:** https://alvaroporras2002-coder.github.io/DD-tool-hub/

- **DTT Tracker:** importa el CSV de llamadas, calcula tiempo base y bono, permite tiempos manuales, metas e historial por día.
- **Video Studio:** editor completo incorporado desde `video-corrector`, con proyectos, biblioteca, texto, audio, capas y exportación. Cabezal de reproducción arrastrable con mouse, touch o lápiz, zoom y scroll; flechas para avanzar por cuadros, Shift para segundos, Home/End. En proyectos vacíos se puede recorrer una regla de 20 segundos antes de importar archivos, sin agregar duración al contenido ni a la exportación.
- **Call Notes:** las 11 preguntas y sus respuestas originales, instrucciones contextuales, nota en inglés en vivo, copia, descarga, borrador automático e historial editable.
- **Follow-up Map:** calendario mensual, agenda diaria, creación/edición, prioridades, pendientes/completados, búsqueda, filtros, copia JSON y exportación .ics. Una nota puede convertirse en seguimiento.

## DTT: regla conservada del archivo original

El CSV debe incluir `Duration in Seconds` y `State`. Se suman **todas las duraciones válidas** y **60 segundos adicionales solo si State es Completed** (sin distinguir mayúsculas o espacios exteriores). Un cero válido Completed también recibe el bono, igual que el archivo original. Otros resultados, como Left Message y Missed, no reciben bono.

Cada nueva carga **reemplaza** el reporte CSV del día, preservando los tiempos manuales. No se acumulan cargas repetidas. Cambia el día del reporte si el CSV pertenece a otra fecha; el archivo no se filtra automáticamente por fecha.

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

Las pruebas de lógica no necesitan instalar paquetes:

```sh
npm test
```

Comprueban el cálculo y persistencia del DTT, reglas de notas y seguimientos, ICS y secuenciación del arrastre del cabezal. Las pruebas DOM usan `basichtml` con adaptadores para eventos/formularios; no sustituyen pruebas visuales de un navegador.

```sh
npm install
npm run test:dom
npx playwright install chromium
npm run test:browser
```

Se puede indicar un Chromium disponible con `CHROMIUM_EXECUTABLE`. Durante la implementación pasaron las pruebas de lógica y DOM; las pruebas de navegador quedaron preparadas pero no pudieron ejecutarse porque el entorno no tenía Chromium y bloqueó su descarga. La previsualización/exportación multimedia depende de los códecs soportados por el navegador.
