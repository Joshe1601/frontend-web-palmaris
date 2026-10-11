export const DNI_REGEX = /^\d{8}$/;
export const PASSWORD_MIN = 6;

/** Email sintético con el que el chofer inicia sesión en la app móvil (usuario = DNI). */
export function emailDeChofer(dni: string) {
  return `${dni}@palmaris.app`;
}
