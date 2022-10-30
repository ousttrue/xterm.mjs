/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { DIM_OPACITY, TEXT_BASELINE } from 'browser/renderer/shared/Constants';
import { DEFAULT_COLOR, Attributes, DEFAULT_EXT, UnderlineStyle } from 'common/buffer/Constants';
import { IColor } from 'common/Types';
import { AttributeData } from 'common/buffer/AttributeData';
import { color, NULL_COLOR, rgba } from 'common/Color';
import { tryDrawCustomChar } from 'browser/renderer/shared/CustomGlyphs';
import { excludeFromContrastRatioDemands, isPowerlineGlyph, isRestrictedPowerlineGlyph, throwIfFalsy } from 'browser/renderer/shared/RendererUtils';
import { IUnicodeService } from 'common/services/Services';
import { FourKeyMap } from 'common/MultiKeyMap';
import { IdleTaskQueue } from 'common/TaskQueue';
import { IBoundingBox, ICharAtlasConfig, IRasterizedGlyph, ITextureAtlas } from 'browser/renderer/shared/Types';
import { EventEmitter } from 'common/EventEmitter';

/**
 * A shared object which is used to draw nothing for a particular cell.
 */
const NULL_RASTERIZED_GLYPH: IRasterizedGlyph = {
  texturePage: 0,
  texturePosition: { x: 0, y: 0 },
  texturePositionClipSpace: { x: 0, y: 0 },
  offset: { x: 0, y: 0 },
  size: { x: 0, y: 0 },
  sizeClipSpace: { x: 0, y: 0 }
};

const TMP_CANVAS_GLYPH_PADDING = 2;

const enum Constants {
  /**
   * The amount of pixel padding to allow in each row. Setting this to zero would make the atlas
   * page pack as tightly as possible, but more pages would end up being created as a result.
   */
  ROW_PIXEL_THRESHOLD = 2
}

interface ICharAtlasActiveRow {
  x: number;
  y: number;
  height: number;
}

// Work variables to avoid garbage collection
let $glyph = undefined;

export class TextureAtlas implements ITextureAtlas {
  private _didWarmUp: boolean = false;

  private _cacheMap: FourKeyMap<number, number, number, number, IRasterizedGlyph> = new FourKeyMap();
  private _cacheMapCombined: FourKeyMap<string, number, number, number, IRasterizedGlyph> = new FourKeyMap();

  // The texture that the atlas is drawn to
  private _pages: AtlasPage[] = [];
  public get pages(): { canvas: HTMLCanvasElement, hasCanvasChanged: boolean }[] { return this._pages; }

  // The set of atlas pages that can be written to
  private _activePages: AtlasPage[] = [];

  private _tmpCanvas: HTMLCanvasElement;
  // A temporary context that glyphs are drawn to before being transfered to the atlas.
  private _tmpCtx: CanvasRenderingContext2D;

  private _workBoundingBox: IBoundingBox = { top: 0, left: 0, bottom: 0, right: 0 };
  private _workAttributeData: AttributeData = new AttributeData();

  private readonly _onAddTextureAtlasCanvas = new EventEmitter<HTMLCanvasElement>();
  public readonly onAddTextureAtlasCanvas = this._onAddTextureAtlasCanvas.event;

  constructor(
    private readonly _document: Document,
    private readonly _config: ICharAtlasConfig,
    private readonly _unicodeService: IUnicodeService
  ) {
    const page = new AtlasPage(_document, _config.devicePixelRatio);
    this._pages.push(page);
    this._activePages.push(page);
    this._tmpCanvas = createCanvas(
      _document,
      this._config.deviceCellWidth * 4 + TMP_CANVAS_GLYPH_PADDING * 2,
      this._config.deviceCellHeight + TMP_CANVAS_GLYPH_PADDING * 2
    );
    this._tmpCtx = throwIfFalsy(this._tmpCanvas.getContext('2d', {
      alpha: this._config.allowTransparency,
      willReadFrequently: true
    }));
  }

  public dispose(): void {
    for (const page of this.pages) {
      page.canvas.remove();
    }
    this._onAddTextureAtlasCanvas.dispose();
  }

  public warmUp(): void {
    if (!this._didWarmUp) {
      this._doWarmUp();
      this._didWarmUp = true;
    }
  }

  private _doWarmUp(): void {
    // Pre-fill with ASCII 33-126, this is not urgent and done in idle callbacks
    const queue = new IdleTaskQueue();
    for (let i = 33; i < 126; i++) {
      queue.enqueue(() => {
        if (!this._cacheMap.get(i, DEFAULT_COLOR, DEFAULT_COLOR, DEFAULT_EXT)) {
          const rasterizedGlyph = this._drawToCache(i, DEFAULT_COLOR, DEFAULT_COLOR, DEFAULT_EXT);
          this._cacheMap.set(i, DEFAULT_COLOR, DEFAULT_COLOR, DEFAULT_EXT, rasterizedGlyph);
        }
      });
    }
  }

