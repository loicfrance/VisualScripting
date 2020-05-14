
const templateCtxMenu = document.querySelector('#context-menu-template').content;

class CustomContextMenu {

    constructor(templateElmt, optionsTree) {
        this.element = templateCtxMenu.querySelector(".context-menu").cloneNode(true);
        for(let x in optionsTree) {
            if (optionsTree.hasOwnProperty(x)) {

            }
        }
    }
}