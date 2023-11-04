import { Disposable, MutableDisposable } from "../src/common/Lifecycle.mts";
import { ICharSizeService, IRenderService } from "../src/browser/services/Services.mts";
import { EventEmitter, IEvent } from "../src/common/EventEmitter.mts";

export default class FixedCharSizeService extends Disposable implements ICharSizeService {
  public serviceBrand: undefined;
  public width: number = 0;
  public height: number = 0;
  private _width: number = 0;
  private _height: number = 0;
  public get hasValidSize(): boolean { return this.width > 0 && this.height > 0; }
  private readonly _onCharSizeChange = this.register(new EventEmitter<void>());
  public readonly onCharSizeChange = this._onCharSizeChange.event;
  constructor(
  ) {
    super();
  }
  setSize(width: number, height: number) {
    this._width = width;
    this._height = height;
    this.measure();
  }
  public measure(): void {
    if (this._width !== this.width || this._height !== this.height) {
      this.width = this._width;
      this.height = this._height;
      const result = { width: this.width, height: this.height };
      console.log(result);
      this._onCharSizeChange.fire();
    }
  }
}
