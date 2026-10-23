/**
 * The builder's list as it was last left (its tab, page, search and filters, in the address): the
 * editors' back arrows return to it, so going into a test or a part and back keeps the page.
 */
export function useBuilderList() {
  return useState<string | null>('builder-list', () => null)
}
