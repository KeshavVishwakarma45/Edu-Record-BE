// Turns the validated list query (?page, limit, sort, search) into Mongoose options.
// Used by every list service so paging and search behave the same in every module.

// Escape the user's text so "B.Com" searches for a dot, not "any character"
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// searchFilter('bca', ['name', 'shortCode']) -> { $or: [{ name: /bca/i }, { shortCode: /bca/i }] }
export function searchFilter(search, fields) {
  if (!search) return {};
  const pattern = new RegExp(escapeRegex(search), 'i');
  return { $or: fields.map((field) => ({ [field]: pattern })) };
}

// '-name' -> { name: -1 };  'name' -> { name: 1 }. _id is added so equal values keep a stable order.
export function sortOption(sort) {
  const field = sort.startsWith('-') ? sort.slice(1) : sort;
  return { [field]: sort.startsWith('-') ? -1 : 1, _id: 1 };
}

export function pageOptions({ page, limit }) {
  return { skip: (page - 1) * limit, limit };
}
