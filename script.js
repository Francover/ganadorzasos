// 1. ALIAS DE MATTER.JS
const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite,
      Events = Matter.Events,
      Mouse = Matter.Mouse,
      MouseConstraint = Matter.MouseConstraint;

// 2. CREAR EL MOTOR Y EL MUNDO
const engine = Engine.create();
const world = engine.world;

// 3. CONFIGURAR EL ESPACIO (VIEWPORT)
const container = document.querySelector('.scene');
const width = container.clientWidth;
const height = container.clientHeight;

const render = Render.create({
    element: document.body,
    engine: engine,
    options: { width: width, height: height, wireframes: false, background: 'transparent' }
});
render.canvas.style.position = 'absolute';
render.canvas.style.zIndex = '10'; 
render.canvas.style.pointerEvents = 'auto';
render.canvas.style.background = 'transparent';

// En touch real el canvas intercepta los taps sobre objetos leídos (z-index no ayuda en touch).
// Detectamos si el tap cayó sobre un .physics-object.leido y disparamos su click.
let objetoTocadoMovil = null;
document.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const elDebajo = document.elementFromPoint(touch.clientX, touch.clientY);
    objetoTocadoMovil = elDebajo ? elDebajo.closest('.physics-object.leido') : null;
}, { passive: true });

// 2. Ejecutamos la acción cuando el dedo se levanta
document.addEventListener('touchend', (e) => {
    if (objetoTocadoMovil) {
        e.preventDefault(); // Matamos el evento nativo para evitar doble-clicks fantasmas
        
        // Ejecutamos la apertura del modal directamente sin depender del .click() falso
        const item = physicsBodies.find(p => p.dom === objetoTocadoMovil);
        if (item && item.leido) {
            abrirModal(item.valor);
        }
        
        objetoTocadoMovil = null; // Limpiamos la variable
    }
}, { passive: false });

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// 4. CONFIGURAR EL MOUSE (PARA ARRASTRAR)
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: { stiffness: 0.2, render: { visible: false } }
});
Composite.add(world, mouseConstraint);
render.mouse = mouse;

// 5. PAREDES GENERALES INVISIBLES
const ground = Bodies.rectangle(width / 2, height + 50, width, 100, { isStatic: true, render: { visible: false } });
const leftWall = Bodies.rectangle(-50, height / 2, 100, height, { isStatic: true, render: { visible: false } });
const rightWall = Bodies.rectangle(width + 50, height / 2, 100, height, { isStatic: true, render: { visible: false } });
const ceiling = Bodies.rectangle(width / 2, -150, width, 100, { isStatic: true, render: { visible: false } }); 
Composite.add(world, [ground, leftWall, rightWall, ceiling]);

// 6. VARIABLES GLOBALES
const pergaminosDOM = document.querySelectorAll('.pergamino');
const physicsBodies = [];
let pergaminosLeidos = 0;
let valorActualAbierto = null; 
const LEIDOS_INICIO_TOP_REM = 1;
const LEIDOS_GAP_REM = 2.8;

const NORMAL_TIME_SCALE = 1;
const DEBUG_DROP = false;
let modalAbierto = false;

let dragStartPos = null;
let huboArrastre = false;

// --- EFECTO DE VIBRACIÓN EN CLICK (Delegación de eventos) ---
function configurarVibrationGlobal() {
    document.addEventListener('mousedown', (e) => {
        // CAMBIO AQUÍ: Agregamos , .btn-primary a la lista
        const el = e.target.closest('.physics-object, .nav-btn.image-btn, .btn-primary');
        
        if (el) {
            // Quitamos la clase si la tenía por un clic anterior muy rápido
            el.classList.remove('vibrating');
            
            // LÍNEA MÁGICA: Forzamos un "Reflow" para reiniciar la animación
            void el.offsetWidth; 
            
            // Volvemos a agregar la clase
            el.classList.add('vibrating');
            
            // Limpiamos después de 600ms
            setTimeout(() => {
                el.classList.remove('vibrating');
            }, 600);
        }
    });
}

