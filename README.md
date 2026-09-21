# Para Melian · 21·09·2026

Un pequeño jardín digital de flores amarillas. Una experiencia web interactiva, construida completamente con HTML, CSS y JavaScript puro — sin frameworks, sin librerías, sin imágenes externas, sin backend.

## Concepto

La premisa es simple: *"No quería simplemente regalarte una flor. Quería construirte un lugar donde pudieran crecer."*

La experiencia se recorre, no se lee: empieza en la oscuridad, un jardín nace y crece flor por flor, cada una guarda un pensamiento o una promesa, un pequeño perrito de la pradera aparece de forma espontánea como mensajero, existe una flor secreta escondida, una carta, una pregunta juguetona, una celebración y un cielo final donde las estrellas se conectan formando una flor.

Todo el arte — flores, perrito, partículas, cielo — está dibujado con SVG y Canvas, generado por código. No hay ni una sola imagen, GIF o archivo de audio externo.

## Estructura

```
melian/
├── index.html   → estructura y escenas
├── style.css    → paleta, tipografía, animaciones, responsive
├── script.js    → motor de escenas, jardín, perrito, audio, cielo
└── README.md    → este archivo
```

## Cómo verlo

No necesitas instalar nada. Simplemente abre `index.html` en cualquier navegador moderno (Chrome, Safari, Firefox, Edge), haciendo doble clic sobre el archivo.

## Publicarlo en GitHub Pages

1. Crea un repositorio nuevo en GitHub (puede ser privado o público — si quieres que solo Melian lo vea con el enlace, puedes dejarlo público sin anunciarlo, o usar GitHub Pages con un repositorio privado si tienes plan que lo permita).
2. Sube estos tres archivos (`index.html`, `style.css`, `script.js`) a la raíz del repositorio. El `README.md` es opcional para la publicación.
   ```bash
   git init
   git add index.html style.css script.js README.md
   git commit -m "Para Melian"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```
3. En GitHub, entra a **Settings → Pages**.
4. En "Build and deployment", selecciona **Deploy from a branch**, rama **main**, carpeta **/ (root)**.
5. Guarda. En un par de minutos GitHub te dará un enlace como:
   `https://TU_USUARIO.github.io/TU_REPOSITORIO/`
6. Abre ese enlace para comprobar que todo funcione, y luego compártelo con Melian.

No hay rutas absolutas, no hay proceso de build, no hay dependencias de npm — el sitio funciona exactamente igual en local que en GitHub Pages.

## Notas de diseño

- **Paleta**: negro profundo (`#0A0907`), tierra, crema (`#F4EBDD`) y dos tonos de amarillo (`#E9B949` azafrán, `#F4D35E` dorado) que aparecen progresivamente como símbolo de luz.
- **Tipografía**: una serif elegante para todo el texto narrativo, una sans-serif limpia para etiquetas e interfaz — con fallbacks del sistema, sin depender de fuentes externas.
- **Audio**: completamente opcional y silencioso por defecto (nunca autoplay). Un botón "activar ambiente" enciende un dron cálido generado con Web Audio API — no hay archivos MP3.
- **Rendimiento**: las partículas usan Canvas y `requestAnimationFrame`, se reducen automáticamente en móvil, y toda animación no esencial se desactiva si el sistema tiene activado "reducir movimiento".
- **Accesibilidad**: navegación por teclado en flores y botones, foco visible, `aria-live` en los mensajes descubiertos, contraste cuidado sobre fondo oscuro.

## Si quieres ajustar algo

- Los **mensajes de las flores** están al inicio de la sección `// 10. ESCENA · JARDÍN INTERACTIVO` en `script.js`, en los arreglos `FLOWER_MESSAGES` y `FLOWER_PROMISES`.
- El **texto de la carta** está directamente en `index.html`, dentro de `<section id="scene-letter">`.
- La **paleta de color** está centralizada en `:root` al inicio de `style.css`.

---

Hecho con cuidado, para que Melian sienta que alguien pensó realmente en ella al hacerlo.
