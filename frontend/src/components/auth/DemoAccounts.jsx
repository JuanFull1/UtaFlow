
const demoAccounts = [
  {
    rol: "Experto",
    correo: "experto1@changeflow.test",
    clave: "UtaFlowDemo2026!",
  },
  {
    rol: "Comité",
    correo: "comite1@changeflow.test",
    clave: "UtaFlowDemo2026!",
  },
];

export default function DemoAccounts() {
  if (!import.meta.env.DEV) return null;

  return (
    <section className="demo-accounts" aria-label="Cuentas de prueba">
      <h3>Cuentas de prueba</h3>
      

      {demoAccounts.map((cuenta) => (
        <div className="demo-account" key={cuenta.correo}>
          <strong>{cuenta.rol}</strong>
          <span>{cuenta.correo}</span>
          <span>Contraseña: {cuenta.clave}</span>
        </div>
      ))}
    </section>
  );
}