function puntoEnDropZone(clientX, clientY) {
    const dropZoneVisual = document.querySelector('.scene.active .drop-zone-visual');
    if (!dropZoneVisual) return false;
    const rect = dropZoneVisual.getBoundingClientRect();
    return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
    );
}

function pausarEscenaParaModal() {
    engine.timing.timeScale = 0;
    render.canvas.style.pointerEvents = 'none';
    modalAbierto = true;
}

function reanudarEscenaTrasModal() {
    engine.timing.timeScale = NORMAL_TIME_SCALE;
    render.canvas.style.pointerEvents = 'auto';
    modalAbierto = false;
}

function actualizarRecordatorioEscena2(objetoDOM) {
    if (!objetoDOM) return;

    const scene2DropZone = document.querySelector('#scene-2 .drop-zone-visual');
    if (!scene2DropZone) return;

    const iconEl = scene2DropZone.querySelector('.drop-icon');
    const textEl = scene2DropZone.querySelector('span');

    const emoji = objetoDOM.getAttribute('data-emoji') || '📦';
    const nombreObjeto = objetoDOM.getAttribute('data-objeto') || 'objeto';

    if (iconEl) iconEl.textContent = emoji;
    if (textEl) textEl.textContent = `Pon aquí el objeto`;
}

function hexAHue(hexColor) {
    if (!hexColor) return null;

    const clean = hexColor.trim().replace('#', '');
    if (![3, 6].includes(clean.length)) return null;

    const full = clean.length === 3
        ? clean.split('').map(c => c + c).join('')
        : clean;

    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    if (delta === 0) return 0;

    let hue;
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;

    const degrees = hue * 60;
    return (degrees + 360) % 360;
}

function filtroPergaminoDesdeColor(hexColor) {
    const baseHuePergamino = 34;
    const hueObjetivo = hexAHue(hexColor);
    if (hueObjetivo == null) return null;

    const rotacion = hueObjetivo - baseHuePergamino;
    return `hue-rotate(${rotacion}deg) saturate(1.2) brightness(1.02)`;
}

