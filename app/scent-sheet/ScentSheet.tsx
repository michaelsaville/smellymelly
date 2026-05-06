// Shared render for the printable scent sheet. Used by /scent-sheet
// (web) and /scent-sheet/print (paper). Mirrors how MenuCards is
// shared between /menu and /menu/print.

type CategoryIcon = {
  id: string
  name: string
  icon: string
  isImage: boolean
}

type ScentRow = {
  id: string
  name: string
  categoryIds: string[]
}

export function ScentSheet({
  scents,
  categories,
  storeName,
  phone,
  email,
  social,
}: {
  scents: ScentRow[]
  categories: CategoryIcon[]
  storeName: string
  phone?: string | null
  email?: string | null
  social?: string | null
}) {
  const catMap = new Map(categories.map((c) => [c.id, c]))

  return (
    <div className="sm-sheet-wrap">
      <div className="sm-sheet-header">
        <div className="sm-sheet-logo">{storeName}</div>
        <div className="sm-sheet-tagline">Available Scents</div>
        <div className="sm-sheet-divider" />
        <div className="sm-sheet-contact">
          {phone && <span>{phone}</span>}
          {phone && (email || social) && <span className="sep">·</span>}
          {email && <span>{email}</span>}
          {email && social && <span className="sep">·</span>}
          {social && <span>{social}</span>}
        </div>
        {categories.length > 0 && (
          <div className="sm-sheet-key">
            <span className="sm-sheet-key-label">Key:</span>
            {categories.map((c) => (
              <span key={c.id} className="sm-sheet-key-item">
                {c.isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.icon} alt="" />
                ) : (
                  <span className="ico">{c.icon}</span>
                )}
                {c.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="sm-sheet-list">
        {scents.length === 0 ? (
          <p className="sm-sheet-empty">No active scents.</p>
        ) : (
          scents.map((s) => (
            <div key={s.id} className="sm-sheet-row">
              <span className="sm-sheet-name">{s.name}</span>
              <span className="sm-sheet-icons">
                {s.categoryIds.length === 0 ? (
                  <span className="sm-sheet-none">—</span>
                ) : (
                  s.categoryIds.map((cid) => {
                    const c = catMap.get(cid)
                    if (!c) return null
                    return c.isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={cid}
                        src={c.icon}
                        alt={c.name}
                        title={c.name}
                      />
                    ) : (
                      <span key={cid} className="ico" title={c.name}>
                        {c.icon}
                      </span>
                    )
                  })
                )}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="sm-sheet-footer">
        <span>{scents.length}</span> scents available · Custom scents
        on request
      </div>
    </div>
  )
}
