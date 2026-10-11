import Image from "next/image";
import { LoginForm } from "@/components/admin/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-sm">
        <Image
          src="/brand/logo.png"
          alt="Grupo Palmaris"
          width={1280}
          height={853}
          priority
          className="mx-auto mb-4 w-48 mix-blend-multiply"
        />
        <h1 className="text-center text-xl font-bold">Panel de administración</h1>
        <p className="mb-6 mt-1 text-center text-[13.5px] text-muted">
          Ingresa con tu correo y contraseña.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