// 7. MEDIR LA MESA Y SOLTAR LOS PERGAMINOS SOBRE SU SUPERFICIE
function inicializarEscena1() {
    // Obtenemos dimensiones relativas al contenedor para que sea 100% responsive
    const mesaDOM = document.querySelector('#scene-1 .mesa');
    const mesaW = mesaDOM.offsetWidth;
    
    const surfaceY = mesaDOM.offsetTop + (mesaDOM.offsetHeight * 0.4);

    // Un solo rectángulo físico que funciona como escritorio centrado
    const mesaSurfaceWidth = mesaW * 0.9;
    const mesaSurface = Bodies.rectangle(
        width / 2, surfaceY, mesaSurfaceWidth, 20, { isStatic: true, render: { visible: false } }
    );
    Composite.add(world, [mesaSurface]);

    const pergaminoReferencia = pergaminosDOM[0]?.offsetWidth || 120;
    const margenLateral = pergaminoReferencia * 0.35;
    const areaDeCaida = Math.max(140, mesaSurfaceWidth - (margenLateral * 2));
    const inicioX = (width / 2) - (areaDeCaida / 2);
    const spacing = areaDeCaida / pergaminosDOM.length;

    const getSpawnPosition = (index) => {
        // Stagger vertical suave para que se vea la caída y evitar superposición inicial.
        const xJitter = Math.random() * 5 - 3;
        const yJitter = Math.random() * 24;
        return {
            x: inicioX + (spacing / 2) + (spacing * index) + xJitter,
            y: surfaceY - 180 - (index * 24) - yJitter
        };
    };

    pergaminosDOM.forEach((div, index) => {
        const spawn = getSpawnPosition(index);
        const visualWidth = div.offsetWidth;
        const visualHeight = div.offsetHeight;

        const valorId = div.getAttribute('data-valor');
        const colorConfigurado = contenidos[valorId]?.color;
        const filtroPorColor = filtroPergaminoDesdeColor(colorConfigurado);
        if (filtroPorColor) {
            div.style.filter = filtroPorColor;
        }

        // Cuerpo más compacto para que la colisión se acerque al pergamino visual.
        const bodyWidth = visualWidth * 0.62;
        const bodyHeight = visualHeight * 0.34;
        
        const body = Bodies.rectangle(spawn.x, spawn.y, bodyWidth, bodyHeight, {
            restitution: 0.25,
            friction: 0.5,
            frictionAir: 0.02,
            chamfer: { radius: bodyHeight * 0.45 },
			angle: Math.random() * 0.7 - 0.35,
            render: { visible: false }
        });
        
        physicsBodies.push({ dom: div, body: body, leido: false, valor: valorId });
        Composite.add(world, body);

        // Permite reabrir el valor desde el inventario de pergaminos leidos.
        div.addEventListener('click', () => {
            const item = physicsBodies.find(p => p.dom === div);
            if (item?.leido) {
                abrirModal(item.valor);
            }
        });
    });

    Events.on(engine, 'afterUpdate', function() {
        physicsBodies.forEach(item => {
            if (item.leido) return; 
            const offsetX = item.dom.offsetWidth / 2;
            const offsetY = item.dom.offsetHeight / 2;
            item.dom.style.transform = `translate(${item.body.position.x - offsetX}px, ${item.body.position.y - offsetY}px) rotate(${item.body.angle}rad)`;
        });
    });

    // --- REINICIAR (ADAPTADO A LA NUEVA DISTRIBUCIÓN) ---
	const btnReiniciar = document.getElementById('btn-reiniciar');
    if (btnReiniciar) {
        btnReiniciar.addEventListener('click', () => {
            physicsBodies.forEach((item, index) => {
                item.leido = false;
                item.dom.classList.remove('leido');
                item.dom.style.top = '';
                item.dom.style.left = '';
                
                const spawn = getSpawnPosition(index);
                
                Matter.Body.setPosition(item.body, { x: spawn.x, y: spawn.y });
                Matter.Body.setVelocity(item.body, { x: 0, y: 0 }); 
                Matter.Body.setAngularVelocity(item.body, 0);

				Matter.Body.setAngle(item.body, Math.random() * 0.7 - 0.35);
                
                Matter.Composite.remove(world, item.body);
                Matter.Composite.add(world, item.body);
            });
            pergaminosLeidos = 0;
            valorActualAbierto = null;

            const btnBoomS2 = document.getElementById('btn-boom-s2');
            if (btnBoomS2) btnBoomS2.style.display = '';
            const btnBoom = document.getElementById('btn-boom');
            if (btnBoom) btnBoom.style.display = '';
        });
    }

    const btnBoom = document.getElementById('btn-boom');
    if (btnBoom) {
        btnBoom.addEventListener('click', () => {
            physicsBodies.forEach(item => {
                if (item.leido) return;

                const forceX = (Math.random() - 0.5) * 0.05;
                const forceY = -(0.03 + Math.random() * 0.035);

                Matter.Body.setVelocity(item.body, {
                    x: (Math.random() - 0.5) * 18,
                    y: -(9 + Math.random() * 8)
                });
                Matter.Body.setAngularVelocity(item.body, (Math.random() - 0.5) * 0.8);
                Matter.Body.applyForce(item.body, item.body.position, { x: forceX, y: forceY });
            });
        });
    }

    // Agregar listeners de vibración a botones de escena 1
    configurarVibrationGlobal();
}

window.addEventListener('load', inicializarEscena1);

