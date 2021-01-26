import {dragListener} from "./design/designUtils.mod.js";

class SidePanel {
    constructor(div, direction) {
        this.panel = div;
        this.panelTitle = this.panel.querySelector('.title');
        this.contentDiv = this.panel.querySelector('.content');
        this.resizer = this.panel.querySelector('.resizer');
        this.direction = direction;
        {
            let initialDx = 0;
            let disableClick = false;
            const mouseDown = dragListener.bind(this, {
                onStart: (evt, pos)=> {
                    initialDx = (direction === 'left') ?
                                    pos.x - this.panel.getBoundingClientRect().right
                                :   pos.x - this.panel.getBoundingClientRect().left;
                    disableClick = false;
                },
                onMove : (evt, pos)=> {
                    const boundingRect = this.panel.getBoundingClientRect();
                    const dW = (direction === 'left') ?
                                    pos.x - boundingRect.right - initialDx
                                :   boundingRect.left + initialDx - pos.x;
                    if (dW !== 0)
                        disableClick = true;

                    const w = Math.max(0, this.panel.offsetWidth + dW);
                    if (w >= 10) {
                        this.panel.style.width = w + 'px';
                    }
                    if (this.isOpen()) {
                        if (w < 10) this.close();
                    } else if(w >= 10) this.open();

                }
            });
            this.resizer.addEventListener('mousedown', mouseDown);
            this.resizer.addEventListener('click', (evt)=> {
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
    isOpen() {
        return this.panel.hasAttribute("open");
    }
    toggle() {
        this.panel.toggleAttribute("open");
        this.panelTitle.innerText = this.panelTitle.innerText === "\u25C4" ? "\u25BA" : "\u25C4"
    }
    open() {
        if(!this.isOpen()) this.toggle();
    }
    close() {
        if(this.isOpen()) this.toggle();
    }
}

export default SidePanel;