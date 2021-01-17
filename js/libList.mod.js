
const rootElementSym = Symbol("root HTML element");
const boardSym = Symbol("FBP design board");

class LibraryTreeView {
    [boardSym];
    [rootElementSym];

    constructor(board, rootUlElement) {
        this[boardSym] = board;
        this[rootElementSym] = rootUlElement;
    }
    update() {
        const libLoader = this[boardSym].fbpSheet.libLoader;
        if(libLoader.isLibLoaded("")) {

        }
    }
    isLibOpened(fullName) {

    }
    displayLib(fullName) {
        const libLoader = this[boardSym].fbpSheet.libLoader;
        if(!libLoader.isLibLoaded(fullName)) {
            libLoader.loadLib(fullName).then(r => this.displayLib(fullName));
            return;
        }
        /*
        const libName = fullName.replaceAll(/[/\\]/g, '.');
        let libPanel = (libName !== "")
            ? panel.querySelector(`#lib_${libName}`)
            : panel;
        const lib = await this.loadLib(libName);
        if(!lib)
            throw Error(`unknown library ${libName}`);

        if (libPanel) {
            const item = document.createElement("li");
            const nameElement = document.createElement("span");
            item.appendChild(nameElement);
            if("libraries" in lib) {
                const subLibs = lib.libraries;
                libPanel.append(...Object.values(subLibs).map(subLib=>{
                    const libItem = item.cloneNode(true);
                    libItem.className = "lib";
                    libItem.querySelector("span").textContent = subLib.name;
                    return libItem;
                }));
            }
            if("processes" in lib) {
                const processes = lib.processes;
                libPanel.append(...Object.values(processes).map(process=>{
                    const procItem = item.cloneNode(true);
                    procItem.className = "process";
                    procItem.querySelector("span").textContent = process.name;
                    return procItem;
                }));
            }
        }
        */
    }
}