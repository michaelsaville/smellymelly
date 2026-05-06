// Shared render for the printable scent-descriptions paper form. Used by
// /scent-descriptions (web preview) and /scent-descriptions/print (paper).
// Mirrors how ScentSheet is shared between /scent-sheet and /scent-sheet/print.

type ScentRow = {
  id: string
  name: string
  description: string | null
}

export function ScentDescriptions({
  scents,
  storeName,
  phone,
  email,
  social,
}: {
  scents: ScentRow[]
  storeName: string
  phone?: string | null
  email?: string | null
  social?: string | null
}) {
  return (
    <div className="sm-descriptions-wrap">
      <div className="sm-descriptions-header">
        <div className="sm-descriptions-logo">{storeName}</div>
        <div className="sm-descriptions-tagline">Scent Descriptions</div>
        <div className="sm-descriptions-divider" />
      </div>

      <ol className="sm-descriptions-list">
        {scents.map((s) => (
          <li key={s.id} className="sm-descriptions-item">
            <h3 className="sm-descriptions-name">{s.name}</h3>
            <p className="sm-descriptions-body">
              {s.description?.trim() || (
                <span className="sm-descriptions-empty">
                  (description not yet written)
                </span>
              )}
            </p>
          </li>
        ))}
      </ol>

      <div className="sm-descriptions-footer">
        {phone && <span>{phone}</span>}
        {email && <span>{email}</span>}
        {social && <span>{social}</span>}
      </div>
    </div>
  )
}
