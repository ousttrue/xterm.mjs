export default class VaoObject {
  private readonly _vertexArrayObject: WebGLVertexArrayObject;
  constructor(private _gl: WebGL2RenderingContext) {
    this._vertexArrayObject = this._gl.createVertexArray()!;
  }

  dispose() {
    this._gl.deleteVertexArray(this._vertexArrayObject);
  }

  bind() {
    this._gl.bindVertexArray(this._vertexArrayObject);
  }

  unbind() {
    this._gl.bindVertexArray(null);
  }

  draw(drawCount: number) {
    this.bind();
    this._gl.drawElementsInstanced(
      this._gl.TRIANGLE_STRIP, 4,
      this._gl.UNSIGNED_BYTE, 0,
      drawCount
    );
    this.unbind();
  }
}

