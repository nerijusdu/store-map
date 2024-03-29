const version = '1.0.0';
import p5 from 'p5';
import { ImageMap } from './image-map';
import { BgLayer } from './bg-layer';
import { Area, AreaCircle, AreaRect, AreaPoly, AreaEmpty, AreaPoint } from './area';
import { Coord } from './coord';
import { Movement } from './selection';
//@ts-ignore no types for this lib
import UndoManager from 'undo-manager';
import QuickSettings, { QuickSettingsPanel } from 'quicksettings';
//@ts-ignore no types for this lib
// import * as ContextMenu from '../lib/contextmenu/contextmenu';
// import '../lib/contextmenu/contextmenu.css';
import { Tool, View, Zoom, Image } from './types';

export class Save {
  constructor (public version: string, public map: ImageMap) {}
}

type OnSelect = (target: Element, key: unknown, item: HTMLElement, area: Area) => void;  
type MenuItem = {
  label: string;
  onSelect: OnSelect;
  enabled?: boolean;
}
type Menu = {
  Delete: OnSelect;
  SetUrl: MenuItem;
  SetTitle: MenuItem;
  MoveFront: MenuItem;
  MoveBack: MenuItem;
}

export class ImageMapCreator {
  protected width: number;
  protected height: number;
  protected tool: Tool;
  protected drawingTools: Tool[];
  protected settings!: QuickSettingsPanel;
  protected areaSettings: QuickSettingsPanel | null;
  protected menu: Menu = {
    SetUrl: {
      onSelect: (_1, _2, _3, area) => { this.setAreaUrl(area); },
      label: 'Set url',
    },
    SetTitle: {
      onSelect: (_1, _2, _3, area) => { this.setAreaTitle(area); },
      label: 'Set title',
    },
    Delete: (_1, _2, _3, area) => { this.deleteArea(area); },
    MoveFront: {
      onSelect: (_1, _2, _3, area) => { this.moveArea(area, -1); },
      enabled: true,
      label: 'Move Forward',
    },
    MoveBack: {
      onSelect: (_1, _2, _3, area) => { this.moveArea(area, 1); },
      enabled: true,
      label: 'Move Backward',
    },
  };
  protected tempArea: Area;
  protected movement: Movement;
  protected selectedArea: Area|null;
  protected hoveredArea: Area|null;
  protected hoveredPoint: Coord|null;
  public map: ImageMap;
  protected undoManager: UndoManager;
  protected img: Image;
  public view: View;
  protected zoomParams: Zoom;
  protected magnetism: boolean;
  protected fusion: boolean;
  protected tolerance: number;
  protected bgLayer: BgLayer;
  public p5: p5;

  constructor(element: HTMLDivElement, width = 600, height = 450) {
    this.width = width;
    this.height = height;
    this.tool = 'polygon';
    this.drawingTools = ['rectangle', 'circle', 'polygon'];
    this.areaSettings = null;
    this.tempArea = new AreaEmpty();
    this.movement = new Movement();
    this.selectedArea = null;
    this.hoveredArea = null;
    this.hoveredPoint = null;
    this.map = new ImageMap(width, height);
    this.undoManager = new UndoManager();
    this.img = { data: null, file: null };
    this.view = {
      scale: 1,
      transX: 0,
      transY: 0,
    };
    this.zoomParams = {
      min: 0.03,
      max: 3,
      sensativity: 0.001,
    };
    this.magnetism = true;
    this.fusion = false;
    this.tolerance = 6;
    this.bgLayer = new BgLayer(this);
    // Must be the last instruction of the constructor.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const p5 = require('p5');
    this.p5 = new p5(this.sketch.bind(this), element);
  }

  //---------------------------- p5 Sketch ----------------------------------

  /**
	 * Override p5 methods
	 * @param {p5} p5
	 */
  private sketch(p5: p5): void {
    // Set this.p5 also in sketch() (fix for #30).
    this.p5 = p5;

    p5.setup = this.setup.bind(this);
    p5.draw = this.draw.bind(this);

    p5.mousePressed = this.mousePressed.bind(this);
    p5.mouseDragged = this.mouseDragged.bind(this);
    p5.mouseReleased = this.mouseReleased.bind(this);
    p5.mouseWheel = this.mouseWheel.bind(this);
    //@ts-ignore p5 types didn't specify the KeyBoardEvent nor the boolean return type
    p5.keyPressed = this.keyPressed.bind(this);
  }

  //---------------------------- p5 Functions ----------------------------------

