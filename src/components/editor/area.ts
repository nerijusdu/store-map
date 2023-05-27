import p5 from 'p5';

import { round } from '@/utils/math';
import { Shape } from './types';
import { Coord } from './coord';
import { ImageMap } from './image-map';

export abstract class Area {

  /**
	 * @param {Shape} shape the type of area
	 * @param {Coord[]} coords the list of coordinates
	 * @param {string} href the link this area is going to point to
	 * @param {number} id the unique id
	 */
  constructor(
		protected shape: Shape,
		protected coords: Coord[] = [],
		protected href: string = '',
		protected title: string = '',
		public id: number = 0) {
  }

  static fromObject(o: unknown): Area {
    switch ((<Area>o).shape) {
      case 'rect':
        const r = o as AreaRect;
        return new AreaRect(r.coords.map(Coord.fromObject), r.href, r.title, r.id);
      case 'circle':
        const c = o as AreaCircle;
        return new AreaCircle(c.coords.map(Coord.fromObject), c.radius, c.href, c.title, c.id);
      case 'poly':
        const p = o as AreaPoly;
        return new AreaPoly(p.coords.map(Coord.fromObject), p.href, p.title, p.id, p.closed);
      case 'point':
        const pt = o as AreaPoint;
        return new AreaPoint(pt.coords.map(Coord.fromObject), pt.href, pt.title, pt.id);
      case 'default':
        const d = o as AreaDefault;
        return new AreaDefault(d.iMap, d.href, d.title);
      default:
        throw 'Not an area';
    }
  }

  getId(): number {
    return this.id;
  }

  setShape(shape: Shape): this {
    this.shape = shape;
    return this;
  }

  getShape(): Shape {
    return this.shape;
  }

  /**
	 * Adds a coordinate to the coords array, and returns it's new length
	 * @param {Coord} coord coordinate
	 */
  addCoord(coord: Coord): number {
    return this.coords.push(coord);
  }

  setCoords(coords: Coord[]): this {
    this.coords = coords;
    return this;
  }

  getCoords(): Coord[] {
    return this.coords;
  }

  /**
	 * Returns a copy of this area's coordinates list
	 */
  drawingCoords(): Coord[] {
    return this.coords.slice();
  }

  getPoints(): Coord[] {
    return this.coords;
  }

  isEmpty(): boolean {
    return this.coords.length == 0;
  }

  /**
	 * @param {Area} area 
	 */
  equals(area: Area): boolean {
    return this.id == area.id;
  }

  /**
	 * Retuns a deep copy of this area's coordinates
	 */
  copyCoords(): Coord[] {
    const copy: Coord[] = [];
    this.coords.forEach((val, index) => {
      copy[index] = new Coord(val.x, val.y);
    });
    return copy;
  }

  updateLastCoord(coord: Coord): this {
    this.coords[this.coords.length - 1] = coord;
    return this;
  }

  //------------------------ Start Interface Movable -------------------------------
  move(coord: Coord): void {
    const fcoord = this.firstCoord();
    if (coord != undefined) {
      fcoord.add(coord);
    }
  }

  getPosition(): Coord {
    return this.firstCoord();
  }

  setPosition(coord: Coord): void {
    const move = this.coords[0].diff(coord);
    this.move(move);
  }
  //------------------------- End Interface Movable --------------------------------

  isValidShape(): boolean {
    return this.isDrawable();
  }

  /**
	 * @param {Coord} coord 
	 * @param {number} tolerance
	 * @returns {Coord|false}
	 */
  isOverPoint(coord: Coord, tolerance: number): Coord | false {
    const point = this.getPoints().find(c => {
      return Coord.dist(coord, c) < tolerance;
    });
    return point ? point : false;
  }

  setHref(url: string): this {
    this.href = url;
    return this;
  }

  getHref(): string {
    return this.href;
  }

  getHrefVerbose(): string {
    return this.href === '' ? 'undefined' : this.href;
  }

  setTitle(title: string): this {
    this.title = title;
    return this;
  }

