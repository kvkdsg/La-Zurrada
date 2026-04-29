<div align="center">

# La Zurrada del Año

**Arquitectura de alto rendimiento y renderizado en Canvas para eventos masivos de streaming**

[![Astro](https://img.shields.io/badge/Astro-5.0-FF5D01?style=for-the-badge&logo=astro&logoColor=white)](https://astro.build/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

</div>

## Sobre el proyecto

**La Zurrada del Año** es un experimento técnico y conceptual desarrollado para mi portfolio personal. Consiste en una plataforma web para un evento ficticio de boxeo entre creadores de contenido.

El objetivo principal del proyecto no es solo el diseño visual, sino **resolver problemas complejos de rendimiento en frontend**. Las webs de grandes eventos suelen estar sobrecargadas de assets pesados, como vídeos, secuencias de imágenes y animaciones complejas, que bloquean el hilo principal y degradan la experiencia.

Este proyecto demuestra cómo construir una experiencia altamente interactiva y fluida, manteniendo **\(60\) fps** en cualquier dispositivo mediante una optimización minuciosa del consumo de memoria, el uso de red y el renderizado.

## Arquitectura técnica y logros

Este repositorio encapsula más de 100 horas de investigación y desarrollo, con un motor propio de secuencias al scroll construido desde cero.

### 1. Motor de renderizado en Canvas (`scrollSequence.ts`)

En lugar de animar elementos pesados en el DOM o depender de vídeos bloqueantes, la navegación de los participantes se apoya en la API de Canvas (`CanvasRenderingContext2D`).

- **Sincronización precisa:** El progreso del scroll se interpola con un array de imágenes prerenderizadas, pintando el frame exacto en el `<canvas>` según la posición del usuario.
- **Resolución adaptativa:** El canvas se escala dinámicamente mediante `window.devicePixelRatio` para mantener nitidez en pantallas Retina sin cargar assets sobredimensionados.
- **Prevención de layout thrashing:** Las lecturas del DOM (`getBoundingClientRect`, `offsetHeight`) y las escrituras se agrupan dentro del ciclo de `requestAnimationFrame`, evitando recálculos de estilo costosos.

### 2. Gestión avanzada de memoria y red

Cargar cientos de frames puede destruir la RAM de un dispositivo móvil. Para evitarlo, implementé un sistema de precarga inteligente y limpieza explícita de recursos.

- **Inicialización bajo demanda con `IntersectionObserver`:** Las secuencias solo se hidratan cuando el usuario se aproxima al viewport, usando `rootMargin: '60% 0px'`.
- **Lazy load bidireccional:** Un algoritmo de _look-ahead_ precarga imágenes en la dirección del scroll, manteniendo un buffer controlado para no saturar la red.
- **Limpieza profunda:** Al salir de la vista o al cambiar de página con la API de View Transitions de Astro, se destruyen contextos de Canvas, se abortan promesas pendientes y se vacía la caché en memoria (`Map<number, HTMLImageElement>`).

### 3. Aceleración por hardware

Las animaciones de interfaz, como paralaje, barridos de luz y escalado de tarjetas, se promueven a capas independientes de GPU mediante `transform`, `opacity` y `will-change`.

Esto libera el hilo principal para el motor de Canvas y mejora la respuesta general de la interfaz.

### 4. Accesibilidad y progressive enhancement

- **Soporte para `prefers-reduced-motion`:** Si el usuario ha solicitado reducir movimiento a nivel del sistema operativo, las secuencias de Canvas se desactivan y se reemplazan por un _fallback_ estático.
- **Ahorro de batería y mayor confort visual:** Esta degradación elegante evita mareos y reduce carga de procesamiento.
- **Navegación por teclado:** El selector de luchadores es totalmente funcional con `ArrowKeys`, `Enter` y `Space`, incluyendo gestión de foco.

## Stack tecnológico

- **Framework:** [Astro](https://astro.build/), con renderizado estático rápido y soporte para View Transitions.
- **Lenguaje:** TypeScript con configuración `strict`, sin `any` y con validaciones exhaustivas.
- **Estilos:** Tailwind CSS v4 + CSS Custom Properties dinámicas para inyectar estados desde JavaScript.
- **Animación y lógica core:** Vanilla JavaScript con `requestAnimationFrame` y Web APIs nativas.

## Instalación y desarrollo

Sigue estos pasos para ejecutar el proyecto en local.

### 1. Clona el repositorio

```bash
git clone https://github.com/tu-usuario/la-zurrada-del-ano.git
cd la-zurrada-del-ano
```

### 2. Instala las dependencias

Se recomienda usar `pnpm`.

```bash
pnpm install
```

### 3. Inicia el servidor de desarrollo

```bash
pnpm dev
```

### 4. Abre el proyecto en tu navegador

Visita:

```bash
http://localhost:4321
```

## Scripts útiles

```bash
pnpm dev
pnpm build
pnpm preview
```

## Aviso legal y licencia

### Licencia técnica del código

El código fuente de este proyecto, incluyendo scripts, lógica de componentes y arquitectura en Astro y Tailwind, ha sido desarrollado íntegramente por Javier Valdés y se distribuye bajo la licencia [MIT](https://opensource.org/licenses/MIT).

Puedes reutilizar libremente esta arquitectura y su código en tus propios proyectos, respetando los términos de dicha licencia.

### Contenido multimedia y contexto del proyecto

Todos los nombres, combates, eventos y marcas mencionados en esta web, como **La Zurrada del Año**, **Arena Código** y los nombres ficticios de los participantes, son puramente paródicos y han sido creados exclusivamente para esta demostración técnica.

Este proyecto no tiene ninguna relación comercial, patrocinio ni afiliación con eventos reales, marcas registradas o creadores de contenido existentes.

## Autor

Hecho con 💻, ☕ y obsesión por los \(60\) fps por **Javier Valdés**.
