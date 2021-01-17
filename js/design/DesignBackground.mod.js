
//##############################################################################
//#                              PRIVATE SYMBOLS                               #
//##############################################################################

//______________________________ private methods _______________________________
//------------------------------------------------------------------------------

const calculateGaps = Symbol("calculate gap between lines/dots");
const requestUpdate = Symbol("request background update");
const updateStyle = Symbol("update background style");
const draw = Symbol("draw background");

//_____________________________ private attributes _____________________________
//------------------------------------------------------------------------------

const htmlElementSym = Symbol("HTML element");
const bgColorSym = Symbol("background color");
const primaryColorSym = Symbol("primary color");
const secondaryColorSym = Symbol("secondary color");
const primaryThicknessSym = Symbol("primary thickness");
const secondaryThicknessSym = Symbol("secondary thickness");
const minGapSym = Symbol("minimum gap between background elements");
const divisionsSym = Symbol("number of divisions between two main bg elements");
const styleSym = Symbol("background style");
const zoomFactorSym = Symbol("zoom factor");
const offsetXSym = Symbol("background offset X");
const offsetYSym = Symbol("background offset Y");

const updateRequestedSym = Symbol("background drawing requested");
const styleChangedSym = Symbol("background style changed");

//##############################################################################
//#                            PUBLIC RELATED TYPES                            #
//##############################################################################

/**
 * @enum
 */
const BackgroundStyle = {
    NONE: 0,
    LINES: 1,
    DOTS: 2
};

const configDefault = {
    bgColor: '#2b2b2b',
    style: BackgroundStyle.LINES,
    minGap: 20,
    divisions: 5,
    primaryColor: '#FFFFFF11',
    secondaryColor: '#FFFFFF44',
    primaryThickness: 1,
    secondaryThickness: 1,
    initialZoom: 1,
    zeroX: 0,
    zeroY: 0
};

class DesignBackground {

//##############################################################################
//#                             PRIVATE ATTRIBUTES                             #
//##############################################################################

    [htmlElementSym];
    [bgColorSym];
    [primaryColorSym];
    [secondaryColorSym];
    [primaryThicknessSym];
    [secondaryThicknessSym];
    [minGapSym];
    [divisionsSym];
    [styleSym];
    [zoomFactorSym];
    [offsetXSym];
    [offsetYSym];
    [updateRequestedSym] = false;
    [styleChangedSym] = true;

//##############################################################################
//#                                CONSTRUCTOR                                 #
//##############################################################################

    /**
     *
     * @param {HTMLDivElement} div
     * @param {Object} config
     * @param {string} [config.bgColor]
     * @param {BackgroundStyle} [config.style]
     * @param {number} [config.minGap]
     * @param {number} [config.divisions]
     * @param {string} [config.primaryColor]
     * @param {string} [config.secondaryColor]
     * @param {number} [config.primaryThickness]
     * @param {number} [config.secondaryThickness]
     * @param {number} [config.initialZoom]
     * @param {number} [config.zeroX]
     * @param {number} [config.zeroY]
     */
    constructor(div, config) {
        const {
            bgColor = '#2b2b2b',
            style = BackgroundStyle.LINES,
            minGap = 20,
            divisions = 5,
            primaryColor = '#FFFFFF11',
            secondaryColor = '#FFFFFF44',
            primaryThickness = 1,
            secondaryThickness = 1,
            initialZoom = 1,
            zeroX = 0,
            zeroY = 0
        } = (config || {});

        // noinspection DuplicatedCode
        this.htmlElement = div;
        this.bgColor = bgColor;
        this.primaryColor = primaryColor;
        this.secondaryColor = secondaryColor;
        this.primaryThickness = primaryThickness;
        this.secondaryThickness = secondaryThickness;
        this.style = style;
        this.minGap = minGap;
        this.divisions = divisions;
        this.updatePosition(zeroX, zeroY, initialZoom);
    }

//##############################################################################
//#                                 ACCESSORS                                  #
//##############################################################################