// 8. LÓGICA DE CLICS / MODAL / INVENTARIO
const modal = document.getElementById('modal-mensaje');
const modalTitulo = document.getElementById('modal-titulo');
const modalTexto = document.getElementById('modal-texto');
const modalValorImagen = document.getElementById('modal-valor-imagen');
const btnCerrar = document.getElementById('btn-cerrar-modal');

// 2. NUEVO VALOR AÑADIDO: 'ownership'
const contenidos = {
    'data': { titulo: 'DATA DRIVEN', texto: 'Ganadorzasos; con la mente en el juego.', color: '#1f8f5f' },
    'agility': { titulo: 'AGILIDAD', texto: 'Somos valientes y estamos obsesionados.', color: '#2e7dd1' },
    'impact': { titulo: 'IMPACTO', texto: 'Audaces en nuestras batallas frente a los retos del negocio.', color: '#c4512d' },
    'ownership': { titulo: 'OWNERSHIP', texto: 'La agilidad no pestañea.', color: '#8b6a3b' },
    'truth': { titulo: 'TRUTH', texto: 'Growth is truth: La integridad de la data primero.', color: '#d442af' },
    'valor1': { titulo: 'Franco', texto: 'Un día sin reir es un día perdido.', color: '#c0392b' },
    'valor2': { titulo: 'Cristiano Ronaldo', texto: 'Siuuuu.', color: '#27ae60' },
    'valor3': { titulo: 'Nico', texto: 'Crecer no es solo alcanzar resultados, es desafiar lo que existe, aprender rápido y convertir cada oportunidad en una mejora.', color: '#ff00b3' },
    'valor4': { titulo: 'Gerson', texto: 'Ganadorsazo!!', color: '#008594' },
    'valor5': { titulo: 'Lou', texto: 'Tu compromiso con el proceso, es lo que va a lograr tu progreso.', color: '#b30707' },
    'valor6': { titulo: 'Coco', texto: 'Cuestionar lo establecido es el primer paso para evolucionar.', color: '#3900c8' },
    'valor7': { titulo: 'Iván', texto: 'Primero construyo, luego existo.', color: '#1c9a29' },
};

// 3. ABRIR CON ARRASTRE LENTO O CLIC:
Events.on(mouseConstraint, 'mousedown', function(event) {
    dragStartPos = { x: event.mouse.position.x, y: event.mouse.position.y };
    huboArrastre = false;
});

Events.on(mouseConstraint, 'mousemove', function(event) {
    if (!dragStartPos) return;

    const dx = event.mouse.position.x - dragStartPos.x;
    const dy = event.mouse.position.y - dragStartPos.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 8) {
        huboArrastre = true;
    }
});

Events.on(mouseConstraint, 'mouseup', function(event) {
    const mousePos = event.mouse.position;

    // Si no se arrastró, no abrir modal (evita click simple).
    if (!huboArrastre) {
        if (DEBUG_DROP) console.log('Drop cancelado: no hubo arrastre.');
        dragStartPos = null;
        return;
    }

    // Solo abrir si se suelta dentro de la drop zone visual.
    if (!puntoEnDropZone(event.mouse.absolute.x, event.mouse.absolute.y)) {
        if (DEBUG_DROP) {
            console.log('Drop cancelado: fuera de la zona activa.', {
                x: event.mouse.absolute.x,
                y: event.mouse.absolute.y,
                escenaActiva: document.querySelector('.scene.active')?.id || 'sin-escena'
            });
        }
        dragStartPos = null;
        return;
    }

    let seAbrioModal = false;
    physicsBodies.forEach(item => {
        if (item.leido) return;

        // Debe soltarse sobre el propio pergamino arrastrado y con velocidad baja.
        if (Matter.Bounds.contains(item.body.bounds, mousePos) && item.body.speed < 20) {
            abrirModal(item.valor);
            seAbrioModal = true;
        }
    });

    if (DEBUG_DROP && !seAbrioModal) {
        console.log('Drop en zona, pero no abrió modal: verifica velocidad o cuerpo seleccionado.');
    }

    dragStartPos = null;
    huboArrastre = false;
});

