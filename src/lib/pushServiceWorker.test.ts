import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";

/**
 * Pruebas del Service Worker de notificaciones push.
 *
 * `public/firebase-messaging-sw.js` no se puede importar: corre en el ámbito
 * de un Service Worker, no en el de un módulo, y su primera instrucción es un
 * `importScripts()` remoto. Aquí se evalúa el archivo TAL CUAL en un contexto
 * aislado, sustituyendo únicamente las APIs que el navegador le proporciona.
 * Así lo que se verifica es el código que se despliega, sin copias ni
 * reescrituras que puedan quedar desincronizadas.
 *
 * Cubre la corrección de las notificaciones duplicadas: el backend envía
 * mensajes "data-only" y este Service Worker es el único que debe llamar a
 * showNotification().
 */

// Desde la raíz del proyecto: bajo jsdom, import.meta.url no es una ruta de
// fichero, así que no sirve para resolverla.
const RUTA_SW = resolve(process.cwd(), "public/firebase-messaging-sw.js");
const CODIGO_SW = readFileSync(RUTA_SW, "utf8");

interface NotificacionMostrada {
  title: string;
  options: {
    body: string;
    tag: string;
    renotify: boolean;
    data: { event_id: string; event_type?: string; url: string };
  };
}

interface Ventana {
  url: string;
  navegadoA: string | null;
  enfocada: boolean;
  navigate(url: string): Promise<void>;
  focus(): Promise<void>;
}

/**
 * Evalúa el Service Worker en un contexto nuevo.
 *
 * Debe llamarse una vez por prueba: el módulo mantiene en memoria el registro
 * de eventos ya notificados, y compartirlo entre pruebas las acoplaría.
 */
function cargarServiceWorker(ventanas: Ventana[] = []) {
  const mostradas: NotificacionMostrada[] = [];
  /** Etiquetas visibles. El navegador reemplaza, no acumula, las del mismo tag. */
  const tagsVisibles = new Set<string>();
  const listeners = new Map<string, (event: unknown) => void>();
  const abiertas: string[] = [];
  let skipWaitingLlamado = false;
  let claimLlamado = false;

  const self = {
    addEventListener(tipo: string, fn: (event: unknown) => void) {
      listeners.set(tipo, fn);
    },
    skipWaiting() {
      skipWaitingLlamado = true;
    },
    clients: {
      claim: async () => {
        claimLlamado = true;
      },
      matchAll: async () => ventanas,
      openWindow: async (url: string) => {
        abiertas.push(url);
      },
    },
    registration: {
      scope: "https://depthguard.app/",
      showNotification: async (title: string, options: NotificacionMostrada["options"]) => {
        mostradas.push({ title, options });
        tagsVisibles.add(options.tag);
      },
      getNotifications: async ({ tag }: { tag: string }) =>
        tagsVisibles.has(tag) ? [{ tag }] : [],
    },
  };

  let manejarMensaje!: (payload: unknown) => Promise<void>;

  const contexto = createContext({
    self,
    // El SDK de Firebase llega por importScripts desde gstatic; aquí solo
    // interesa el callback que el Service Worker le registra.
    importScripts: () => {},
    firebase: {
      initializeApp: () => ({}),
      messaging: () => ({
        onBackgroundMessage: (fn: (payload: unknown) => Promise<void>) => {
          manejarMensaje = fn;
        },
      }),
    },
    console,
  });

  runInContext(CODIGO_SW, contexto);

  return {
    manejarMensaje,
    /** Dispara notificationclick y espera a lo que el handler pase a waitUntil. */
    async clicEnNotificacion(notificacion: NotificacionMostrada, action = "") {
      const handler = listeners.get("notificationclick");
      if (!handler) throw new Error("El Service Worker no registró notificationclick");

      let pendiente: Promise<unknown> = Promise.resolve();
      let cerrada = false;
      handler({
        action,
        notification: {
          data: notificacion.options.data,
          close: () => {
            cerrada = true;
          },
        },
        waitUntil: (p: Promise<unknown>) => {
          pendiente = p;
        },
      });
      await pendiente;
      return { cerrada };
    },
    mostradas,
    abiertas,
    listeners,
    get skipWaitingLlamado() {
      return skipWaitingLlamado;
    },
    get claimLlamado() {
      return claimLlamado;
    },
  };
}

/** Mensaje "data-only" tal como lo envía la Edge Function notify-event. */
function mensajeDeEvento(eventId: string, extra: Record<string, string> = {}) {
  return {
    data: {
      event_id: eventId,
      event_type: "FRAUDE",
      title: "Fraude Detectado",
      body: "Cámara: entrada_principal",
      url: `/event/${eventId}`,
      ...extra,
    },
  };
}

