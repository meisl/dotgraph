"use strict";

var util = require('util');
var dotgraph = require('./lib/dotgraph');


function isPrimitive(v) {
    return (v === null) || ((typeof v) !== 'object') && ((typeof v) !== 'function');
}

function isNullOrUndefined(v) {
    return v === null || v === undefined;
}

function isDotPrototype(x) {
    return !isPrimitive(x) && x.hasOwnProperty('constructor');
}


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
    color:      "red",
    fontcolor:  "red",
    shape:      "ellipse",
});

g.nodeIf(isDotPrototype, { fillcolor: "lightgreen", style: "filled" });
g.nodeIf(x => isDotPrototype(x) && (x.constructor === Object), { rank: 4 });
g.nodeIf(x => isDotPrototype(x) && (x.constructor !== Object), { rank: 3 });

g.nodeIf(x => typeof x === "function",  { rank: 2 });
g.nodeIf(x => x === Function,           { rank: 0 });
g.nodeIf(x => x === Function.prototype, { rank: 1 });

g.nodeIf(x => typeof x === "object", {
    shape: "box",
});

g.nodeIf(isPrimitive, {
    rank:       5,
    color:      "purple",
    fontcolor:  "purple",
    fillcolor:  "lightgray",
    style:      "filled",
    shape:      "box",
});


g.edgeIf((from, to) =>
       (from === Function)           && (to === Function.prototype)
    || (from === Function.prototype) && (to === Object.prototype)
    || (from === Object.prototype)   && (to === null)
    , { weight: 10 }
);


g.func = function (f) {
    g.addPath(f, f.prototype).where({ color: "green" });
    g.addPath(f, Object.getPrototypeOf(f)).where({ style: "bold" });
    g.addPath(f.prototype, Object.getPrototypeOf(f.prototype)).where({ style: "bold" });
};


g.prim = function (v) {
    g.addNode({
        represents: v,
    });
    if (!isNullOrUndefined(v)) {
        g.addPath(v, Object.getPrototypeOf(v)).where({ style: "bold" })
    }
};

g.inst = function (ctor) {
    var args = Array.prototype.slice.call(arguments, 1),
        inst;
    switch (args.length) {
        case 0: inst = new ctor();
            break;
        case 1: inst = new ctor(args[0]);
            break;
        case 2: inst = new ctor(args[0], args[1]);
            break;
        case 3: inst = new ctor(args[0], args[1], args[2]);
            break;
        case 4: inst = new ctor(args[0], args[1], args[2], args[3]);
            break;
        default:
            throw new Error("not supported: synthetic constructor call with " + args.length + " arguments");
    }
    g.addNode({
        rank:   6,
        label:  'object\nnew ' + ctor.name + '(' + args.map(util.inspect).join(', ') + ')',
        shape:  "box",
        represents: inst,
    });
    g.addPath(inst, Object.getPrototypeOf(inst)).where({ style: "bold" });
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
g.func(Number);
g.func(Foo);
g.func(Bar);

g.prim(true);
g.prim(false);
g.prim("");
g.prim("foo");
g.prim(0);
g.prim(NaN);
g.prim(5);


g.inst(Boolean);
g.inst(Boolean,  true);
g.inst(Boolean, false);

g.inst(String);
g.inst(String, "");
g.inst(String, "foo");
g.inst(Number, 5);
g.inst(Number);
g.inst(Number, NaN);



//g.addPath(Function.prototype, Function.prototype.prototype).where({invis: true});


g.inst(Bar);
g.inst(Foo);


//g.addPath(String, Boolean, Object).where({ style: "invis" });
//g.addPath(Bar, Foo).where({ style: "invis" });


g.render({ output: 'example', format: 'svg', show: true });
//process.exit();

//https://chart.googleapis.com/chart?cht=gv%3Adot&chl=digraph%20poset%20%7B%0Af1%20%5Blabel%3Df1%5D%3B%0Af2%20%5Blabel%3Df2%5D%3B%0Af3%20%5Blabel%3Df3%5D%3B%0Af2%20-%3E%20f1%3B%0Af3%20-%3E%20f1%3B%0A%7D





console.log(JSON.stringify(NaN));