    get htmlElement() { return this[htmlElementSym]; }
    set htmlElement(element) {
        this[htmlElementSym] = element;
        this[requestUpdate]();
    }
    get bgColor() { return this[bgColorSym]; }
    set bgColor(value) {
        this[bgColorSym] = value;
        this[requestUpdate](true);
    }
    get primaryColor() { return this[primaryColorSym]; }
    set primaryColor(value) {
        this[primaryColorSym] = value;
        this[requestUpdate](true);
    }
    get secondaryColor() { return this[secondaryColorSym]; }
    set secondaryColor(value) {
        this[secondaryColorSym] = value;
        this[requestUpdate](true);
    }
    get primaryThickness() { return this[primaryThicknessSym]; }
    set primaryThickness(value) {
        this[primaryThicknessSym] = value;
        this[requestUpdate](true);
    }
    get secondaryThickness() { return this[secondaryThicknessSym]; }
    set secondaryThickness(value) {
        this[secondaryThicknessSym] = value;
        this[requestUpdate](true);
    }
    get minGap() { return this[minGapSym]; }
    set minGap(value) {
        this[minGapSym] = value;
        this[requestUpdate]();
    }
    get divisions() { return this[divisionsSym]; }
    set divisions(value) {
        this[divisionsSym] = value;
        this[requestUpdate]();
    }
    get style() { return this[styleSym]; }
    set style(value) {
        this[styleSym] = value;
        this[requestUpdate](true);
    }

//##############################################################################
//#                               PUBLIC METHODS                               #
//##############################################################################

    setColors(background, primary = this.primaryColor, secondary = this.secondaryColor) {
        this.bgColor = background;
        this.primaryColor = primary;
        this.secondaryColor = secondary;
    }

    updatePosition(zeroX, zeroY, zoomFactor) {
        this[offsetXSym] = zeroX;
        this[offsetYSym] = zeroY;
        this[zoomFactorSym] = zoomFactor;
        this[requestUpdate]();
    }

//##############################################################################
//#                              PRIVATE METHODS                               #
//##############################################################################

    [requestUpdate](styleChanged = false) {
        this[styleChangedSym] = this[styleChangedSym] || styleChanged;
        if(!this[updateRequestedSym]) {
            requestAnimationFrame(this[draw].bind(this));
            this[updateRequestedSym] = true;
        }
    }

    [calculateGaps]() {
        let smallGap = this[zoomFactorSym]*this.minGap;
        while(smallGap < this.minGap) smallGap *= this.divisions;
        while(smallGap > this.minGap * this.divisions)
            smallGap /= this.divisions;
        const bigGap = smallGap * this.divisions;
        return [smallGap, bigGap];
    }

    [updateStyle]() {
        this[styleChangedSym] = false;
        this.htmlElement.style.backgroundColor = this.bgColor;
        switch(this.style) {
            case BackgroundStyle.LINES:
                const s = `${this.secondaryColor} ${this.secondaryThickness}px, transparent 1px`;
                const p = `${this.primaryColor} ${this.primaryThickness}px, transparent 1px`;

                this.htmlElement.style.backgroundImage = [
                    `linear-gradient(${s}), linear-gradient(90deg, ${s})`,
                    `linear-gradient(${p}), linear-gradient(90deg, ${p})`].join(", ");
                break;

            case BackgroundStyle.DOTS:
                throw Error(`unimplemented style DOTS`);

            case BackgroundStyle.NONE:
                this.htmlElement.style.removeProperty('backgroundImage');
                break;

            default:
                throw Error(`unknown style ${this.style}`);
        }
    }

    [draw]() {
        this[updateRequestedSym] = false;
        if(this[styleChangedSym])
            this[updateStyle]();
        switch(this.style) {
            case BackgroundStyle.LINES:
                const [gP, gS] = this[calculateGaps]();
                const [tP, tS] = [this.primaryThickness, this.secondaryThickness];
                const [dX, dY] = [this[offsetXSym], this[offsetYSym]]
                    .map(x=> (x * this[zoomFactorSym]) % gS);
                this.htmlElement.style.backgroundSize =
                    `${tS}px ${gS}px, ${gS}px ${tS}px, ${tP}px ${gP}px, ${gP}px ${tP}px`;
                const pos = `${dX}px ${dY}px`;
                this.htmlElement.style.backgroundPosition = [pos, pos, pos, pos].join(',');
                break;

            case BackgroundStyle.DOTS:
                throw Error("unimplemented background style");

            case BackgroundStyle.NONE:
            default:
                break;

        }
    }
}

export default DesignBackground;

export {
    DesignBackground,
    BackgroundStyle
};