  public beginFrame(): boolean {
    const page = this._pages[this._pages.length - 1];
    // TODO: Revisit when a new page gets added, this is only really needed now when there is no
    // room for a new row
    if (page.currentRow.y > Math.floor(page.canvas.height * 0.8)) {
      // TODO: Clear all pages and restart if the maximum page count is reached
      console.log(`Add page #${this._pages.length + 1}`);
      const newPage = new AtlasPage(this._document, this._config.devicePixelRatio);
      this._pages.push(newPage);
      this._activePages.push(newPage);
      this._onAddTextureAtlasCanvas.fire(newPage.canvas);
      return true;
    }
    return false;
  }

  public clearTexture(): void {
    if (this._pages[0].currentRow.x === 0 && this._pages[0].currentRow.y === 0) {
      return;
    }
    for (const page of this._pages) {
      page.clear();
    }
    this._cacheMap.clear();
    this._cacheMapCombined.clear();
    this._didWarmUp = false;
  }

  public getRasterizedGlyphCombinedChar(chars: string, bg: number, fg: number, ext: number): IRasterizedGlyph {
    return this._getFromCacheMap(this._cacheMapCombined, chars, bg, fg, ext);
  }

  public getRasterizedGlyph(code: number, bg: number, fg: number, ext: number): IRasterizedGlyph {
    return this._getFromCacheMap(this._cacheMap, code, bg, fg, ext);
  }

  /**
   * Gets the glyphs texture coords, drawing the texture if it's not already
   */
  private _getFromCacheMap(
    cacheMap: FourKeyMap<string | number, number, number, number, IRasterizedGlyph>,
    key: string | number,
    bg: number,
    fg: number,
    ext: number
  ): IRasterizedGlyph {
    $glyph = cacheMap.get(key, bg, fg, ext);
    if (!$glyph) {
      $glyph = this._drawToCache(key, bg, fg, ext);
      cacheMap.set(key, bg, fg, ext, $glyph);
    }
    return $glyph;
  }

  private _getColorFromAnsiIndex(idx: number): IColor {
    if (idx >= this._config.colors.ansi.length) {
      throw new Error('No color found for idx ' + idx);
    }
    return this._config.colors.ansi[idx];
  }

  private _getBackgroundColor(bgColorMode: number, bgColor: number, inverse: boolean, dim: boolean): IColor {
    if (this._config.allowTransparency) {
      // The background color might have some transparency, so we need to render it as fully
      // transparent in the atlas. Otherwise we'd end up drawing the transparent background twice
      // around the anti-aliased edges of the glyph, and it would look too dark.
      return NULL_COLOR;
    }

    let result: IColor;
    switch (bgColorMode) {
      case Attributes.CM_P16:
      case Attributes.CM_P256:
        result = this._getColorFromAnsiIndex(bgColor);
        break;
      case Attributes.CM_RGB:
        const arr = AttributeData.toColorRGB(bgColor);
        // TODO: This object creation is slow
        result = rgba.toColor(arr[0], arr[1], arr[2]);
        break;
      case Attributes.CM_DEFAULT:
      default:
        if (inverse) {
          result = this._config.colors.foreground;
        } else {
          result = this._config.colors.background;
        }
        break;
    }

    if (dim) {
      // Blend here instead of using opacity because transparent colors mess with clipping the
      // glyph's bounding box
      result = color.blend(this._config.colors.background, color.multiplyOpacity(result, DIM_OPACITY));
    }

    return result;
  }

  private _getForegroundColor(bg: number, bgColorMode: number, bgColor: number, fg: number, fgColorMode: number, fgColor: number, inverse: boolean, dim: boolean, bold: boolean, excludeFromContrastRatioDemands: boolean): IColor {
    // TODO: Pass dim along to get min contrast?
    const minimumContrastColor = this._getMinimumContrastColor(bg, bgColorMode, bgColor, fg, fgColorMode, fgColor, false, bold, excludeFromContrastRatioDemands);
    if (minimumContrastColor) {
      return minimumContrastColor;
    }

    let result: IColor;
    switch (fgColorMode) {
      case Attributes.CM_P16:
      case Attributes.CM_P256:
        if (this._config.drawBoldTextInBrightColors && bold && fgColor < 8) {
          fgColor += 8;
        }
        result = this._getColorFromAnsiIndex(fgColor);
        break;
      case Attributes.CM_RGB:
        const arr = AttributeData.toColorRGB(fgColor);
        result = rgba.toColor(arr[0], arr[1], arr[2]);
        break;
      case Attributes.CM_DEFAULT:
      default:
        if (inverse) {
          result = this._config.colors.background;
        } else {
          result = this._config.colors.foreground;
        }
    }

    // Always use an opaque color regardless of allowTransparency
    if (this._config.allowTransparency) {
      result = color.opaque(result);
    }

    // Apply dim to the color, opacity is fine to use for the foreground color
    if (dim) {
      result = color.multiplyOpacity(result, DIM_OPACITY);
    }

    return result;
  }

