/** Match sticky `left` on column 2 to the pixel width of column 1 or headers overlap when scrolling. */
export const STICKY_ROW_W = 120
export const STICKY_STATUS_W = 152
/** Pull status column slightly under row to close subpixel gaps (avoids bleed-through when scrolling). */
export const STICKY_COL_OVERLAP = 2

export const STICKY_ROW_LEFT_STYLE = {
  left: 0,
  width: STICKY_ROW_W,
  minWidth: STICKY_ROW_W,
  maxWidth: STICKY_ROW_W,
} as const

export const STICKY_STATUS_LEFT_STYLE = {
  left: STICKY_ROW_W - STICKY_COL_OVERLAP,
  width: STICKY_STATUS_W + STICKY_COL_OVERLAP,
  minWidth: STICKY_STATUS_W + STICKY_COL_OVERLAP,
  maxWidth: STICKY_STATUS_W + STICKY_COL_OVERLAP,
} as const
