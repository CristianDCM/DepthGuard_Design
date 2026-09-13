import { describe, it, expect, afterEach, vi } from "vitest";

// El módulo importa firebase/messaging y el cliente de Supabase en cuanto se
// carga. Aquí solo se verifica getPushStatus, que es lógica pura de
// detección de capacidades, así que las dependencias de red se sustituyen.
vi.mock("firebase/messaging", () => ({
  getToken: vi.fn(),
  deleteToken: vi.fn(),
  onMessage: vi.fn(),
}));
vi.mock("./firebase", () => ({
  getFirebaseMessaging: vi.fn(async () => null),
  VAPID_KEY: "test-vapid-key",
}));
vi.mock("./supabase", () => ({ supabase: {} }));

const { getPushStatus } = await import("./pushNotifications");

/** Simula un navegador con o sin soporte para notificaciones push. */
function simularNavegador(opciones: {
  serviceWorker?: boolean;
  notification?: NotificationPermission | null;
}) {
  if (opciones.serviceWorker === false) {
    vi.stubGlobal("navigator", {});
  } else {
    vi.stubGlobal("navigator", { serviceWorker: {} });
  }

  if (opciones.notification === null) {
    vi.stubGlobal("window", {});
  } else {
    const Notification = { permission: opciones.notification };
    vi.stubGlobal("Notification", Notification);
    vi.stubGlobal("window", { Notification });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getPushStatus", () => {
  it("reporta 'unsupported' si el navegador no tiene Service Workers", () => {
    // Caso real: navegación privada, o iOS sin la PWA instalada.
    simularNavegador({ serviceWorker: false, notification: "granted" });
    expect(getPushStatus()).toBe("unsupported");
  });

  it("reporta 'unsupported' si no existe la API de notificaciones", () => {
    simularNavegador({ serviceWorker: true, notification: null });
    expect(getPushStatus()).toBe("unsupported");
  });

  it.each(["granted", "denied", "default"] as const)(
    "refleja el permiso '%s' concedido por el navegador",
    (permiso) => {
      simularNavegador({ serviceWorker: true, notification: permiso });
      expect(getPushStatus()).toBe(permiso);
    }
  );
});
