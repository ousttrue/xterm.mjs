/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { addDisposableDomListener } from 'browser/Lifecycle.mjs';
import { ITerminal } from 'browser/Types.mjs';
import { CellColorResolver } from 'browser/renderer/shared/CellColorResolver.mjs';
import { acquireTextureAtlas, removeTerminalFromCache } from 'browser/renderer/shared/CharAtlasCache.mjs';
import { CursorBlinkStateManager } from 'browser/renderer/shared/CursorBlinkStateManager.mjs';
import { observeDevicePixelDimensions } from 'browser/renderer/shared/DevicePixelObserver.mjs';
import { createRenderDimensions } from 'browser/renderer/shared/RendererUtils.mjs';
import { IRenderDimensions, IRenderer, IRequestRedrawEvent, ITextureAtlas } from 'browser/renderer/shared/Types.mjs';
import { ICharSizeService, ICharacterJoinerService, ICoreBrowserService, IThemeService } from 'browser/services/Services.mjs';
import { EventEmitter, forwardEvent } from 'common/EventEmitter.mjs';
import { Disposable, MutableDisposable, getDisposeArrayDisposable, toDisposable } from 'common/Lifecycle.mjs';
import { CharData, IBufferLine, ICellData } from 'common/Types.mjs';
import { AttributeData } from 'common/buffer/AttributeData.mjs';
import { CellData } from 'common/buffer/CellData.mjs';
import { Attributes, Content, NULL_CELL_CHAR, NULL_CELL_CODE } from 'common/buffer/Constants.mjs';
import { ICoreService, IDecorationService, IOptionsService } from 'common/services/Services.mjs';
import { Terminal } from 'xterm';
import { GlyphRenderer } from './GlyphRenderer.mjs';
import { RectangleRenderer } from './RectangleRenderer.mjs';
import { COMBINED_CHAR_BIT_MASK, RENDER_MODEL_BG_OFFSET, RENDER_MODEL_EXT_OFFSET, RENDER_MODEL_FG_OFFSET, RENDER_MODEL_INDICIES_PER_CELL, RenderModel } from './RenderModel.mjs';
import { IWebGL2RenderingContext } from './Types.mjs';
import { LinkRenderLayer } from './renderLayer/LinkRenderLayer.mjs';
import { IRenderLayer } from './renderLayer/Types.mjs';
import { BufferNamespaceApi } from 'common/public/BufferNamespaceApi.mjs';

type Cursor = {
  cursorY: number,
  cursorX: number,
  lastCursorX: number,
  isCursorVisible: boolean,
};

export class WebglExternalRenderer extends Disposable implements IRenderer {
  private _cursorBlinkStateManager: MutableDisposable<CursorBlinkStateManager> = new MutableDisposable();
  private _charAtlasDisposable = this.register(new MutableDisposable());
  private _charAtlas: ITextureAtlas | undefined;
  private _devicePixelRatio: number;

  private _model: RenderModel = new RenderModel();
  private _workCell: CellData = new CellData();
  private _cellColorResolver: CellColorResolver;

  private _rectangleRenderer: MutableDisposable<RectangleRenderer> = this.register(new MutableDisposable());
  private _glyphRenderer: MutableDisposable<GlyphRenderer> = this.register(new MutableDisposable());

  public readonly dimensions: IRenderDimensions;

  private _isAttached: boolean;

  private readonly _onChangeTextureAtlas = this.register(new EventEmitter<HTMLCanvasElement>());
  public readonly onChangeTextureAtlas = this._onChangeTextureAtlas.event;
  private readonly _onAddTextureAtlasCanvas = this.register(new EventEmitter<HTMLCanvasElement>());
  public readonly onAddTextureAtlasCanvas = this._onAddTextureAtlasCanvas.event;
  private readonly _onRemoveTextureAtlasCanvas = this.register(new EventEmitter<HTMLCanvasElement>());
  public readonly onRemoveTextureAtlasCanvas = this._onRemoveTextureAtlasCanvas.event;
  private readonly _onRequestRedraw = this.register(new EventEmitter<IRequestRedrawEvent>());
  public readonly onRequestRedraw = this._onRequestRedraw.event;
  private readonly _onContextLoss = this.register(new EventEmitter<void>());
  public readonly onContextLoss = this._onContextLoss.event;

