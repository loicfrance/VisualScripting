const N_32bits = 2**32;

const toString = (x)=>x.toString();
const unsigned_modulo = (x,n)=> ((x%n)+n)%n;

const types = [
    {name: 'void', color: '#FFF', str: (x)=>"void"},
    {name: 'any', color: '#888', inheritFrom: 'void', str: toString, parse: s=>s},
    {name: 'object', color: '#F00', inheritFrom: 'any', str: toString, parse: JSON.parse},
    {name: 'string', color: '#0A0', inheritFrom: 'any', str: toString, parse: s=>s},
    {name: 'float', color: '#00F', inheritFrom: 'any', str: toString, parse: Number.parseFloat,
        castTo: {
        'int': (x)=>x|0
    }},
    {name: 'int', color: '#06F', inheritFrom: 'float', str: toString, parse: Number.parseInt,
        castTo: {
        'uint': unsigned_modulo
    }},
    {name: 'uint', color: '#09F', inheritFrom: 'int', str: toString,
        parse: s=>unsigned_modulo(Number.parseInt(s))
    }
];

/**
 * @param {function(new:FbpType, Map<string, FbpType>, object)} FbpType
 * @param {Map<string, FbpType>?} typesMap
 * @param {boolean?} override
 */
function getTypes(FbpType, typesMap = new Map(), override=true) {
    for(let type of types) {
        if(override || !typesMap.has(type.name))
            typesMap.set(type.name, new FbpType(typesMap, type));
    }
    return typesMap;
}
function getTypesList() {
    return types.map(t=>t.name);
}

export {
    getTypes,
    getTypesList
}