/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { DecorationService } from './DecorationService.mjs';
import { EventEmitter } from 'common/EventEmitter.mjs';
import { IMarker } from 'common/Types.mjs';
import { Disposable } from 'common/Lifecycle.mjs';

const fakeMarker: IMarker = Object.freeze(new class extends Disposable {
  public readonly id = 1;
  public readonly line = 1;
  public readonly isDisposed = false;
  public readonly onDispose = new EventEmitter<void>().event;
}());

describe('DecorationService', () => {
  it('should set isDisposed to true after dispose', () => {
    const service = new DecorationService();
    const decoration = service.registerDecoration({
      marker: fakeMarker
    });
    assert.ok(decoration);
    assert.isFalse(decoration!.isDisposed);
    decoration!.dispose();
    assert.isTrue(decoration!.isDisposed);
  });
});