  private _resolveBackgroundRgba(bgColorMode: number, bgColor: number, inverse: boolean): number {
    switch (bgColorMode) {
      case Attributes.CM_P16:
      case Attributes.CM_P256:
        return this._getColorFromAnsiIndex(bgColor).rgba;
      case Attributes.CM_RGB:
        return bgColor << 8;
      case Attributes.CM_DEFAULT:
      default:
        if (inverse) {
          return this._config.colors.foreground.rgba;
        }
        return this._config.colors.background.rgba;
    }
  }

  private _resolveForegroundRgba(fgColorMode: number, fgColor: number, inverse: boolean, bold: boolean): number {
    switch (fgColorMode) {
      case Attributes.CM_P16:
      case Attributes.CM_P256:
        if (this._config.drawBoldTextInBrightColors && bold && fgColor < 8) {
          fgColor += 8;
        }
        return this._getColorFromAnsiIndex(fgColor).rgba;
      case Attributes.CM_RGB:
        return fgColor << 8;
      case Attributes.CM_DEFAULT:
      default:
        if (inverse) {
          return this._config.colors.background.rgba;
        }
        return this._config.colors.foreground.rgba;
    }
  }

  private _getMinimumContrastColor(bg: number, bgColorMode: number, bgColor: number, fg: number, fgColorMode: number, fgColor: number, inverse: boolean, bold: boolean, excludeFromContrastRatioDemands: boolean): IColor | undefined {
    if (this._config.minimumContrastRatio === 1 || excludeFromContrastRatioDemands) {
      return undefined;
    }

    // Try get from cache first
    const adjustedColor = this._config.colors.contrastCache.getColor(bg, fg);
    if (adjustedColor !== undefined) {
      return adjustedColor || undefined;
    }

    const bgRgba = this._resolveBackgroundRgba(bgColorMode, bgColor, inverse);
    const fgRgba = this._resolveForegroundRgba(fgColorMode, fgColor, inverse, bold);
    const result = rgba.ensureContrastRatio(bgRgba, fgRgba, this._config.minimumContrastRatio);

    if (!result) {
      this._config.colors.contrastCache.setColor(bg, fg, null);
      return undefined;
    }

    const color = rgba.toColor(
      (result >> 24) & 0xFF,
      (result >> 16) & 0xFF,
      (result >> 8) & 0xFF
    );
    this._config.colors.contrastCache.setColor(bg, fg, color);

    return color;
  }

