/*
 * 收藏 tab: a 6-column card grid fed live from the favorites store, starting
 * at row 0 of the tab's content group.
 */
import CardGrid from '../components/CardGrid.jsx'
import { useStoreValue } from '../hooks/useStore.js'
import { favoritesStore } from '../store/favorites.js'

export default function FavoritesPage({ group = 'content', onOpenDetail }) {
  const favorites = useStoreValue(favoritesStore)
  return <CardGrid items={favorites} group={group} onOpenDetail={onOpenDetail} />
}
