/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICharacterJoinerService, ICharSizeService, ICoreBrowserService, IRenderService, IThemeService } from 'browser/services/Services.mjs';
import { ITerminal } from 'browser/Types.mjs';
import { EventEmitter, forwardEvent } from 'common/EventEmitter.mjs';
import { Disposable, toDisposable } from 'common/Lifecycle.mjs';
import { getSafariVersion, isSafari } from 'common/Platform.mjs';
import { ICoreService, IDecorationService, ILogService, IOptionsService } from 'common/services/Services.mjs';
import { ITerminalAddon, Terminal } from 'xterm';
import { WebglExternalRenderer } from './WebglExternalRenderer.mjs';
import { setTraceLogger } from 'common/services/LogService.mjs';
import { IWebGL2RenderingContext } from './Types.mjs';
import { BufferNamespaceApi } from 'common/public/BufferNamespaceApi.mjs';

export class WebglExternalAddon extends Disposable implements ITerminalAddon {
  private _terminal?: Terminal;
  _renderer?: WebglExternalRenderer;
  private readonly _gl: IWebGL2RenderingContext;

  private readonly _onChangeTextureAtlas = this.register(new EventEmitter<HTMLCanvasElement>());
  public readonly onChangeTextureAtlas = this._onChangeTextureAtlas.event;
  private readonly _onAddTextureAtlasCanvas = this.register(new EventEmitter<HTMLCanvasElement>());
  public readonly onAddTextureAtlasCanvas = this._onAddTextureAtlasCanvas.event;
  private readonly _onRemoveTextureAtlasCanvas = this.register(new EventEmitter<HTMLCanvasElement>());
  public readonly onRemoveTextureAtlasCanvas = this._onRemoveTextureAtlasCanvas.event;
  private readonly _onContextLoss = this.register(new EventEmitter<void>());
  public readonly onContextLoss = this._onContextLoss.event;

  constructor(
    gl: IWebGL2RenderingContext
  ) {
    if (isSafari && getSafariVersion() < 16) {
      throw new Error('Webgl2 is only supported on Safari 16 and above');
    }
    super();
    this._gl = gl;
  }

  public activate(terminal: Terminal): void {
    const core = (terminal as any)._core as ITerminal;
    if (!terminal.element) {
      this.register(core.onWillOpen(() => this.activate(terminal)));
      return;
    }
    this._terminal = terminal;
    this.activateCore(core, terminal.buffer, this._gl);
    this.register(toDisposable(() => {
      const renderService: IRenderService = (this._terminal as any)._core._renderService;
      renderService.setRenderer((this._terminal as any)._core._createRenderer());
      renderService.handleResize(terminal.cols, terminal.rows);
    }));
  }

  public activateCore(core: ITerminal, buffer: BufferNamespaceApi, gl: IWebGL2RenderingContext): void {
    // workaround
    core._core = core;

    const coreService: ICoreService = core.coreService;
    const optionsService: IOptionsService = core.optionsService;
    const unsafeCore = core as any;
    const renderService: IRenderService = unsafeCore._renderService;
    const characterJoinerService: ICharacterJoinerService = unsafeCore._characterJoinerService;
    const charSizeService: ICharSizeService = unsafeCore._charSizeService;
    const coreBrowserService: ICoreBrowserService = unsafeCore._coreBrowserService;
    const decorationService: IDecorationService = unsafeCore._decorationService;
    const logService: ILogService = unsafeCore._logService;
    const themeService: IThemeService = unsafeCore._themeService;

    // Set trace logger just in case it hasn't been yet which could happen when the addon is
    // bundled separately to the core module
    setTraceLogger(logService);

    this._renderer = this.register(new WebglExternalRenderer(
      gl, core, buffer,
      characterJoinerService,
      charSizeService,
      coreBrowserService,
      coreService,
      decorationService,
      optionsService,
      themeService,
    ));
    this.register(forwardEvent(this._renderer.onContextLoss, this._onContextLoss));
    this.register(forwardEvent(this._renderer.onChangeTextureAtlas, this._onChangeTextureAtlas));
    this.register(forwardEvent(this._renderer.onAddTextureAtlasCanvas, this._onAddTextureAtlasCanvas));
    this.register(forwardEvent(this._renderer.onRemoveTextureAtlasCanvas, this._onRemoveTextureAtlasCanvas));
    renderService.setRenderer(this._renderer);
  }

  public get textureAtlas(): HTMLCanvasElement | undefined {
    return this._renderer?.textureAtlas;
  }

  public clearTextureAtlas(): void {
    this._renderer?.clearTextureAtlas();
  }
}