  private _drawToCache(codeOrChars: number | string, bg: number, fg: number, ext: number): IRasterizedGlyph {
    const chars = typeof codeOrChars === 'number' ? String.fromCharCode(codeOrChars) : codeOrChars;

    // Uncomment for debugging
    // console.log(`draw to cache "${chars}"`, bg, fg, ext);

    // Allow 1 cell width per character, with a minimum of 2 (CJK), plus some padding. This is used
    // to draw the glyph to the canvas as well as to restrict the bounding box search to ensure
    // giant ligatures (eg. =====>) don't impact overall performance.
    const allowedWidth = this._config.deviceCellWidth * Math.max(chars.length, 2) + TMP_CANVAS_GLYPH_PADDING * 2;
    if (this._tmpCanvas.width < allowedWidth) {
      this._tmpCanvas.width = allowedWidth;
    }
    // Include line height when drawing glyphs
    const allowedHeight = this._config.deviceCellHeight + TMP_CANVAS_GLYPH_PADDING * 4;
    if (this._tmpCanvas.height < allowedHeight) {
      this._tmpCanvas.height = allowedHeight;
    }
    this._tmpCtx.save();

    this._workAttributeData.fg = fg;
    this._workAttributeData.bg = bg;
    this._workAttributeData.extended.ext = ext;

    const invisible = !!this._workAttributeData.isInvisible();
    if (invisible) {
      return NULL_RASTERIZED_GLYPH;
    }

    const bold = !!this._workAttributeData.isBold();
    const inverse = !!this._workAttributeData.isInverse();
    const dim = !!this._workAttributeData.isDim();
    const italic = !!this._workAttributeData.isItalic();
    const underline = !!this._workAttributeData.isUnderline();
    const strikethrough = !!this._workAttributeData.isStrikethrough();
    let fgColor = this._workAttributeData.getFgColor();
    let fgColorMode = this._workAttributeData.getFgColorMode();
    let bgColor = this._workAttributeData.getBgColor();
    let bgColorMode = this._workAttributeData.getBgColorMode();
    if (inverse) {
      const temp = fgColor;
      fgColor = bgColor;
      bgColor = temp;
      const temp2 = fgColorMode;
      fgColorMode = bgColorMode;
      bgColorMode = temp2;
    }

    // draw the background
    const backgroundColor = this._getBackgroundColor(bgColorMode, bgColor, inverse, dim);
    // Use a 'copy' composite operation to clear any existing glyph out of _tmpCtxWithAlpha, regardless of
    // transparency in backgroundColor
    this._tmpCtx.globalCompositeOperation = 'copy';
    this._tmpCtx.fillStyle = backgroundColor.css;
    this._tmpCtx.fillRect(0, 0, this._tmpCanvas.width, this._tmpCanvas.height);
    this._tmpCtx.globalCompositeOperation = 'source-over';

    // draw the foreground/glyph
    const fontWeight = bold ? this._config.fontWeightBold : this._config.fontWeight;
    const fontStyle = italic ? 'italic' : '';
    this._tmpCtx.font =
      `${fontStyle} ${fontWeight} ${this._config.fontSize * this._config.devicePixelRatio}px ${this._config.fontFamily}`;
    this._tmpCtx.textBaseline = TEXT_BASELINE;

    const powerlineGlyph = chars.length === 1 && isPowerlineGlyph(chars.charCodeAt(0));
    const restrictedPowerlineGlyph = chars.length === 1 && isRestrictedPowerlineGlyph(chars.charCodeAt(0));
    const foregroundColor = this._getForegroundColor(bg, bgColorMode, bgColor, fg, fgColorMode, fgColor, inverse, dim, bold, excludeFromContrastRatioDemands(chars.charCodeAt(0)));
    this._tmpCtx.fillStyle = foregroundColor.css;

    // For powerline glyphs left/top padding is excluded (https://github.com/microsoft/vscode/issues/120129)
    const padding = restrictedPowerlineGlyph ? 0 : TMP_CANVAS_GLYPH_PADDING * 2;

    // Draw custom characters if applicable
    let customGlyph = false;
    if (this._config.customGlyphs !== false) {
      customGlyph = tryDrawCustomChar(this._tmpCtx, chars, padding, padding, this._config.deviceCellWidth, this._config.deviceCellHeight, this._config.fontSize, this._config.devicePixelRatio);
    }

    // Whether to clear pixels based on a threshold difference between the glyph color and the
    // background color. This should be disabled when the glyph contains multiple colors such as
    // underline colors to prevent important colors could get cleared.
    let enableClearThresholdCheck = !powerlineGlyph;

    let chWidth: number;
    if (typeof codeOrChars === 'number') {
      chWidth = this._unicodeService.wcwidth(codeOrChars);
    } else {
      chWidth = this._unicodeService.getStringCellWidth(codeOrChars);
    }

    // Draw underline
    if (underline) {
      this._tmpCtx.save();
      const lineWidth = Math.max(1, Math.floor(this._config.fontSize * this._config.devicePixelRatio / 15));
      // When the line width is odd, draw at a 0.5 position
      const yOffset = lineWidth % 2 === 1 ? 0.5 : 0;
      this._tmpCtx.lineWidth = lineWidth;

      // Underline color
      if (this._workAttributeData.isUnderlineColorDefault()) {
        this._tmpCtx.strokeStyle = this._tmpCtx.fillStyle;
      } else if (this._workAttributeData.isUnderlineColorRGB()) {
        enableClearThresholdCheck = false;
        this._tmpCtx.strokeStyle = `rgb(${AttributeData.toColorRGB(this._workAttributeData.getUnderlineColor()).join(',')})`;
      } else {
        enableClearThresholdCheck = false;
        let fg = this._workAttributeData.getUnderlineColor();
        if (this._config.drawBoldTextInBrightColors && this._workAttributeData.isBold() && fg < 8) {
          fg += 8;
        }
        this._tmpCtx.strokeStyle = this._getColorFromAnsiIndex(fg).css;
      }

      // Underline style/stroke
      this._tmpCtx.beginPath();
      const xLeft = padding;
      const yTop = Math.ceil(padding + this._config.deviceCharHeight) - yOffset;
      const yMid = padding + this._config.deviceCharHeight + lineWidth - yOffset;
      const yBot = Math.ceil(padding + this._config.deviceCharHeight + lineWidth * 2) - yOffset;

      for (let i = 0; i < chWidth; i++) {
        this._tmpCtx.save();
        const xChLeft = xLeft + i * this._config.deviceCellWidth;
        const xChRight = xLeft + (i + 1) * this._config.deviceCellWidth;
        const xChMid = xChLeft + this._config.deviceCellWidth / 2;
        switch (this._workAttributeData.extended.underlineStyle) {
          case UnderlineStyle.DOUBLE:
            this._tmpCtx.moveTo(xChLeft, yTop);
            this._tmpCtx.lineTo(xChRight, yTop);
            this._tmpCtx.moveTo(xChLeft, yBot);
            this._tmpCtx.lineTo(xChRight, yBot);
            break;
          case UnderlineStyle.CURLY:
            // Choose the bezier top and bottom based on the device pixel ratio, the curly line is
            // made taller when the line width is  as otherwise it's not very clear otherwise.
            const yCurlyBot = lineWidth <= 1 ? yBot : Math.ceil(padding + this._config.deviceCharHeight - lineWidth / 2) - yOffset;
            const yCurlyTop = lineWidth <= 1 ? yTop : Math.ceil(padding + this._config.deviceCharHeight + lineWidth / 2) - yOffset;
            // Clip the left and right edges of the underline such that it can be drawn just outside
            // the edge of the cell to ensure a continuous stroke when there are multiple underlined
            // glyphs adjacent to one another.
            const clipRegion = new Path2D();
            clipRegion.rect(xChLeft, yTop, this._config.deviceCellWidth, yBot - yTop);
            this._tmpCtx.clip(clipRegion);
            // Start 1/2 cell before and end 1/2 cells after to ensure a smooth curve with other cells
            this._tmpCtx.moveTo(xChLeft - this._config.deviceCellWidth / 2, yMid);
            this._tmpCtx.bezierCurveTo(
              xChLeft - this._config.deviceCellWidth / 2, yCurlyTop,
              xChLeft, yCurlyTop,
              xChLeft, yMid
            );
            this._tmpCtx.bezierCurveTo(
              xChLeft, yCurlyBot,
              xChMid, yCurlyBot,
              xChMid, yMid
            );
            this._tmpCtx.bezierCurveTo(
              xChMid, yCurlyTop,
              xChRight, yCurlyTop,
              xChRight, yMid
            );
            this._tmpCtx.bezierCurveTo(
              xChRight, yCurlyBot,
              xChRight + this._config.deviceCellWidth / 2, yCurlyBot,
              xChRight + this._config.deviceCellWidth / 2, yMid
            );
            break;
          case UnderlineStyle.DOTTED:
            this._tmpCtx.setLineDash([this._config.devicePixelRatio * 2, this._config.devicePixelRatio]);
            this._tmpCtx.moveTo(xChLeft, yTop);
            this._tmpCtx.lineTo(xChRight, yTop);
            break;
          case UnderlineStyle.DASHED:
            this._tmpCtx.setLineDash([this._config.devicePixelRatio * 4, this._config.devicePixelRatio * 3]);
            this._tmpCtx.moveTo(xChLeft, yTop);
            this._tmpCtx.lineTo(xChRight, yTop);
            break;
          case UnderlineStyle.SINGLE:
          default:
            this._tmpCtx.moveTo(xChLeft, yTop);
            this._tmpCtx.lineTo(xChRight, yTop);
            break;
        }
        this._tmpCtx.stroke();
        this._tmpCtx.restore();
      }
      this._tmpCtx.restore();

      // Draw stroke in the background color for non custom characters in order to give an outline
      // between the text and the underline. Only do this when font size is >= 12 as the underline
      // looks odd when the font size is too small
      if (!customGlyph && this._config.fontSize >= 12) {
        // This only works when transparency is disabled because it's not clear how to clear stroked
        // text
        if (!this._config.allowTransparency && chars !== ' ') {
          // Measure the text, only draw the stroke if there is a descent beyond an alphabetic text
          // baseline
          this._tmpCtx.save();
          this._tmpCtx.textBaseline = 'alphabetic';
          const metrics = this._tmpCtx.measureText(chars);
          this._tmpCtx.restore();
          if ('actualBoundingBoxDescent' in metrics && metrics.actualBoundingBoxDescent > 0) {
            // This translates to 1/2 the line width in either direction
            this._tmpCtx.save();
            // Clip the region to only draw in valid pixels near the underline to avoid a slight
            // outline around the whole glyph, as well as additional pixels in the glyph at the top
            // which would increase GPU memory demands
            const clipRegion = new Path2D();
            clipRegion.rect(xLeft, yTop - Math.ceil(lineWidth / 2), this._config.deviceCellWidth, yBot - yTop + Math.ceil(lineWidth / 2));
            this._tmpCtx.clip(clipRegion);
            this._tmpCtx.lineWidth = this._config.devicePixelRatio * 3;
            this._tmpCtx.strokeStyle = backgroundColor.css;
            this._tmpCtx.strokeText(chars, padding, padding + this._config.deviceCharHeight);
            this._tmpCtx.restore();
          }
        }
      }
    }

    // Draw the character
    if (!customGlyph) {
      this._tmpCtx.fillText(chars, padding, padding + this._config.deviceCharHeight);
    }

    // If this charcater is underscore and beyond the cell bounds, shift it up until it is visible
    // even on the bottom row, try for a maximum of 5 pixels.
    if (chars === '_' && !this._config.allowTransparency) {
      let isBeyondCellBounds = clearColor(this._tmpCtx.getImageData(padding, padding, this._config.deviceCellWidth, this._config.deviceCellHeight), backgroundColor, foregroundColor, enableClearThresholdCheck);
      if (isBeyondCellBounds) {
        for (let offset = 1; offset <= 5; offset++) {
          this._tmpCtx.save();
          this._tmpCtx.fillStyle = backgroundColor.css;
          this._tmpCtx.fillRect(0, 0, this._tmpCanvas.width, this._tmpCanvas.height);
          this._tmpCtx.restore();
          this._tmpCtx.fillText(chars, padding, padding + this._config.deviceCharHeight - offset);
          isBeyondCellBounds = clearColor(this._tmpCtx.getImageData(padding, padding, this._config.deviceCellWidth, this._config.deviceCellHeight), backgroundColor, foregroundColor, enableClearThresholdCheck);
          if (!isBeyondCellBounds) {
            break;
          }
        }
      }
    }

    // Draw strokethrough
    if (strikethrough) {
      const lineWidth = Math.max(1, Math.floor(this._config.fontSize * this._config.devicePixelRatio / 10));
      const yOffset = this._tmpCtx.lineWidth % 2 === 1 ? 0.5 : 0; // When the width is odd, draw at 0.5 position
      this._tmpCtx.lineWidth = lineWidth;
      this._tmpCtx.strokeStyle = this._tmpCtx.fillStyle;
      this._tmpCtx.beginPath();
      this._tmpCtx.moveTo(padding, padding + Math.floor(this._config.deviceCharHeight / 2) - yOffset);
      this._tmpCtx.lineTo(padding + this._config.deviceCharWidth * chWidth, padding + Math.floor(this._config.deviceCharHeight / 2) - yOffset);
      this._tmpCtx.stroke();
    }

    this._tmpCtx.restore();

    // clear the background from the character to avoid issues with drawing over the previous
    // character if it extends past it's bounds
    const imageData = this._tmpCtx.getImageData(
      0, 0, this._tmpCanvas.width, this._tmpCanvas.height
    );

    // Clear out the background color and determine if the glyph is empty.
    let isEmpty: boolean;
    if (!this._config.allowTransparency) {
      isEmpty = clearColor(imageData, backgroundColor, foregroundColor, enableClearThresholdCheck);
    } else {
      isEmpty = checkCompletelyTransparent(imageData);
    }

    // Handle empty glyphs
    if (isEmpty) {
      return NULL_RASTERIZED_GLYPH;
    }

    // TODO: Ideally this wouldn't pull dimensions off the first canvas
    const rasterizedGlyph = this._findGlyphBoundingBox(imageData, this._workBoundingBox, allowedWidth, restrictedPowerlineGlyph, customGlyph, padding, this._pages[0].canvas.width, this._pages[0].canvas.height);

    // Find the best atlas row to use
    let activePage: AtlasPage;
    let activeRow: ICharAtlasActiveRow;
    while (true) {
      // Get the best current row from all active pages
      activePage = this._activePages[this._activePages.length - 1];
      activeRow = activePage.currentRow;
      for (const p of this._activePages) {
        if (rasterizedGlyph.size.y <= p.currentRow.height) {
          activePage = p;
          activeRow = p.currentRow;
        }
      }

      // Replace the best current row with a fixed row if there is one at least as good as the
      // current row
      for (const p of this._activePages) {
        for (const row of p.fixedRows) {
          if (row.height <= activeRow.height && rasterizedGlyph.size.y <= row.height) {
            activePage = p;
            activeRow = row;
          }
        }
      }

      // Create a new one if too much vertical space would be wasted, fixing the previously active
      // row in the process as it now has a fixed height
      if (activeRow.height > rasterizedGlyph.size.y + Constants.ROW_PIXEL_THRESHOLD) {
        // Create the new fixed height row, creating a new page if there isn't enough room on the
        // current page
        if (activePage.currentRow.y + activePage.currentRow.height + rasterizedGlyph.size.y > activePage.canvas.height) {
          // Find the first page with room to create the new row on
          let candidatePage: AtlasPage | undefined;
          for (const p of this._activePages) {
            if (p.currentRow.y + p.currentRow.height + rasterizedGlyph.size.y <= p.canvas.height) {
              candidatePage = p;
              break;
            }
          }
          if (candidatePage === undefined) {
            // Creating a new page if there is no room
            // TODO: Share atlas page creation code
            const newPage = new AtlasPage(this._document, this._config.devicePixelRatio);
            this._pages.push(newPage);
            this._activePages.push(newPage);
            this._onAddTextureAtlasCanvas.fire(newPage.canvas);

            activePage = newPage;
            activeRow = newPage.currentRow;
            activeRow.height = rasterizedGlyph.size.y;
          } else {
            // TODO: Simplify this and share code with below
            activePage = candidatePage;
            // Fix the current row as the new row is being added below
            if (activePage.currentRow.height > 0) {
              activePage.fixedRows.push(activePage.currentRow);
            }
            activeRow = {
              x: 0,
              y: activePage.currentRow.y + activePage.currentRow.height,
              height: rasterizedGlyph.size.y
            };
            activePage.fixedRows.push(activeRow);

            // Create the new current row below the new fixed height row
            activePage.currentRow = {
              x: 0,
              y: activeRow.y + activeRow.height,
              height: 0
            };
          }
        } else {
          // Fix the current row as the new row is being added below
          if (activePage.currentRow.height > 0) {
            activePage.fixedRows.push(activePage.currentRow);
          }
          activeRow = {
            x: 0,
            y: activePage.currentRow.y + activePage.currentRow.height,
            height: rasterizedGlyph.size.y
          };
          activePage.fixedRows.push(activeRow);

          // Create the new current row below the new fixed height row
          activePage.currentRow = {
            x: 0,
            y: activeRow.y + activeRow.height,
            height: 0
          };
        }
        // TODO: Remove pages when all rows are filled

      }

      // Exit the loop if there is enough room in the row
      if (activeRow.x + rasterizedGlyph.size.x <= activePage.canvas.width) {
        console.log(`draw "${chars}" to row ${activeRow} on page ${this._pages.indexOf(activePage)}`);
        break;
      }

      // If there is not enough room in the current row, finish it and try again
      if (activeRow === activePage.currentRow) {
        activeRow.x = 0;
        activeRow.y += activeRow.height;
        activeRow.height = 0;
      } else {
        activePage.fixedRows.splice(activePage.fixedRows.indexOf(activeRow), 1);
      }
    }

    // Record texture position
    rasterizedGlyph.texturePage = this._pages.indexOf(activePage);
    rasterizedGlyph.texturePosition.x = activeRow.x;
    rasterizedGlyph.texturePosition.y = activeRow.y;
    rasterizedGlyph.texturePositionClipSpace.x = activeRow.x / activePage.canvas.width;
    rasterizedGlyph.texturePositionClipSpace.y = activeRow.y / activePage.canvas.height;

    // Update atlas current row, for fixed rows the glyph height will never be larger than the row
    // height
    activeRow.height = Math.max(activeRow.height, rasterizedGlyph.size.y);
    activeRow.x += rasterizedGlyph.size.x;

    // putImageData doesn't do any blending, so it will overwrite any existing cache entry for us
    activePage.ctx.putImageData(
      imageData,
      rasterizedGlyph.texturePosition.x - this._workBoundingBox.left,
      rasterizedGlyph.texturePosition.y - this._workBoundingBox.top,
      this._workBoundingBox.left,
      this._workBoundingBox.top,
      rasterizedGlyph.size.x,
      rasterizedGlyph.size.y
    );
    activePage.hasCanvasChanged = true;

    return rasterizedGlyph;
  }

