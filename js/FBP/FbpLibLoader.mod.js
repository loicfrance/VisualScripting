import BusyCount from "../../../jslib/utils/BusyCount.mod.js";
import {loadString} from "../../../jslib/utils/tools.mod.js";

const loadSym = Symbol("base loader");
const busyCountSym = Symbol("busy count");

const incrementBusy = Symbol("increment busy count");
const decrementBusy = Symbol("decrement busy count");

/**
 * @typedef FbpProcessHandler
 * @property {function(parameters:object)} onCreate
 * @property {function(parameters:object)} [onChange]
 * @property {function(display:FbpObjectDisplay)} [onDisplay]
 * @property {function: Array<object>} [getParameters]
 * @property {function(parameters:object):(string|null)} [checkParameters]
 * @property {function(port:string):any} [getPassThroughValue]
 * @property {function(port:string, packet:any)} [onPacket]
 * @property {function():Object} [exportJSON]
 */

/**
 * @typedef {Map<string,FbpType>} TypesMap
 */

/**
 * @typedef TypesModule
 * @property {function(FbpType:function(new:FbpType, Map, object), typesMap:TypesMap?, override:boolean?):TypesMap} getTypes
 * @property {function: Array<string>} [getTypesList]
 */

class FbpLoader {

    libs = new Map();
    processes = new Map();
    typeLibs = new Map();
    [busyCountSym] = new BusyCount();

    [incrementBusy] = this[busyCountSym].increment.bind(this[busyCountSym]);
    [decrementBusy] = this[busyCountSym].decrement.bind(this[busyCountSym]);

    constructor(libRootUrl=undefined) {
        this.libs.set("", {
            libraries: {}
        });
        if(libRootUrl) {
            // noinspection JSIgnoredPromiseFromCall
            this.addRootUrl(libRootUrl);
        }
    }

    async addRootUrl(rootUrl) {
        rootUrl = rootUrl.replaceAll("\\", "/");
        if(!rootUrl.endsWith('/'))
            rootUrl += "/";

        this[incrementBusy]();
        loadString(rootUrl+"_lib.json")
            .then(text=>JSON.parse(text, (key, value)=>
                ["dir","src","href","url"].includes(key) ? (rootUrl + value) : value
            ))
            .then(({libraries})=>{
                Object.assign(this.getLoadedLib("").libraries, libraries);
            })
            .then(this[decrementBusy]);
    }

    async getLibURL(libName) {
        let url = "";
        let lib = this.getLoadedLib("");
        while(libName.includes("/")) {
            const nextLib = libName.substring(0, libName.indexOf("/"));
            if (!("libraries" in lib) || !(nextLib in lib["libraries"])) {
                if (url === "") {
                    await this.finishLoadings();
                    lib = this.getLoadedLib(""); // TODO: maybe useless, object should be modified
                    if(!(nextLib in lib["libraries"]))
                        return undefined;
                }
                else {
                    return undefined;
                }
            }
            url += lib["libraries"][nextLib];
            if (!url.endsWith("/"))
                url += "/";

            libName = libName.substring(nextLib.length+1);
            lib = this.loadLib(nextLib)
        }
        if (url === "") {
            await this.finishLoadings();
        }
        if (libName.length === 0)
            return url;
        if (!("libraries" in lib) || !(libName in lib["libraries"]))
            return undefined;
        return url + lib["libraries"][libName]["dir"];
    }

    async loadLib(name) {
        if (this.libs.has(name)) {
            if(this.libs.get(name) instanceof Promise) {
                this[incrementBusy]();
                await this.libs.get(name);
                this[decrementBusy]();
            }
            return this.libs.get(name);
        } else {
            const url = await this.getLibURL(name)+"_lib.json";
            this[incrementBusy]();
            this.libs.set(name, await loadString(url).then(JSON.parse));
            this[decrementBusy]();
            return this.libs.get(name);
        }
    }

    async [loadSym](fullName, map, jsonTag) {
        if (map.has(fullName))
            return map.get(fullName);
        const idx = fullName.lastIndexOf("/");
        const lib_name = fullName.substring(0, idx);
        const elmt_name = fullName.substring(idx+1);
        const lib_path = await this.getLibURL(lib_name);
        const lib = await this.loadLib(lib_name);
        if (lib !== undefined && jsonTag in lib && elmt_name in lib[jsonTag]) {
            this[incrementBusy]();
            const module = await import(lib_path + lib[jsonTag][elmt_name]["src"]);
            this[decrementBusy]();
            map.set(fullName, module);
            return module;
        }
        return undefined;
    }

    /**
     * @param {string} fullName
     * @return {FbpProcessHandler}
     */
    async loadHandler(fullName) {
        return await this[loadSym](fullName, this.processes, "processes");
    }

    isLibLoaded(fullName) {
        return this.libs.has(fullName)
            && !(this.libs.get(fullName) instanceof Promise);
    }
    isHandlerLoaded(fullName) {
        return this.processes.has(fullName);
    }
    isTypesLibLoaded(fullName) {
        return this.typeLibs.has(fullName);
    }
    getLoadedLib(fullName) {
        return this.libs.get(fullName);
    }
    getLoadedHandler(fullName) {
        return this.processes.get(fullName);
    }
    getLoadedTypesLib(fullName) {
        return this.typeLibs.get(fullName);
    }

    /**
     * @param {string} fullName
     * @return {TypesModule}
     */
    async loadTypesLib(fullName) {
        return await this[loadSym](fullName, this.typeLibs, "types");
    }

    async displayLib(panel, libName) {
        libName = libName.replaceAll(/[/\\]/g, '.');
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
    }
    async finishLoadings() {
        await this[busyCountSym].wait();
    }

}
export {
    FbpLoader
};
export default FbpLoader