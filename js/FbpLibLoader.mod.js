import BusyCount from "../../jslib/utils/BusyCount.mod.js";
import {loadString} from "../../jslib/utils/tools.mod.js";

const loadSym = Symbol("base loader");
const busyCountSym = Symbol("busy count");

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

    libRootUrl;
    libs =  new Map();
    processes = new Map();
    typeLibs = new Map();
    [busyCountSym] = new BusyCount();


    constructor(libRootUrl) {
        this.libRootUrl = libRootUrl;
        this.libRootUrl = this.libRootUrl.replaceAll("\\", "/")
        if (!this.libRootUrl.endsWith("/")) {
            this.libRootUrl += "/";
        }
        this[busyCountSym].increment();
        this.libs.set("", loadString(libRootUrl+"_lib.json")
            .then(JSON.parse)
            .then(this.libs.set.bind(this.libs, ""))
            .then(this[busyCountSym].decrement.bind(this[busyCountSym])));
    }

    async getLibPath(libName) {
        let path = this.libRootUrl;
        let lib = await this.loadLib("");

        while(libName.includes("/")) {
            const nextLib = libName.substring(0, libName.indexOf("/"));
            if (!("libraries" in lib) || !(nextLib in lib["libraries"])) {
                return undefined;
            }
            path += lib["libraries"][nextLib];
            if (path[path.length-1] !== "/")
                path += "/"
            libName = libName.substring(nextLib.length+1);
            lib = this.loadLib(nextLib)
        }
        if (libName.length === 0)
            return path;
        if (!("libraries" in lib) || !(libName in lib["libraries"]))
            return undefined;
        return path + lib["libraries"][libName]["dir"];
    }

    async loadLib(name) {
        if (this.libs.has(name)) {
            if(this.libs.get(name) instanceof Promise) {
                this[busyCountSym].increment();
                await this.libs.get(name);
                this[busyCountSym].decrement();
            }
            return this.libs.get(name);
        } else {
            this[busyCountSym].increment();
            const url = await this.getLibPath(name)+"_lib.json";
            this.libs.set(name, await loadString(url).then(JSON.parse));
            this[busyCountSym].decrement();
            return this.libs.get(name);
        }
    }

    async [loadSym](fullName, map, jsonTag) {
        if (map.has(fullName))
            return map.get(fullName);
        const idx = fullName.lastIndexOf("/");
        const lib_name = fullName.substring(0, idx);
        const elmt_name = fullName.substring(idx+1);
        const lib_path = await this.getLibPath(lib_name);
        const lib = await this.loadLib(lib_name);
        if (lib !== undefined && jsonTag in lib && elmt_name in lib[jsonTag]) {
            const module = await import(lib_path + lib[jsonTag][elmt_name]["src"]);
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
        this[busyCountSym].increment();
        const result = await this[loadSym](fullName, this.processes, "processes");
        this[busyCountSym].decrement();
        return result;
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
        this[busyCountSym].increment();
        const result = await this[loadSym](fullName, this.typeLibs, "types");
        this[busyCountSym].decrement();
        return result;
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