  /**
   * Given an ImageData object, find the bounding box of the non-transparent
   * portion of the texture and return an IRasterizedGlyph with these
   * dimensions.
   * @param imageData The image data to read.
   * @param boundingBox An IBoundingBox to put the clipped bounding box values.
   */
  private _findGlyphBoundingBox(imageData: ImageData, boundingBox: IBoundingBox, allowedWidth: number, restrictedGlyph: boolean, customGlyph: boolean, padding: number, pageWidth: number, pageHeight: number): IRasterizedGlyph {
    boundingBox.top = 0;
    const height = restrictedGlyph ? this._config.deviceCellHeight : this._tmpCanvas.height;
    const width = restrictedGlyph ? this._config.deviceCellWidth : allowedWidth;
    let found = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alphaOffset = y * this._tmpCanvas.width * 4 + x * 4 + 3;
        if (imageData.data[alphaOffset] !== 0) {
          boundingBox.top = y;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
    }
    boundingBox.left = 0;
    found = false;
    for (let x = 0; x < padding + width; x++) {
      for (let y = 0; y < height; y++) {
        const alphaOffset = y * this._tmpCanvas.width * 4 + x * 4 + 3;
        if (imageData.data[alphaOffset] !== 0) {
          boundingBox.left = x;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
    }
    boundingBox.right = width;
    found = false;
    for (let x = padding + width - 1; x >= padding; x--) {
      for (let y = 0; y < height; y++) {
        const alphaOffset = y * this._tmpCanvas.width * 4 + x * 4 + 3;
        if (imageData.data[alphaOffset] !== 0) {
          boundingBox.right = x;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
    }
    boundingBox.bottom = height;
    found = false;
    for (let y = height - 1; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        const alphaOffset = y * this._tmpCanvas.width * 4 + x * 4 + 3;
        if (imageData.data[alphaOffset] !== 0) {
          boundingBox.bottom = y;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
    }
    return {
      texturePage: 0,
      texturePosition: { x: 0, y: 0 },
      texturePositionClipSpace: { x: 0, y: 0 },
      size: {
        x: boundingBox.right - boundingBox.left + 1,
        y: boundingBox.bottom - boundingBox.top + 1
      },
      sizeClipSpace: {
        x: (boundingBox.right - boundingBox.left + 1) / pageWidth,
        y: (boundingBox.bottom - boundingBox.top + 1) / pageHeight
      },
      offset: {
        x: -boundingBox.left + padding + ((restrictedGlyph || customGlyph) ? Math.floor((this._config.deviceCellWidth - this._config.deviceCharWidth) / 2) : 0),
        y: -boundingBox.top + padding + ((restrictedGlyph || customGlyph) ? this._config.lineHeight === 1 ? 0 : Math.round((this._config.deviceCellHeight - this._config.deviceCharHeight) / 2) : 0)
      }
    };
  }
}

class AtlasPage {
  public readonly canvas: HTMLCanvasElement;
  public readonly ctx: CanvasRenderingContext2D;

  /**
   * Whether the canvas of the atlas page has changed, this is only set to true by the atlas, the
   * user of the boolean is required to reset its value to false.
   */
  public hasCanvasChanged = false;

  // Texture atlas current positioning data. The texture packing strategy used is to fill from
  // left-to-right and top-to-bottom. When the glyph being written is less than half of the current
  // row's height, the following happens:
  //
  // - The current row becomes the fixed height row A
  // - A new fixed height row B the exact size of the glyph is created below the current row
  // - A new dynamic height current row is created below B
  //
  // This strategy does a good job preventing space being wasted for very short glyphs such as
  // underscores, hyphens etc. or those with underlines rendered.
  public currentRow: ICharAtlasActiveRow = {
    x: 0,
    y: 0,
    height: 0
  };
  public readonly fixedRows: ICharAtlasActiveRow[] = [];

  constructor(
    document: Document,
    dpr: number
  ) {
    // TODO: Enforce a maximum texture size
    const size = Math.pow(2, 8 + Math.max(1, dpr));
    this.canvas = createCanvas(document, size, size);
    // The canvas needs alpha because we use clearColor to convert the background color to alpha.
    // It might also contain some characters with transparent backgrounds if allowTransparency is
    // set.
    this.ctx = throwIfFalsy(this.canvas.getContext('2d', { alpha: true }));
  }

  public clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.currentRow.x = 0;
    this.currentRow.y = 0;
    this.currentRow.height = 0;
    this.fixedRows.length = 0;
    this.hasCanvasChanged = true;
  }
}

/**
 * Makes a particular rgb color and colors that are nearly the same in an ImageData completely
 * transparent.
 * @returns True if the result is "empty", meaning all pixels are fully transparent.
 */
function clearColor(imageData: ImageData, bg: IColor, fg: IColor, enableThresholdCheck: boolean): boolean {
  // Get color channels
  const r = bg.rgba >>> 24;
  const g = bg.rgba >>> 16 & 0xFF;
  const b = bg.rgba >>> 8 & 0xFF;
  const fgR = fg.rgba >>> 24;
  const fgG = fg.rgba >>> 16 & 0xFF;
  const fgB = fg.rgba >>> 8 & 0xFF;

  // Calculate a threshold that when below a color will be treated as transpart when the sum of
  // channel value differs. This helps improve rendering when glyphs overlap with others. This
  // threshold is calculated relative to the difference between the background and foreground to
  // ensure important details of the glyph are always shown, even when the contrast ratio is low.
  // The number 12 is largely arbitrary to ensure the pixels that escape the cell in the test case
  // were covered (fg=#8ae234, bg=#c4a000).
  const threshold = Math.floor((Math.abs(r - fgR) + Math.abs(g - fgG) + Math.abs(b - fgB)) / 12);

  // Set alpha channel of relevent pixels to 0
  let isEmpty = true;
  for (let offset = 0; offset < imageData.data.length; offset += 4) {
    // Check exact match
    if (imageData.data[offset] === r &&
        imageData.data[offset + 1] === g &&
        imageData.data[offset + 2] === b) {
      imageData.data[offset + 3] = 0;
    } else {
      // Check the threshold based difference
      if (enableThresholdCheck &&
          (Math.abs(imageData.data[offset] - r) +
          Math.abs(imageData.data[offset + 1] - g) +
          Math.abs(imageData.data[offset + 2] - b)) < threshold) {
        imageData.data[offset + 3] = 0;
      } else {
        isEmpty = false;
      }
    }
  }

  return isEmpty;
}

function checkCompletelyTransparent(imageData: ImageData): boolean {
  for (let offset = 0; offset < imageData.data.length; offset += 4) {
    if (imageData.data[offset + 3] > 0) {
      return false;
    }
  }
  return true;
}

function createCanvas(document: Document, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
