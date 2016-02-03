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

g.nodeIf(util.isFunction, {
    label:      'function\n\\N', // \N is dot-specific and means "name (id) of this node as a string"
    color:      "red",
    fontcolor:  "red",
    shape:      "ellipse",
});

g.nodeIf(x => typeof x === "function",  { rank: 2 });
g.nodeIf(x => x === Function,           { rank: 0 });
g.nodeIf(x => x === Function.prototype, { rank: 1, label: "function\nFunction.prototype" });

g.nodeIf(x => typeof x === "object", {
    shape: "box",
});

g.nodeIf(x => (x === null) || (typeof x !== "object" && typeof x !== "function"), {
    rank:       5,
    color:      "purple",
    fontcolor:  "purple",
    fillcolor:  "lightgray",
    style:      "filled",
    shape:      "box",
});


g.edgeIf((from, to) => (from !== null) && (from !== undefined) && (to === Object.getPrototypeOf(from)), {
    style: "bold",
});

g.edgeIf((from, to) => (typeof from === "function") && (to === from.prototype), {
    color: "green",
});

g.edgeIf((from, to) =>
       (from === Function)           && (to === Function.prototype)
    || (from === Function.prototype) && (to === Object.prototype)
    || (from === Object.prototype)   && (to === null)
    , { weight: 10 }
);


g.func = function (f) {
    var node;
    g.addNode({
        id:         f.name,
        represents: f,
    });
    g.proto(f.prototype);
    g.addPath(f, f.prototype);
};


g.proto = function (p) {
    var ctor = p.constructor,
        rank;
    if (ctor === Object) {
        rank = 4;
    } else {
        rank = 3;
    }
    g.addNode({
        rank:       rank,
        id:         ctor.name + '_proto',
        label:      (typeof p) + '\n' + ctor.name + '.prototype',
        represents: p,
    });
    g.addPath(p, Object.getPrototypeOf(p));
};

g.prim = function (v) {
    g.addNode({
        rank:       5,
        id:         util.isString(v) ? JSON.stringify(JSON.stringify(v)) : JSON.stringify(v),
        label:      (typeof v) + '\n\\N',
        represents: v,
    });
    if ((v !== null) && (v !== undefined)) {
        g.addPath(v, Object.getPrototypeOf(v))
    }
};

g.inst = function (inst) {
    var args = Array.prototype.slice.call(arguments, 1),
        ctor = inst.constructor,
        id   = '"new ' + ctor.name + '(' + args.map(util.inspect).join(', ') + ')"',
        node = g.addNode({
            rank:   6,
            id:     id,
            label:  (typeof inst) + '\n\\N',
            shape:  "box",
            represents: inst,
        });
    g.addPath(inst, Object.getPrototypeOf(inst));
    if (typeof inst.valueOf === "function") {
        g.addPath(inst, inst.valueOf()).where({ color: "purple" });
    }
};

function Foo() {
}
function Bar() {
}
util.inherits(Bar, Foo);

g.prim(null);
g.prim(undefined);

g.func(Object);
g.func(Function);
g.func(Boolean);
g.func(String);
g.func(Foo);
g.func(Bar);

g.prim(true);
g.prim(false);
g.prim("");
g.prim("foo");


g.inst(new Boolean(true),  true);
g.inst(new Boolean(false), false);

g.inst(new String());
g.inst(new String(""), "");
g.inst(new String("foo"), "foo");



[Object, Boolean, String].forEach(x =>
    g.addPath(x, Object.getPrototypeOf(x))
);

[Foo, Bar].forEach(x =>
    g.addPath(x, Object.getPrototypeOf(x))
);


//g.addPath(Function.prototype, Function.prototype.prototype).where({invis: true});


g.inst(new Bar());
g.inst(new Foo());


//g.addPath(String, Boolean, Object).where({ style: "invis" });
//g.addPath(Bar, Foo).where({ style: "invis" });


g.render({ output: 'example', format: 'svg', show: true });
//process.exit();

//https://chart.googleapis.com/chart?cht=gv%3Adot&chl=digraph%20poset%20%7B%0Af1%20%5Blabel%3Df1%5D%3B%0Af2%20%5Blabel%3Df2%5D%3B%0Af3%20%5Blabel%3Df3%5D%3B%0Af2%20-%3E%20f1%3B%0Af3%20-%3E%20f1%3B%0A%7D