describe("Service Worker de push — notificaciones duplicadas", () => {
  it("muestra una sola notificación cuando el mismo evento llega dos veces", async () => {
    // Este es el fallo original: en cualquier teléfono llegaban dos avisos
    // del mismo evento de seguridad.
    const sw = cargarServiceWorker();

    await sw.manejarMensaje(mensajeDeEvento("evt-1"));
    await sw.manejarMensaje(mensajeDeEvento("evt-1"));

    expect(sw.mostradas).toHaveLength(1);
  });

  it("sigue mostrando una sola tras varias entregas repetidas", async () => {
    const sw = cargarServiceWorker();

    for (let i = 0; i < 5; i++) await sw.manejarMensaje(mensajeDeEvento("evt-1"));

    expect(sw.mostradas).toHaveLength(1);
  });

  it("muestra ambas cuando son eventos distintos", async () => {
    // La deduplicación no puede silenciar alertas legítimas.
    const sw = cargarServiceWorker();

    await sw.manejarMensaje(mensajeDeEvento("evt-1"));
    await sw.manejarMensaje(mensajeDeEvento("evt-2"));

    expect(sw.mostradas).toHaveLength(2);
    expect(sw.mostradas.map((n) => n.options.tag)).toEqual([
      "depthguard-event-evt-1",
      "depthguard-event-evt-2",
    ]);
  });

  it("no muestra nada si el mensaje trae bloque notification", async () => {
    // Un mensaje con `notification` ya lo pinta el SDK de Firebase por su
    // cuenta. Si además lo mostrásemos aquí, volverían los duplicados.
    const sw = cargarServiceWorker();

    await sw.manejarMensaje({
      notification: { title: "Fraude Detectado", body: "Cámara: entrada_principal" },
      data: { event_id: "evt-1" },
    });

    expect(sw.mostradas).toHaveLength(0);
  });

  it("no vuelve a sonar ante un duplicado (renotify desactivado)", async () => {
    const sw = cargarServiceWorker();

    await sw.manejarMensaje(mensajeDeEvento("evt-1"));

    expect(sw.mostradas[0].options.renotify).toBe(false);
  });
});

describe("Service Worker de push — contenido de la notificación", () => {
  it("toma título y cuerpo del bloque data, no de notification", async () => {
    const sw = cargarServiceWorker();

    await sw.manejarMensaje(mensajeDeEvento("evt-1"));

    expect(sw.mostradas[0].title).toBe("Fraude Detectado");
    expect(sw.mostradas[0].options.body).toBe("Cámara: entrada_principal");
  });

  it("no incluye emojis en el título", async () => {
    const sw = cargarServiceWorker();

    await sw.manejarMensaje(mensajeDeEvento("evt-1"));
    await sw.manejarMensaje(mensajeDeEvento("evt-2", { title: "Persona Desconocida" }));

    for (const { title } of sw.mostradas) {
      expect(title).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
    }
  });

  it("cae en textos genéricos si el mensaje llega incompleto", async () => {
    const sw = cargarServiceWorker();

    await sw.manejarMensaje({ data: { event_id: "evt-1" } });

    expect(sw.mostradas[0].title).toBe("DepthGuard");
    expect(sw.mostradas[0].options.body).toBe("Nuevo evento de seguridad");
  });

  it("enlaza al evento, y al panel cuando no hay identificador", async () => {
    const conId = cargarServiceWorker();
    await conId.manejarMensaje(mensajeDeEvento("evt-1"));
    expect(conId.mostradas[0].options.data.url).toBe("/event/evt-1");

    const sinId = cargarServiceWorker();
    await sinId.manejarMensaje({ data: {} });
    expect(sinId.mostradas[0].options.data.url).toBe("/dashboard");
  });
});

describe("Service Worker de push — clic en la notificación", () => {
  it("lleva a la ventana ya abierta en lugar de abrir otra", async () => {
    const ventana: Ventana = {
      url: "https://depthguard.app/dashboard",
      navegadoA: null,
      enfocada: false,
      async navigate(url: string) {
        this.navegadoA = url;
      },
      async focus() {
        this.enfocada = true;
      },
    };

    const sw = cargarServiceWorker([ventana]);
    await sw.manejarMensaje(mensajeDeEvento("evt-1"));
    const { cerrada } = await sw.clicEnNotificacion(sw.mostradas[0]);

    expect(cerrada).toBe(true);
    expect(ventana.navegadoA).toBe("/event/evt-1");
    expect(ventana.enfocada).toBe(true);
    expect(sw.abiertas).toHaveLength(0);
  });

  it("abre una ventana nueva si no hay ninguna", async () => {
    const sw = cargarServiceWorker([]);
    await sw.manejarMensaje(mensajeDeEvento("evt-1"));
    await sw.clicEnNotificacion(sw.mostradas[0]);

    expect(sw.abiertas).toEqual(["/event/evt-1"]);
  });

  it("la acción Descartar cierra sin navegar", async () => {
    const sw = cargarServiceWorker([]);
    await sw.manejarMensaje(mensajeDeEvento("evt-1"));
    const { cerrada } = await sw.clicEnNotificacion(sw.mostradas[0], "dismiss");

    expect(cerrada).toBe(true);
    expect(sw.abiertas).toHaveLength(0);
  });
});

describe("Service Worker de push — ciclo de vida", () => {
  it("se activa de inmediato sin esperar a que se cierren las pestañas", async () => {
    // Sin skipWaiting/claim, un teléfono con la PWA instalada seguiría
    // ejecutando la versión anterior del Service Worker: la que duplicaba.
    const sw = cargarServiceWorker();

    sw.listeners.get("install")?.({});
    await sw.listeners.get("activate")?.({ waitUntil: (p: Promise<unknown>) => p });

    expect(sw.skipWaitingLlamado).toBe(true);
  });
});
