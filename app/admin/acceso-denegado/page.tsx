import { SignOutButton } from "@/components/admin/sign-out-button";

export default function AccesoDenegadoPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-chip-bad text-2xl text-chip-bad-ink">
          !
        </div>
        <h1 className="text-xl font-bold">Acceso denegado</h1>
        <p className="mb-6 mt-2 text-[13.5px] text-muted">
          Tu cuenta no tiene rol de administrador. Si crees que es un error, pide acceso a quien
          gestiona el sistema.
        </p>
        <SignOutButton variant="outline" />
      </div>
    </main>
  );
}
