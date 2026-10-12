/**
 * 多酒店行程里「一段住宿」的认定:同一物业 + 同一组入离日期。
 *
 * 后端一个房型一笔预订(`order_main`),所以一个 Trip 的预订行要先按段归并,
 * 页面上才是「Stay 1 / Stay 2」而不是一行一个房型。
 * 行程详情、预订详情、「我的预订」的「Multi Booking (N Stay)」都用这一份口径。
 */

interface StayRow {
  property_id: number;
  use_date: string | null;
  end_date: string | null;
}

export function stayKeyOf(row: StayRow): string {
  return `${row.property_id}|${row.use_date ?? ''}|${row.end_date ?? ''}`;
}

/** 按段归并,段与段内的顺序都保持传入顺序(后端已按入住日排好) */
export function groupStays<T extends StayRow>(rows: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = stayKeyOf(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.values()];
}
