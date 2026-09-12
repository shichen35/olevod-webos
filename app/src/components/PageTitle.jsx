// Page heading for the personal tabs — the same treatment as a home shelf's
// row title, so 收藏 on its own tab reads like 我的收藏 on the home page.
export default function PageTitle({ className = '', children }) {
  return <h2 className={`mb-[18px] text-heading font-semibold text-fg ${className}`}>{children}</h2>
}