  getTitle(): string {
    return this.title;
  }

  setId(id: number): this {
    this.id = id;
    return this;
  }

  firstCoord(): Coord {
    return this.coords[0];
  }

  htmlCoords(dec: number, scale: number): string {
    return this.drawingCoords().map(c => {
      return c.toHtml(dec, scale);
    }).join(',');
  }

  toHtml(scale = 1): string {
    let htmlCoords = this.htmlCoords(0, scale);
    htmlCoords = htmlCoords ? `coords="${htmlCoords}"` : '';
    const href = this.href ? `href="${this.href}"` : 'nohref';
    const title = this.title ? `title="${this.title}"` : '';
    return `<area shape="${this.shape}" ${htmlCoords} ${href} alt="${this.href}" ${title} />`;
  }

  toSvg(scale = 1): string {
    return `<a xlink:href="${this.href}">${this.svgArea(scale)}</a>`;
  }

	abstract isDrawable(): boolean;
	abstract svgArea(scale: number): string;
	abstract isOver(coord: Coord): boolean;
	abstract display(p: p5): void;
}

export class AreaEmpty extends Area {
  constructor() {
    super('empty');
  }
  isDrawable(): boolean {
    return false;
  }

  svgArea(): string {
    return '';
  }

  isOver(): boolean {
    return false;
  }

  display(): void {
    return;
  }
}

export class AreaCircle extends Area {
  /**
	 * @param {Coord[]} coords the list of coordinates
	 * @param {number} radius radius of the circle
	 * @param {string} href the link this area is going to point to
	 * @param {number} id the unique id
	 */
  constructor(
    coords: Coord[] = [],
		public radius: number = 0,
		href = '',
		title = '',
		id = 0
  ) {
    super('circle', coords, href, title, id);
  }

  getCenter(): Coord {
    return this.firstCoord();
  }

  isValidShape(): boolean {
    return super.isValidShape() && this.radius > 0;
  }

  isDrawable(): boolean {
    return this.coords.length == 1;
  }

  isOver(coord: Coord): boolean {
    const center = this.getCenter();
    return Coord.dist(coord, center) < this.radius;
  }

  updateLastCoord(coord: Coord): this {
    const center = this.getCenter();
    this.radius = Coord.dist(center, coord);
    return this;
  }

  /**
	 * draw the area to the given p5 instance
	 * @param {p5} p5 
	 */
  display(p5: p5): void {
    p5.ellipse(this.getCenter().x, this.getCenter().y, this.radius * 2);
  }

  htmlCoords(dec: number, scale: number): string {
    return this.getCenter().toHtml(dec, scale) + ',' + round(this.radius, dec);
  }

  svgArea(scale: number): string {
    const x = this.coords[0].toStr(0, 'x', scale);
    const y = this.coords[0].toStr(0, 'y', scale);
    const r = round(this.radius, 0);
    return `<circle cx="${x}" cy="${y}" r="${r}" />`;
  }
}
export class AreaPoly extends Area {
  /**
	 * @param {Coord[]} coords the list of coordinates
	 * @param {string} href the link this area is going to point to
	 * @param {int} id the unique id
	 */
  constructor(
    coords: Coord[] = [],
    href = '',
    title = '',
    id = 0,
		public closed = false
  ) {
    super('poly', coords, href, title, id);
  }

  isDrawable(): boolean {
    return this.coords.length >= 2;
  }

  isValidShape(): boolean {
    return super.isValidShape() && this.closed;
  }

  isOver(coord: Coord): boolean {
    const x = coord.x;
    const y = coord.y;
    const cornersX = this.coords.map(c => { return c.x; });
    const cornersY = this.coords.map(c => { return c.y; });

    let i, j = cornersX.length - 1;
    let oddNodes = 0;

    const polyX = cornersX;
    const polyY = cornersY;

    for (i = 0; i < cornersX.length; i++) {
      if ((polyY[i] < y && polyY[j] >= y || polyY[j] < y && polyY[i] >= y) && (polyX[i] <= x || polyX[j] <= x)) {
        oddNodes ^= (polyX[i] + (y - polyY[i]) / (polyY[j] - polyY[i]) * (polyX[j] - polyX[i]) < x) ? 1 : 0;
      }
      j = i;
    }

    return Boolean(oddNodes);
  }