  private setup(): void {
    const canvas = this.p5.createCanvas(this.width, this.height);
    canvas.drop(this.handeFile.bind(this)).dragLeave(this.onLeave.bind(this)).dragOver(this.onOver.bind(this));
    //@ts-ignore p5 types does not specify the canvas attribute
    this.settings = QuickSettings.create(this.p5.width + 5, 0, 'Image-map Creator', this.p5.canvas.parentElement)
      .setDraggable(false)
      .addText('Map Name', '', (v: string) => { this.map.setName(v); })
      .addDropDown('Tool', ['polygon', 'rectangle', 'circle', 'move', 'delete', 'point', 'select'], v => { 
        this.setTool(v.value); 
        if (this.areaSettings) {
          this.selectedArea = null;
          this.areaSettings.destroy();
          this.areaSettings = null;
        }
      })
      .addBoolean('Default Area', this.map.hasDefaultArea, (v: boolean) => { this.setDefaultArea(v); })
      .addButton('Undo', this.undoManager.undo)
      .addButton('Redo', this.undoManager.redo)
      .addButton('Clear', this.clearAreas.bind(this))
      .addButton('Generate Html', () => { this.settings.setValue('Output', this.map.toHtml()); })
      .addButton('Generate Svg', () => { this.settings.setValue('Output', this.map.toSvg()); })
      .addButton('Generate Json', () => { this.settings.setValue('Output', this.exportMap()); })
      .addTextArea('Input', '')
      .addButton('Load', this.load.bind(this))
      .addTextArea('Output', '');
    //@ts-ignore
    this.p5.canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); });
    // @ts-ignore
    this.p5.canvas.addEventListener('mousedown', (e) => { e.preventDefault(); });
    document.getElementById('Output')?.setAttribute('onFocus', 'this.select();');
  }

  private draw(): void {
    this.updateTempArea();
    this.updateHovered();
    this.setCursor();
    this.setOutput();
    this.setBackground();
    this.setTitle(this.hoveredArea);
    this.p5.translate(this.view.transX, this.view.transY);
    this.p5.scale(this.view.scale);
    this.drawImage();
    this.bgLayer.display();
    this.drawAreas();
  }

  //------------------------------ p5 Events -----------------------------------

  private mousePressed(): void {
    if (this.mouseIsHoverSketch()) {
      const coord = this.drawingCoord();
      if (this.p5.mouseButton == this.p5.LEFT /* && !ContextMenu.isOpen() */) {
        switch (this.tool) {
          case 'circle':
          case 'rectangle':
            this.setTempArea(coord);
            break;
          case 'polygon':
            const areaPoly = this.tempArea as unknown as AreaPoly;
            if (areaPoly.isEmpty()) {
              this.setTempArea(coord);
            } else if (areaPoly.isClosable(this.mCoord(), this.tolerance / this.view.scale)) {
              areaPoly.close();
              if (areaPoly.isValidShape())
                this.createArea(areaPoly);
              this.tempArea = new AreaEmpty();
            } else {
              this.tempArea.addCoord(this.mCoord());
            }
            break;
          case 'move':
            console.log(this.hoveredArea, this.hoveredPoint);
            if (this.hoveredPoint !== null) {
              this.movement.addPoint(this.hoveredPoint);
              this.movement.registerArea(this.hoveredArea!);
              this.movement.resetOrigin(this.hoveredPoint);
            } else if (this.hoveredArea !== null) {
              this.movement.addArea(this.hoveredArea);
              this.movement.resetOrigin(this.mCoord());
            }
            break;
          case 'point':
            const areaPoint = new AreaPoint([this.mCoord()]);
            this.createArea(areaPoint);
            break;
          case 'select':
            if (this.areaSettings) {
              this.areaSettings.destroy();
              this.areaSettings = null;
              this.selectedArea = null;
            }

            if (this.hoveredArea) {
              this.selectedArea = this.hoveredArea;
              // @ts-ignore
              this.areaSettings = QuickSettings.create(this.p5.width + 210, 0, 'Area settings', this.p5.canvas.parentElement)
                .setDraggable(false)
                .addText('Title', this.selectedArea.getTitle(), (v: string) => { this.selectedArea?.setTitle(v); })
                .addText('Url', this.selectedArea.getHref(), (v: string) => { this.selectedArea?.setHref(v); });
            }             
            break;
        }
      }
    }
  }

  private mouseDragged(): void {
    if (this.mouseIsHoverSketch() /* && !ContextMenu.isOpen() */) {
      if (this.p5.mouseButton == this.p5.LEFT) {
        switch (this.tool) {
          case 'move':
            this.movement.setPosition(this.drawingCoord());
            break;
        }
      } else if (this.p5.mouseButton == this.p5.CENTER) {
        this.view.transX += this.p5.mouseX - this.p5.pmouseX;
        this.view.transY += this.p5.mouseY - this.p5.pmouseY;
      }
    }
  }

  private mouseReleased(): void {
    switch (this.tool) {
      case 'rectangle':
      case 'circle':
        if (this.tempArea.isValidShape())
          this.createArea(this.tempArea);
        this.tempArea = new AreaEmpty();
        break;
      case 'move':
        const selection = this.movement;
        if (!selection.isEmpty()) {
          const move = this.movement.distToOrigin();
          this.undoManager.add({
            undo: () => selection.move(move.invert()),
            redo: () => selection.move(move),
          });
        }
        this.movement = new Movement();
        break;
    }
    this.onClick();
    this.bgLayer.disappear();
  }

  private mouseWheel(e: WheelEvent): boolean {
    if (this.mouseIsHoverSketch()) {
      const coefZoom = this.view.scale * this.zoomParams.sensativity * - e.deltaY;
      this.zoom(coefZoom);
      return false;
    }
    return true;
  }

  private keyPressed(e: KeyboardEvent): boolean {
    if (e.composed && e.ctrlKey) {
      switch (e.key) {
        case 's':
          this.save();
          break;
        case 'z':
          this.undoManager.undo();
          break;
        case 'y':
          this.undoManager.redo();
          break;
        default:
          return true;
      }
      return false;
    } else if (
      this.tool == 'polygon' &&
			//@ts-ignore p5 types didn't specify the ESCAPE keycode
			e.keyCode == this.p5.ESCAPE
    ) {
      this.tempArea = new AreaEmpty();
      return false;
    }
    return true;
  }

  //---------------------------- Functions ----------------------------------

  trueX(coord: number): number {
    return (coord - this.view.transX) / this.view.scale;
  }

  trueY(coord: number): number {
    return (coord - this.view.transY) / this.view.scale;
  }

  mX(): number {
    return this.trueX(this.p5.mouseX);
  }

  mY(): number {
    return this.trueY(this.p5.mouseY);
  }

  /**
	 * Get the true coordinate of the mouse relative to the imageMap
	 */
  mCoord(): Coord {
    return new Coord(this.mX(), this.mY());
  }

  /**
	 * Get the coordinate of the mouse for drawing
	 */
  drawingCoord(): Coord {
    let coord = this.mCoord();
    coord = this.magnetism ? this.hoveredPoint ? this.hoveredPoint : coord : coord;
    if (!this.fusion) {
      coord = coord.clone();
    }
    return coord;
  }

  mouseIsHoverSketch(): boolean {
    return this.p5.mouseX <= this.p5.width && this.p5.mouseX >= 0 && this.p5.mouseY <= this.p5.height && this.p5.mouseY >= 0;
  }

  /**
	 * Sets hoveredPoint and hoveredArea excluding currently selected Areas
	 */
  updateHovered(): void {
    this.hoveredPoint = null;
    const allAreas = this.map.getAreas();
    const area = allAreas.find((a: Area): boolean => {
      if (this.movement.containsArea(a)) {
        return false;
      }
      if (a.isOver(this.mCoord())) {
        return true;
      }
      return false;
    });
    if (this.p5.mouseIsPressed) return;
    this.hoveredArea = area ? area : null;
  }

  onClick(): void {
    if (this.mouseIsHoverSketch()) {
      if (this.hoveredArea) {
        if (this.p5.mouseButton == this.p5.RIGHT) {
          this.movement.addArea(this.hoveredArea);
          this.menu.MoveFront.enabled = !(this.map.isFirstArea(this.hoveredArea.id) || this.hoveredArea.getShape() == 'default');
          this.menu.MoveBack.enabled = !(this.map.isLastArea(this.hoveredArea.id) || this.hoveredArea.getShape() == 'default');
          // ContextMenu.display(event, this.menu, {
          //   position: 'click',
          //   data: this.hoveredArea,
          // });
          // return false; // doesn't work as expected
        } else if (this.p5.mouseButton == this.p5.LEFT /* && !ContextMenu.isOpen() */) {
          switch (this.tool) {
            case 'delete':
              this.deleteArea(this.hoveredArea);
              break;
          }
        }
      }
    }
    this.movement.clear();
  }

  onOver(evt: MouseEvent): void {
    this.bgLayer.appear();
    evt.preventDefault();
  }

  onLeave(): void {
    this.bgLayer.disappear();
  }

  handeFile(file: p5.File): void {
    if (file.type == 'image') {
      this.img.data = this.p5.loadImage(file.data, img => this.resetView(img));
      this.img.file = file.file;
      if (!this.map.getName()) {
        this.map.setName(file.name);
        this.settings.setValue('Map Name', this.map.getName());
      }
    } else if (file.subtype == 'json') {
      fetch(file.data)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onload = () => {
            const json = reader.result;
            if (typeof(json) == 'string') {
              this.importMap(json);
            }
          };
          reader.readAsText(blob);
        });
    }
    this.bgLayer.disappear();
  }

  resetView(img: p5.Image): void {
    this.view.scale = 1;
    this.view.transX = 0;
    this.view.transY = 0;
    const xScale = this.p5.width / img.width;
    const yScale = this.p5.height / img.height;
    if (xScale < this.view.scale)
      this.view.scale = xScale;
    if (yScale < this.view.scale)
      this.view.scale = yScale;
    this.map.setSize(img.width, img.height);
  }

  zoom(coef: number): void {
    const newScale = this.view.scale + coef;
    if (newScale > this.zoomParams.min && newScale < this.zoomParams.max) {
      const mouseXToOrigin = this.mX();
      const mouseYToOrigin = this.mY();
      const transX = mouseXToOrigin * coef;
      const transY = mouseYToOrigin * coef;

      this.view.scale = newScale;
      this.view.transX -= transX;
      this.view.transY -= transY;
    }
  }

  drawImage(): void {
    if (this.img.data)
      this.p5.image(this.img.data, 0, 0, this.img.data.width, this.img.data.height);
  }

  drawAreas(): void {
    const allAreas = [this.tempArea]
      .concat(this.map.getAreas())
      .sort((a, b) => {
        if (a.getShape() == 'point') {
          return -1;
        }
        if (b.getShape() == 'point') {
          return 1;
        }
        return 0;
      });
      
    for (let i = allAreas.length; i--;) {
      const area = allAreas[i];
      this.setAreaStyle(area);
      if (area.isDrawable())
        area.display(this.p5);
    }
    if (this.hoveredPoint) {
      const point = this.hoveredPoint;
      this.p5.fill(0);
      this.p5.noStroke();
      this.p5.ellipse(point.x, point.y, 6 / this.view.scale);
    }
  }

  setTool(value: Tool): void {
    this.tool = value;
    this.tempArea = new AreaEmpty();
  }

  setCursor(): void {
    if (this.drawingTools.includes(this.tool)) {
      switch (this.tool) {
        case 'polygon':
          const areaPoly = this.tempArea as AreaPoly;
          if (!areaPoly.isEmpty() && areaPoly.isClosable(this.mCoord(), 5 / this.view.scale)) {
            this.p5.cursor(this.p5.HAND);
            break;
          }
        default:
          this.p5.cursor(this.p5.CROSS);
      }
    } else {
      this.p5.cursor(this.p5.ARROW);
      if (this.hoveredArea) {
        switch (this.tool) {
          case 'delete':
            this.p5.cursor(this.p5.HAND);
            break;
          case 'move':
            if (!this.hoveredPoint) {
              this.p5.cursor(this.p5.MOVE);
            }
            break;
        }
      }
    }
  }

  setOutput(): void {
    switch (this.tool) {
      case 'move':
        if (this.mouseIsHoverSketch()) {
          const href = this.hoveredArea ? this.hoveredArea.getHrefVerbose() : 'none';
          this.settings.setValue('Output', href);
        }
        break;
    }
  }

  setBackground(): void {
    this.p5.background(200);
    if (!this.img.data) {
      this.p5.noStroke();
      this.p5.fill(0);
    }
  }

  /**
	 * Set the title of the canvas from an area
	 */
  setTitle(area: Area|null): void {
    if (area && area.getTitle()) {
      //@ts-ignore p5 types does not specify the canvas attribute
      this.p5.canvas.setAttribute('title', area.getTitle());
    } else {
      //@ts-ignore p5 types does not specify the canvas attribute
      this.p5.canvas.removeAttribute('title');
    }
  }

  setAreaStyle(area: Area): void {
    let color = this.p5.color(255, 255, 255, 178);
    if (
      (
        (this.tool == 'delete' || this.tool == 'move') &&
        this.mouseIsHoverSketch() &&
        area == this.hoveredArea
      ) ||
			this.movement.containsArea(area) ||
      area == this.selectedArea
    ) {
      const colorRed = [255, 200, 200, 178] as const;
      color = this.p5.color(...colorRed);
    }
    this.p5.fill(color);
    this.p5.strokeWeight(1 / this.view.scale);
    this.p5.stroke(0);
  }

  setTempArea(coord: Coord): void {
    const coords = [coord];
    switch (this.tool) {
      case 'rectangle':
        this.tempArea = new AreaRect(coords);
        break;
      case 'circle':
        this.tempArea = new AreaCircle(coords);
        break;
      case 'polygon':
        this.tempArea = new AreaPoly(coords);
        this.tempArea.addCoord(coord);
        break;
    }
  }

  updateTempArea(): void {
    const coord = this.drawingCoord();
    if (!this.tempArea.isEmpty()) {
      this.tempArea.updateLastCoord(coord);
    }
  }

  exportMap(): string {
    return JSON.stringify(new Save(version, this.map), function (_, value) {
      if (value instanceof ImageMap && !(this instanceof Save)) {
        return value.getName();
      }
      return value;
    });
  }

  load(): void {
    const input = this.settings.getValue('Input');
    this.importMap(input);
  }

  save(): void {
    //@ts-ignore encoding options for Chrome
    // const blob = new Blob([this.exportMap()], { encoding: 'UTF-8', type: 'text/plain;charset=UTF-8' });
    // download(blob, `${this.map.getName()}.map.json`, 'application/json');
    console.log('save');
    console.log(this.exportMap());
  }

  importMap(json: string): void {
    const object = JSON.parse(json);
    const objectMap = object.map;
    this.map.setFromObject(objectMap);
    this.settings.setValue('Map Name', objectMap.name);
    this.settings.setValue('Default Area', objectMap.hasDefaultArea);
    this.reset();
  }

  /**
	 * Add an area to the imageMap object
	 */
  createArea(area: Area): void {
    this.map.addArea(area);
    this.undoManager.add({
      undo: () => area = this.map.shiftArea()!,
      redo: () => this.map.addArea(area, false),
    });
  }

  /**
	 * remove an area from the imageMap object
	 */
  deleteArea(area: Area): void {
    const id = area.id;
    if (id === 0) {
      this.settings.setValue('Default Area', false);
    } else {
      const index = this.map.rmvArea(id);
      this.undoManager.add({
        undo: () => this.map.insertArea(area, index),
        redo: () => this.map.rmvArea(id),
      });
    }
  }

  /**
	 * Move an area forward or backward
	 */
  moveArea(area: Area, direction: number): void {
    if (this.map.moveArea(area.id, direction) !== false) {
      this.undoManager.add({
        undo: () => this.map.moveArea(area.id, -direction),
        redo: () => this.map.moveArea(area.id, direction),
      });
    }
  }

  /**
	 * Set the url of an area
	 */
  setAreaUrl(area: Area): void {
    const href = area.getHref();
    const input = prompt('Enter the pointing url of this area', href ? href : 'http://');
    if (input) {
      area.setHref(input);
      this.undoManager.add({
        undo: () => area.setHref(href),
        redo: () => area.setHref(input!),
      });
    }
  }

  /**
	 * Set the title of an area
	 */
  setAreaTitle(area: Area): void {
    const title = area.getTitle();
    const input = prompt('Enter the title of this area', title ? title : '');
    if (input) {
      area.setTitle(input);
      this.undoManager.add({
        undo: () => area.setTitle(title),
        redo: () => area.setTitle(input!),
      });
    }
  }

  setDefaultArea(bool: boolean): void {
    this.map.setDefaultArea(bool);
    this.undoManager.add({
      undo: () => {
        this.map.setDefaultArea(!bool); // semble redondant
        this.settings.setValue('Default Area', !bool);
      },
      redo: () => {
        this.map.setDefaultArea(bool); // semble redondant
        this.settings.setValue('Default Area', bool);
      },
    });
  }

  clearAreas(): void {
    const areas = this.map.getAreas(false);
    this.map.clearAreas();
    this.undoManager.add({
      undo: () => this.map.setAreas(areas),
      redo: () => this.map.clearAreas(),
    });
  }

  reset(): void {
    this.undoManager.clear();
  }
}