function extraerHueRotate(filterValue) {
    if (!filterValue || filterValue === 'none') return null;
    const match = filterValue.match(/hue-rotate\((-?\d+(?:\.\d+)?)deg\)/i);
    return match ? Number(match[1]) : null;
}

function colorBotonDesdeFiltro(filterValue) {
    const baseHuePergamino = 34;
    const hueRotate = extraerHueRotate(filterValue) ?? 0;
    const hueFinal = ((baseHuePergamino + hueRotate) % 360 + 360) % 360;
    return `hsl(${hueFinal}, 65%, 38%)`;
}
// Genera una forma irregular aleatoria para la caja (estilo dibujado a mano)
// function aplicarDeformidadAleatoria(elementoCSS) {
//     // Generamos números aleatorios para simular trazos irregulares
//     // Valores altos (ej. 200-255) para las partes largas, valores bajos (10-40) para las esquinas aplastadas.
//     const randomLow = () => Math.floor(Math.random() * 30) + 10; 
//     const randomHigh = () => Math.floor(Math.random() * 55) + 200; 

//     // Fórmula mágica de 8 valores para CSS border-radius
//     const deformidad = `${randomHigh()}px ${randomLow()}px ${randomHigh()}px ${randomLow()}px / ${randomLow()}px ${randomHigh()}px ${randomLow()}px ${randomHigh()}px`;
    
//     elementoCSS.style.borderRadius = deformidad;
// }


function abrirModal(valorId) {
    if (modalAbierto) return;

    const data = contenidos[valorId];
    if(data) {
        const pergaminoActivo = physicsBodies.find(p => p.valor === valorId);
        const filtroInline = pergaminoActivo?.dom?.style?.filter || '';
        const filtroComputado = pergaminoActivo?.dom ? getComputedStyle(pergaminoActivo.dom).filter : '';
        const filtroPergamino = (filtroInline && filtroInline !== 'none')
            ? filtroInline
            : ((filtroComputado && filtroComputado !== 'none') ? filtroComputado : 'none');

        valorActualAbierto = valorId;
        modalTitulo.innerText = data.titulo;
        modalTexto.innerText = data.texto;

        const esManzana = valorId === 'valor1' || valorId === 'valor2' || valorId === 'valor3' || valorId === 'valor4' || valorId === 'valor5' || valorId === 'valor6' || valorId === 'valor7';
        modal.classList.toggle('con-titulo', esManzana);

        // Color configurable desde contenidos (fallback al dinámico por filtro)
        const colorDinamico = colorBotonDesdeFiltro(filtroPergamino);
        const colorModal = data.color || colorDinamico;

        // --- NUEVO: APLICAR DEFORMIDAD AL AZAR Y COLOR ---
        const cajaDinamica = document.getElementById('modal-caja-dinamica');
        //aplicarDeformidadAleatoria(cajaDinamica);
        
        // Coloreamos dinámicamente la línea del título y la sombra de la caja
        modalTitulo.style.borderBottomColor = colorModal;
        if (cajaDinamica) {
            cajaDinamica.style.boxShadow = `8px 8px 0px ${colorModal}`;
        }

        btnCerrar.style.backgroundColor = colorModal;
        btnCerrar.style.color = '#ffffff';
        btnCerrar.innerText = "ENTENDIDO 🫡";
        
        modal.classList.remove('hidden');
        pausarEscenaParaModal();
    }
}

