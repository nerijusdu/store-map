import p5 from 'p5';
import { Coord } from './coord';

export type Shape = 'empty' | 'rect' | 'circle' | 'poly' | 'default' | 'point';

export type Axle = 'x'|'y';

export interface Movable {
	move(coord: Coord): void;
	getPosition(): Coord;
	setPosition(coord: Coord): void;
}

export type Tool = 'polygon' | 'rectangle' | 'circle' | 'select' | 'delete' | 'test' | 'point';
export type Image = {
	data: p5.Image|null,
	file: p5.File|null,
};
export type ToolLabel = {
	key: string,
	value: Tool,
};
export type View = { scale: number, transX: number, transY: number, };
export type Zoom = { min: number, max: number, sensativity: number, };
