export const FEATURED_SERVICE_GUIDE_ID = 'guida-al-servizio';

export function belongsToGuideCategory(item, category) {
  return item?.id !== FEATURED_SERVICE_GUIDE_ID && item?.category === category;
}

export function orderGuideItems(items) {
  return items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((left, right) => {
      const leftOrder = Number.isFinite(left.item.sortOrder) ? left.item.sortOrder : null;
      const rightOrder = Number.isFinite(right.item.sortOrder) ? right.item.sortOrder : null;

      if (leftOrder === null && rightOrder === null) {
        return left.originalIndex - right.originalIndex;
      }
      if (leftOrder === null) return 1;
      if (rightOrder === null) return -1;
      return leftOrder - rightOrder || left.originalIndex - right.originalIndex;
    })
    .map(({ item }) => item);
}