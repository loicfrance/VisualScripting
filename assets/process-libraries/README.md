
# Process handlers library

## library file

A library file is a `_lib.json` file with the following format,where `[[X]]`
must be replaced with the appropriate value:
```json
{
  "lib-name": "[[library display name]]",
  "processes": {
    "[[process-id]]": {
      "name": "[[process display name]]",
      "src": "[[relative path to process handler .js file]]"
    },
    "[[other processes...]]": {}
  },
  "libraries": {
    "[[library-id]]": {
      "name": "[[library display name]]",
      "dir":"[[relative path to library directory]]"
    },
    "[[other libraries...]]": {}
  },
  "types": {
    "[[types-lib-id]]": {
      "name": "[[types library display name]]",
      "src": "[[relative path to types library .js file]]"
    },
    "[[other types libraries...]]": {}
  }
}
```

If there are no sub-libraries, processes or types libraries, the `"libraries"`,
`"processes"` or `"types"` can be omitted.

However, for each process and type library, the `"name"` and `"src"`
are mandatory, as well as `"name"` and `"dir"` for sub-libraries.

## Process handler file

### Functions
A process handler `.js` file is an es6 module exporting a set of function,
called on specific occasions :
  * `onCreate({...parameters})` (mandatory) : a process is created
    with this handler.
  * `onPacket(port: string, packet: Object)` (if event ports):
    an event (or active) port receives a packet.
  * `getPassThroughValue(port: string)` (if pass-through output ports):
    the value for a pass-through output port is requested.
  * `getParameters()` (if `onCreate` needs parameters): the list of
    parameters to create this handler is requested. See the **Parameters**
    section of this document for more information.
  * `checkParameters({...parameters}, fbpSheet)` (optional): return `null`
    if the specified parameters are correct, or a `string` describing
    the issue otherwise. The `fbpSheet` parameter is used to provide some context.
  * `onChange(key, ...args)` (optional): called when something has changed
    on the process. See the **Change** section of this document for the list
    of possible `key` values and the related arguments.
    

the functions `onCreate`, `onPacket`, `getPassThroughValue` and `onChange`
are called with the process bound to `this`.

All those functions must be exported to be used.

### Parameters

Parameters can be passed to `onCreate` to configure the process handler.
to make creating process handlers mor easy, the `getParameters` function
must provide information on the parameters.
the `getParameters` function returns an array of object with the following
format:
```js
function getParameters() {
    return [{
        key:"[[parameter key in the final object]]", name: "[[display name]]",
        type: "[[parameters selection type. See below]]",
        //[[other attribute(s) depending on the chosen type]]
        default: "[[default value]]"
    }, {
        //...
    }];
}
```
the type of the parameter determines the possible choices for the user.

The types and related attributes are as follows :
  * "**string**" for simple texts. No other attribute is required.
  * "**int**" for integer values. A `range: [min, max]` attribute can be specified.
    `Infinity` can be used as minimum or maximum.
  * "**float**" for floating-point values. Like **int**, a range can pe specified.
  * "**checkbox**" for boolean values. No other attribute is required.
  * "**select**" to select one value from a dropdown list. the `values` attribute
    is mandatory, and must look like this:
     ```
     {
        [[id_1]]: "[[display name]]",
        [[id_2]]: "[[display name]]",
        //...
     }
     ```
  * "**list**" to require a list of parameters with a specific shape.
    The `elements` attribute is mandatory and describes the attributes for each
    element, exactly like parameters. The `size` attribute is mandatory
    and specifies the minimum and maximum length of the list.

See existing process handlers for examples.

### Change

The `key` value passed to the `onChange` function tells the type of change that
happened and the content of remaining arguments. The possible values are :
  * `"port_changed"` when a port is changed. The next parameter is the involved port,
    and the next ones are the change key from the port and the related parameters.
  * `"attr"` when an additional attribute is set or removed. The next parameter
    is the attribute name. This can also be a `"port_change"` key.
  * `"connection"` for `"port_change"` keys only. Used when a port is connected to
    or disconnected from another port.
  

## Types

TODO
    