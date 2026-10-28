
export default function SelectorTarjetas({
  titulo,
  opciones = [],
  valor = '',
  onChange,
  disabled = false,
}) {
  return (
    <fieldset
      className="uf-choice-fieldset"
      disabled={disabled}
    >
      <legend>{titulo}</legend>

      <div className="uf-choice-group">
        {opciones.map((opcion) => {
          const activo =
            String(valor) === String(opcion.valor)

          return (
            <button
              key={opcion.valor}
              type="button"
              className={`uf-choice ${
                activo ? 'uf-choice-active' : ''
              }`}
              onClick={() =>
                onChange(String(opcion.valor))
              }
              disabled={disabled}
              aria-pressed={activo}
            >
              <strong>{opcion.etiqueta}</strong>

              {opcion.descripcion && (
                <small>
                  {opcion.descripcion}
                </small>
              )}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
