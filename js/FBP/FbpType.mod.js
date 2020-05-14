/**
 *
 */
class FbpType {
    /**
     * @constructor
     * @param {string} name
     * @param {FbpType[]}inherited
     * @param {FbpType[]}interfaces
     */
    constructor({
            name,
            inherited = undefined,
        }) {
        this.name = name;
        this.inherited = inherited;
    }
    inheritFrom(type) {
        if (type === this) //same type
            return true;
        if(this.inherited) {
            if(this.inherited instanceof FbpType) {
                return this.inherited.canBeCastTo(type);
            }
            else for (let i in this.inherited) {
                if(this.inherited.hasOwnProperty(i) && this.inherited[i].canBeCastTo(type))
                    return true;
            }
        }
        return false;
    }
    /**
     * @param {FbpType} type
     * @returns {boolean}
     */
    canBeCastTo(type) {
        return this.inheritFrom(type);
    }

}

export default FbpType;