  constructor(
    private _gl: IWebGL2RenderingContext,
    private _core: ITerminal,
    private _buffer: BufferNamespaceApi,
    private readonly _charSizeService: ICharSizeService,
    private readonly _coreBrowserService: ICoreBrowserService,
    private readonly _coreService: ICoreService,
    private readonly _decorationService: IDecorationService,
    private readonly _optionsService: IOptionsService,
    private readonly _themeService: IThemeService,
  ) {
    super();

    this.register(this._themeService.onChangeColors(() => this._handleColorChange()));

    this._cellColorResolver = new CellColorResolver(this._core, this._model.selection, this._decorationService, this._coreBrowserService, this._themeService);
    this.dimensions = createRenderDimensions();
    this._devicePixelRatio = this._coreBrowserService.dpr;
    this._updateDimensions();
    this._updateCursorBlink();
    this.register(_optionsService.onOptionChange(() => this._handleOptionsChanged()));

    [this._rectangleRenderer.value, this._glyphRenderer.value] = this._initializeWebGLState();

    this._isAttached = this._coreBrowserService.window.document.body.contains(this._core.screenElement!);

    this.register(toDisposable(() => {
      removeTerminalFromCache(this._core);
    }));
  }

  public get textureAtlas(): HTMLCanvasElement | undefined {
    return this._charAtlas?.pages[0].canvas;
  }

  private _handleColorChange(): void {
    this._refreshCharAtlas();

    // Force a full refresh
    this._clearModel(true);
  }

  public handleDevicePixelRatioChange(): void {
    // If the device pixel ratio changed, the char atlas needs to be regenerated
    // and the terminal needs to refreshed
    if (this._devicePixelRatio !== this._coreBrowserService.dpr) {
      this._devicePixelRatio = this._coreBrowserService.dpr;
      this.handleResize(this._core.cols, this._core.rows);
    }
  }

  public handleResize(cols: number, rows: number): void {
    // Update character and canvas dimensions
    this._updateDimensions();

    this._model.resize(this._core.cols, this._core.rows);

    // Resize the screen
    this._core.screenElement!.style.width = `${this.dimensions.css.canvas.width}px`;
    this._core.screenElement!.style.height = `${this.dimensions.css.canvas.height}px`;

    this._rectangleRenderer.value?.setDimensions(this.dimensions);
    this._rectangleRenderer.value?.handleResize();
    this._glyphRenderer.value?.setDimensions(this.dimensions);
    this._glyphRenderer.value?.handleResize();

    this._refreshCharAtlas();

    // Force a full refresh. Resizing `_glyphRenderer` should clear it already,
    // so there is no need to clear it again here.
    this._clearModel(false);
  }

  public handleCharSizeChanged(): void {
    this.handleResize(this._core.cols, this._core.rows);
  }

  public handleBlur(): void {
    this._cursorBlinkStateManager.value?.pause();
    // Request a redraw for active/inactive selection background
    this._requestRedrawViewport();
  }

  public handleFocus(): void {
    this._cursorBlinkStateManager.value?.resume();
    // Request a redraw for active/inactive selection background
    this._requestRedrawViewport();
  }

