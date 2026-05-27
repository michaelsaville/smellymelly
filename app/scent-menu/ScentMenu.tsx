// Shared render for the illustrated "bistro" scent menu — a fancier,
// menu-presentation sibling of the plain ScentDescriptions sheet. Same
// scent + description content, dressed as a framed two-column tasting menu.
// Used by /scent-menu/print (paper).
//
// The menu is paginated into discrete <section.sm-menu-page> blocks so that
// every printed sheet carries its OWN complete border + corner flourishes
// (a single spanning frame only draws a top edge on page 1 and a bottom edge
// on the last page). The final page centers its leftover items both ways.

type ScentRow = {
  id: string
  name: string
  description: string | null
}

// Conservative per-sheet item counts. The first page gives up room to the
// header/crest, so it holds fewer than the continuation pages. Descriptions
// run ~180 chars (≈4 lines, some 6), so each two-column entry is ~1.2–1.4in
// tall — these counts are sized so a full page's items fit within one sheet
// (the .sm-menu-page height cap in CSS is the hard backstop). 47 scents →
// 10 / 13 / 13 / 11 across 4 sheets. Bump only if descriptions get shorter.
const FIRST_PAGE_ITEMS = 10
const REST_PAGE_ITEMS = 13

function paginate(scents: ScentRow[]): ScentRow[][] {
  if (scents.length === 0) return [[]]
  const pages: ScentRow[][] = [scents.slice(0, FIRST_PAGE_ITEMS)]
  for (let i = FIRST_PAGE_ITEMS; i < scents.length; i += REST_PAGE_ITEMS) {
    pages.push(scents.slice(i, i + REST_PAGE_ITEMS))
  }
  return pages
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
  const pages = paginate(scents)

  return (
    <>
      {pages.map((pageScents, pi) => {
        const isFirst = pi === 0
        const isLast = pi === pages.length - 1
        return (
          <section
            key={pi}
            className={`sm-menu-page${isLast ? ' is-last' : ''}`}
          >
            {/* Corner flourishes — per page so the border reads as closed */}
            <span className="sm-menu-corner tl">&#10086;</span>
            <span className="sm-menu-corner tr">&#10086;</span>
            <span className="sm-menu-corner bl">&#10086;</span>
            <span className="sm-menu-corner br">&#10086;</span>

            <div className="sm-menu-inner">
              <div className="sm-menu-pagebody">
                {isFirst && (
                  <header className="sm-menu-head">
                    <div className="sm-menu-crest">
                      <span className="fl">&#10086;</span>
                      <span className="sm-menu-name">{storeName}</span>
                      <span className="fl">&#10087;</span>
                    </div>
                    <div className="sm-menu-sub">Scent Menu</div>
                    <div className="sm-menu-rule" />
                    <p className="sm-menu-note">
                      A little about how each one smells &mdash; find your
                      favorite.
                    </p>
                  </header>
                )}

                {pageScents.length === 0 ? (
                  <p className="sm-menu-empty">No scents selected for the menu.</p>
                ) : (
                  <div className="sm-menu-list">
                    {pageScents.map((s) => (
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

                {isLast && (
                  <footer className="sm-menu-foot">
                    <span className="fl">&#10086;</span>
                    {phone && <span>{phone}</span>}
                    {email && <span>{email}</span>}
                    {social && <span>{social}</span>}
                    <span className="fl">&#10087;</span>
                  </footer>
                )}
              </div>
            </div>
          </section>
        )
      })}
    </>
  )
}