  isClosable(coord: Coord, tolerance: number): boolean {
    const dist = Coord.dist(coord, this.firstCoord());
    return this.coords.length >= 4 && dist < tolerance;
  }

  drawingCoords(): Coord[] {
    const coords = super.drawingCoords();
    if (this.closed) {
      coords.push(this.firstCoord());
    }
    return coords;
  }

  close(): this {
    this.closed = true;
    this.coords.pop();
    return this;
  }

  move(coord: Coord): void {
    this.coords.map(c => c.add(coord));
  }

  /**
	 * draw the area to the given p5 instance
	 * @param {p5} p5 
	 */
  display(p5: p5): void {
    p5.beginShape();
    this.drawingCoords().forEach(c => p5.vertex(c.x, c.y));
    p5.endShape();
  }

  svgArea(scale: number): string {
    const points = this.drawingCoords().map(c => {
      return c.toStr(0, 'x', scale) + ',' + c.toStr(0, 'y', scale);
    }).join(' ');
    return `<polygon points="${points}" />`;
  }
}

export class AreaRect extends AreaPoly {
  /**
	 * @param {Coord[]} coords the list of coordinates
	 * @param {string} href the link this area is going to point to
	 * @param {number} id the unique id
	 */
  constructor(
    coords: Coord[] = [],
    href = '',
    title = '',
    id = 0
  ) {
    super(coords, href, title, id, true);
    if (this.coords.length > 0 && this.coords.length < 4) {
      const coord = this.firstCoord();
      this.coords = [
        coord,
        coord.clone(),
        coord.clone(),
        coord.clone(),
      ];
    }
  }

  isValidShape(): boolean {
    return super.isValidShape() && !this.isNullArea();
  }

  private isNullArea(): boolean {
    return this.coords[0].x == this.coords[1].x || this.coords[0].y == this.coords[3].y;
  }

  updateLastCoord(coord: Coord): this {
    this.coords[1].x = coord.x;
    this.coords[2] = coord;
    this.coords[3].y = coord.y;
    return this;
  }

}

export class AreaDefault extends Area {
  protected isDefault = true;
  /**
	 * Constructor
	 * @param {string} href the link this area is going to point to
	 * @param {string} title the title on hover
	 */
  constructor(
		public iMap: ImageMap,
		href = '',
		title = ''
  ) {
    super('default', [], href, title);
  }

  isDrawable(): boolean {
    return true;
  }

  isOver(): boolean {
    return true;
  }

  /**
	 * draw the area to the given p5 instance
	 * @param {p5} p5 
	 */
  display(p5: p5): void {
    p5.rect(0, 0, this.iMap.width - 1, this.iMap.height - 1);
  }

  svgArea(): string {
    return '<rect x="0" y="0" width="100%" height="100%" />';
  }
}

export class AreaPoint extends Area {
  /**
   * @param {Coord[]} coords the list of coordinates
   * @param {string} href the link this area is going to point to
   * @param {number} id the unique id
   */
  constructor(
    coords: Coord[] = [],
    href = '',
    title = '',
    id = 0
  ) {
    super('point', coords, href, title, id);
  }

  isDrawable(): boolean {
    return this.coords.length == 1;
  }

  isOver(coord: Coord): boolean {
    return Coord.dist(coord, this.firstCoord()) < 5;
  }

  display(p: p5): void {
    p.circle(this.firstCoord().x, this.firstCoord().y, 5);
  }

  svgArea(scale: number): string {
    const x = this.coords[0].toStr(0, 'x', scale);
    const y = this.coords[0].toStr(0, 'y', scale);
    return `<circle cx="${x}" cy="${y}" r="5" fill="red" />`;
  }
}