  public handleSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean): void {
    this._model.selection.update(this._core, start, end, columnSelectMode);
    this._requestRedrawViewport();
  }

  public handleCursorMove(): void {
    this._cursorBlinkStateManager.value?.restartBlinkAnimation();
  }

  private _handleOptionsChanged(): void {
    this._updateDimensions();
    this._refreshCharAtlas();
    this._updateCursorBlink();
  }

  /**
   * Initializes members dependent on WebGL context state.
   */
  private _initializeWebGLState(): [RectangleRenderer, GlyphRenderer] {
    this._rectangleRenderer.value = new RectangleRenderer(this._core, this._gl, this.dimensions, this._themeService);
    this._glyphRenderer.value = new GlyphRenderer(this._core, this._gl, this.dimensions);

    // Update dimensions and acquire char atlas
    this.handleCharSizeChanged();

    return [this._rectangleRenderer.value, this._glyphRenderer.value];
  }

  /**
   * Refreshes the char atlas, aquiring a new one if necessary.
   */
  private _refreshCharAtlas(): void {
    if (this.dimensions.device.char.width <= 0 && this.dimensions.device.char.height <= 0) {
      // Mark as not attached so char atlas gets refreshed on next render
      this._isAttached = false;
      return;
    }

    const atlas = acquireTextureAtlas(
      this,
      this._optionsService.rawOptions,
      this._themeService.colors,
      this.dimensions.device.cell.width,
      this.dimensions.device.cell.height,
      this.dimensions.device.char.width,
      this.dimensions.device.char.height,
      this._coreBrowserService.dpr
    );
    if (this._charAtlas !== atlas) {
      this._onChangeTextureAtlas.fire(atlas.pages[0].canvas);
      this._charAtlasDisposable.value = getDisposeArrayDisposable([
        forwardEvent(atlas.onAddTextureAtlasCanvas, this._onAddTextureAtlasCanvas),
        forwardEvent(atlas.onRemoveTextureAtlasCanvas, this._onRemoveTextureAtlasCanvas)
      ]);
    }
    this._charAtlas = atlas;
    this._charAtlas.warmUp();
    this._glyphRenderer.value?.setAtlas(this._charAtlas);
  }

  /**
   * Clear the model.
   * @param clearGlyphRenderer Whether to also clear the glyph renderer. This
   * should be true generally to make sure it is in the same state as the model.
   */
  private _clearModel(clearGlyphRenderer: boolean): void {
    this._model.clear();
    if (clearGlyphRenderer) {
      this._glyphRenderer.value?.clear();
    }
  }

  public clearTextureAtlas(): void {
    this._charAtlas?.clearTexture();
    this._clearModel(true);
    this._requestRedrawViewport();
  }

  public clear(): void {
    this._clearModel(true);
    this._cursorBlinkStateManager.value?.restartBlinkAnimation();
    this._updateCursorBlink();
  }

  public registerCharacterJoiner(handler: (text: string) => [number, number][]): number {
    return -1;
  }

  public deregisterCharacterJoiner(joinerId: number): boolean {
    return false;
  }

  public renderRows(start: number, end: number): void {
    // console.log(`${start} => ${end}`);
    if (!this._isAttached) {
      if (this._coreBrowserService.window.document.body.contains(this._core.screenElement!) && this._charSizeService.width && this._charSizeService.height) {
        this._updateDimensions();
        this._refreshCharAtlas();
        this._isAttached = true;
      } else {
        console.log('return');
        return;
      }
    }

    // Update render layers
    if (!this._glyphRenderer.value || !this._rectangleRenderer.value) {
      console.log('return');
      return;
    }

    // Tell renderer the frame is beginning
    // upon a model clear also refresh the full viewport model
    // (also triggered by an atlas page merge, part of #4480)
    if (this._glyphRenderer.value.beginFrame()) {
      this._clearModel(true);
      this._updateModel(0, this._core.rows - 1);
    } else {
      // just update changed lines to draw
      this._updateModel(start, end);
    }
  }

  public render(): void {
    // Render
    this._rectangleRenderer.value.renderBackgrounds();
    this._glyphRenderer.value.render(this._model);
    if (!this._cursorBlinkStateManager.value || this._cursorBlinkStateManager.value.isCursorVisible) {
      this._rectangleRenderer.value.renderCursor();
    }
  }

  private _updateCursorBlink(): void {
    if (this._core.options.cursorBlink) {
      this._cursorBlinkStateManager.value = new CursorBlinkStateManager(() => {
        this._requestRedrawCursor();
      }, this._coreBrowserService);
    } else {
      this._cursorBlinkStateManager.clear();
    }
    // Request a refresh from the terminal as management of rendering is being
    // moved back to the terminal
    this._requestRedrawCursor();
  }

  private _updateModel(start: number, end: number): void {
    const terminal = this._core;
    start = clamp(start, terminal.rows - 1, 0);
    end = clamp(end, terminal.rows - 1, 0);
    const cursor = {
      cursorY: this._buffer.active.baseY + this._buffer.active.cursorY,
      // in case cursor.x == cols adjust visual cursor to cols - 1
      cursorX: Math.min(this._buffer.active.cursorX, terminal.cols - 1),
      lastCursorX: -1,
      isCursorVisible:
        this._coreService.isCursorInitialized &&
        !this._coreService.isCursorHidden &&
        (!this._cursorBlinkStateManager.value || this._cursorBlinkStateManager.value.isCursorVisible),
    };
    this._model.cursor = undefined;
    let modelUpdated = false;
    for (let y = start; y <= end; y++) {
      if (this._updateModelLine(y, cursor)) {
        modelUpdated = true;
      }
    }
    if (modelUpdated) {
      this._rectangleRenderer.value!.updateBackgrounds(this._model);
    }
    this._rectangleRenderer.value!.updateCursor(this._model);
  }

  _updateModelLine(y: number, cursor: Cursor): boolean {
    const terminal = this._core;
    let cell: ICellData = this._workCell;
    const row = y + terminal.buffer.ydisp;
    const line = terminal.buffer.lines.get(row)!;
    this._model.lineLengths[y] = 0;
    let modelUpdated = false;
    for (let x = 0; x < terminal.cols; x++) {
      line.loadCell(x, cell);

      let lastBg = this._cellColorResolver.result.bg;
      if (x === 0) {
        lastBg = this._cellColorResolver.result.bg;
      }

      // If true, indicates that the current character(s) to draw were joined.
      let lastCharX = x;

      const chars = cell.getChars();
      let code = cell.getCode();
      const i = ((y * terminal.cols) + x) * RENDER_MODEL_INDICIES_PER_CELL;

      // Load colors/resolve overrides into work colors
      this._cellColorResolver.resolve(cell, x, row);

      // Override colors for cursor cell
      if (cursor.isCursorVisible && row === cursor.cursorY) {
        if (x === cursor.cursorX) {
          this._model.cursor = {
            x: cursor.cursorX,
            y: this._buffer.active.cursorY,
            width: cell.getWidth(),
            style: this._coreBrowserService.isFocused ?
              (terminal.options.cursorStyle || 'block') : terminal.options.cursorInactiveStyle,
            cursorWidth: terminal.options.cursorWidth,
            dpr: this._devicePixelRatio
          };
          cursor.lastCursorX = cursor.cursorX + cell.getWidth() - 1;
        }
        if (x >= cursor.cursorX && x <= cursor.lastCursorX &&
          ((this._coreBrowserService.isFocused &&
            (terminal.options.cursorStyle || 'block') === 'block') ||
            (this._coreBrowserService.isFocused === false &&
              terminal.options.cursorInactiveStyle === 'block'))) {
          this._cellColorResolver.result.fg =
            Attributes.CM_RGB | (this._themeService.colors.cursorAccent.rgba >> 8 & Attributes.RGB_MASK);
          this._cellColorResolver.result.bg =
            Attributes.CM_RGB | (this._themeService.colors.cursor.rgba >> 8 & Attributes.RGB_MASK);
        }
      }

      if (code !== NULL_CELL_CODE) {
        this._model.lineLengths[y] = x + 1;
      }

      // Nothing has changed, no updates needed
      if (this._model.cells[i] === code &&
        this._model.cells[i + RENDER_MODEL_BG_OFFSET] === this._cellColorResolver.result.bg &&
        this._model.cells[i + RENDER_MODEL_FG_OFFSET] === this._cellColorResolver.result.fg &&
        this._model.cells[i + RENDER_MODEL_EXT_OFFSET] === this._cellColorResolver.result.ext) {
        continue;
      }

      modelUpdated = true;

      // Flag combined chars with a bit mask so they're easily identifiable
      if (chars.length > 1) {
        code |= COMBINED_CHAR_BIT_MASK;
      }

      // Cache the results in the model
      this._model.cells[i] = code;
      this._model.cells[i + RENDER_MODEL_BG_OFFSET] = this._cellColorResolver.result.bg;
      this._model.cells[i + RENDER_MODEL_FG_OFFSET] = this._cellColorResolver.result.fg;
      this._model.cells[i + RENDER_MODEL_EXT_OFFSET] = this._cellColorResolver.result.ext;

      this._glyphRenderer.value!.updateCell(x, y, code, this._cellColorResolver.result.bg, this._cellColorResolver.result.fg, this._cellColorResolver.result.ext, chars, lastBg);
    }

    return modelUpdated;
  }

  /**
   * Recalculates the character and canvas dimensions.
   */
  private _updateDimensions(): void {
    // Perform a new measure if the CharMeasure dimensions are not yet available
    if (!this._charSizeService.width || !this._charSizeService.height) {
      return;
    }

    // Calculate the device character width. Width is floored as it must be drawn to an integer grid
    // in order for the char atlas glyphs to not be blurry.
    this.dimensions.device.char.width = Math.floor(this._charSizeService.width * this._devicePixelRatio);

    // Calculate the device character height. Height is ceiled in case devicePixelRatio is a
    // floating point number in order to ensure there is enough space to draw the character to the
    // cell.
    this.dimensions.device.char.height = Math.ceil(this._charSizeService.height * this._devicePixelRatio);

    // Calculate the device cell height, if lineHeight is _not_ 1, the resulting value will be
    // floored since lineHeight can never be lower then 1, this guarentees the device cell height
    // will always be larger than device char height.
    this.dimensions.device.cell.height = Math.floor(
      this.dimensions.device.char.height *
      this._optionsService.rawOptions.lineHeight);

    // Calculate the y offset within a cell that glyph should draw at in order for it to be centered
    // correctly within the cell.
    this.dimensions.device.char.top = this._optionsService.rawOptions.lineHeight === 1 ? 0 : Math.round((this.dimensions.device.cell.height - this.dimensions.device.char.height) / 2);

    // Calculate the device cell width, taking the letterSpacing into account.
    this.dimensions.device.cell.width = this.dimensions.device.char.width + Math.round(this._optionsService.rawOptions.letterSpacing);

    // Calculate the x offset with a cell that text should draw from in order for it to be centered
    // correctly within the cell.
    this.dimensions.device.char.left = Math.floor(this._optionsService.rawOptions.letterSpacing / 2);

    // Recalculate the canvas dimensions, the device dimensions define the actual number of pixel in
    // the canvas
    this.dimensions.device.canvas.height = this._core.rows * this.dimensions.device.cell.height;
    this.dimensions.device.canvas.width = this._core.cols * this.dimensions.device.cell.width;

    // The the size of the canvas on the page. It's important that this rounds to nearest integer
    // and not ceils as browsers often have floating point precision issues where
    // `window.devicePixelRatio` ends up being something like `1.100000023841858` for example, when
    // it's actually 1.1. Ceiling may causes blurriness as the backing canvas image is 1 pixel too
    // large for the canvas element size.
    this.dimensions.css.canvas.height = Math.round(this.dimensions.device.canvas.height / this._devicePixelRatio);
    this.dimensions.css.canvas.width = Math.round(this.dimensions.device.canvas.width / this._devicePixelRatio);

    // Get the CSS dimensions of an individual cell. This needs to be derived from the calculated
    // device pixel canvas value above. CharMeasure.width/height by itself is insufficient when the
    // page is not at 100% zoom level as CharMeasure is measured in CSS pixels, but the actual char
    // size on the canvas can differ.
    this.dimensions.css.cell.height = this.dimensions.device.cell.height / this._devicePixelRatio;
    this.dimensions.css.cell.width = this.dimensions.device.cell.width / this._devicePixelRatio;

    console.log(this.dimensions);
  }

  private _requestRedrawViewport(): void {
    this._onRequestRedraw.fire({ start: 0, end: this._core.rows - 1 });
  }

  private _requestRedrawCursor(): void {
    const cursorY = this._buffer.active.cursorY;
    this._onRequestRedraw.fire({ start: cursorY, end: cursorY });
  }
}

function clamp(value: number, max: number, min: number = 0): number {
  return Math.max(Math.min(value, max), min);
}
