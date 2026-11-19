export const SortDirection = Object.freeze({
  Asc: 'asc',
  Desc: 'desc',
});

export type SortDirection = (typeof SortDirection)[keyof typeof SortDirection];
