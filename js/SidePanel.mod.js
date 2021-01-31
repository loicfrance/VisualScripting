import {dragListener} from "./design/designUtils.mod.js";
import {createElement} from "../../jslib/utils/createHtml.mod.js";

const panelDivSym = Symbol("side-panel html div");
const contentDivSym = Symbol("side-panel content html div");
const resizerSym = Symbol("side-panel resizer html div");

class SidePanel {
    [panelDivSym] = createElement("div", {class:"side-panel"});
    [resizerSym] = createElement("div", {class:"resizer"});
    [contentDivSym] = createElement("div", {class:"content"});

    constructor(direction, opened = true) {
        if(!["left", "right"].includes(direction))
            throw Error(`unknown side-panel direction ${direction}`);
        this[panelDivSym].toggleAttribute(direction, true);
        if(opened)
            this.open();
        this.panelDiv.append(this.resizer, this.contentDiv);
        {
            let initialDx = 0;
            let disableClick = false;
            const mouseDown = dragListener.bind(this, {
                onStart: (evt, pos)=> {
                    initialDx = (direction === 'left') ?
                                    pos.x - this.panelDiv.getBoundingClientRect().right
                                :   pos.x - this.panelDiv.getBoundingClientRect().left;
                    disableClick = false;
                },
                onMove: (evt, pos)=> {
                    const boundingRect = this.panelDiv.getBoundingClientRect();
                    const dW = (direction === 'left') ?
                                    pos.x - boundingRect.right - initialDx
                                :   boundingRect.left + initialDx - pos.x;
                    if (dW !== 0)
                        disableClick = true;

                    const w = Math.max(0, this.panelDiv.offsetWidth + dW);
                    if (w >= 10)
                        this.panelDiv.style.width = w + 'px';
                    if (this.isOpen()) {
                        if (w < 10) this.close();
                    }
                    else if (w >= 10)
                        this.open();
                }
            });
            this.resizer.addEventListener('mousedown', mouseDown);
            this.resizer.addEventListener('click', ()=> {
                if(disableClick) {
                    disableClick = false;
                } else {
                    if(this.isOpen())
                        this.close();
                    else
                        this.open();
                }
            });
        }
    }
    get panelDiv() { return this[panelDivSym]; }
    get resizer() { return this[resizerSym]; }
    get contentDiv() { return this[contentDivSym]; }
    get direction() {
        return this.panelDiv.hasAttribute("left") ? "left"
            :  this.panelDiv.hasAttribute("right") ? "right"
            : undefined;
    }

    isOpen() {
        return this.panelDiv.hasAttribute("open");
    }
    toggle() {
        this.panelDiv.toggleAttribute("open");
    }
    open() {
        if(!this.isOpen()) this.toggle();
    }
    close() {
        if(this.isOpen()) this.toggle();
    }
}

export default SidePanel;