"use strict";

var dotgraph = require('./lib/dotgraph.js');


function _getID(o, where) {
    var id,
        count = 0;
    for (id in where) {
        if (where[id] === o) {
            return id;
        }
        count++;
    }
    return "n" + count;
}

function _explore(o, res) {
    var edges  = res.edges,
        nodes  = res.nodes,
        thisID = _getID(o, nodes),
        other,
        otherID,
        e;
    if (!(thisID in nodes)) {
        nodes[thisID] = o;
        for (e in edges) {
            try {
                other = edges[e].access(o);
                otherID = _explore(other, res);
                edges[e][thisID] = otherID;
            } catch (Error) {

            }
        }
    }
    return thisID;
}

function error(err) {
    err = err || Error;
    throw err.call(Object.create(err.prototype));
}

function explore(o) {
    var res = {
        nodes: {},
        edges: {
            "[[Prototype]]": Object.create(Object.prototype, {
                access: { value: x => Object.getPrototypeOf(x) }
            }),
            ".prototype": Object.create(Object.prototype, {
                access: { value: x => x.hasOwnProperty("prototype") ? x.prototype : error() }
            }),
            ".constructor": Object.create(Object.prototype, {
                access: { value: x => x.hasOwnProperty("constructor") ? x.constructor : error() }
            }),
            ".valueOf()": Object.create(Object.prototype, {
                access: { value: x => x.hasOwnProperty("valueOf") ? x.valueOf() : error() }
                //access: { value: x => (typeof x.valueOf === "function") ? x.valueOf() : error() }
            }),
            ".name": Object.create(Object.prototype, {
                access: { value: x => x.hasOwnProperty("name") ? x.name : error() }
            }),
        }
    };
    _explore(o, res);
    return res;
}




var g = dotgraph.label("Javascript prototypal inheritance")
                .fontsize(20)
;

g.func = function (f) {
    return g.addNode({
        rank:       f === Function ? 0 : 2,
        id:         f.name,
        label:      'function\n\\N', // \N is dot-specific and means "name (id) of this node as a string"
        represents: f,
        color:      "red",
        fontcolor:  "red",
    });
};

g.proto = function (p) {
    var ctor = p.constructor,
        rank;
    if (ctor === Function) {
        rank = 1;
    } else if (ctor === Object) {
        rank = 4;
    } else {
        rank = 3;
    }
    return g.addNode({
        rank:       rank,
        id:         ctor.name + '_proto',
        label:      (typeof p) + '\n' + ctor.name + '.prototype',
        represents: p,
        color:      "green",
        fontcolor:  "green",
        shape:      "box",
    });
    return node;
};

g.prim = function (v) {
    return g.addNode({
        rank:       6,
        id:         JSON.stringify(v),
        represents: v,
        color:      "purple",
        fontcolor:  "purple",
        shape:      "polygon",
        sides:      6,
   });
};

var funcF = g.func(Function);
var funcO = g.func(Object);

var funcB = g.func(Boolean);
var funcS = g.func(String);

var f_proto = g.proto(Function.prototype);
var o_proto = g.proto(Object.prototype);

var s_proto = g.proto(String.prototype);
var b_proto = g.proto(Boolean.prototype);

var _null = g.prim(null);

var _primTrue  = g.prim(true);
var _primFalse = g.prim(false);

var _oTrue  = g.addNode({ rank: 5, id: '"new Boolean(true)"',  label: 'object\n\\N', represents: new Boolean(true)  });
var _oFalse = g.addNode({ rank: 5, id: '"new Boolean(false)"', label: 'object\n\\N', represents: new Boolean(false) });

g.addPath(funcF, f_proto, o_proto, _null)
    .where({ weight: 10, style: "bold" });

g.addPath(funcO, f_proto).where({ style: "bold", weight: 5, });
g.addPath(funcB, f_proto).where({ style: "bold" });
g.addPath(funcS, f_proto).where({ style: "bold" });

g.addPath(s_proto, o_proto).where({ style: "bold" });
g.addPath(b_proto, o_proto).where({ style: "bold" });


g.addPath(funcO, o_proto).where({ color: "green", weight: 5 });
g.addPath(funcF, f_proto).where({ color: "green", weight: 5 });

g.addPath(funcB, b_proto).where({ color: "green", weight: 5 });
g.addPath(funcS, s_proto).where({ color: "green", weight: 5 });


g.addPath(_primTrue,  b_proto).where({ style: "bold", weight: 2, });
g.addPath(_primFalse, b_proto).where({ style: "bold", weight: 2, });

g.addPath(_oTrue,  b_proto).where({ style: "bold", weight: 2, });
g.addPath(_oFalse, b_proto).where({ style: "bold", weight: 2, });

g.addPath(_oTrue,  _primTrue).where({ color: "purple" });
g.addPath(_oFalse, _primFalse).where({ color: "purple" });


g.render({ output: '../test', format: 'svg', show: true });
//process.exit();



function toDot(x) {
    const colors = [
        "black",
        "green",
        "blue",
        "red",
        "pink",
    ];
    var res = "digraph {",
        n, o, i, c, e,
        ranks = [],
        attrs, label;
    for (n in x.nodes) {
        o = x.nodes[n];
        attrs = '';
        switch (typeof o) {
            case "function":
                attrs = 'label="function\\n' + o.name + '"'
                      + ',fontname="Arial"'
                      + ',name=' + JSON.stringify(util.inspect(o))
                ;
                break;
            case "object":
                attrs = 'label="' + (o === null ? "null" : "object") + '"'
                ;
                break;
            case "string":
                attrs = 'label="string\\n' + JSON.stringify(JSON.stringify(o)).substr(1)
                ;
                break;
            default:
                attrs = 'label="' + (typeof o) + "\\n" + util.inspect(o) + '"'
                ;
        }
        /*
        if (o !== null && o !== undefined) {
            Object.keys(o).forEach(e => {
                label += "\\n." + e + ": "; // + util.inspect(o[e]);
            });
        }
        */
        res += '\n    ' + n + '[' + attrs + '];';
    }
    res += "\n";
    i = 0;
    for (n in x.edges) {
        if (n !== ".constructor") {
            c = colors[i % colors.length];
            i++;
            label = '[label="' + n + '"]';
            res += "\n    "
                + "/* " + n + " */"
                + "\n    edge[color=" + c + ",fontcolor=" + c
                + (n === "[[Prototype]]" ? ",weight=10,style=bold" : ",weight=1,style=solid")
                + "];";
            for (e in x.edges[n]) {
                res += "\n    " + e + "->" + x.edges[n][e] + label + ";";
                label = "";
            }
            res += "\n";
        }
    }
    res += "\n}";
    return res;
}



