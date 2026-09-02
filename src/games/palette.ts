/**
 * The shared visual vocabulary every game draws from: a handful of plain
 * shapes and strongly separated colours.
 *
 * Glyphs rather than images or canvas — they stay crisp at any screen density,
 * scale with the type size, and need nothing downloaded.
 */

export interface Swatch {
  name: string;
  hex: string;
}

/**
 * Chosen to stay distinguishable for the most common colour-vision
 * deficiency: no red/green pair carries meaning on its own.
 */
export const COLOURS: readonly Swatch[] = [
  { name: 'red', hex: '#D64545' },
  { name: 'blue', hex: '#2F6FB5' },
  { name: 'yellow', hex: '#DB9A16' },
  { name: 'purple', hex: '#7B5EA7' },
  { name: 'green', hex: '#3F8F5B' },
] as const;

export interface ShapeSpec {
  name: string;
  glyph: string;
}

export const SHAPES: readonly ShapeSpec[] = [
  { name: 'circle', glyph: '●' },
  { name: 'square', glyph: '■' },
  { name: 'triangle', glyph: '▲' },
  { name: 'star', glyph: '★' },
  { name: 'heart', glyph: '♥' },
  { name: 'diamond', glyph: '◆' },
] as const;

export function shapeByName(name: string): ShapeSpec {
  return SHAPES.find((shape) => shape.name === name) ?? SHAPES[0];
}

export function colourByName(name: string): Swatch {
  return COLOURS.find((colour) => colour.name === name) ?? COLOURS[0];
}