btnCerrar.addEventListener('click', () => {
    modal.classList.add('hidden');
    reanudarEscenaTrasModal();

    if (valorActualAbierto) {
        const item = physicsBodies.find(p => p.valor === valorActualAbierto);
        if (item && !item.leido) {
            item.leido = true;
            
            Matter.Composite.remove(world, item.body);
            
            item.dom.style.transform = ''; 
            item.dom.classList.add('leido');
            
            item.dom.style.top = `${(pergaminosLeidos * LEIDOS_GAP_REM) + LEIDOS_INICIO_TOP_REM}rem`;
            
            // Posición left diferente según escena
            const esEscena2 = item.dom.closest('#scene-2') !== null;
            item.dom.style.left = esEscena2 ? '2.5rem' : '3.5rem';
            
            pergaminosLeidos++;
            valorActualAbierto = null;

            const btnBoomActual = esEscena2 ? document.getElementById('btn-boom-s2') : document.getElementById('btn-boom');
            if (btnBoomActual && pergaminosLeidos >= physicsBodies.length) {
                btnBoomActual.style.display = 'none';
            }
        }
    }
});

// --- TRANSICIÓN ENTRE ESCENAS ---
const btnConocenos = document.getElementById('btn-conocenos');
const scene1 = document.getElementById('scene-1');
const scene2 = document.getElementById('scene-2');

if (btnConocenos) {
    btnConocenos.addEventListener('click', () => {
        // 1. Ocultamos Escena 1 y Mostramos Escena 2
        scene1.style.display = 'none';
        scene1.classList.remove('active');
        
        scene2.style.display = 'block';
        scene2.classList.add('active');

        // 2. Limpiamos los objetos físicos Y EL DOM de la Escena 1
        physicsBodies.forEach(item => {
            // --- NUEVO: Limpiamos los rastros visuales ---
            item.dom.classList.remove('leido');
            item.dom.style.top = '';
            item.dom.style.left = '';
            
            Matter.Composite.remove(world, item.body);
        });
        physicsBodies.length = 0; // Vaciamos el array
        pergaminosLeidos = 0; // Reiniciamos el contador de lectura

        const btnBoomS2 = document.getElementById('btn-boom-s2');
        if (btnBoomS2) btnBoomS2.style.display = '';

        // 3. Cargamos los nuevos objetos de la Escena 2
        inicializarEscena2();
    });
}

