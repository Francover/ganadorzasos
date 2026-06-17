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

// 7. MEDIR LA MESA Y SOLTAR LOS PERGAMINOS SOBRE SU SUPERFICIE
window.addEventListener('load', () => {
    
    // Obtenemos dimensiones relativas al contenedor para que sea 100% responsive
    const mesaDOM = document.querySelector('.mesa');
    const mesaW = mesaDOM.offsetWidth;
    
    const surfaceY = mesaDOM.offsetTop + (mesaDOM.offsetHeight * 0.6);

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
        const xJitter = Math.random() * 16 - 8;
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
        
        physicsBodies.push({ dom: div, body: body, leido: false, valor: div.getAttribute('data-valor') });
        Composite.add(world, body);
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
        });
    }
});

// 8. LÓGICA DE CLICS / MODAL / INVENTARIO
const modal = document.getElementById('modal-mensaje');
const modalTitulo = document.getElementById('modal-titulo');
const modalTexto = document.getElementById('modal-texto');
const btnCerrar = document.getElementById('btn-cerrar-modal');

// 2. NUEVO VALOR AÑADIDO: 'ownership'
const contenidos = {
    'data': { titulo: 'DATA DRIVEN', texto: 'Tomamos decisiones basadas en datos duros.' },
    'agility': { titulo: 'AGILIDAD', texto: 'Iteramos rápido. Es mejor hecho que perfecto.' },
    'impact': { titulo: 'IMPACTO', texto: 'Buscamos acciones que muevan la aguja del negocio.' },
    'candor': { titulo: 'CANDOR', texto: 'Nos decimos la verdad de frente, con empatía y respeto.' },
    'ownership': { titulo: 'OWNERSHIP', texto: 'Actuamos como dueños, asumiendo la responsabilidad total.' }
};

// 3. ABRIR CON ARRASTRE LENTO O CLIC:
Events.on(mouseConstraint, 'mouseup', function(event) {
    const mousePos = event.mouse.position;
    
    physicsBodies.forEach(item => {
        if (item.leido) return; 

        if (Matter.Bounds.contains(item.body.bounds, mousePos)) { 
            // CAMBIO AQUÍ: Aumentamos la tolerancia de 3 a 20.
            // Ahora perdonará movimientos bruscos al soltar.
            if (item.body.speed < 20) {
                abrirModal(item.valor);
            }
        }
    });
});

function abrirModal(valorId) {
    const data = contenidos[valorId];
    if(data) {
        valorActualAbierto = valorId;
        modalTitulo.innerText = data.titulo;
        modalTexto.innerText = data.texto;
        btnCerrar.innerText = "ENTENDIDO ✔";
        
        modal.classList.remove('hidden');
        render.canvas.style.pointerEvents = 'none'; 
    }
}

btnCerrar.addEventListener('click', () => {
    modal.classList.add('hidden');
    render.canvas.style.pointerEvents = 'auto'; 

    if (valorActualAbierto) {
        const item = physicsBodies.find(p => p.valor === valorActualAbierto);
        if (item && !item.leido) {
            item.leido = true;
            
            Matter.Composite.remove(world, item.body);
            
            item.dom.style.transform = ''; 
            item.dom.classList.add('leido');
            
            item.dom.style.top = `${pergaminosLeidos * 40}px`; 
            item.dom.style.left = '3rem';
            
            pergaminosLeidos++;
            valorActualAbierto = null;
        }
    }
});