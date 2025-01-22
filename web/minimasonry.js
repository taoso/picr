// see https://spope.github.io/MiniMasonry.js/

class MiniMasonry {
  constructor(conf) {
    this._sizes             = []
    this._columns           = []
    this._container         = null
    this._count             = 3
    this._width             = 0
    this._removeListener    = null
    this._currentGutterX    = null
    this._currentGutterY    = null

    this._resizeTimeout = null,

    this.conf = {
      baseWidth: 255,
      gutterX: null,
      gutterY: null,
      gutter: 10,
      container: null,
      minify: true,
      surroundingGutter: false,
      direction: 'ltr',
      wedge: false
    }

    this.init(conf)
  }
  init(conf) {
    for (let i in this.conf) {
      if (conf[i] != undefined) {
        this.conf[i] = conf[i]
      }
    }

    if (this.conf.gutterX == null || this.conf.gutterY == null) {
      this.conf.gutterX = this.conf.gutterY = this.conf.gutter
    }
    this._currentGutterX = this.conf.gutterX
    this._currentGutterY = this.conf.gutterY

    this._container = typeof this.conf.container == 'object' && this.conf.container.nodeName ?
      this.conf.container :
      document.querySelector(this.conf.container)

    if (!this._container) {
      throw new Error('Container not found or missing')
    }

    let onResize = this.resizeThrottler.bind(this)
    window.addEventListener("resize", onResize)
    this._removeListener = function() {
      window.removeEventListener("resize", onResize)
      if (this._resizeTimeout != null) {
        window.clearTimeout(this._resizeTimeout)
        this._resizeTimeout = null
      }
    }

    this.layout()
  }
  reset() {
    this._sizes   = []
    this._columns = []
    this._width   = this._container.clientWidth
    this._currentGutterX = this.conf.gutterX
  }
  computeWidth() {
    let width
    if (this.conf.surroundingGutter) {
      width = ((this._width - this._currentGutterX) / this._count) - this._currentGutterX
    } else {
      width = ((this._width + this._currentGutterX) / this._count) - this._currentGutterX
    }
    width = Number.parseFloat(width.toFixed(2))

    return width
  }
  layout() {
    if (!this._container) {
      console.error('Container not found')
      return
    }
    this.reset()

    //Computing columns width
    let colWidth = this.computeWidth()

    for (let i = 0; i < this._count; i++) {
      this._columns[i] = 0
    }

    //Saving children real heights
    let children = this._container.children
    for (let k = 0; k < children.length; k++) {
      // Set colWidth before retrieving element height if content is proportional
      children[k].style.width = colWidth + 'px'
      this._sizes[k] = colWidth * children[k].dataset.radio
    }

    let startX
    if (this.conf.direction == 'ltr') {
      startX = this.conf.surroundingGutter ? this._currentGutterX : 0
    } else {
      startX = this._width - (this.conf.surroundingGutter ? this._currentGutterX : 0)
    }
    if (this._count > this._sizes.length) {
      //If more columns than children
      let occupiedSpace = (this._sizes.length * (colWidth + this._currentGutterX)) - this._currentGutterX
      if (this.conf.wedge === false) {
        if (this.conf.direction == 'ltr') {
          startX = ((this._width - occupiedSpace) / 2)
        } else {
          startX = this._width - ((this._width - occupiedSpace) / 2)
        }
      } else {
        if (this.conf.direction == 'ltr') {
          //
        } else {
          startX = this._width - this._currentGutterX
        }
      }
    }

    //Computing position of children
    for (let index = 0; index < children.length; index++) {
      let nextColumn = this.conf.minify ? this.getShortest() : this.getNextColumn(index)

      let childrenGutter = 0
      if (this.conf.surroundingGutter || nextColumn != this._columns.length) {
        childrenGutter = this._currentGutterX
      }
      let x
      if (this.conf.direction == 'ltr') {
        x = startX + ((colWidth + childrenGutter) * (nextColumn))
      } else {
        x = startX - ((colWidth + childrenGutter) * (nextColumn)) - colWidth
      }
      let y = this._columns[nextColumn]

      children[index].style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)'

      this._columns[nextColumn] += this._sizes[index] + this.conf.gutterY
    }

    this._container.style.height = this._columns[this.getLongest()] - this.conf.gutterY + 'px'
  }
  getNextColumn(index) {
    return index % this._columns.length
  }
  getShortest() {
    let shortest = 0
    for (let i = 0; i < this._count; i++) {
      if (this._columns[i] < this._columns[shortest]) {
        shortest = i
      }
    }

    return shortest
  }
  getLongest() {
    let longest = 0
    for (let i = 0; i < this._count; i++) {
      if (this._columns[i] > this._columns[longest]) {
        longest = i
      }
    }

    return longest
  }
  resizeThrottler() {
    // ignore resize events as long as an actualResizeHandler execution is in the queue
    if ( !this._resizeTimeout ) {
      this._resizeTimeout = setTimeout(function() {
        this._resizeTimeout = null
        //IOS Safari throw random resize event on scroll, call layout only if size has changed
        if (this._container.clientWidth != this._width) {
          this.layout()
        }
        // The actualResizeHandler will execute at a rate of 30fps
      }.bind(this), 33)
    }
  }
  destroy() {
    if (typeof this._removeListener == "function") {
      this._removeListener()
    }

    let children = this._container.children
    for (let k = 0; k < children.length; k++) {
      children[k].style.removeProperty('width')
      children[k].style.removeProperty('transform')
    }
    this._container.style.removeProperty('height')
    this._container.style.removeProperty('min-width')
  }
}

export default MiniMasonry