// Función para inicializar las físicas de la Escena 2
function inicializarEscena2() {
    const manzanasDOM = document.querySelectorAll('#scene-2 .physics-object');
    const mesaDOM2 = document.querySelector('#scene-2 .mesa');

    if (manzanasDOM.length > 0) {
        actualizarRecordatorioEscena2(manzanasDOM[0]);
    }
    
    // Recalculamos posiciones en base a la nueva escena
    const mesaW = mesaDOM2.offsetWidth;
    const surfaceY = mesaDOM2.offsetTop + (mesaDOM2.offsetHeight * 0.4);
    
    const objetoReferencia = manzanasDOM[0]?.offsetWidth || 120;
    const margenLateral = objetoReferencia * 0.35;
    const areaDeCaida = Math.max(140, (mesaW * 0.9) - (margenLateral * 2));
    const inicioX = (width / 2) - (areaDeCaida / 2);
    const spacing = areaDeCaida / manzanasDOM.length;

    manzanasDOM.forEach((div, index) => {
        const xJitter = Math.random() * 5 - 3;
        const yJitter = Math.random() * 24;
        const spawnX = inicioX + (spacing / 2) + (spacing * index) + xJitter;
        const spawnY = surfaceY - 180 - (index * 24) - yJitter;

        const visualWidth = div.offsetWidth;
        const radius = visualWidth * 0.45; // Como son objetos redondos, usamos radio

        // CREAMOS CUERPOS CIRCULARES PARA QUE RUEDEN
        const body = Bodies.circle(spawnX, spawnY, radius, {
            restitution: 0.6, // Rebotan más que el pergamino
            friction: 0.3,
            frictionAir: 0.01,
            angle: Math.random() * Math.PI * 2,
            render: { visible: false }
        });
        
        physicsBodies.push({ dom: div, body: body, leido: false, valor: div.getAttribute('data-valor') });
        Composite.add(world, body);

        // Clic: actualiza el recordatorio con emoji + objeto y reabre modal si ya fue leído.
        div.addEventListener('click', () => {
            actualizarRecordatorioEscena2(div);

            const item = physicsBodies.find(p => p.dom === div);
            if (item?.leido) {
                abrirModal(item.valor);
            }
        });
    });

    // Configurar botones de Escena 2
    const btnReiniciarS2 = document.getElementById('btn-reiniciar-s2');
    if (btnReiniciarS2) {
        btnReiniciarS2.addEventListener('click', () => {
            physicsBodies.forEach((item, index) => {
                item.leido = false;
                item.dom.classList.remove('leido');
                item.dom.style.top = '';
                item.dom.style.left = '';
                
                const manzanasDOM = document.querySelectorAll('#scene-2 .physics-object');
                const mesaDOM2 = document.querySelector('#scene-2 .mesa');
                const mesaW = mesaDOM2.offsetWidth;
                const surfaceY = mesaDOM2.offsetTop + (mesaDOM2.offsetHeight * 0.4);
                
                const objetoReferencia = manzanasDOM[0]?.offsetWidth || 120;
                const margenLateral = objetoReferencia * 0.35;
                const areaDeCaida = Math.max(140, (mesaW * 0.9) - (margenLateral * 2));
                const inicioX = (width / 2) - (areaDeCaida / 2);
                const spacing = areaDeCaida / manzanasDOM.length;
                
                const xJitter = Math.random() * 5 - 3;
                const yJitter = Math.random() * 24;
                const spawnX = inicioX + (spacing / 2) + (spacing * index) + xJitter;
                const spawnY = surfaceY - 180 - (index * 24) - yJitter;
                
                Matter.Body.setPosition(item.body, { x: spawnX, y: spawnY });
                Matter.Body.setVelocity(item.body, { x: 0, y: 0 });
                Matter.Body.setAngularVelocity(item.body, 0);
                Matter.Body.setAngle(item.body, Math.random() * Math.PI * 2);
                
                Matter.Composite.remove(world, item.body);
                Matter.Composite.add(world, item.body);
            });
            pergaminosLeidos = 0;
            valorActualAbierto = null;

            const btnBoomS2Reinicio = document.getElementById('btn-boom-s2');
            if (btnBoomS2Reinicio) btnBoomS2Reinicio.style.display = '';
        });
    }

    const btnBoomS2 = document.getElementById('btn-boom-s2');
    if (btnBoomS2) {
        btnBoomS2.addEventListener('click', () => {
            physicsBodies.forEach(item => {
                if (item.leido) return;

                Matter.Body.setVelocity(item.body, {
                    x: (Math.random() - 0.5) * 18,
                    y: -(9 + Math.random() * 8)
                });
                Matter.Body.setAngularVelocity(item.body, (Math.random() - 0.5) * 0.8);
            });
        });
    }

    const btnVolver = document.getElementById('btn-volver');
    if (btnVolver) {
        btnVolver.addEventListener('click', () => {
            // Volver a Escena 1
            scene2.style.display = 'none';
            scene2.classList.remove('active');
            
            scene1.style.display = 'block';
            scene1.classList.add('active');

            // Limpiar objetos físicos Y DOM de Escena 2
            physicsBodies.forEach(item => {
                // --- NUEVO: Limpiamos los rastros visuales ---
                item.dom.classList.remove('leido');
                item.dom.style.top = '';
                item.dom.style.left = '';
                
                Matter.Composite.remove(world, item.body);
            });
            physicsBodies.length = 0;
            pergaminosLeidos = 0;

            const btnBoom = document.getElementById('btn-boom');
            if (btnBoom) btnBoom.style.display = '';

            // Reinicializar Escena 1
            inicializarEscena1();
        });
    }
    // Re-agregar listeners de vibración para botones de escena 2
    // (No necesario con delegación de eventos global)
}