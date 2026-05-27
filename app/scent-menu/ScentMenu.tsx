// Shared render for the illustrated "bistro" scent menu — a fancier,
// menu-presentation sibling of the plain ScentDescriptions sheet. Same
// scent + description content, dressed as a framed two-column tasting menu.
// Used by /scent-menu/print (paper).

type ScentRow = {
  id: string
  name: string
  description: string | null
}

export function ScentMenu({
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
    <div className="sm-menu-frame">
      {/* Corner flourishes */}
      <span className="sm-menu-corner tl">&#10086;</span>
      <span className="sm-menu-corner tr">&#10086;</span>
      <span className="sm-menu-corner bl">&#10086;</span>
      <span className="sm-menu-corner br">&#10086;</span>

      <div className="sm-menu-inner">
        <header className="sm-menu-head">
          <div className="sm-menu-crest">
            <span className="fl">&#10086;</span>
            <span className="sm-menu-name">{storeName}</span>
            <span className="fl">&#10087;</span>
          </div>
          <div className="sm-menu-sub">Scent Menu</div>
          <div className="sm-menu-rule" />
          <p className="sm-menu-note">
            A little about how each one smells &mdash; find your favorite.
          </p>
        </header>

        {scents.length === 0 ? (
          <p className="sm-menu-empty">No scents selected for the menu.</p>
        ) : (
          <div className="sm-menu-list">
            {scents.map((s) => (
              <div key={s.id} className="sm-menu-item">
                <h3 className="sm-menu-item-name">{s.name}</h3>
                <p className="sm-menu-item-desc">
                  {s.description?.trim() || (
                    <span className="muted">(description coming soon)</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}

        <footer className="sm-menu-foot">
          <span className="fl">&#10086;</span>
          {phone && <span>{phone}</span>}
          {email && <span>{email}</span>}
          {social && <span>{social}</span>}
          <span className="fl">&#10087;</span>
        </footer>
      </div>
    </div>
  )
}
