"use strict";

var util = require('util');
var dotgraph = require('./lib/dotgraph');


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
        represents: f,
    });
};

g.nodeIf(util.isFunction, {
    label:      'function\n\\N', // \N is dot-specific and means "name (id) of this node as a string"
    color:      "red",
    fontcolor:  "red",
    shape:      "ellipse",
});

g.nodeIf(x => typeof x === "object", {
    shape: "box",
});

g.nodeIf(x => (x === null) || (typeof x !== "object" && typeof x !== "function"), {
    rank:       6,
    color:      "purple",
    fontcolor:  "purple",
    shape:      "polygon",
    sides:      6,
});

g.nodeIf(x => typeof x === "function", { rank: 2 });
g.nodeIf(x => x === Function, { rank: 0 });
g.nodeIf(x => x === Function.prototype, { rank: 1 });

g.proto = function (p) {
    var ctor = p.constructor,
        rank;
    if (ctor === Object) {
        rank = 4;
    } else {
        rank = 3;
    }
    return g.addNode({
        rank:       rank,
        id:         ctor.name + '_proto',
        label:      (typeof p) + '\n' + ctor.name + '.prototype',
        represents: p,
    });
    return node;
};

g.prim = function (v) {
    return g.addNode({
        rank:       6,
        id:         util.isString(v) ? JSON.stringify(JSON.stringify(v)) : JSON.stringify(v),
        label:      (typeof v) + '\n\\N',
        represents: v,
   });
};

g.inst = function (inst) {
    var args = Array.prototype.slice.call(arguments, 1),
        ctor = inst.constructor,
        id   = '"new ' + ctor.name + '(' + args.map(util.inspect).join(', ') + ')"',
        node = g.addNode({ rank: 5, id: id, label: (typeof inst) + '\n\\N', shape: "box", represents: inst  });
    g.addPath(inst, Object.getPrototypeOf(inst)).where({ style: "bold", weight: 2 });
    if (typeof inst.valueOf === "function") {
        g.addPath(inst, inst.valueOf()).where({ color: "purple" });
    }
    return node;
};

g.func(Function);
g.func(Object);
g.func(Boolean);
g.func(String);

g.proto(Function.prototype);
g.proto(Object.prototype);
g.proto(String.prototype);
g.proto(Boolean.prototype);


g.prim(true);
g.prim(false);
g.prim(undefined);
g.prim(null);
g.prim("");
g.prim("foo");


g.inst(new Boolean(true),  true);
g.inst(new Boolean(false), false);

g.inst(new String());
g.inst(new String(""), "");
g.inst(new String("foo"), "foo");


g.addPath(Function, Function.prototype, Object.prototype, null)
    .where({ weight: 10, style: "bold" });

[Object, Boolean, String, Boolean.prototype, String.prototype, true, false].forEach(x =>
    g.addPath(x, Object.getPrototypeOf(x)).where({ style: "bold" })
);

[Object, Boolean, String, Function].forEach(x =>
    g.addPath(x, x.prototype).where({ color: "green" })
);


//g.addPath(funcS, funcO, funcB);

g.render({ output: 'example', format: 'svg', show: true });
//process.exit();

//https://chart.googleapis.com/chart?cht=gv%3Adot&chl=digraph%20poset%20%7B%0Af1%20%5Blabel%3Df1%5D%3B%0Af2%20%5Blabel%3Df2%5D%3B%0Af3%20%5Blabel%3Df3%5D%3B%0Af2%20-%3E%20f1%3B%0Af3%20-%3E%20f1%3B%0A%7D

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



