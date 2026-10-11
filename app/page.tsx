import Link from "next/link";

// Marcador de posición: aquí irá la landing. Por ahora solo enlaza al panel.
export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center">
      <Link
        href="/admin"
        className="rounded-xl bg-forest px-6 py-3 font-bold text-white hover:bg-forest-deep"
      >
        Ir al panel de administración
      </Link>
    </main>
  );
}
